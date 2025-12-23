'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { showToast } from '@/app/components/Toast';

interface Category {
  id: number;
  name: string;
}

interface SubCategory {
  id: number;
  category_id: number;
  name: string;
}

const CreateQualificationCourse = () => {
  const [userRole, setUserRole] = useState<'Admin' | 'Tutor' | 'Student' | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  
  // Basic Info
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');

  // General Course Content
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [generalInfo, setGeneralInfo] = useState('');
  
  // File uploads - support multiple files for each section
  const [welcomeFiles, setWelcomeFiles] = useState<File[]>([]);
  const [disclaimerFiles, setDisclaimerFiles] = useState<File[]>([]);
  const [generalInfoFiles, setGeneralInfoFiles] = useState<File[]>([]);
  const [handbook, setHandbook] = useState<File | null>(null);
  const [descriptor, setDescriptor] = useState<File | null>(null);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const role = user?.role || null;
    setUserRole(role as 'Admin' | 'Tutor' | 'Student' | null);
    setIsCheckingAuth(false);
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const [catData, subData] = await Promise.all([
        apiService.getCourseCategories(),
        apiService.getSubCategories()
      ]);
      setCategories(catData.categories || []);
      setSubCategories(subData.subCategories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const filteredSubCategories = subCategories.filter(
    sub => sub.category_id === parseInt(categoryId)
  );

  // File handling helpers
  const handleWelcomeFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setWelcomeFiles(prev => [...prev, ...files]);
  };

  const handleDisclaimerFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDisclaimerFiles(prev => [...prev, ...files]);
  };

  const handleGeneralInfoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setGeneralInfoFiles(prev => [...prev, ...files]);
  };

  const removeWelcomeFile = (index: number) => {
    setWelcomeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeDisclaimerFile = (index: number) => {
    setDisclaimerFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeGeneralInfoFile = (index: number) => {
    setGeneralInfoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!courseTitle || !categoryId) {
      showToast('Please enter course title and select category', 'warning');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', courseTitle);
      formData.append('description', courseDescription);
      formData.append('category_id', categoryId);
      formData.append('sub_category_id', subCategoryId);
      formData.append('welcome_message', welcomeMessage);
      formData.append('disclaimer', disclaimer);
      formData.append('general_information', generalInfo);
      
      console.log('[Create Course] Preparing files...');
      console.log('  Welcome files:', welcomeFiles.length);
      console.log('  Disclaimer files:', disclaimerFiles.length);
      console.log('  General info files:', generalInfoFiles.length);
      console.log('  Handbook:', handbook ? handbook.name : 'none');
      console.log('  Descriptor:', descriptor ? descriptor.name : 'none');
      
      // Append welcome message files
      welcomeFiles.forEach((file) => {
        console.log('  Appending welcome_files:', file.name, file.size);
        formData.append('welcome_files', file);
      });
      
      // Append disclaimer files
      disclaimerFiles.forEach((file) => {
        console.log('  Appending disclaimer_files:', file.name, file.size);
        formData.append('disclaimer_files', file);
      });
      
      // Append general info files
      generalInfoFiles.forEach((file) => {
        console.log('  Appending general_info_files:', file.name, file.size);
        formData.append('general_info_files', file);
      });
      
      // Append handbook and descriptor
      if (handbook) {
        console.log('  Appending handbook:', handbook.name, handbook.size);
        formData.append('handbook', handbook);
      }
      if (descriptor) {
        console.log('  Appending descriptor:', descriptor.name, descriptor.size);
        formData.append('descriptor', descriptor);
      }

      console.log('[Create Course] Sending FormData to API...');
      const response = await apiService.createQualificationCourse(formData);

      if (response.success) {
        showToast('Qualification Course created successfully!', 'success');
        // Redirect to role-specific course management page to add units
        const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
        const role = user?.role?.toLowerCase() || 'admin';
        window.location.href = `/dashboard/${role}/qualification/${response.courseId}/manage`;
      } else {
        setError(response.message || 'Failed to create course');
      }
    } catch (error: any) {
      console.error('Error creating Qualification course:', error);
      
      // Check if it's an authentication error
      if (error?.message?.includes('401') || error?.message?.includes('authorization')) {
        setError('Your session has expired. Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(error?.message || 'Failed to create Qualification course');
      }
    } finally {
      setCreating(false);
    }
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

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Tutor']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-t-4 border-purple-600">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <span className="text-4xl">🎓</span>
                Create Qualification Course
              </h1>
              <button
                onClick={() => {
                  const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
                  const role = user?.role?.toLowerCase() || 'admin';
                  window.location.href = `/dashboard/${role}`;
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back to Dashboard
              </button>
            </div>
            <p className="text-gray-600 mt-2">
              Set up your qualification course. After creating, you'll add units, topics, and assignments.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Main Form */}
          <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
            
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Basic Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="e.g., Level 3 Diploma in Business Administration"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course Description
                  </label>
                  <textarea
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    rows={4}
                    placeholder="Brief overview of what students will learn..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sub-Category
                    </label>
                    <select
                      value={subCategoryId}
                      onChange={(e) => setSubCategoryId(e.target.value)}
                      disabled={!categoryId}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-100"
                    >
                      <option value="">Select Sub-Category</option>
                      {filteredSubCategories.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Course Introduction Content */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">👋</span>
                Introduction & General Information
              </h2>
              <div className="space-y-6">
                {/* Welcome Message Section */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Welcome Message <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <textarea
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    rows={3}
                    placeholder="Welcome students to your course..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  
                  {/* Welcome Files Upload */}
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      📎 Attach Files (Optional - Multiple files allowed)
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={handleWelcomeFiles}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {welcomeFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {welcomeFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm flex items-center gap-2">
                              <span>{getFileIcon(file.name)}</span>
                              <span className="text-gray-700">{file.name}</span>
                              <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <button
                              onClick={() => removeWelcomeFile(index)}
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

                {/* Disclaimer Section */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Disclaimer <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <textarea
                    value={disclaimer}
                    onChange={(e) => setDisclaimer(e.target.value)}
                    rows={3}
                    placeholder="Important terms, conditions, or disclaimers..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  
                  {/* Disclaimer Files Upload */}
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      📎 Attach Files (Optional - Multiple files allowed)
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={handleDisclaimerFiles}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                    />
                    {disclaimerFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {disclaimerFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm flex items-center gap-2">
                              <span>{getFileIcon(file.name)}</span>
                              <span className="text-gray-700">{file.name}</span>
                              <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <button
                              onClick={() => removeDisclaimerFile(index)}
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

                {/* General Information Section */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    General Information <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <textarea
                    value={generalInfo}
                    onChange={(e) => setGeneralInfo(e.target.value)}
                    rows={4}
                    placeholder="Course requirements, prerequisites, expected outcomes..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  
                  {/* General Info Files Upload */}
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      📎 Attach Files (Optional - Multiple files allowed)
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={handleGeneralInfoFiles}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    {generalInfoFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {generalInfoFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm flex items-center gap-2">
                              <span>{getFileIcon(file.name)}</span>
                              <span className="text-gray-700">{file.name}</span>
                              <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <button
                              onClick={() => removeGeneralInfoFile(index)}
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
            </div>

            <hr className="border-gray-200" />

            {/* Course Files */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📚</span>
                Course Documents <span className="text-sm text-gray-500 font-normal">(Optional)</span>
              </h2>
              <p className="text-sm text-gray-600 mb-4">Upload official course documents (single file each)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student Handbook (PDF) <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setHandbook(e.target.files?.[0] || null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                  {handbook && (
                    <div className="mt-2 flex items-center gap-2 text-sm bg-white p-2 rounded border border-green-200">
                      <span>{getFileIcon(handbook.name)}</span>
                      <span className="text-gray-700">{handbook.name}</span>
                      <span className="text-gray-400 text-xs">({(handbook.size / 1024).toFixed(1)} KB)</span>
                      <button
                        onClick={() => setHandbook(null)}
                        className="ml-auto text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Course Descriptor (PDF) <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setDescriptor(e.target.files?.[0] || null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                  {descriptor && (
                    <div className="mt-2 flex items-center gap-2 text-sm bg-white p-2 rounded border border-green-200">
                      <span>{getFileIcon(descriptor.name)}</span>
                      <span className="text-gray-700">{descriptor.name}</span>
                      <span className="text-gray-400 text-xs">({(descriptor.size / 1024).toFixed(1)} KB)</span>
                      <button
                        onClick={() => setDescriptor(null)}
                        className="ml-auto text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
                  const role = user?.role?.toLowerCase() || 'admin';
                  window.location.href = `/dashboard/${role}`;
                }}
                disabled={creating}
                className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !courseTitle || !categoryId}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  '✓ Create Course & Add Units'
                )}
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-6">
            <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <span>💡</span>
              Next Steps
            </h3>
            <p className="text-purple-700 text-sm">
              After creating the course, you'll be redirected to the management page where you can:
            </p>
            <ul className="mt-3 space-y-1 text-purple-700 text-sm list-disc list-inside">
              <li>Add units with topics and learning materials</li>
              <li>Upload assignment briefs and resources</li>
              <li>Create quizzes with passing scores</li>
              <li>Set unlock conditions and deadlines</li>
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CreateQualificationCourse;
