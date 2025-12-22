'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { showToast } from '@/app/components/Toast';

interface QualUnit {
  id: number;
  unit_number: number;
  title: string;
  content: string;
  is_optional: boolean;
  unlock_condition: string;
  enable_assignment_submission: boolean;
  enable_presentation_submission: boolean;
  deadline: string | null;
  welcome_message: string;
  disclaimer: string;
  general_information: string;
}

const ManageQualificationCourse = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.courseId as string);
  
  const [userRole, setUserRole] = useState<'Admin' | 'Tutor' | 'Student' | null>(null);
  const [course, setCourse] = useState<any>(null);
  const [units, setUnits] = useState<QualUnit[]>([]);
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  
  // New Unit Form
  const [showNewUnitForm, setShowNewUnitForm] = useState(false);
  const [newUnit, setNewUnit] = useState({
    title: '',
    content: '',
    is_optional: false,
    unlock_condition: 'none',
    enable_assignment_submission: true,
    enable_presentation_submission: false,
    enable_quiz: false,
    deadline: '',
    disclaimer: '',
    general_information: ''
  });
  
  // Lectures system
  const [lectures, setLectures] = useState<Array<{
    title: string;
    description: string;
    files: File[];
  }>>([]);
  
  // Additional readings
  const [additionalReadings, setAdditionalReadings] = useState<File[]>([]);
  
  // Assignment and Presentation Briefs
  const [assignmentBrief, setAssignmentBrief] = useState({
    heading: '',
    description: '',
    importantNote: '',
    gradingType: 'pass_fail' as 'pass_fail' | 'score',
    passingScore: 70
  });
  
  const [assignmentBriefFiles, setAssignmentBriefFiles] = useState<File[]>([]);
  
  const [presentationBrief, setPresentationBrief] = useState({
    heading: '',
    description: '',
    importantNote: ''
  });
  
  // Quiz form state
  const [quizTitle, setQuizTitle] = useState('');
  const [quizGiftFormat, setQuizGiftFormat] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [addingUnit, setAddingUnit] = useState(false);
  const [deletingUnitId, setDeletingUnitId] = useState<number | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const role = user?.role || null;
    setUserRole(role as 'Admin' | 'Tutor' | 'Student' | null);
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      // Add cache-busting timestamp to ensure fresh data after deletion
      const response = await apiService.getQualificationCourse(courseId);
      
      if (response.success) {
        setCourse(response.course);
        // Sort units by order_index in ascending order
        const sortedUnits = (response.units || []).sort((a: any, b: any) => {
          return (a.order_index || 0) - (b.order_index || 0);
        });
        setUnits(sortedUnits);
        console.log('[Manage] Loaded', sortedUnits.length, 'units for course', courseId);
      } else {
        showToast('Failed to load course data', 'error');
      }
    } catch (error) {
      console.error('Error loading course:', error);
      showToast('Error loading course data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Lecture management
  const addLecture = () => {
    setLectures([...lectures, { title: '', description: '', files: [] }]);
  };

  const removeLecture = (index: number) => {
    setLectures(lectures.filter((_, i) => i !== index));
  };

  const updateLecture = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...lectures];
    updated[index][field] = value;
    setLectures(updated);
  };

  const handleLectureFiles = (lectureIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const updated = [...lectures];
    updated[lectureIndex].files = [...updated[lectureIndex].files, ...files];
    setLectures(updated);
  };

  const removeLectureFile = (lectureIndex: number, fileIndex: number) => {
    const updated = [...lectures];
    updated[lectureIndex].files = updated[lectureIndex].files.filter((_, i) => i !== fileIndex);
    setLectures(updated);
  };

  // Additional readings
  const handleAdditionalReadings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAdditionalReadings(prev => [...prev, ...files]);
  };

  const removeAdditionalReading = (index: number) => {
    setAdditionalReadings(prev => prev.filter((_, i) => i !== index));
  };

  // Assignment brief files
  const handleAssignmentBriefFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAssignmentBriefFiles(prev => [...prev, ...files]);
  };

  const removeAssignmentBriefFile = (index: number) => {
    setAssignmentBriefFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return '📄';
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return '📝';
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return '📊';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return '📈';
    if (lower.endsWith('.zip') || lower.endsWith('.rar')) return '📦';
    if (lower.endsWith('.mp4') || lower.endsWith('.avi') || lower.endsWith('.mov')) return '🎥';
    if (lower.endsWith('.mp3') || lower.endsWith('.wav')) return '🎵';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif')) return '🖼️';
    return '📎';
  };

  const handleAddUnit = async () => {
    if (!newUnit.title) {
      showToast('Please enter unit title', 'warning');
      return;
    }

    if (addingUnit) return; // Prevent double-click

    try {
      setAddingUnit(true);
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append('title', newUnit.title);
      formData.append('content', newUnit.content);
      formData.append('order_index', (units.length + 1).toString());
      formData.append('is_optional', newUnit.is_optional.toString());
      formData.append('unlock_condition', newUnit.unlock_condition);
      formData.append('enable_assignment_submission', newUnit.enable_assignment_submission.toString());
      formData.append('enable_presentation_submission', newUnit.enable_presentation_submission.toString());
      formData.append('enable_quiz', newUnit.enable_quiz.toString());
      formData.append('deadline', newUnit.deadline || '');
      formData.append('disclaimer', newUnit.disclaimer);
      formData.append('general_information', newUnit.general_information);

      // Append lectures data
      formData.append('lectures', JSON.stringify(lectures.map((lec, idx) => ({
        title: lec.title,
        description: lec.description,
        fileCount: lec.files.length
      }))));

      // Append lecture files
      lectures.forEach((lecture, lectureIndex) => {
        lecture.files.forEach((file) => {
          formData.append(`lecture_${lectureIndex}_files`, file);
        });
      });

      // Append additional reading files
      additionalReadings.forEach((file) => {
        formData.append('reading_files', file);
      });

      // Append assignment brief if enabled
      if (newUnit.enable_assignment_submission) {
        formData.append('assignment_brief_heading', assignmentBrief.heading);
        formData.append('assignment_brief_description', assignmentBrief.description);
        formData.append('assignment_brief_important_note', assignmentBrief.importantNote);
        formData.append('assignment_brief_grading_type', assignmentBrief.gradingType);
        formData.append('assignment_brief_passing_score', assignmentBrief.passingScore.toString());
        
        // Append assignment brief files
        assignmentBriefFiles.forEach((file) => {
          formData.append('assignment_brief_files', file);
        });
      }

      // Append presentation brief if enabled
      if (newUnit.enable_presentation_submission) {
        formData.append('presentation_brief_heading', presentationBrief.heading);
        formData.append('presentation_brief_description', presentationBrief.description);
        formData.append('presentation_brief_important_note', presentationBrief.importantNote);
      }

      // Append quiz if enabled
      if (newUnit.enable_quiz) {
        formData.append('quiz_title', quizTitle);
        formData.append('quiz_type', 'practice');
        formData.append('quiz_gift_format', quizGiftFormat);
        formData.append('quiz_passing_score', '70'); // Default passing score
      }

      console.log('[Add Unit] Lectures:', lectures.length, ', Readings:', additionalReadings.length, ', Assignment Brief Files:', assignmentBriefFiles.length);
      console.log('[Add Unit] FormData keys:', Array.from(formData.keys()));
      console.log('[Add Unit] Calling API with courseId:', courseId);

      const response = await apiService.createQualificationUnit(courseId, formData);
      
      if (response.success) {
        showToast('Unit added successfully!', 'success');
        setShowNewUnitForm(false);
        setNewUnit({
          title: '',
          content: '',
          is_optional: false,
          unlock_condition: 'none',
          enable_assignment_submission: true,
          enable_presentation_submission: false,
          enable_quiz: false,
          deadline: '',
          disclaimer: '',
          general_information: ''
        });
        setLectures([]);
        setAdditionalReadings([]);
        setAssignmentBriefFiles([]);
        setAssignmentBrief({
          heading: '',
          description: '',
          importantNote: '',
          gradingType: 'pass_fail',
          passingScore: 70
        });
        setPresentationBrief({
          heading: '',
          description: '',
          importantNote: ''
        });
        setQuizTitle('');
        setQuizGiftFormat('');
        loadCourseData();
      }
    } catch (error: any) {
      console.error('Error adding unit:', error);
      
      if (error?.message?.includes('401') || error?.message?.includes('authorization')) {
        showToast('Your session has expired. Please log in again.', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        showToast(error?.message || 'Error adding unit', 'error');
      }
    } finally {
      setAddingUnit(false);
    }
  };

  const handleDeleteUnit = async (unitId: number) => {
    if (!confirm('Are you sure you want to delete this unit? This will remove all associated topics, files, and assignments.')) {
      return;
    }

    if (deletingUnitId === unitId) return; // Prevent double-click

    try {
      setDeletingUnitId(unitId);
      const response = await apiService.deleteQualificationUnit(unitId);
      
      if (response.success) {
        showToast('Unit deleted successfully!', 'success');
        loadCourseData(); // Reload the course data to refresh the units list
      } else {
        showToast('Failed to delete unit: ' + (response.message || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error deleting unit:', error);
      showToast('Error deleting unit: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    } finally {
      setDeletingUnitId(null);
    }
  };

  const handleUnitClick = (unitId: number) => {
    // Navigate to unit editor page (to be created)
    router.push(`/dashboard/${userRole?.toLowerCase()}/qualification/units/${unitId}/edit`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading course...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Tutor']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-t-4 border-purple-600">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <span className="text-4xl">🎓</span>
                  {course?.title || 'Qualification Course'}
                </h1>
                <p className="text-gray-600 mt-2">
                  {course?.description || 'Manage units, topics, and assignments for this qualification course'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/dashboard/${userRole?.toLowerCase()}/qualification/${courseId}/view`)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  👁️ View Course
                </button>
                <button
                  onClick={() => window.location.href = `/dashboard/${userRole?.toLowerCase()}`}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ← Back to Dashboard
                </button>
              </div>
            </div>

            {/* Course Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{units.length}</div>
                <div className="text-sm text-gray-600">Total Units</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {units.filter(u => u.is_optional).length}
                </div>
                <div className="text-sm text-gray-600">Optional Units</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {units.filter(u => u.enable_assignment_submission).length}
                </div>
                <div className="text-sm text-gray-600">Units with Assignments</div>
              </div>
            </div>
          </div>

          {/* Units List */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Course Units</h2>
              <button
                onClick={() => setShowNewUnitForm(!showNewUnitForm)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl"
              >
                {showNewUnitForm ? '✕ Cancel' : '+ Add New Unit'}
              </button>
            </div>

            {/* New Unit Form */}
            {showNewUnitForm && (
              <div className="mb-6 p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Unit</h3>
                
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Unit Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newUnit.title}
                      onChange={(e) => setNewUnit({...newUnit, title: e.target.value})}
                      placeholder="e.g., Unit 1: Introduction to Business Communication"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Unit Description/Content
                    </label>
                    <textarea
                      value={newUnit.content}
                      onChange={(e) => setNewUnit({...newUnit, content: e.target.value})}
                      rows={3}
                      placeholder="Brief overview of this unit..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Unit Settings Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Optional Unit */}
                    <div className="flex items-center space-x-2 p-4 bg-white rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id="optional"
                        checked={newUnit.is_optional}
                        onChange={(e) => setNewUnit({...newUnit, is_optional: e.target.checked})}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <label htmlFor="optional" className="text-sm font-semibold text-gray-700 cursor-pointer">
                        Optional Unit (not required for completion)
                      </label>
                    </div>

                    {/* Unlock Condition */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Unlock Condition
                      </label>
                      <select
                        value={newUnit.unlock_condition}
                        onChange={(e) => setNewUnit({...newUnit, unlock_condition: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="none">Unlocked by default</option>
                        <option value="assignment_pass">After passing assignment</option>
                        <option value="final_quiz_pass">After passing final quiz</option>
                        <option value="manual">Manual unlock by tutor</option>
                      </select>
                    </div>
                  </div>

                  {/* Submission Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2 p-4 bg-white rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id="assignment"
                        checked={newUnit.enable_assignment_submission}
                        onChange={(e) => setNewUnit({...newUnit, enable_assignment_submission: e.target.checked})}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <label htmlFor="assignment" className="text-sm font-semibold text-gray-700 cursor-pointer">
                        Enable Assignment Submission
                      </label>
                    </div>

                    <div className="flex items-center space-x-2 p-4 bg-white rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id="presentation"
                        checked={newUnit.enable_presentation_submission}
                        onChange={(e) => setNewUnit({...newUnit, enable_presentation_submission: e.target.checked})}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <label htmlFor="presentation" className="text-sm font-semibold text-gray-700 cursor-pointer">
                        Enable Presentation Submission
                      </label>
                    </div>

                    <div className="flex items-center space-x-2 p-4 bg-white rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id="quiz"
                        checked={newUnit.enable_quiz}
                        onChange={(e) => setNewUnit({...newUnit, enable_quiz: e.target.checked})}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <label htmlFor="quiz" className="text-sm font-semibold text-gray-700 cursor-pointer">
                        Enable Quiz (Practice Only - Does Not Unlock Units)
                      </label>
                    </div>
                  </div>

                  {/* Deadline */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Deadline (Optional)
                    </label>
                    <input
                      type="date"
                      value={newUnit.deadline}
                      onChange={(e) => setNewUnit({...newUnit, deadline: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Lectures Section */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        📚 Lectures <span className="text-gray-500 text-xs">(Optional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={addLecture}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        + Add Lecture
                      </button>
                    </div>
                    
                    {lectures.length === 0 ? (
                      <p className="text-xs text-gray-600">No lectures added yet. Click "Add Lecture" to create one.</p>
                    ) : (
                      <div className="space-y-3">
                        {lectures.map((lecture, lectureIndex) => (
                          <div key={lectureIndex} className="bg-white p-4 rounded-lg border border-blue-200">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-gray-900">Lecture {lectureIndex + 1}</h4>
                              <button
                                onClick={() => removeLecture(lectureIndex)}
                                className="text-red-500 hover:text-red-700 text-sm font-bold"
                              >
                                ✕ Remove
                              </button>
                            </div>
                            
                            <input
                              type="text"
                              placeholder="Lecture title (e.g., Introduction to Marketing)"
                              value={lecture.title}
                              onChange={(e) => updateLecture(lectureIndex, 'title', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm"
                            />
                            
                            <textarea
                              placeholder="Lecture description"
                              value={lecture.description}
                              onChange={(e) => updateLecture(lectureIndex, 'description', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm"
                            />
                            
                            <div>
                              <label className="text-xs text-gray-600 block mb-1">📎 Lecture Files (PDF, Documents, Videos)</label>
                              <input
                                type="file"
                                multiple
                                onChange={(e) => handleLectureFiles(lectureIndex, e)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
                              />
                              {lecture.files.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {lecture.files.map((file, fileIndex) => (
                                    <div key={fileIndex} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                      <span className="text-xs flex items-center gap-2">
                                        <span>{getFileIcon(file.name)}</span>
                                        <span className="text-gray-700">{file.name}</span>
                                        <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                                      </span>
                                      <button
                                        onClick={() => removeLectureFile(lectureIndex, fileIndex)}
                                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Additional Reading Files */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📚 Additional Reading <span className="text-gray-500 text-xs">(Optional - Multiple files allowed)</span>
                    </label>
                    <p className="text-xs text-gray-600 mb-2">Supplementary reading materials, references, guides</p>
                    <input
                      type="file"
                      multiple
                      onChange={handleAdditionalReadings}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    {additionalReadings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {additionalReadings.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm flex items-center gap-2">
                              <span>{getFileIcon(file.name)}</span>
                              <span className="text-gray-700">{file.name}</span>
                              <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <button
                              onClick={() => removeAdditionalReading(index)}
                              className="text-red-500 hover:text-red-700 text-sm font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assignment Brief (shown only if assignment submission is enabled) */}
                  {newUnit.enable_assignment_submission && (
                    <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        📝 Assignment Brief
                      </h3>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Assignment heading (e.g., Unit 1 Assignment)"
                          value={assignmentBrief.heading}
                          onChange={(e) => setAssignmentBrief({...assignmentBrief, heading: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <textarea
                          placeholder="Assignment description (what students need to do)"
                          value={assignmentBrief.description}
                          onChange={(e) => setAssignmentBrief({...assignmentBrief, description: e.target.value})}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <textarea
                          placeholder="Important notes (submission guidelines, deadlines, etc.)"
                          value={assignmentBrief.importantNote}
                          onChange={(e) => setAssignmentBrief({...assignmentBrief, importantNote: e.target.value})}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Grading Type</label>
                            <select
                              value={assignmentBrief.gradingType}
                              onChange={(e) => setAssignmentBrief({...assignmentBrief, gradingType: e.target.value as 'pass_fail' | 'score'})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="pass_fail">Pass/Fail</option>
                              <option value="score">Numeric Score (0-100)</option>
                            </select>
                          </div>
                          {assignmentBrief.gradingType === 'score' && (
                            <div>
                              <label className="text-xs font-semibold text-gray-700 block mb-1">Passing Score (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={assignmentBrief.passingScore}
                                onChange={(e) => setAssignmentBrief({...assignmentBrief, passingScore: parseInt(e.target.value) || 70})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                          )}
                        </div>

                        {/* Assignment Brief Files */}
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-2">
                            📎 Assignment Brief Files <span className="text-gray-500 font-normal">(PDF, Criteria, Rubric, etc.)</span>
                          </label>
                          <input
                            type="file"
                            multiple
                            onChange={handleAssignmentBriefFiles}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                          />
                          {assignmentBriefFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {assignmentBriefFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-orange-200">
                                  <span className="text-sm flex items-center gap-2">
                                    <span>{getFileIcon(file.name)}</span>
                                    <span className="text-gray-700">{file.name}</span>
                                    <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                                  </span>
                                  <button
                                    onClick={() => removeAssignmentBriefFile(index)}
                                    className="text-red-500 hover:text-red-700 text-sm font-bold"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Presentation Brief (shown only if presentation submission is enabled) */}
                  {newUnit.enable_presentation_submission && (
                    <div className="bg-pink-50 p-4 rounded-lg border-2 border-pink-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        🎤 Presentation Brief
                      </h3>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Presentation heading (e.g., Unit 1 Presentation)"
                          value={presentationBrief.heading}
                          onChange={(e) => setPresentationBrief({...presentationBrief, heading: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <textarea
                          placeholder="Presentation description (topic, duration, format requirements)"
                          value={presentationBrief.description}
                          onChange={(e) => setPresentationBrief({...presentationBrief, description: e.target.value})}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <textarea
                          placeholder="Important notes (submission format, upload instructions, etc.)"
                          value={presentationBrief.importantNote}
                          onChange={(e) => setPresentationBrief({...presentationBrief, importantNote: e.target.value})}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Quiz Section (shown only if quiz is enabled) */}
                  {newUnit.enable_quiz && (
                    <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        🧪 Practice Quiz <span className="text-xs font-normal text-gray-600">(Does Not Unlock Units)</span>
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            Quiz Title <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Unit 1 Practice Quiz"
                            value={quizTitle}
                            onChange={(e) => setQuizTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            GIFT Format Quiz <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={quizGiftFormat}
                            onChange={(e) => setQuizGiftFormat(e.target.value)}
                            rows={8}
                            placeholder="Paste GIFT format questions here...&#10;&#10;Example:&#10;::Question 1:: What is health? {&#10;  =Physical, mental and social wellbeing&#10;  ~Just physical fitness&#10;  ~Only mental state&#10;  ~Absence of disease&#10;}"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                          />
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                            <p className="text-xs text-blue-800 font-medium mb-1">📝 GIFT Format Guide:</p>
                            <ul className="text-xs text-blue-700 space-y-0.5 ml-3">
                              <li>• Start with ::Question Title::</li>
                              <li>• Use = for correct answer</li>
                              <li>• Use ~ for wrong answers</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowNewUnitForm(false)}
                      className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddUnit}
                      disabled={addingUnit}
                      className={`px-6 py-2 bg-purple-600 text-white rounded-lg transition-colors font-semibold flex items-center gap-2 ${
                        addingUnit 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-purple-700'
                      }`}
                    >
                      {addingUnit ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Adding Unit...</span>
                        </>
                      ) : (
                        <>
                          <span>✓</span>
                          <span>Add Unit</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Units Grid */}
            {units.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-lg">No units yet. Click "Add New Unit" to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="border-2 border-gray-200 rounded-xl p-6 hover:border-purple-300 transition-all cursor-pointer bg-gradient-to-r from-white to-purple-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1" onClick={() => handleUnitClick(unit.id)}>
                        <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <span className="text-purple-600">Unit {unit.unit_number}:</span>
                          {unit.title}
                          {unit.is_optional && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                              Optional
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-600 mb-4">{unit.content}</p>
                        
                        {/* Unit Info */}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="flex items-center gap-1 text-gray-600">
                            🔓 <strong>Unlock:</strong> {unit.unlock_condition === 'none' ? 'Default' : unit.unlock_condition.replace('_', ' ')}
                          </span>
                          {unit.enable_assignment_submission && (
                            <span className="text-green-600 font-semibold">📝 Assignment Enabled</span>
                          )}
                          {unit.enable_presentation_submission && (
                            <span className="text-blue-600 font-semibold">🎤 Presentation Enabled</span>
                          )}
                          {unit.deadline && (
                            <span className="text-orange-600">
                              ⏰ Due: {new Date(unit.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnitClick(unit.id);
                          }}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUnit(unit.id);
                          }}
                          disabled={deletingUnitId === unit.id}
                          className={`px-4 py-2 bg-red-50 text-red-600 rounded-lg transition-colors text-sm font-semibold flex items-center gap-2 ${
                            deletingUnitId === unit.id
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-red-100'
                          }`}
                        >
                          {deletingUnitId === unit.id ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <span>🗑️</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
            <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <span>💡</span>
              How Units Work
            </h3>
            <ul className="space-y-1 text-purple-700 text-sm list-disc list-inside">
              <li><strong>Unlock Conditions:</strong> Control when students can access each unit</li>
              <li><strong>Assignment & Presentation:</strong> Enable submission slots for graded work</li>
              <li><strong>Grading Types:</strong> Each submission can be graded as Score (0-100) or Pass/Fail</li>
              <li><strong>Topics & Materials:</strong> Click "Edit Topics" to add learning resources and quizzes</li>
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ManageQualificationCourse;
