'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';

interface Category {
  id: number;
  name: string;
}

interface SubCategory {
  id: number;
  category_id: number;
  name: string;
}

const CreateCPDCourse = () => {
  const [userRole, setUserRole] = useState<'Admin' | 'Tutor' | 'Student' | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  
  // Basic Info
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');

  // General Sections
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementDesc, setAnnouncementDesc] = useState('');
  const [announcementFiles, setAnnouncementFiles] = useState<File[]>([]);
  const [faqContent, setFaqContent] = useState('');
  const [faqFiles, setFaqFiles] = useState<File[]>([]);

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

  const handleCreate = async () => {
    if (!courseTitle || !categoryId) {
      alert('Please enter course title and select category');
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
      formData.append('course_type', 'cpd');
      formData.append('announcement_title', announcementTitle);
      formData.append('announcement_description', announcementDesc);
      formData.append('faq_content', faqContent);
      
      // Append announcement files
      announcementFiles.forEach((file) => {
        formData.append('announcement_files', file);
      });
      
      // Append FAQ files
      faqFiles.forEach((file) => {
        formData.append('faq_files', file);
      });

      const response = await apiService.createCPDCourse(formData);

      if (response.success) {
        alert('CPD Course created successfully!');
        // Redirect to role-specific course management page to add topics
        const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
        const role = user?.role?.toLowerCase() || 'admin';
        window.location.href = `/dashboard/${role}/cpd/${response.courseId}/manage`;
      } else {
        setError(response.message || 'Failed to create course');
      }
    } catch (error) {
      console.error('Error creating CPD course:', error);
      setError('Failed to create CPD course');
    } finally {
      setCreating(false);
    }
  };

  const handleAnnouncementFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAnnouncementFiles(prev => [...prev, ...files]);
  };

  const handleFaqFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFaqFiles(prev => [...prev, ...files]);
  };

  const removeAnnouncementFile = (index: number) => {
    setAnnouncementFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeFaqFile = (index: number) => {
    setFaqFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.pdf')) return '📄';
    if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return '📝';
    if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) return '📊';
    if (fileName.endsWith('.mp4') || fileName.endsWith('.avi') || fileName.endsWith('.mov')) return '🎥';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.jpeg')) return '🖼️';
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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => {
                const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
                const role = user?.role?.toLowerCase() || 'admin';
                window.location.href = `/dashboard/${role}`;
              }}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Create CPD Course</h1>
            <p className="text-gray-600 mt-2">Set up basic course information, then manage topics and quizzes</p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            {/* Basic Info */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="e.g., Level 5 Diploma in Health and Social Care (CPD)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Description
                  </label>
                  <textarea
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe what students will learn..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => {
                        setCategoryId(e.target.value);
                        setSubCategoryId('');
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sub-Category
                    </label>
                    <select
                      value={subCategoryId}
                      onChange={(e) => setSubCategoryId(e.target.value)}
                      disabled={!categoryId}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
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

            {/* General Sections */}
            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">General Sections (Optional)</h2>
              
              <div className="space-y-6">
                {/* News & Announcements */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">📢 General News & Announcements</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      placeholder="Announcement Title (e.g., Welcome to the course)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                    />
                    <textarea
                      value={announcementDesc}
                      onChange={(e) => setAnnouncementDesc(e.target.value)}
                      rows={2}
                      placeholder="Announcement description..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Attach Files (PDF, Word, Video, Images)
                      </label>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.avi,.mov,.jpg,.jpeg,.png"
                        onChange={handleAnnouncementFiles}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                      />
                      {announcementFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {announcementFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                              <span className="flex items-center gap-2 text-sm">
                                {getFileIcon(file.name)} {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeAnnouncementFile(idx)}
                                className="text-red-600 hover:text-red-800 text-sm"
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

                {/* General FAQ */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">❓ General FAQ</h3>
                  <div className="space-y-3">
                    <textarea
                      value={faqContent}
                      onChange={(e) => setFaqContent(e.target.value)}
                      rows={3}
                      placeholder="Frequently asked questions and answers..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Attach Files (PDF, Word, Video, Images)
                      </label>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.avi,.mov,.jpg,.jpeg,.png"
                        onChange={handleFaqFiles}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                      />
                      {faqFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {faqFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                              <span className="flex items-center gap-2 text-sm">
                                {getFileIcon(file.name)} {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFaqFile(idx)}
                                className="text-red-600 hover:text-red-800 text-sm"
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
            </div>

            {/* Action Buttons */}
            <div className="border-t pt-6 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                After creating the course, you'll be able to add topics, files, and quizzes.
              </p>
              <button
                onClick={handleCreate}
                disabled={creating || !courseTitle || !categoryId}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Course & Add Topics →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CreateCPDCourse;
