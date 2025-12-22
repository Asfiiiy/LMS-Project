'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';

interface CPDTopic {
  id: number;
  topic_number: number;
  title: string;
  description: string;
  deadline: string;
  files: any[];
  practice_quiz?: {
    id: number;
    title: string;
    time_limit: number;
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
  
  const [userRole, setUserRole] = useState<'admin' | 'tutor' | 'student' | null>(null);
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
  
  // Quiz Form States
  const [showQuizForm, setShowQuizForm] = useState<{topicId: number; type: 'practice' | 'final'} | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizPassingScore, setQuizPassingScore] = useState(70);
  const [giftText, setGiftText] = useState('');
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const role = user?.role?.toLowerCase() || null;
    setUserRole(role as 'admin' | 'tutor' | 'student' | null);
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
        alert('Failed to load course data');
      }
    } catch (error) {
      console.error('Error loading course:', error);
      alert('Error loading course data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = async () => {
    if (!newTopic.title) {
      alert('Please enter topic title');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('topic_number', (topics.length + 1).toString());
      formData.append('title', newTopic.title);
      formData.append('description', newTopic.description);
      formData.append('deadline', newTopic.deadline);
      
      uploadingFiles.forEach((file) => {
        formData.append(`files`, file);
      });

      const response = await apiService.addCPDTopic(courseId, formData);
      
      if (response.success) {
        alert('Topic added successfully!');
        setNewTopic({ title: '', description: '', deadline: '' });
        setUploadingFiles([]);
        setShowNewTopicForm(false);
        loadCourseData();
      } else {
        alert('Failed to add topic');
      }
    } catch (error) {
      console.error('Error adding topic:', error);
      alert('Failed to add topic');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadingFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteFile = async (fileId: number, topicId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await apiService.deleteCPDFile(fileId);
      if (response.success) {
        alert('File deleted successfully!');
        loadCourseData();
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const handleDeleteQuiz = async (quizId: number, quizType: string, topicId: number) => {
    if (!confirm(`Are you sure you want to delete this ${quizType} quiz? This will also delete all questions.`)) {
      return;
    }

    try {
      const response = await apiService.deleteCPDQuiz(quizId);
      
      if (response.success) {
        alert('Quiz deleted successfully!');
        loadCourseData();
      } else {
        alert('Failed to delete quiz');
      }
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('Failed to delete quiz');
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
      <ProtectedRoute allowedRoles={['admin', 'tutor']} userRole={userRole}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading course...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['admin', 'tutor']} userRole={userRole}>
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
                <h3 className="font-semibold text-gray-900 mb-4">New Topic (Unit {topics.length + 1})</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newTopic.title}
                    onChange={(e) => setNewTopic({...newTopic, title: e.target.value})}
                    placeholder="Topic Title (e.g., Unit 1 - Introduction to Health & Social Care)"
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Files (PDF, Word, PPT, Video)
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

                  <button
                    onClick={handleAddTopic}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                  >
                    ✓ Add Topic
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
                {topics.map((topic, index) => (
                  <div key={topic.id} className="border border-gray-200 rounded-lg">
                    {/* Topic Header */}
                    <div
                      onClick={() => setExpandedTopic(expandedTopic === topic.id ? null : topic.id)}
                      className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📂</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                          <p className="text-sm text-gray-500">
                            {topic.files?.length || 0} files • 
                            {topic.practice_quiz ? ' Practice Quiz ✓' : ' No Practice Quiz'} • 
                            {topic.final_quiz ? ' Final Quiz ✓' : ' No Final Quiz'}
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl">{expandedTopic === topic.id ? '▼' : '▶'}</span>
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
                                  <p className="text-sm text-green-600 mb-2">✓ Quiz created (Pass: {topic.practice_quiz.passing_score}%)</p>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleDeleteQuiz(topic.practice_quiz.id, 'practice', topic.id)}
                                      className="text-sm text-red-600 hover:text-red-800"
                                    >
                                      Delete
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button 
                                      onClick={async () => {
                                        if (confirm('Delete and recreate this quiz?')) {
                                          await handleDeleteQuiz(topic.practice_quiz.id, 'practice', topic.id);
                                          setShowQuizForm({topicId: topic.id, type: 'practice'});
                                        }
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
                                  <p className="text-sm text-green-600 mb-2">✓ Quiz created (Pass: {topic.final_quiz.passing_score}%)</p>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleDeleteQuiz(topic.final_quiz.id, 'final', topic.id)}
                                      className="text-sm text-red-600 hover:text-red-800"
                                    >
                                      Delete
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button 
                                      onClick={async () => {
                                        if (confirm('Delete and recreate this quiz?')) {
                                          await handleDeleteQuiz(topic.final_quiz.id, 'final', topic.id);
                                          setShowQuizForm({topicId: topic.id, type: 'final'});
                                        }
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
                      placeholder="e.g., Unit 1 Practice Quiz"
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
                        alert('Please enter quiz title and GIFT format questions');
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
                          alert(`✅ Quiz created with ${response.questionCount || 0} questions!`);
                          setShowQuizForm(null);
                          setQuizTitle('');
                          setGiftText('');
                          setQuizPassingScore(70);
                          loadCourseData();
                        } else {
                          alert('Failed to create quiz: ' + (response.message || 'Unknown error'));
                        }
                      } catch (error) {
                        console.error('Error creating quiz:', error);
                        alert('Failed to create quiz');
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


