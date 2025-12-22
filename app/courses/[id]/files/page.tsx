'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';

const CourseFilesManager = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = Number(params?.id);
  const [outline, setOutline] = useState<any>({ units: [], course: {} });
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [unitTitle, setUnitTitle] = useState('');
  const [unitContent, setUnitContent] = useState('');
  const [giftText, setGiftText] = useState('');
  const [giftUnit, setGiftUnit] = useState<number | ''>('');
  const [quizType, setQuizType] = useState<'practice' | 'final'>('practice');
  const [passingScore, setPassingScore] = useState(70);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingResource, setEditingResource] = useState<any>(null);
  const [deletingResource, setDeletingResource] = useState<Record<number, boolean>>({});
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [deletingQuiz, setDeletingQuiz] = useState<Record<number, boolean>>({});
  
  // Assignment states
  const [showAssignmentForm, setShowAssignmentForm] = useState<Record<number, boolean>>({});
  const [assignmentTitle, setAssignmentTitle] = useState<Record<number, string>>({});
  const [assignmentDescription, setAssignmentDescription] = useState<Record<number, string>>({});
  const [assignmentDueDate, setAssignmentDueDate] = useState<Record<number, string>>({});
  const [creatingAssignment, setCreatingAssignment] = useState<Record<number, boolean>>({});
  const [userId, setUserId] = useState<number | null>(null);
  
  // Course introduction states
  const [showIntroSection, setShowIntroSection] = useState(false);
  const [introHeading, setIntroHeading] = useState('');
  const [introSubheading, setIntroSubheading] = useState('');
  const [introContent, setIntroContent] = useState('');
  const [introFiles, setIntroFiles] = useState<any[]>([]);
  const [uploadingIntro, setUploadingIntro] = useState(false);
  const [savingIntro, setSavingIntro] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const ol = await apiService.getCourseOutline(courseId);
    if (ol.success) {
      setOutline(ol);
      // Load introduction data
      if (ol.course) {
        setIntroHeading(ol.course.intro_heading || '');
        setIntroSubheading(ol.course.intro_subheading || '');
        setIntroContent(ol.course.intro_content || '');
      }
    }
    setLoading(false);
  };

  const loadIntroFiles = async () => {
    const result = await apiService.getIntroFiles(courseId);
    if (result.success) {
      setIntroFiles(result.files || []);
    }
  };

  useEffect(() => {
    // Get user role and ID from localStorage
    try {
      const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
      if (user?.role) {
        setUserRole(user.role);
      }
      if (user?.id) {
        setUserId(user.id);
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }, []);

  useEffect(() => { 
    if (courseId) {
      refresh();
      loadIntroFiles();
    }
  }, [courseId]);

  const createUnit = async () => {
    if (!unitTitle.trim()) return;
    await apiService.createUnit(courseId, { title: unitTitle, content: unitContent });
    setUnitTitle(''); 
    setUnitContent(''); 
    setShowAddForm(false);
    refresh();
  };

  const updateUnit = async () => {
    if (!editingUnit || !editingUnit.title?.trim()) return;
    await apiService.updateUnit(editingUnit.id, { 
      title: editingUnit.title, 
      content: editingUnit.content, 
      order_index: editingUnit.order_index 
    });
    setEditingUnit(null);
    refresh();
  };

  const deleteUnit = async (id: number) => {
    if (!confirm('Are you sure you want to delete this topic? This will also delete all associated files and quizzes.')) return;
    await apiService.deleteUnit(id);
    refresh();
  };

  const updateResource = async (resourceId: number, title: string) => {
    if (!title.trim()) return;
    try {
      const result = await apiService.updateResource(resourceId, title.trim());
      if (result.success) {
        setEditingResource(null);
        refresh();
      } else {
        alert(result.message || 'Error updating file');
      }
    } catch (error: any) {
      alert(error.message || 'Error updating file');
    }
  };

  const deleteResource = async (resourceId: number) => {
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) return;
    
    setDeletingResource({ ...deletingResource, [resourceId]: true });
    try {
      const result = await apiService.deleteResource(resourceId);
      if (result.success) {
        refresh();
      } else {
        alert(result.message || 'Error deleting file');
      }
    } catch (error: any) {
      alert(error.message || 'Error deleting file');
    } finally {
      setDeletingResource({ ...deletingResource, [resourceId]: false });
    }
  };

  const updateQuiz = async (quizId: number, title: string) => {
    if (!title.trim()) return;
    try {
      const result = await apiService.updateQuiz(quizId, title.trim());
      if (result.success) {
        setEditingQuiz(null);
        refresh();
      } else {
        alert(result.message || 'Error updating quiz');
      }
    } catch (error: any) {
      alert(error.message || 'Error updating quiz');
    }
  };

  const deleteQuiz = async (quizId: number) => {
    if (!confirm('Are you sure you want to delete this quiz? All quiz data will be permanently removed.')) return;
    
    setDeletingQuiz({ ...deletingQuiz, [quizId]: true });
    try {
      const result = await apiService.deleteQuiz(quizId);
      if (result.success) {
        refresh();
      } else {
        alert(result.message || 'Error deleting quiz');
      }
    } catch (error: any) {
      alert(error.message || 'Error deleting quiz');
    } finally {
      setDeletingQuiz({ ...deletingQuiz, [quizId]: false });
    }
  };

  const saveIntroduction = async () => {
    if (!introHeading.trim()) {
      alert('Please enter an introduction heading');
      return;
    }

    setSavingIntro(true);
    try {
      const result = await apiService.updateCourseIntro(courseId, introHeading, introSubheading, introContent);
      if (result.success) {
        alert('Introduction saved successfully!');
        refresh();
      } else {
        alert(result.message || 'Error saving introduction');
      }
    } catch (error: any) {
      alert(error.message || 'Error saving introduction');
    } finally {
      setSavingIntro(false);
    }
  };

  const handleIntroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIntro(true);
    try {
      const result = await apiService.uploadIntroFile(courseId, file);
      if (result.success) {
        alert('File uploaded successfully!');
        loadIntroFiles();
      } else {
        alert(result.message || 'Error uploading file');
      }
    } catch (error: any) {
      alert(error.message || 'Error uploading file');
    } finally {
      setUploadingIntro(false);
      e.target.value = ''; // Reset input
    }
  };

  const deleteIntroFile = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const result = await apiService.deleteIntroFile(fileId);
      if (result.success) {
        loadIntroFiles();
      } else {
        alert(result.message || 'Error deleting file');
      }
    } catch (error: any) {
      alert(error.message || 'Error deleting file');
    }
  };

  const toggleAssignmentRequirement = async (unitId: number, currentValue: boolean) => {
    try {
      const result = await apiService.toggleUnitAssignmentRequirement(unitId, !currentValue, 70);
      if (result.success) {
        alert(!currentValue ? 'Assignment requirement enabled! Students must complete and pass an assignment to unlock the next topic.' : 'Assignment requirement disabled.');
        refresh();
      } else {
        alert(result.message || 'Error updating requirement');
      }
    } catch (error: any) {
      alert(error.message || 'Error updating requirement');
    }
  };

  const createAssignment = async (unitId: number) => {
    const title = assignmentTitle[unitId];
    const description = assignmentDescription[unitId];
    const dueDate = assignmentDueDate[unitId];

    if (!title || !title.trim()) {
      alert('Please enter assignment title');
      return;
    }

    if (!userId) {
      alert('User not logged in');
      return;
    }

    setCreatingAssignment({ ...creatingAssignment, [unitId]: true });
    try {
      const result = await apiService.createAssignment(
        courseId,
        unitId,
        title,
        description || '',
        dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days from now
        userId
      );

      if (result.success) {
        setAssignmentTitle({ ...assignmentTitle, [unitId]: '' });
        setAssignmentDescription({ ...assignmentDescription, [unitId]: '' });
        setAssignmentDueDate({ ...assignmentDueDate, [unitId]: '' });
        setShowAssignmentForm({ ...showAssignmentForm, [unitId]: false });
        refresh();
        alert('Assignment created successfully!');
      } else {
        alert(result.message || 'Error creating assignment');
      }
    } catch (error: any) {
      alert(error.message || 'Error creating assignment');
    } finally {
      setCreatingAssignment({ ...creatingAssignment, [unitId]: false });
    }
  };

  const deleteAssignment = async (assignmentId: number) => {
    if (!confirm('Are you sure you want to delete this assignment? All submissions will be permanently removed.')) return;

    try {
      const result = await apiService.deleteAssignment(assignmentId);
      if (result.success) {
        refresh();
      } else {
        alert(result.message || 'Error deleting assignment');
      }
    } catch (error: any) {
      alert(error.message || 'Error deleting assignment');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => {
                    // Redirect based on user role
                    const dashboardPath = userRole === 'Tutor' 
                      ? '/dashboard/tutor' 
                      : userRole === 'Student' || userRole === 'ManagerStudent' || userRole === 'InstituteStudent'
                      ? '/dashboard/student'
                      : '/dashboard/admin';
                    router.push(dashboardPath);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Dashboard
                </button>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Course Content Manager</h1>
                  <p className="text-gray-600 mt-1">Organize learning materials, create topics, and manage assessments</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Course Introduction Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Course Introduction</h2>
                <p className="text-gray-500 text-sm">Add overview content that appears before course topics (always unlocked for students)</p>
              </div>
            </div>
            <button
              onClick={() => setShowIntroSection(!showIntroSection)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                showIntroSection 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
            >
              {showIntroSection ? 'Cancel' : (introHeading ? 'Edit Introduction' : 'Add Introduction')}
            </button>
          </div>

          {/* Display current introduction if exists and not editing */}
          {!showIntroSection && (introHeading || introFiles.length > 0) && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 space-y-4">
              {introHeading && (
                <div>
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">{introHeading}</h3>
                  {introSubheading && (
                    <p className="text-md font-medium text-purple-700 mb-2">{introSubheading}</p>
                  )}
                  {introContent && (
                    <p className="text-purple-800 text-sm leading-relaxed whitespace-pre-wrap">{introContent}</p>
                  )}
                </div>
              )}
              {introFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-purple-900">Attached Files:</p>
                  <div className="flex flex-wrap gap-2">
                    {introFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-purple-900">{file.file_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Introduction Edit Form */}
          {showIntroSection && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Introduction Heading <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  placeholder="e.g., Welcome to the Course, Course Overview, Getting Started..."
                  value={introHeading}
                  onChange={(e) => setIntroHeading(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub-heading
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  placeholder="e.g., Learn the fundamentals in 6 weeks, Master the basics..."
                  value={introSubheading}
                  onChange={(e) => setIntroSubheading(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Introduction Content
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-colors"
                  rows={6}
                  placeholder="Provide an overview, learning objectives, prerequisites, or any introductory information students should know..."
                  value={introContent}
                  onChange={(e) => setIntroContent(e.target.value)}
                />
              </div>

              {/* File Upload for Introduction */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attach Files (PDFs, Documents)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-lg cursor-pointer transition-colors">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-700">Choose File</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                      onChange={handleIntroFileUpload}
                      disabled={uploadingIntro}
                    />
                  </label>
                  {uploadingIntro && (
                    <span className="text-sm text-purple-600">Uploading...</span>
                  )}
                </div>
              </div>

              {/* Display uploaded introduction files */}
              {introFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Uploaded Files:</p>
                  <div className="space-y-2">
                    {introFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.file_size / 1024).toFixed(2)} KB • {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={file.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="View file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </a>
                          <button
                            onClick={() => deleteIntroFile(file.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={saveIntroduction}
                  disabled={!introHeading.trim() || savingIntro}
                  className="px-6 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingIntro ? 'Saving...' : 'Save Introduction'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Topic Management */}
          <div className="lg:col-span-2 space-y-8">
            {/* Add Topic Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Create New Topic</h2>
                  <p className="text-gray-500 text-sm">Structure your course content with organized topics</p>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    showAddForm 
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                      : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                  }`}
                >
                  {showAddForm ? 'Cancel' : 'New Topic'}
                </button>
              </div>
              
              {showAddForm && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topic Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent transition-colors"
                      placeholder="Enter topic title..."
                      value={unitTitle}
                      onChange={(e) => setUnitTitle(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent resize-none transition-colors"
                      rows={3}
                      placeholder="Provide a brief description of this topic..."
                      value={unitContent}
                      onChange={(e) => setUnitContent(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={createUnit}
                      disabled={!unitTitle.trim()}
                      className="px-6 py-3 bg-[#11CCEF] text-white rounded-lg font-medium hover:bg-[#0daed9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create Topic
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Topics List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Course Topics</h2>
                  <p className="text-gray-500 text-sm">Manage your course structure and content</p>
                </div>
                <div className="text-sm text-gray-500">
                  {outline.units?.length || 0} topics
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-3 border-[#11CCEF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 text-sm">Loading course content...</p>
                </div>
              ) : outline.units?.length ? (
                <div className="space-y-4">
                  {outline.units.map((unit: any, index: number) => (
                    <div
                      key={unit.id}
                      className="border border-gray-200 rounded-xl bg-white hover:shadow-sm transition-shadow"
                    >
                      <div className="p-6">
                        {editingUnit?.id === unit.id ? (
                          <div className="space-y-4">
                            <input
                              type="text"
                              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent font-semibold"
                              value={editingUnit.title}
                              onChange={(e) => setEditingUnit({ ...editingUnit, title: e.target.value })}
                            />
                            <textarea
                              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent resize-none"
                              rows={3}
                              value={editingUnit.content}
                              onChange={(e) => setEditingUnit({ ...editingUnit, content: e.target.value })}
                            />
                            <div className="flex justify-end gap-3 pt-2">
                              <button
                                onClick={() => setEditingUnit(null)}
                                className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={updateUnit}
                                className="px-5 py-2.5 bg-[#11CCEF] text-white rounded-lg font-medium hover:bg-[#0daed9] transition-colors"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Unit Header */}
                            <div className="flex items-start justify-between mb-6">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 font-semibold text-sm">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{unit.title}</h3>
                                  {unit.content && (
                                    <p className="text-gray-600 text-sm leading-relaxed">{unit.content}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => setEditingUnit({ ...unit })}
                                  className="p-2 text-gray-500 hover:text-[#11CCEF] hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit topic"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteUnit(unit.id)}
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete topic"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* File Upload Section */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-gray-900">Upload Materials</h4>
                                <span className="text-xs text-gray-500">PDF, Word, PowerPoint, or Video files</span>
                              </div>
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="file"
                                  accept="application/pdf,video/mp4,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploading({ ...uploading, [unit.id]: true });
                                    try {
                                      await apiService.uploadUnitResource(unit.id, file);
                                      refresh();
                                      e.target.value = '';
                                    } catch (error: any) {
                                      alert(error.message || 'Error uploading file');
                                    } finally {
                                      setUploading({ ...uploading, [unit.id]: false });
                                    }
                                  }}
                                  className="hidden"
                                />
                                <span className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                                  uploading[unit.id] 
                                    ? 'bg-gray-600 text-white' 
                                    : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                                }`}>
                                  {uploading[unit.id] ? 'Uploading...' : 'Upload File'}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {uploading[unit.id] ? 'Processing...' : 'Select file to upload'}
                                </span>
                              </label>
                            </div>

                            {/* Files List */}
                            <div className="mb-6">
                              <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Learning Materials ({unit.resources?.length || 0})
                              </h4>
                              {unit.resources?.length ? (
                                <div className="space-y-2">
                                  {unit.resources.map((resource: any) => {
                                    const fileName = resource.file_name || resource.file_path || '';
                                    const isVideo = fileName.includes('.mp4');
                                    const isWord = fileName.includes('.doc') || fileName.includes('.docx');
                                    const isPowerPoint = fileName.includes('.ppt') || fileName.includes('.pptx');
                                    const isPDF = fileName.includes('.pdf');
                                    const isEditing = editingResource?.id === resource.id;
                                    const isDeleting = deletingResource[resource.id];

                                    // Determine icon and colors
                                    let icon = '📄';
                                    let bgColor = 'bg-blue-100';
                                    let textColor = 'text-blue-600';
                                    let fileType = 'Document';
                                    
                                    if (isVideo) {
                                      icon = '🎥';
                                      bgColor = 'bg-red-100';
                                      textColor = 'text-red-600';
                                      fileType = 'Video';
                                    } else if (isWord) {
                                      icon = '📝';
                                      bgColor = 'bg-blue-100';
                                      textColor = 'text-blue-600';
                                      fileType = 'Word Document';
                                    } else if (isPowerPoint) {
                                      icon = '📊';
                                      bgColor = 'bg-orange-100';
                                      textColor = 'text-orange-600';
                                      fileType = 'PowerPoint';
                                    } else if (isPDF) {
                                      icon = '📄';
                                      bgColor = 'bg-red-100';
                                      textColor = 'text-red-600';
                                      fileType = 'PDF';
                                    }

                                    return (
                                      <div
                                        key={resource.id}
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                      >
                                        {isEditing ? (
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className={`w-8 h-8 rounded flex items-center justify-center ${bgColor} ${textColor}`}>
                                              {icon}
                                            </div>
                                            <input
                                              type="text"
                                              className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent"
                                              value={editingResource.title}
                                              onChange={(e) => setEditingResource({ ...editingResource, title: e.target.value })}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') updateResource(resource.id, editingResource.title);
                                                if (e.key === 'Escape') setEditingResource(null);
                                              }}
                                              autoFocus
                                            />
                                            <div className="flex gap-1">
                                              <button
                                                onClick={() => updateResource(resource.id, editingResource.title)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                              </button>
                                              <button
                                                onClick={() => setEditingResource(null)}
                                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex items-center gap-3 flex-1">
                                              <div className={`w-8 h-8 rounded flex items-center justify-center ${bgColor} ${textColor}`}>
                                                {icon}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 text-sm truncate">
                                                  {resource.title || resource.file_name || 'Untitled'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {fileType}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => setEditingResource({ ...resource })}
                                                className="p-2 text-gray-500 hover:text-[#11CCEF] hover:bg-blue-50 rounded-lg transition-colors"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                              </button>
                                              <button
                                                onClick={() => deleteResource(resource.id)}
                                                disabled={isDeleting}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                                  <p className="text-gray-500 text-sm">No materials uploaded</p>
                                </div>
                              )}
                            </div>

                            {/* Quizzes List */}
                            <div className="mb-6">
                              <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Quizzes ({unit.quizzes?.length || 0})
                              </h4>
                              {unit.quizzes?.length ? (
                                <div className="space-y-2">
                                  {unit.quizzes.map((quiz: any) => {
                                    const isEditing = editingQuiz?.id === quiz.id;
                                    const isDeleting = deletingQuiz[quiz.id];

                                    return (
                                      <div
                                        key={quiz.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                                      >
                                        {isEditing ? (
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded flex items-center justify-center">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                            </div>
                                            <input
                                              type="text"
                                              className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#E51791] focus:border-transparent"
                                              value={editingQuiz.title}
                                              onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') updateQuiz(quiz.id, editingQuiz.title);
                                                if (e.key === 'Escape') setEditingQuiz(null);
                                              }}
                                              autoFocus
                                            />
                                            <div className="flex gap-1">
                                              <button
                                                onClick={() => updateQuiz(quiz.id, editingQuiz.title)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                              </button>
                                              <button
                                                onClick={() => setEditingQuiz(null)}
                                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex items-center gap-3 flex-1">
                                              <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                              </div>
                                              <span className="font-medium text-gray-900 text-sm">{quiz.title}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => setEditingQuiz({ ...quiz })}
                                                className="p-2 text-gray-500 hover:text-[#E51791] hover:bg-pink-50 rounded-lg transition-colors"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                              </button>
                                              <button
                                                onClick={() => deleteQuiz(quiz.id)}
                                                disabled={isDeleting}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                                  <p className="text-gray-500 text-sm">No quizzes added</p>
                                </div>
                              )}
                            </div>

                            {/* Assignments Section */}
                            <div className="border-t border-gray-200 pt-6">
                              {/* Assignments List */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <h5 className="font-medium text-gray-900 flex items-center gap-2">
                                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                      </svg>
                                      Assignments
                                    </h5>
                                    <p className="text-xs text-gray-500 ml-7">Add assignments for students to complete ({unit.assignments?.length || 0})</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => toggleAssignmentRequirement(unit.id, unit.requires_assignment || false)}
                                      className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
                                        unit.requires_assignment
                                          ? 'bg-green-500 text-white hover:bg-green-600'
                                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                      }`}
                                      title={unit.requires_assignment ? 'Click to remove lock - students can access next topic freely' : 'Click to lock - students must pass assignment to unlock next topic'}
                                    >
                                      {unit.requires_assignment ? '🔒 Locks Next' : '🔓 Optional'}
                                    </button>
                                    <button
                                      onClick={() => setShowAssignmentForm({ ...showAssignmentForm, [unit.id]: !showAssignmentForm[unit.id] })}
                                      className="text-sm px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                    >
                                      {showAssignmentForm[unit.id] ? 'Cancel' : '+ Add'}
                                    </button>
                                  </div>
                                </div>
                                
                                {unit.requires_assignment && (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                                    <p className="text-xs text-green-800">
                                      🔒 <strong>Lock Active:</strong> Students must pass an assignment here (70%+) to unlock the next topic.
                                    </p>
                                  </div>
                                )}

                                {/* Assignment Form */}
                                {showAssignmentForm[unit.id] && (
                                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-3 space-y-3">
                                    <input
                                      type="text"
                                      placeholder="Assignment Title *"
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                      value={assignmentTitle[unit.id] || ''}
                                      onChange={(e) => setAssignmentTitle({ ...assignmentTitle, [unit.id]: e.target.value })}
                                    />
                                    <textarea
                                      placeholder="Description (optional)"
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                                      rows={2}
                                      value={assignmentDescription[unit.id] || ''}
                                      onChange={(e) => setAssignmentDescription({ ...assignmentDescription, [unit.id]: e.target.value })}
                                    />
                                    <input
                                      type="datetime-local"
                                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                      value={assignmentDueDate[unit.id] || ''}
                                      onChange={(e) => setAssignmentDueDate({ ...assignmentDueDate, [unit.id]: e.target.value })}
                                    />
                                    <button
                                      onClick={() => createAssignment(unit.id)}
                                      disabled={creatingAssignment[unit.id] || !assignmentTitle[unit.id]}
                                      className="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                    >
                                      {creatingAssignment[unit.id] ? 'Creating...' : 'Create Assignment'}
                                    </button>
                                  </div>
                                )}

                                {/* Assignments Display */}
                                {unit.assignments && unit.assignments.length > 0 ? (
                                  <div className="space-y-2">
                                    {unit.assignments.map((assignment: any) => (
                                      <div
                                        key={assignment.id}
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          <div className="w-8 h-8 bg-green-100 text-green-600 rounded flex items-center justify-center">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 text-sm truncate">{assignment.title}</div>
                                            {assignment.due_date && (
                                              <div className="text-xs text-gray-500">
                                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => deleteAssignment(assignment.id)}
                                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Delete assignment"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded-lg">
                                    <p className="text-gray-500 text-xs">No assignments yet</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Topics Created</h3>
                  <p className="text-gray-500 mb-6">Start building your course structure</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="px-6 py-3 bg-[#11CCEF] text-white rounded-lg font-medium hover:bg-[#0daed9] transition-colors"
                  >
                    Create First Topic
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="space-y-8">
            {/* Import Quiz Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#E51791] bg-opacity-10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#E51791]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Import Quiz</h2>
                  <p className="text-gray-500 text-sm">Add quizzes using GIFT format</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quiz Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E51791] focus:border-transparent text-sm"
                    value={quizType}
                    onChange={(e) => setQuizType(e.target.value as 'practice' | 'final')}
                  >
                    <option value="practice">📝 Practice Quiz (Not tracked)</option>
                    <option value="final">🎯 Final Quiz (Tracked & unlocks next unit)</option>
                  </select>
                </div>

                {quizType === 'final' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Passing Score (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E51791] focus:border-transparent text-sm"
                      value={passingScore}
                      onChange={(e) => setPassingScore(Number(e.target.value))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Students must score at least this to unlock the next unit</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attach to Topic
                  </label>
                  <select
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E51791] focus:border-transparent text-sm"
                    value={giftUnit}
                    onChange={(e) => setGiftUnit(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select topic (optional)</option>
                    {outline.units?.map((unit: any) => (
                      <option key={unit.id} value={unit.id}>{unit.title}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GIFT Format Text
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E51791] focus:border-transparent resize-none text-sm font-mono"
                    rows={6}
                    placeholder="Paste GIFT format quiz content here..."
                    value={giftText}
                    onChange={(e) => setGiftText(e.target.value)}
                  />
                </div>
                
                <button
                  onClick={async () => {
                    if (!giftText.trim()) {
                      alert('Please enter GIFT format text');
                      return;
                    }
                    await apiService.importGift(courseId, giftText, 'Imported Quiz', giftUnit || undefined, quizType, passingScore);
                    setGiftText('');
                    setQuizType('practice');
                    setPassingScore(70);
                    refresh();
                  }}
                  disabled={!giftText.trim()}
                  className="w-full px-4 py-2.5 bg-[#E51791] text-white rounded-lg font-medium hover:bg-[#c3147f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Quiz
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Course Overview</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Total Topics</span>
                  <span className="font-semibold text-gray-900">{outline.units?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Learning Materials</span>
                  <span className="font-semibold text-gray-900">
                    {outline.units?.reduce((acc: number, unit: any) => acc + (unit.resources?.length || 0), 0) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Quizzes</span>
                  <span className="font-semibold text-gray-900">
                    {outline.units?.reduce((acc: number, unit: any) => acc + (unit.quizzes?.length || 0), 0) || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseFilesManager;