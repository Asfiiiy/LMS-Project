'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { showSweetAlert } from '@/app/components/SweetAlert';

interface CPDTopic {
  id: number;
  topic_number: number;
  order_index?: number;
  title: string;
  description: string;
  deadline: string;
  files: any[];
  practice_quiz?: {
    id: number;
    title: string;
    time_limit: number;
    passing_score?: number;
  };
  final_quiz?: {
    id: number;
    title: string;
    passing_score: number;
    time_limit: number;
  };
}

const ManageCPDCourse = () => {
  const params = useParams();
  const courseId = parseInt(params.courseId as string);
  
  const [userRole, setUserRole] = useState<'Admin' | 'Assessor' | 'Student' | null>(null);
  const [course, setCourse] = useState<any>(null);
  const [topics, setTopics] = useState<CPDTopic[]>([]);
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);
  
  // New Topic Form
  const [showNewTopicForm, setShowNewTopicForm] = useState(false);
  const [newTopic, setNewTopic] = useState({
    title: '',
    description: '',
    deadline: ''
  });
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [sections, setSections] = useState<Array<{title: string; files: File[]}>>([]);
  const [addingTopic, setAddingTopic] = useState(false);
  
  // Drag and drop state
  const [draggedTopic, setDraggedTopic] = useState<number | null>(null);
  const [dragOverTopic, setDragOverTopic] = useState<number | null>(null);
  
  // Quiz Form States
  const [showQuizForm, setShowQuizForm] = useState<{topicId: number; type: 'practice' | 'final'} | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizPassingScore, setQuizPassingScore] = useState(70);
  const [giftText, setGiftText] = useState('');
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const role = user?.role || null;
    setUserRole(role as 'Admin' | 'Assessor' | 'Student' | null);
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCPDCourseForAdmin(courseId);
      
      if (response.success) {
        setCourse(response.course);
        setTopics(response.topics || []);
      } else {
        showSweetAlert({
          title: 'Error',
          text: 'Failed to load course data',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      showSweetAlert({
        title: 'Error',
        text: 'Error loading course data. Please refresh the page.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = async () => {
    if (!newTopic.title) {
      showSweetAlert({
        title: 'Validation Error',
        text: 'Please enter topic title',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    setAddingTopic(true);
    try {
      const formData = new FormData();
      // Calculate topic_number based on order_index (which is sequential)
      // This ensures deleted topics don't cause conflicts
      // Fallback to topic_number if order_index is not available
      const maxOrderIndex = topics.length > 0 
        ? Math.max(...topics.map(t => {
            // Use order_index if available, otherwise derive from topic_number (topic_number - 1)
            return t.order_index ?? (t.topic_number ? t.topic_number - 1 : 0);
          }))
        : -1;
      const nextTopicNumber = maxOrderIndex + 2; // order_index is 0-based, topic_number is 1-based
      formData.append('topic_number', nextTopicNumber.toString());
      formData.append('title', newTopic.title);
      formData.append('description', newTopic.description);
      formData.append('deadline', newTopic.deadline);
      
      // Add sections data
      formData.append('sections', JSON.stringify(sections.map(s => ({ title: s.title, fileCount: s.files.length }))));
      
      // Add files with section indices
      sections.forEach((section, sectionIndex) => {
        section.files.forEach((file) => {
          formData.append(`section_${sectionIndex}_files`, file);
        });
      });
      
      // Add general files (without section)
      uploadingFiles.forEach((file) => {
        formData.append(`files`, file);
      });

      const response = await apiService.addCPDTopic(courseId, formData);
      
      if (response.success) {
        setNewTopic({ title: '', description: '', deadline: '' });
        setUploadingFiles([]);
        setSections([]);
        setShowNewTopicForm(false);
        await loadCourseData();
        showSweetAlert({
          title: 'Success!',
          text: 'Topic added successfully!',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } else {
        showSweetAlert({
          title: 'Error',
          text: response.message || 'Failed to add topic',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      showSweetAlert({
        title: 'Error',
        text: 'Failed to add topic. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    } finally {
      setAddingTopic(false);
    }
  };

  const addSection = () => {
    setSections([...sections, { title: '', files: [] }]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const updateSectionTitle = (index: number, title: string) => {
    const updated = [...sections];
    updated[index].title = title;
    setSections(updated);
  };

  const addFilesToSection = (index: number, files: File[]) => {
    const updated = [...sections];
    updated[index].files = [...updated[index].files, ...files];
    setSections(updated);
  };

  const removeFileFromSection = (sectionIndex: number, fileIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].files = updated[sectionIndex].files.filter((_, i) => i !== fileIndex);
    setSections(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadingFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteFile = async (fileId: number, topicId: number) => {
    showSweetAlert({
      title: 'Delete File?',
      text: 'Are you sure you want to delete this file? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await apiService.deleteCPDFile(fileId);
          if (response.success) {
            showSweetAlert({
              title: 'Deleted!',
              text: 'File deleted successfully!',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            loadCourseData();
          } else {
            showSweetAlert({
              title: 'Error',
              text: response.message || 'Failed to delete file',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        } catch (error) {
          showSweetAlert({
            title: 'Error',
            text: 'Failed to delete file. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      }
    });
  };

  const handleDeleteQuiz = async (quizId: number, quizType: string, topicId: number) => {
    showSweetAlert({
      title: 'Delete Quiz?',
      text: `Are you sure you want to delete this ${quizType} quiz? This will also delete all questions. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await apiService.deleteCPDQuiz(quizId);
          
          if (response.success) {
            showSweetAlert({
              title: 'Deleted!',
              text: 'Quiz deleted successfully!',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            loadCourseData();
          } else {
            showSweetAlert({
              title: 'Error',
              text: response.message || 'Failed to delete quiz',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        } catch (error) {
          showSweetAlert({
            title: 'Error',
            text: 'Failed to delete quiz. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      }
    });
  };

  const handleDeleteTopic = async (topicId: number, topicTitle: string) => {
    showSweetAlert({
      title: 'Delete Topic?',
      text: `Are you sure you want to delete "${topicTitle}"? This will also delete all files, quizzes, and questions in this topic. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      onConfirm: async () => {
        try {
          const { getApiUrl } = await import('@/app/utils/apiUrl');
          const apiUrl = getApiUrl();
          const token = localStorage.getItem('lms-token');
          
          const response = await fetch(`${apiUrl}/api/cpd/topics/${topicId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();
          if (data.success) {
            showSweetAlert({
              title: 'Deleted!',
              text: 'Topic deleted successfully!',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            loadCourseData();
          } else {
            showSweetAlert({
              title: 'Error',
              text: data.message || 'Failed to delete topic',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        } catch (error) {
          showSweetAlert({
            title: 'Error',
            text: 'Failed to delete topic. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      }
    });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, topicId: number) => {
    setDraggedTopic(topicId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, topicId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTopic(topicId);
  };

  const handleDragLeave = () => {
    setDragOverTopic(null);
  };

  const handleDrop = async (e: React.DragEvent, dropTargetId: number) => {
    e.preventDefault();
    
    if (!draggedTopic || draggedTopic === dropTargetId) {
      setDraggedTopic(null);
      setDragOverTopic(null);
      return;
    }

    // Create new topics array with updated order
    const sortedTopics = [...topics].sort((a, b) => {
      const aOrder = a.order_index ?? (a.topic_number ?? 0) - 1;
      const bOrder = b.order_index ?? (b.topic_number ?? 0) - 1;
      return aOrder - bOrder;
    });

    const draggedIndex = sortedTopics.findIndex(t => t.id === draggedTopic);
    const dropIndex = sortedTopics.findIndex(t => t.id === dropTargetId);

    if (draggedIndex === -1 || dropIndex === -1) return;

    // Reorder topics
    const [removed] = sortedTopics.splice(draggedIndex, 1);
    sortedTopics.splice(dropIndex, 0, removed);

    // Update order_index for all topics
    const updatedTopics = sortedTopics.map((topic, index) => ({
      ...topic,
      order_index: index
    }));

    // Optimistically update UI
    setTopics(updatedTopics);
    setDraggedTopic(null);
    setDragOverTopic(null);

    // Save to backend
    try {
      const { getApiUrl } = await import('@/app/utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');

      const response = await fetch(`${apiUrl}/api/cpd/topics/reorder`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          course_id: courseId,
          topics: updatedTopics.map(t => ({ id: t.id, order_index: t.order_index }))
        })
      });

      const data = await response.json();

      if (!data.success) {
        showSweetAlert({
          title: 'Error',
          text: 'Failed to save topic order',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        // Reload to get correct order
        loadCourseData();
      } else {
        showSweetAlert({
          title: 'Success!',
          text: 'Topic order updated successfully',
          icon: 'success',
          confirmButtonText: 'OK',
          timer: 2000
        });
      }
    } catch (error) {
      showSweetAlert({
        title: 'Error',
        text: 'Failed to save topic order',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      // Reload to get correct order
      loadCourseData();
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.pdf')) return '📄';
    if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return '📝';
    if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) return '📊';
    if (fileName.endsWith('.mp4')) return '🎥';
    return '📎';
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Admin', 'Assessor']} userRole={userRole}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading course...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Assessor']} userRole={userRole}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => window.location.href = `/dashboard/${userRole || 'admin'}`}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{course?.title}</h1>
            <p className="text-gray-600 mt-2">Manage CPD course topics, files, and quizzes</p>
          </div>

          {/* Course Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Course Topics ({topics.length})
              </h2>
              <button
                onClick={() => setShowNewTopicForm(!showNewTopicForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showNewTopicForm ? 'Cancel' : '+ Add New Topic'}
              </button>
            </div>

            {/* New Topic Form */}
            {showNewTopicForm && (
              <div className="mb-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-4">New Topic</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newTopic.title}
                    onChange={(e) => setNewTopic({...newTopic, title: e.target.value})}
                    placeholder="Topic Title (e.g., Introduction to Health & Social Care)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <textarea
                    value={newTopic.description}
                    onChange={(e) => setNewTopic({...newTopic, description: e.target.value})}
                    rows={2}
                    placeholder="Topic Description (optional)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📅 Topic Deadline (optional)
                    </label>
                    <input
                      type="date"
                      value={newTopic.deadline}
                      onChange={(e) => setNewTopic({...newTopic, deadline: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">Students will see this deadline for completing the topic</p>
                  </div>
                  
                  {/* General Files (without section) - SHOW FIRST */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📎 General Files (without section)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.avi,.mov"
                      onChange={handleFileUpload}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    {uploadingFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {uploadingFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                            <span className="flex items-center gap-2">
                              {getFileIcon(file.name)} {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sections with Files - SHOW BELOW GENERAL FILES */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        📑 Sections with Files (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={addSection}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        + Add Section
                      </button>
                    </div>
                    
                    {sections.map((section, sectionIndex) => (
                      <div key={sectionIndex} className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => updateSectionTitle(sectionIndex, e.target.value)}
                            placeholder="Section Title (e.g., Introduction, Main Content, Summary)"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg mr-2"
                          />
                          <button
                            type="button"
                            onClick={() => removeSection(sectionIndex)}
                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-2">
                            Files for this section:
                          </label>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.avi,.mov"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              addFilesToSection(sectionIndex, files);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          {section.files.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {section.files.map((file, fileIdx) => (
                                <div key={fileIdx} className="flex items-center justify-between bg-white px-2 py-1 rounded text-sm">
                                  <span className="flex items-center gap-2">
                                    {getFileIcon(file.name)} {file.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeFileFromSection(sectionIndex, fileIdx)}
                                    className="text-red-600 hover:text-red-800"
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

                  <button
                    onClick={handleAddTopic}
                    disabled={addingTopic}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {addingTopic ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Adding Topic...</span>
                      </>
                    ) : (
                      <>
                        <span>✓</span>
                        <span>Add Topic</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Topics List */}
            {topics.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-4">No topics added yet</p>
                <button
                  onClick={() => setShowNewTopicForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Your First Topic
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {[...topics].sort((a, b) => {
                  // Sort by order_index if available, otherwise by topic_number
                  const aOrder = a.order_index ?? (a.topic_number ?? 0) - 1;
                  const bOrder = b.order_index ?? (b.topic_number ?? 0) - 1;
                  return aOrder - bOrder;
                }).map((topic, index) => (
                  <div 
                    key={topic.id} 
                    className={`border rounded-lg transition-all ${
                      dragOverTopic === topic.id ? 'border-blue-500 border-2 bg-blue-50' : 'border-gray-200'
                    } ${draggedTopic === topic.id ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, topic.id)}
                    onDragOver={(e) => handleDragOver(e, topic.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, topic.id)}
                  >
                    {/* Topic Header */}
                    <div className="p-4 hover:bg-gray-50 flex justify-between items-center">
                      <div
                        onClick={() => setExpandedTopic(expandedTopic === topic.id ? null : topic.id)}
                        className="flex items-center gap-3 cursor-pointer flex-1"
                      >
                        <span className="text-2xl cursor-move" title="Drag to reorder">⋮⋮</span>
                        <span className="text-2xl">📂</span>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">{topic.title}</h3>
                          <p className="text-sm text-gray-500">
                            {topic.files?.length || 0} files • 
                            {topic.practice_quiz ? ' Practice Quiz ✓' : ' No Practice Quiz'} • 
                            {topic.final_quiz ? ' Final Quiz ✓' : ' No Final Quiz'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTopic(topic.id, topic.title);
                          }}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          title="Delete Topic"
                        >
                          🗑️ Delete Topic
                        </button>
                        <span 
                          className="text-2xl cursor-pointer" 
                          onClick={() => setExpandedTopic(expandedTopic === topic.id ? null : topic.id)}
                        >
                          {expandedTopic === topic.id ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>

                    {/* Topic Content (Expanded) */}
                    {expandedTopic === topic.id && (
                      <div className="p-6 border-t bg-gray-50 space-y-6">
                        {/* Files Section */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-gray-900">Learning Materials</h4>
                            <button className="text-sm text-blue-600 hover:text-blue-800">
                              + Add Files
                            </button>
                          </div>
                          {topic.files && topic.files.length > 0 ? (
                            <div className="space-y-2">
                              {topic.files.map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between bg-white p-3 rounded border">
                                  <span className="flex items-center gap-2">
                                    {getFileIcon(file.file_name)} {file.file_name}
                                  </span>
                                  <button 
                                    onClick={() => handleDeleteFile(file.id, topic.id)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">No files uploaded</p>
                          )}
                        </div>

                        {/* Quizzes Section */}
                        <div className="border-t pt-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Quizzes</h4>
                          
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Practice Quiz */}
                            <div className="bg-white p-4 rounded-lg border">
                              <h5 className="font-medium text-gray-900 mb-2">🧪 Practice Quiz</h5>
                              <p className="text-xs text-gray-600 mb-3">Unlimited attempts, no unlock required</p>
                              {topic.practice_quiz ? (
                                <div>
                                  <p className="text-sm text-green-600 mb-2">✓ Quiz created (Pass: {topic.practice_quiz?.passing_score}%)</p>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleDeleteQuiz(topic.practice_quiz?.id!, 'practice', topic.id)}
                                      className="text-sm text-red-600 hover:text-red-800"
                                    >
                                      Delete
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button 
                                      onClick={() => {
                                        showSweetAlert({
                                          title: 'Recreate Quiz?',
                                          text: 'This will delete the current quiz and create a new one. Continue?',
                                          icon: 'warning',
                                          showCancelButton: true,
                                          confirmButtonText: 'Yes, recreate!',
                                          cancelButtonText: 'Cancel',
                                          onConfirm: async () => {
                                            await handleDeleteQuiz(topic.practice_quiz?.id!, 'practice', topic.id);
                                            setShowQuizForm({topicId: topic.id, type: 'practice'});
                                          }
                                        });
                                      }}
                                      className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                      Recreate
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setShowQuizForm({topicId: topic.id, type: 'practice'})}
                                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                >
                                  + Create Practice Quiz
                                </button>
                              )}
                            </div>

                            {/* Final Quiz */}
                            <div className="bg-white p-4 rounded-lg border">
                              <h5 className="font-medium text-gray-900 mb-2">🏁 Final Quiz</h5>
                              <p className="text-xs text-gray-600 mb-3">Pass required to unlock next topic</p>
                              {topic.final_quiz ? (
                                <div>
                                  <p className="text-sm text-green-600 mb-2">✓ Quiz created (Pass: {topic.final_quiz?.passing_score}%)</p>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleDeleteQuiz(topic.final_quiz?.id!, 'final', topic.id)}
                                      className="text-sm text-red-600 hover:text-red-800"
                                    >
                                      Delete
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button 
                                      onClick={() => {
                                        showSweetAlert({
                                          title: 'Recreate Quiz?',
                                          text: 'This will delete the current quiz and create a new one. Continue?',
                                          icon: 'warning',
                                          showCancelButton: true,
                                          confirmButtonText: 'Yes, recreate!',
                                          cancelButtonText: 'Cancel',
                                          onConfirm: async () => {
                                            await handleDeleteQuiz(topic.final_quiz?.id!, 'final', topic.id);
                                            setShowQuizForm({topicId: topic.id, type: 'final'});
                                          }
                                        });
                                      }}
                                      className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                      Recreate
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setShowQuizForm({topicId: topic.id, type: 'final'})}
                                  className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                >
                                  + Create Final Quiz
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quiz Creation Modal - GIFT Format */}
          {showQuizForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Create {showQuizForm.type === 'practice' ? '🧪 Practice' : '🏁 Final'} Quiz
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quiz Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="e.g., Practice Quiz"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Passing Score (%) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={quizPassingScore}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuizPassingScore(val === '' ? 70 : parseInt(val) || 70);
                      }}
                      min="0"
                      max="100"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {showQuizForm.type === 'final' ? 
                        '⚠️ Students must score this to unlock next topic' : 
                        'Used for grading only (no unlock requirement)'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GIFT Format Quiz <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={giftText}
                      onChange={(e) => setGiftText(e.target.value)}
                      rows={12}
                      placeholder="Paste GIFT format questions here...&#10;&#10;Example:&#10;::Question 1:: What is health? {&#10;  =Physical, mental and social wellbeing&#10;  ~Just physical fitness&#10;  ~Only mental state&#10;  ~Absence of disease&#10;}"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm text-blue-800 font-medium mb-1">📝 GIFT Format Guide:</p>
                    <ul className="text-xs text-blue-700 space-y-1 ml-4">
                      <li>• Start with ::Question Title::</li>
                      <li>• Use = for correct answer</li>
                      <li>• Use ~ for wrong answers</li>
                      <li>• Questions auto-imported instantly!</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowQuizForm(null);
                      setQuizTitle('');
                      setGiftText('');
                      setQuizPassingScore(70);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!quizTitle || !giftText) {
                        showSweetAlert({
                          title: 'Validation Error',
                          text: 'Please enter quiz title and GIFT format questions',
                          icon: 'warning',
                          confirmButtonText: 'OK'
                        });
                        return;
                      }

                      try {
                        const response = await apiService.importCPDQuizGift(
                          showQuizForm.topicId,
                          giftText,
                          quizTitle,
                          showQuizForm.type,
                          quizPassingScore
                        );

                        if (response.success) {
                          showSweetAlert({
                            title: 'Success!',
                            text: `Quiz created with ${response.questionCount || 0} questions!`,
                            icon: 'success',
                            confirmButtonText: 'OK'
                          });
                          setShowQuizForm(null);
                          setQuizTitle('');
                          setGiftText('');
                          setQuizPassingScore(70);
                          loadCourseData();
                        } else {
                          showSweetAlert({
                            title: 'Error',
                            text: 'Failed to create quiz: ' + (response.message || 'Unknown error'),
                            icon: 'error',
                            confirmButtonText: 'OK'
                          });
                        }
                      } catch (error) {
                        showSweetAlert({
                          title: 'Error',
                          text: 'Failed to create quiz. Please try again.',
                          icon: 'error',
                          confirmButtonText: 'OK'
                        });
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ✓ Create Quiz
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ManageCPDCourse;


