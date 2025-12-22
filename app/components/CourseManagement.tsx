'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiService } from '@/app/services/api';

interface Course {
  id: number;
  title: string;
  description: string;
  status: string;
  created_by: number;
  created_by_name: string;
  category_id: number;
  category_name: string;
  created_at: string;
  course_type?: 'cpd' | 'qualification';
}

interface Category {
  id: number;
  name: string;
  description: string;
}

interface SubCategory {
  id: number;
  category_id: number;
  name: string;
  description: string;
}

interface CourseFile {
  id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface CourseManagementProps {
  filterType?: 'all' | 'cpd' | 'qualification';
  showControls?: boolean;
}

const CourseManagement = ({ filterType = 'all', showControls = true }: CourseManagementProps = {}) => {
  const [courseType, setCourseType] = useState<'cpd' | 'qualification'>('cpd');
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [userRole, setUserRole] = useState<string>('admin');
  const [courseFiles, setCourseFiles] = useState<CourseFile[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12); // Show 12 recent courses per page
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [totalCoursesPage, setTotalCoursesPage] = useState(1);
  const [totalCoursesLimit, setTotalCoursesLimit] = useState(12);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'Active',
    created_by: '',
    category_id: '',
    sub_category_id: '',
    start_date: '',
    end_date: ''
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: ''
  });

  const [showSubCategoryForm, setShowSubCategoryForm] = useState(false);
  const [subCategoryFormData, setSubCategoryFormData] = useState({
    category_id: '',
    name: '',
    description: ''
  });

  useEffect(() => {
    // Get user role from localStorage
    const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
    const role = user?.role?.toLowerCase() || 'admin';
    setUserRole(role);
    
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [coursesData, categoriesData] = await Promise.all([
        apiService.getCourses(),
        apiService.getCourseCategories()
      ]);

      if (coursesData.success) {
        setCourses(coursesData.courses);
      }
      if (categoriesData.success) {
        setCategories(categoriesData.categories);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to connect to admin API. Please restart the backend server.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubCategories = async (categoryId: number) => {
    if (!categoryId) {
      setSubCategories([]);
      return;
    }
    try {
      const data = await apiService.getSubCategories(categoryId);
      if (data.success) {
        setSubCategories(data.subCategories);
      }
    } catch (error) {
      console.error('Error fetching sub-categories:', error);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
      const courseData = {
        ...formData,
        created_by: user.id
      };
      
      const data = await apiService.createCourse(courseData);
      if (data.success) {
        fetchData();
        setShowCreateForm(false);
        setFormData({ title: '', description: '', status: 'Active', created_by: '', category_id: '', sub_category_id: '', start_date: '', end_date: '' });
        setSubCategories([]);
        alert('Course created successfully!');
      } else {
        alert(data.message || 'Error creating course');
      }
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Error creating course');
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    try {
      const data = await apiService.updateCourse(editingCourse!.id, formData);
      if (data.success) {
        fetchData();
        setEditingCourse(null);
        setFormData({ title: '', description: '', status: 'Active', created_by: '', category_id: '', sub_category_id: '', start_date: '', end_date: '' });
        setSubCategories([]);
        alert('Course updated successfully!');
      } else {
        alert(data.message || 'Error updating course');
      }
    } catch (error) {
      console.error('Error updating course:', error);
      alert('Error updating course');
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    
    try {
      const data = await apiService.deleteCourse(courseId);
      if (data.success) {
        fetchData();
        alert('Course deleted successfully!');
      } else {
        alert(data.message || 'Error deleting course');
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('Error deleting course');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiService.createCourseCategory(categoryFormData);
      if (data.success) {
        fetchData();
        setShowCategoryForm(false);
        setCategoryFormData({ name: '', description: '' });
        alert('Category created successfully!');
      } else {
        alert(data.message || 'Error creating category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Error creating category');
    }
  };

  const handleCreateSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCategoryFormData.category_id) {
      alert('Please select a category first');
      return;
    }
    try {
      const data = await apiService.createSubCategory(subCategoryFormData);
      if (data.success) {
        fetchData();
        setShowSubCategoryForm(false);
        setSubCategoryFormData({ category_id: '', name: '', description: '' });
        alert('Sub-category created successfully!');
      } else {
        alert(data.message || 'Error creating sub-category');
      }
    } catch (error: any) {
      console.error('Error creating sub-category:', error);
      // Try to get error message from response
      const errorMessage = error?.message || 'Error creating sub-category. Please check if the category exists and try again.';
      alert(errorMessage);
    }
  };

  const handleFileUpload = async (courseId: number, file: File, fileType: string) => {
    try {
      const data = await apiService.uploadCourseFile(courseId, file, fileType);
      if (data.success) {
        fetchCourseFiles(courseId);
        alert('File uploaded successfully!');
      } else {
        alert(data.message || 'Error uploading file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    }
  };

  const fetchCourseFiles = async (courseId: number) => {
    try {
      const data = await apiService.getCourseFiles(courseId);
      if (data.success) {
        setCourseFiles(data.files);
      }
    } catch (error) {
      console.error('Error fetching course files:', error);
    }
  };

  const handleBackupCourses = async () => {
    try {
      const data = await apiService.backupCourses();
      if (data.success) {
        alert(`Backup created successfully! ${data.coursesCount} courses backed up.`);
      } else {
        alert(data.message || 'Error creating backup');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('Error creating backup');
    }
  };

  const handleRestoreCourses = async (file: File) => {
    try {
      const data = await apiService.restoreCourses(file);
      if (data.success) {
        fetchData();
        alert(`Courses restored successfully! ${data.restoredCourses} courses restored.`);
      } else {
        alert(data.message || 'Error restoring courses');
      }
    } catch (error) {
      console.error('Error restoring courses:', error);
      alert('Error restoring courses');
    }
  };

  // Filter and sort courses
  const filteredCourses = useMemo(() => {
    let filtered = courses.filter(course => {
      // Filter by filterType prop (all, cpd, or qualification)
      let matchesFilterType = true;
      if (filterType !== 'all') {
        matchesFilterType = (course as any).course_type === filterType;
      }
      
      // Filter by course type tab (cpd or qualification) - only if filterType is 'all'
      const matchesCourseType = filterType === 'all' 
        ? ((course as any).course_type 
            ? (course as any).course_type === courseType 
            : courseType === 'qualification') // Default to qualification if no course_type set
        : true;
      
      // Apply search filter (in both tabs)
      const matchesSearch = searchTerm.trim() === '' ||
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply category filter (in both tabs)
      const matchesCategory = !filterCategory || course.category_name === filterCategory;
      
      // Apply status filter (in both tabs)
      const matchesStatus = !filterStatus || course.status === filterStatus;
      
      return matchesFilterType && matchesCourseType && matchesSearch && matchesCategory && matchesStatus;
    });
    
    // Sort by created_at descending (most recent first)
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
    
    return filtered;
  }, [courses, filterType, courseType, searchTerm, filterCategory, filterStatus]);

  // Paginate courses
  const paginatedCourses = useMemo(() => {
    if (showControls) {
      // In Course Management tab, show only recent courses with pagination
      const start = (page - 1) * limit;
      const end = start + limit;
      return filteredCourses.slice(start, end);
    } else {
      // In Total Courses tab, show paginated courses
      const start = (totalCoursesPage - 1) * totalCoursesLimit;
      const end = start + totalCoursesLimit;
      return filteredCourses.slice(start, end);
    }
  }, [filteredCourses, page, limit, totalCoursesPage, totalCoursesLimit, showControls]);

  // Reset pagination when filters change in Course Management tab
  useEffect(() => {
    if (showControls) {
      setPage(1);
    }
  }, [searchTerm, filterCategory, filterStatus, showControls]);

  const totalPages = Math.ceil(filteredCourses.length / limit);
  const totalCoursesTotalPages = Math.ceil(filteredCourses.length / totalCoursesLimit);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-red-100 text-red-800';
      case 'Draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading courses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="text-red-600 text-lg mr-3">⚠️</div>
          <div>
            <h3 className="text-red-800 font-semibold">Connection Error</h3>
            <p className="text-red-600 mt-1">{error}</p>
            <button 
              onClick={fetchData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showControls && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Course Management</h2>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCategoryForm(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add Category
              </button>
              <button
                onClick={() => setShowSubCategoryForm(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                + Add Sub-Category
              </button>
            </div>
          </div>

          {/* Course Type Tabs */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => setCourseType('cpd')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  courseType === 'cpd'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📘 CPD Courses
              </button>
              <button
                onClick={() => setCourseType('qualification')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  courseType === 'qualification'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🎓 Qualification Courses
              </button>
            </div>
            
            {courseType === 'cpd' ? (
              <button
                onClick={() => window.location.href = `/dashboard/${userRole}/cpd/create`}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-medium text-lg"
              >
                + Create New CPD Course
              </button>
            ) : (
              <button
                onClick={() => window.location.href = `/dashboard/${userRole}/qualification/create`}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all font-medium text-lg"
              >
                + Create New Qualification Course
              </button>
            )}
          </div>

        </>
      )}

      {/* Filters - Show in both tabs */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Courses</label>
            <input
              type="text"
              placeholder="Search by title or description..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (showControls) {
                  setPage(1);
                } else {
                  setTotalCoursesPage(1);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category</label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                if (showControls) {
                  setPage(1);
                } else {
                  setTotalCoursesPage(1);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                if (showControls) {
                  setPage(1);
                } else {
                  setTotalCoursesPage(1);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedCourses.map((course) => (
          <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{course.title}</h3>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(course.status)}`}>
                  {course.status}
                </span>
              </div>
              
              <p className="text-gray-600 text-sm mb-3 line-clamp-3">{course.description}</p>
              
              <div className="space-y-2 text-sm text-gray-500">
                <div>📚 Category: {course.category_name || 'No Category'}</div>
                <div>👤 Created by: {course.created_by_name}</div>
                <div>📅 Created: {new Date(course.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center">
                {course.course_type === 'cpd' ? (
                  <button
                    onClick={() => window.location.href = `/dashboard/${userRole}/cpd/${course.id}/manage`}
                    className="text-[#11CCEF] hover:text-[#0daed9] text-sm font-medium cursor-pointer"
                  >
                    📚 Manage Course
                  </button>
                ) : course.course_type === 'qualification' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.location.href = `/dashboard/${userRole}/qualification/${course.id}/view`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer"
                    >
                      👁️ View Course
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => window.location.href = `/dashboard/${userRole}/qualification/${course.id}/manage`}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium cursor-pointer"
                    >
                      🎓 Manage Course
                    </button>
                  </div>
                ) : (
                  <a
                    href={`/courses/${course.id}/files`}
                    target="_blank"
                    className="text-[#11CCEF] hover:text-[#0daed9] text-sm font-medium"
                  >
                    📁 Files
                  </a>
                )}
                <div className="flex space-x-2">
                  {course.course_type === 'cpd' ? (
                    <>
                      <button
                        onClick={() => {
                          const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
                          const role = user?.role?.toLowerCase();
                          window.location.href = `/dashboard/${role}/cpd/${course.id}/view`;
                        }}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setEditingCourse(course);
                          setFormData({
                            title: course.title,
                            description: course.description,
                            status: course.status,
                            created_by: course.created_by.toString(),
                            category_id: course.category_id?.toString() || '',
                            sub_category_id: (course as any).sub_category_id?.toString() || '',
                            start_date: (course as any).start_date ? (course as any).start_date.split('T')[0] : '',
                            end_date: (course as any).end_date ? (course as any).end_date.split('T')[0] : ''
                          });
                          if (course.category_id) {
                            fetchSubCategories(course.category_id);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                    </>
                  ) : course.course_type === 'qualification' ? (
                    <>
                      <button
                        onClick={() => {
                          const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
                          const role = user?.role?.toLowerCase();
                          window.location.href = `/dashboard/${role}/qualification/${course.id}/manage`;
                        }}
                        className="text-purple-600 hover:text-purple-800 text-sm"
                      >
                        View Units
                      </button>
                      <button
                        onClick={() => {
                          setEditingCourse(course);
                          setFormData({
                            title: course.title,
                            description: course.description,
                            status: course.status,
                            created_by: course.created_by.toString(),
                            category_id: course.category_id?.toString() || '',
                            sub_category_id: (course as any).sub_category_id?.toString() || '',
                            start_date: (course as any).start_date ? (course as any).start_date.split('T')[0] : '',
                            end_date: (course as any).end_date ? (course as any).end_date.split('T')[0] : ''
                          });
                          if (course.category_id) {
                            fetchSubCategories(course.category_id);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => window.location.href = `/courses/${course.id}`}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setEditingCourse(course);
                          setFormData({
                            title: course.title,
                            description: course.description,
                            status: course.status,
                            created_by: course.created_by.toString(),
                            category_id: course.category_id?.toString() || '',
                            sub_category_id: (course as any).sub_category_id?.toString() || '',
                            start_date: (course as any).start_date ? (course as any).start_date.split('T')[0] : '',
                            end_date: (course as any).end_date ? (course as any).end_date.split('T')[0] : ''
                          });
                          if (course.category_id) {
                            fetchSubCategories(course.category_id);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDeleteCourse(course.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination - Show in both tabs */}
      {((showControls && totalPages > 1) || (!showControls && totalCoursesTotalPages > 1)) && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">
            {showControls ? (
              <>Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, filteredCourses.length)} of {filteredCourses.length} courses</>
            ) : (
              <>Showing {((totalCoursesPage - 1) * totalCoursesLimit) + 1} to {Math.min(totalCoursesPage * totalCoursesLimit, filteredCourses.length)} of {filteredCourses.length} courses</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => showControls ? setPage((p) => Math.max(1, p - 1)) : setTotalCoursesPage((p) => Math.max(1, p - 1))}
              disabled={showControls ? page === 1 : totalCoursesPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              « Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, showControls ? totalPages : totalCoursesTotalPages) }, (_, i) => {
                const currentPage = showControls ? page : totalCoursesPage;
                const totalPagesCount = showControls ? totalPages : totalCoursesTotalPages;
                let pageNum;
                if (totalPagesCount <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPagesCount - 2) {
                  pageNum = totalPagesCount - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => showControls ? setPage(pageNum) : setTotalCoursesPage(pageNum)}
                    className={`px-3 py-1 rounded text-sm ${
                      currentPage === pageNum
                        ? 'bg-[#11CCEF] text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {(showControls ? totalPages : totalCoursesTotalPages) > 5 && <span className="px-2 text-sm text-gray-500">…</span>}
            </div>
            <button
              onClick={() => showControls ? setPage((p) => Math.min(totalPages, p + 1)) : setTotalCoursesPage((p) => Math.min(totalCoursesTotalPages, p + 1))}
              disabled={showControls ? page === totalPages : totalCoursesPage === totalCoursesTotalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next »
            </button>
          </div>
        </div>
      )}

      {/* Course Files Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Course Files: {selectedCourse.title}</h3>
              <button
                onClick={() => setSelectedCourse(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload New File</label>
              <input
                type="file"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0];
                    const fileType = file.name.endsWith('.mbz') ? 'moodle' : 'resource';
                    handleFileUpload(selectedCourse.id, file, fileType);
                  }
                }}
                accept=".mbz,.zip,.pdf,.mp4,.doc,.docx,.ppt,.pptx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
              />
            </div>
            
            <div className="space-y-2">
              {courseFiles.map((file) => (
                <div key={file.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{file.file_name}</div>
                    <div className="text-sm text-gray-500">
                      {file.file_type} • {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-800">Download</button>
                    <button className="text-red-600 hover:text-red-800">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Course Modal */}
      {(showCreateForm || editingCourse) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingCourse ? 'Edit Course' : 'Create New Course'}
            </h3>
            <form onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => {
                    setFormData({ ...formData, category_id: e.target.value, sub_category_id: '' });
                    fetchSubCategories(Number(e.target.value));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                >
                  <option value="">No Category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Category</label>
                <select
                  value={formData.sub_category_id}
                  onChange={(e) => setFormData({ ...formData, sub_category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                  disabled={!formData.category_id}
                >
                  <option value="">No Sub-Category</option>
                  {subCategories.map(subCat => (
                    <option key={subCat.id} value={subCat.id}>{subCat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingCourse(null);
                    setFormData({ title: '', description: '', status: 'Active', created_by: '', category_id: '', sub_category_id: '', start_date: '', end_date: '' });
                    setSubCategories([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9]"
                >
                  {editingCourse ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Category</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setCategoryFormData({ name: '', description: '' });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sub-Category Modal */}
      {showSubCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Sub-Category</h3>
            <form onSubmit={handleCreateSubCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={subCategoryFormData.category_id}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">No categories available. Please create a category first.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Category Name</label>
                <input
                  type="text"
                  required
                  value={subCategoryFormData.name}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Enter sub-category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={subCategoryFormData.description}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Enter sub-category description (optional)"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubCategoryForm(false);
                    setSubCategoryFormData({ category_id: '', name: '', description: '' });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!subCategoryFormData.category_id || categories.length === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Sub-Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseManagement;
