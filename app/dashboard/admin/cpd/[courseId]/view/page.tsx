'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';

interface CPDCourse {
  id: number;
  title: string;
  description: string;
}

interface CPDTopic {
  id: number;
  topic_number: number;
  title: string;
  description: string;
  deadline: string;
  files: any[];
  practice_quiz?: any;
  final_quiz?: any;
  progress: {
    is_unlocked: number;
    practice_quiz_attempted: number;
    practice_quiz_best_score: number;
    final_quiz_attempted: number;
    final_quiz_passed: number;
    final_quiz_score: number;
  };
}

const AdminCPDView = () => {
  const params = useParams();
  const courseId = parseInt(params.courseId as string);
  
  const [course, setCourse] = useState<CPDCourse | null>(null);
  const [announcements, setAnnouncements] = useState<any>(null);
  const [faq, setFaq] = useState<any>(null);
  const [topics, setTopics] = useState<CPDTopic[]>([]);
  const [canClaimCertificate, setCanClaimCertificate] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<CPDTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<'Admin' | 'Tutor' | 'Student' | null>(null);
  const [viewingFile, setViewingFile] = useState<{url: string; name: string} | null>(null);
  const [extendingDeadline, setExtendingDeadline] = useState<number | null>(null);
  const [newDeadline, setNewDeadline] = useState('');
  
  // Edit states
  const [editingTopic, setEditingTopic] = useState<number | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicDescription, setEditTopicDescription] = useState('');
  const [viewingQuiz, setViewingQuiz] = useState<{quiz: any; questions: any[]} | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [addingQuestion, setAddingQuestion] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    question_type: 'multiple_choice',
    points: 1,
    options: ['', '', '', ''],
    correct_answer: 0
  });
  const [editQuizTitle, setEditQuizTitle] = useState('');
  const [editQuizScore, setEditQuizScore] = useState(0);
  const [editQuizGiftFormat, setEditQuizGiftFormat] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<number | null>(null);
  const [replacingFile, setReplacingFile] = useState<number | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    if (user && user.id) {
      setUserId(user.id);
      const role = user.role || null;
      setUserRole(role as 'Admin' | 'Tutor' | 'Student' | null);
      loadCourseData(user.id);
    } else {
      setError('Please login to view this course');
      setLoading(false);
    }
  }, [courseId]);

  const loadCourseData = async (userId: number) => {
    try {
      setLoading(true);
      const data = await apiService.getCPDCourseForStudent(courseId, userId);
      
      if (data.success) {
        setCourse(data.course);
        setAnnouncements(data.announcements);
        setFaq(data.faq);
        setTopics(data.topics);
        setCanClaimCertificate(data.canClaimCertificate);
        
        // Auto-select first unlocked topic
        const firstUnlocked = data.topics.find((t: CPDTopic) => t.progress.is_unlocked === 1);
        if (firstUnlocked) {
          setSelectedTopic(firstUnlocked);
        }
      } else {
        setError(data.message || 'Failed to load course');
      }
    } catch (error) {
      console.error('Error loading CPD course:', error);
      setError('Failed to load course data');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimCertificate = async () => {
    if (!userId) return;
    
    try {
      const response = await apiService.claimCPDCertificate(courseId, userId);
      if (response.success) {
        alert('Certificate claimed successfully!');
      }
    } catch (error) {
      console.error('Error claiming certificate:', error);
      alert('Failed to claim certificate');
    }
  };

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return null;
    
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return { status: 'overdue', text: 'Overdue', color: 'text-red-600 bg-red-50 border-red-200', icon: '⚠️' };
    } else if (daysUntil === 0) {
      return { status: 'today', text: 'Due Today', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '🔔' };
    } else if (daysUntil <= 3) {
      return { status: 'urgent', text: `${daysUntil} days left`, color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '⏰' };
    } else if (daysUntil <= 7) {
      return { status: 'upcoming', text: `${daysUntil} days left`, color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '📅' };
    } else {
      return { status: 'normal', text: `${daysUntil} days left`, color: 'text-blue-600 bg-blue-50 border-blue-200', icon: '📆' };
    }
  };

  const handleExtendDeadline = async (topicId: number) => {
    if (!newDeadline) {
      alert('Please select a new deadline date');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/topics/${topicId}/deadline`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ deadline: newDeadline })
      });

      const data = await response.json();
      if (data.success) {
        alert('Deadline updated successfully!');
        setExtendingDeadline(null);
        setNewDeadline('');
        if (userId) loadCourseData(userId);
      } else {
        alert(data.message || 'Failed to update deadline');
      }
    } catch (error) {
      console.error('Error updating deadline:', error);
      alert('Failed to update deadline');
    }
  };

  const getDownloadUrl = (fileUrl: string, fileName: string) => {
    return `http://localhost:5000/api/cpd/download-file?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('doc')) return '📝';
    if (fileType.includes('powerpoint') || fileType.includes('ppt')) return '📊';
    if (fileType.includes('video') || fileType.includes('mp4')) return '🎥';
    return '📎';
  };

  // Edit Topic Name/Description
  const handleUpdateTopic = async (topicId: number) => {
    if (!editTopicTitle.trim()) {
      alert('Topic title is required');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/topics/${topicId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: editTopicTitle,
          description: editTopicDescription
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Topic updated successfully!');
        setEditingTopic(null);
        if (userId) loadCourseData(userId);
      } else {
        alert(data.message || 'Failed to update topic');
      }
    } catch (error) {
      console.error('Error updating topic:', error);
      alert('Failed to update topic');
    }
  };

  // Delete Topic
  const handleDeleteTopic = async (topicId: number) => {
    if (!confirm('Are you sure you want to delete this topic? This will also delete all associated files and quizzes.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/topics/${topicId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('Topic deleted successfully!');
        setSelectedTopic(null);
        if (userId) loadCourseData(userId);
      } else {
        alert(data.message || 'Failed to delete topic');
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert('Failed to delete topic');
    }
  };

  // Delete File
  const handleDeleteFile = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('File deleted successfully!');
        if (userId) loadCourseData(userId);
      } else {
        alert(data.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  // View Quiz with Questions
  const handleViewQuiz = async (quiz: any) => {
    try {
      const response = await fetch(`http://localhost:5000/api/cpd/quizzes/${quiz.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setViewingQuiz({ quiz, questions: data.questions });
        setEditQuizTitle(quiz.title);
        setEditQuizScore(quiz.passing_score);
        
        // Convert questions to GIFT format
        let giftText = '';
        data.questions.forEach((q: any, idx: number) => {
          giftText += `// Q${idx + 1}\n`;
          giftText += `::Q${idx + 1} - ${q.question_text.substring(0, 30)}::\n`;
          giftText += `${q.question_text}\n`;
          giftText += `{\n`;
          q.options.forEach((opt: any) => {
            if (opt.is_correct) {
              giftText += `==${opt.option_text}\n`;
            } else {
              giftText += `~~${opt.option_text}\n`;
            }
          });
          giftText += `}\n\n`;
        });
        setEditQuizGiftFormat(giftText);
      } else {
        alert('Failed to load quiz questions');
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
      alert('Failed to load quiz');
    }
  };

  // Update Quiz Passing Score
  const handleUpdateQuizScore = async (quizId: number, passingScore: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/cpd/quizzes/${quizId}/passing-score`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ passing_score: passingScore })
      });

      const data = await response.json();
      if (data.success) {
        alert('Passing score updated!');
        if (userId) loadCourseData(userId);
      } else {
        alert('Failed to update passing score');
      }
    } catch (error) {
      console.error('Error updating passing score:', error);
      alert('Failed to update passing score');
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('Question deleted!');
        // Reload quiz questions
        if (viewingQuiz) {
          handleViewQuiz(viewingQuiz.quiz);
        }
      } else {
        alert('Failed to delete question');
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  // Add New Question
  const handleAddQuestion = async (quizId: number) => {
    if (!newQuestion.question_text.trim()) {
      alert('Question text is required');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newQuestion)
      });

      const data = await response.json();
      if (data.success) {
        alert('Question added!');
        setAddingQuestion(null);
        setNewQuestion({
          question_text: '',
          question_type: 'multiple_choice',
          points: 1,
          options: ['', '', '', ''],
          correct_answer: 0
        });
        // Reload quiz questions
        if (viewingQuiz) {
          handleViewQuiz(viewingQuiz.quiz);
        }
      } else {
        alert('Failed to add question');
      }
    } catch (error) {
      console.error('Error adding question:', error);
      alert('Failed to add question');
    }
  };

  // Upload More Files
  const handleUploadFiles = async (topicId: number, files: FileList) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/topics/${topicId}/upload-files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        alert('Files uploaded successfully!');
        setUploadingFiles(null);
        if (userId) loadCourseData(userId);
      } else {
        alert('Failed to upload files');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files');
    }
  };

  // Replace File
  const handleReplaceFile = async (fileId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/files/${fileId}/replace`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        alert('File replaced successfully!');
        setReplacingFile(null);
        if (userId) loadCourseData(userId);
      } else {
        alert('Failed to replace file');
      }
    } catch (error) {
      console.error('Error replacing file:', error);
      alert('Failed to replace file');
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('Are you sure you want to delete this quiz? All questions and student attempts will be lost.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/cpd/quizzes/${quizId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('Quiz deleted successfully!');
        if (userId) loadCourseData(userId);
      } else {
        alert('Failed to delete quiz');
      }
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('Failed to delete quiz');
    }
  };

  // Save Edited Quiz (GIFT Format)
  const handleSaveQuizEdit = async () => {
    if (!viewingQuiz) return;

    try {
      // First update quiz title and passing score
      await fetch(`http://localhost:5000/api/cpd/quizzes/${viewingQuiz.quiz.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: editQuizTitle,
          passing_score: editQuizScore
        })
      });

      // Then update questions via GIFT format
      const response = await fetch(`http://localhost:5000/api/cpd/quizzes/${viewingQuiz.quiz.id}/update-gift`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          gift_format: editQuizGiftFormat
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Quiz updated successfully!');
        setViewingQuiz(null);
        if (userId) loadCourseData(userId);
      } else {
        alert(data.message || 'Failed to update quiz');
      }
    } catch (error) {
      console.error('Error updating quiz:', error);
      alert('Failed to update quiz');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Admin', 'Tutor']} userRole={userRole}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading course...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute allowedRoles={['Admin', 'Tutor']} userRole={userRole}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Tutor']} userRole={userRole}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Course Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <button
              onClick={() => window.location.href = '/dashboard/admin'}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{course?.title}</h1>
            <p className="text-gray-600">{course?.description}</p>
          </div>

          {/* General Sections */}
          <div className="space-y-4 mb-6">
            {announcements && (
              <details className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                  <span className="text-2xl">📢</span>
                  General News & Announcements
                  <span className="ml-auto text-2xl">›</span>
                </summary>
                <div className="mt-4 pl-8">
                  <h3 className="font-medium">{announcements.title}</h3>
                  <p className="text-gray-600 mt-2">{announcements.description}</p>
                  {announcements.files && announcements.files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {announcements.files.map((file: any) => (
                        <div
                          key={file.id}
                          onClick={() => setViewingFile({url: file.file_path, name: file.file_name})}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {getFileIcon(file.file_type)} {file.file_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}

            {faq && (
              <details className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                  <span className="text-2xl">📂</span>
                  General FAQ
                  <span className="ml-auto text-2xl">›</span>
                </summary>
                <div className="mt-4 pl-8">
                  <p className="text-gray-700">{faq.content}</p>
                  {faq.files && faq.files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {faq.files.map((file: any) => (
                        <div
                          key={file.id}
                          onClick={() => setViewingFile({url: file.file_path, name: file.file_name})}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {getFileIcon(file.file_type)} {file.file_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>

          {/* Topics List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Modules</h2>
            <div className="space-y-3">
              {topics.map((topic) => {
                const deadlineInfo = getDeadlineStatus(topic.deadline);
                return (
                  <div key={topic.id} className="space-y-2">
                    <div
                      onClick={() => setSelectedTopic(topic)}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer border-blue-200 hover:border-blue-400 bg-blue-50 ${
                        selectedTopic?.id === topic.id ? 'border-blue-500 bg-blue-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-2xl">📂</span>
                        <div className="flex-1">
                          <span className="text-sm text-blue-600 font-medium">Unit {topic.topic_number}</span>
                          <h3 className="font-medium text-gray-900">{topic.title}</h3>
                          {topic.deadline && (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-500">
                                Deadline: {new Date(topic.deadline).toLocaleDateString()}
                              </p>
                              {deadlineInfo && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${deadlineInfo.color}`}>
                                  {deadlineInfo.icon} {deadlineInfo.text}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExtendingDeadline(topic.id);
                                  setNewDeadline(topic.deadline ? new Date(topic.deadline).toISOString().split('T')[0] : '');
                                }}
                                className="ml-2 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                ✏️ Extend
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTopic(topic.id);
                            setEditTopicTitle(topic.title);
                            setEditTopicDescription(topic.description || '');
                          }}
                          className="text-xs px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTopic(topic.id);
                          }}
                          className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          🗑️ Delete
                        </button>
                        <span className="text-2xl">›</span>
                      </div>
                    </div>

                    {/* Deadline Extension Form */}
                    {extendingDeadline === topic.id && (
                      <div className="ml-12 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">Extend Deadline</h4>
                        <div className="flex items-center gap-3">
                          <input
                            type="date"
                            value={newDeadline}
                            onChange={(e) => setNewDeadline(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                          />
                          <button
                            onClick={() => handleExtendDeadline(topic.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setExtendingDeadline(null);
                              setNewDeadline('');
                            }}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Edit Topic Form */}
                    {editingTopic === topic.id && (
                      <div className="ml-12 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-3">Edit Topic</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input
                              type="text"
                              value={editTopicTitle}
                              onChange={(e) => setEditTopicTitle(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              placeholder="Topic title"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={editTopicDescription}
                              onChange={(e) => setEditTopicDescription(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              rows={3}
                              placeholder="Topic description"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleUpdateTopic(topic.id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => {
                                setEditingTopic(null);
                                setEditTopicTitle('');
                                setEditTopicDescription('');
                              }}
                              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Topic Content */}
          {selectedTopic && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedTopic.title}</h2>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              {selectedTopic.description && (
                <p className="text-gray-600 mb-6">{selectedTopic.description}</p>
              )}

              {/* Topic Files */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Course Materials</h3>
                  <button
                    onClick={() => setUploadingFiles(selectedTopic.id)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ➕ Upload More Files
                  </button>
                </div>

                {/* Upload Files Form */}
                {uploadingFiles === selectedTopic.id && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">Upload New Files</h4>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          handleUploadFiles(selectedTopic.id, e.target.files);
                        }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                    <button
                      onClick={() => setUploadingFiles(null)}
                      className="mt-2 px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {selectedTopic.files && selectedTopic.files.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTopic.files.map((file: any) => (
                      <div key={file.id}>
                        <div className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div 
                            onClick={() => setViewingFile({url: file.file_path, name: file.file_name})}
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                          >
                            <span className="text-3xl">{getFileIcon(file.file_type)}</span>
                            <div>
                              <p className="font-medium text-gray-900">{file.file_name}</p>
                              <p className="text-xs text-gray-500">
                                {file.file_type.includes('pdf') ? 'PDF Document' : 
                                 file.file_type.includes('video') ? 'Video' : 'File'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setReplacingFile(file.id)}
                              className="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                            >
                              🔄 Replace
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>

                        {/* Replace File Form */}
                        {replacingFile === file.id && (
                          <div className="mt-2 ml-12 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h5 className="font-semibold text-sm text-gray-900 mb-2">Replace: {file.file_name}</h5>
                            <input
                              type="file"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleReplaceFile(file.id, e.target.files[0]);
                                }
                              }}
                              className="block w-full text-sm text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-yellow-600 file:text-white hover:file:bg-yellow-700"
                            />
                            <button
                              onClick={() => setReplacingFile(null)}
                              className="mt-2 px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No files uploaded yet</p>
                )}
              </div>

              {/* Quiz Section */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quizzes</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Practice Quiz */}
                  {(selectedTopic as any).practice_quiz ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🧪</span>
                        <h4 className="font-semibold text-gray-900">Practice Quiz</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {(selectedTopic as any).practice_quiz.title}
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        Pass: {(selectedTopic as any).practice_quiz.passing_score}% • Unlimited attempts
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleViewQuiz((selectedTopic as any).practice_quiz)}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          ✏️ Edit Quiz
                        </button>
                        <button 
                          onClick={() => handleDeleteQuiz((selectedTopic as any).practice_quiz.id)}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🧪</span>
                        <h4 className="font-semibold text-gray-500">Practice Quiz</h4>
                      </div>
                      <p className="text-sm text-gray-500">No practice quiz available</p>
                    </div>
                  )}

                  {/* Final Quiz */}
                  {(selectedTopic as any).final_quiz ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🏁</span>
                        <h4 className="font-semibold text-gray-900">Final Test</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {(selectedTopic as any).final_quiz.title}
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        Pass: {(selectedTopic as any).final_quiz.passing_score}% • Required to unlock next topic
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleViewQuiz((selectedTopic as any).final_quiz)}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                        >
                          ✏️ Edit Quiz
                        </button>
                        <button 
                          onClick={() => handleDeleteQuiz((selectedTopic as any).final_quiz.id)}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🏁</span>
                        <h4 className="font-semibold text-gray-500">Final Test</h4>
                      </div>
                      <p className="text-sm text-gray-500">No final test available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Claim Certificate */}
          {canClaimCertificate && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">🎓 Congratulations!</h3>
                  <p className="text-gray-600">You've completed all modules. Claim your certificate now!</p>
                </div>
                <button
                  onClick={handleClaimCertificate}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Claim Certificate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

          {/* Quiz Editor Modal (GIFT Format) */}
          {viewingQuiz && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <div>
                    <h3 className="font-semibold text-lg">Edit Quiz</h3>
                    <p className="text-sm text-gray-500">
                      {viewingQuiz.quiz.quiz_type === 'practice' ? '🧪 Practice Quiz' : '🏁 Final Test'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setViewingQuiz(null);
                      setAddingQuestion(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                  {/* Quiz Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quiz Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editQuizTitle}
                      onChange={(e) => setEditQuizTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Practice"
                    />
                  </div>

                  {/* Passing Score */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passing Score (%) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={editQuizScore || ''}
                      onChange={(e) => setEditQuizScore(parseInt(e.target.value) || 0)}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Used for grading only (no unlock requirement)</p>
                  </div>

                  {/* GIFT Format Quiz */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GIFT Format Quiz <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={editQuizGiftFormat}
                      onChange={(e) => setEditQuizGiftFormat(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                      rows={20}
                      placeholder="~Working memory&#13;&#10;}&#13;&#10;&#13;&#10;// Q5&#13;&#10;::Q5 - Child Development::&#13;&#10;Which skill belongs to *social development*?&#13;&#10;{&#13;&#10;==Sharing toys with others&#13;&#10;~~Running fast&#13;&#10;~~Drawing shapes&#13;&#10;~~Solving math problems&#13;&#10;}"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="p-4 border-t flex justify-end gap-3">
                  <button
                    onClick={() => setViewingQuiz(null)}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveQuizEdit}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Quiz
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PDF/File Viewer Modal */}
          {viewingFile && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold text-lg">{viewingFile.name}</h3>
                  <div className="flex items-center gap-3">
                    <a
                      href={getDownloadUrl(viewingFile.url, viewingFile.name)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                    >
                      ⬇️ Download
                    </a>
                    <button
                      onClick={() => setViewingFile(null)}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>
            <div className="flex-1 overflow-hidden">
              {viewingFile.url.includes('.pdf') || viewingFile.name.endsWith('.pdf') ? (
                <iframe
                  src={
                    viewingFile.url.includes('cloudinary.com')
                      ? `http://localhost:5000/api/cpd/proxy-pdf?url=${encodeURIComponent(viewingFile.url)}`
                      : `${viewingFile.url}#toolbar=1&navpanes=0&scrollbar=1`
                  }
                  className="w-full h-full"
                  title={viewingFile.name}
                  allow="fullscreen"
                  style={{ border: 'none' }}
                  onLoad={() => console.log('[CPD] PDF loaded successfully')}
                  onError={(e) => {
                    console.error('[CPD] PDF load error:', e);
                    console.log('[CPD] Failed URL:', viewingFile.url);
                  }}
                />
              ) : viewingFile.url.includes('.mp4') || viewingFile.url.includes('video') ? (
                <video controls className="w-full h-full">
                  <source src={viewingFile.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-gray-600 mb-4">This file type cannot be previewed</p>
                  <a
                    href={viewingFile.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
};

export default AdminCPDView;

