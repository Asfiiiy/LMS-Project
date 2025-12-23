'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';

interface Topic {
  id: number;
  topic_number: number;
  title: string;
  description: string;
  deadline: string | null;
  files: any[];
}

export default function EditQualificationUnit() {
  const params = useParams();
  const router = useRouter();
  const unitId = parseInt(params.unitId as string);
  
  const [userRole, setUserRole] = useState<string | null>(null);
  const [unit, setUnit] = useState<any>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [additionalReadings, setAdditionalReadings] = useState<any[]>([]);
  const [assignmentBrief, setAssignmentBrief] = useState<any>(null);
  const [assignmentBriefExistingFiles, setAssignmentBriefExistingFiles] = useState<any[]>([]);
  const [presentationBrief, setPresentationBrief] = useState<any>(null);
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);
  
  // New Topic Form
  const [showNewTopicForm, setShowNewTopicForm] = useState(false);
  const [newTopic, setNewTopic] = useState({
    title: '',
    description: '',
    deadline: ''
  });
  const [topicFiles, setTopicFiles] = useState<File[]>([]);
  
  // New Lecture Form
  const [showNewLectureForm, setShowNewLectureForm] = useState(false);
  const [newLecture, setNewLecture] = useState({
    title: '',
    description: ''
  });
  const [lectureFiles, setLectureFiles] = useState<File[]>([]);
  
  // Additional Reading Form
  const [showReadingForm, setShowReadingForm] = useState(false);
  const [readingFiles, setReadingFiles] = useState<File[]>([]);
  
  // Assignment Brief Files
  const [showAssignmentBriefForm, setShowAssignmentBriefForm] = useState(false);
  const [assignmentBriefFiles, setAssignmentBriefFiles] = useState<File[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const role = user?.role || null;
    setUserRole(role);
    loadUnitData();
  }, [unitId]);

  const loadUnitData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getQualificationUnit(unitId);
      
      console.log('[Unit Editor] Received data:', response);
      
      if (response.success) {
        setUnit(response.unit);
        setTopics(response.topics || []);
        // Backend returns 'announcements' for lectures
        setLectures(response.announcements || []);
        setAdditionalReadings(response.readings || []);
        setAssignmentBrief(response.assignmentBrief || null);
        setAssignmentBriefExistingFiles(response.briefFiles || []);
        setPresentationBrief(response.presentationBrief || null);
      } else {
        alert('Failed to load unit data');
      }
    } catch (error) {
      console.error('Error loading unit:', error);
      alert('Error loading unit data');
    } finally {
      setLoading(false);
    }
  };

  // File handling helpers
  const handleTopicFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setTopicFiles(prev => [...prev, ...files]);
  };

  const handleLectureFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setLectureFiles(prev => [...prev, ...files]);
  };

  const handleReadingFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setReadingFiles(prev => [...prev, ...files]);
  };

  const handleAssignmentBriefFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAssignmentBriefFiles(prev => [...prev, ...files]);
  };

  const removeTopicFile = (index: number) => {
    setTopicFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeLectureFile = (index: number) => {
    setLectureFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeReadingFile = (index: number) => {
    setReadingFiles(prev => prev.filter((_, i) => i !== index));
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

  const handleAddTopic = async () => {
    if (!newTopic.title) {
      alert('Please enter topic title');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('unit_id', unitId.toString());
      formData.append('topic_number', (topics.length + 1).toString());
      formData.append('title', newTopic.title);
      formData.append('description', newTopic.description);
      formData.append('deadline', newTopic.deadline || '');

      topicFiles.forEach((file) => {
        formData.append('files', file);
      });

      // TODO: Implement API endpoint
      alert('Add topic endpoint coming soon!');
      
      setShowNewTopicForm(false);
      setNewTopic({ title: '', description: '', deadline: '' });
      setTopicFiles([]);
      loadUnitData();
    } catch (error) {
      console.error('Error adding topic:', error);
      alert('Error adding topic');
    }
  };

  const handleAddLecture = async () => {
    if (!newLecture.title) {
      alert('Please enter lecture title');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('unit_id', unitId.toString());
      formData.append('title', newLecture.title);
      formData.append('description', newLecture.description);

      lectureFiles.forEach((file) => {
        formData.append('files', file);
      });

      // TODO: Implement API endpoint
      alert('Add lecture endpoint coming soon!');
      
      setShowNewLectureForm(false);
      setNewLecture({ title: '', description: '' });
      setLectureFiles([]);
      loadUnitData();
    } catch (error) {
      console.error('Error adding lecture:', error);
      alert('Error adding lecture');
    }
  };

  const handleAddReading = async () => {
    if (readingFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('unit_id', unitId.toString());

      readingFiles.forEach((file) => {
        formData.append('files', file);
      });

      // TODO: Implement API endpoint
      alert('Add reading endpoint coming soon!');
      
      setShowReadingForm(false);
      setReadingFiles([]);
      loadUnitData();
    } catch (error) {
      console.error('Error adding reading:', error);
      alert('Error adding reading');
    }
  };

  const handleUploadAssignmentBriefFiles = async () => {
    if (assignmentBriefFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('unit_id', unitId.toString());

      assignmentBriefFiles.forEach((file) => {
        formData.append('files', file);
      });

      // TODO: Implement API endpoint
      alert('Upload assignment brief files endpoint coming soon!');
      
      setShowAssignmentBriefForm(false);
      setAssignmentBriefFiles([]);
      loadUnitData();
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files');
    }
  };

  const handleDeleteLecture = async (lectureId: number) => {
    if (!confirm('Are you sure you want to delete this lecture?')) {
      return;
    }

    try {
      // TODO: Implement API endpoint
      alert('Delete lecture endpoint coming soon!');
      loadUnitData();
    } catch (error) {
      console.error('Error deleting lecture:', error);
      alert('Error deleting lecture');
    }
  };

  const handleDeleteReading = async (readingId: number) => {
    if (!confirm('Are you sure you want to delete this reading?')) {
      return;
    }

    try {
      // TODO: Implement API endpoint
      alert('Delete reading endpoint coming soon!');
      loadUnitData();
    } catch (error) {
      console.error('Error deleting reading:', error);
      alert('Error deleting reading');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading unit...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Tutor']} userRole={userRole as any}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-t-4 border-purple-600">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <span className="text-4xl">📝</span>
                  {unit?.title || 'Edit Unit'}
                </h1>
                <p className="text-gray-600 mt-2">
                  {unit?.content || 'Manage topics, lectures, assignments, and quizzes for this unit'}
                </p>
              </div>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back
              </button>
            </div>

            {/* Unit Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{topics.length}</div>
                <div className="text-sm text-gray-600">Topics</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{lectures.length}</div>
                <div className="text-sm text-gray-600">Lectures</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">{additionalReadings.length}</div>
                <div className="text-sm text-gray-600">Readings</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {(unit?.enable_assignment_submission ? 1 : 0) + (unit?.enable_presentation_submission ? 1 : 0)}
                </div>
                <div className="text-sm text-gray-600">Submissions</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl shadow-lg mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                <button className="border-b-2 border-purple-600 py-4 px-1 text-sm font-medium text-purple-600">
                  📚 Topics
                </button>
                <button className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
                  🎓 Lectures
                </button>
                <button className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
                  📖 Additional Reading
                </button>
                {unit?.enable_assignment_submission && (
                  <button className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
                    📝 Assignment Brief
                  </button>
                )}
                {unit?.enable_presentation_submission && (
                  <button className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
                    🎤 Presentation Brief
                  </button>
                )}
                <button className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
                  📊 Student Progress
                </button>
              </nav>
            </div>
          </div>

          {/* Topics Section */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Topics</h2>
              <button
                onClick={() => setShowNewTopicForm(!showNewTopicForm)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl"
              >
                {showNewTopicForm ? '✕ Cancel' : '+ Add New Topic'}
              </button>
            </div>

            {/* New Topic Form */}
            {showNewTopicForm && (
              <div className="mb-6 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Topic</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Topic Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTopic.title}
                      onChange={(e) => setNewTopic({...newTopic, title: e.target.value})}
                      placeholder="e.g., Introduction to Marketing Principles"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newTopic.description}
                      onChange={(e) => setNewTopic({...newTopic, description: e.target.value})}
                      rows={3}
                      placeholder="Brief description of this topic..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Deadline (Optional)
                    </label>
                    <input
                      type="date"
                      value={newTopic.deadline}
                      onChange={(e) => setNewTopic({...newTopic, deadline: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📎 Topic Files <span className="text-gray-500 text-xs">(Optional - Multiple files allowed)</span>
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={handleTopicFiles}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {topicFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {topicFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm flex items-center gap-2">
                              <span>{getFileIcon(file.name)}</span>
                              <span className="text-gray-700">{file.name}</span>
                              <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <button
                              onClick={() => removeTopicFile(index)}
                              className="text-red-500 hover:text-red-700 text-sm font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowNewTopicForm(false)}
                      className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTopic}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                    >
                      ✓ Add Topic
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Topics List */}
            {topics.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-lg">No topics yet. Click "Add New Topic" to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-all bg-gradient-to-r from-white to-blue-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          Topic {topic.topic_number}: {topic.title}
                        </h3>
                        <p className="text-gray-600 mb-4">{topic.description}</p>
                        
                        {topic.deadline && (
                          <p className="text-sm text-orange-600">
                            ⏰ Due: {new Date(topic.deadline).toLocaleDateString()}
                          </p>
                        )}
                        
                        {topic.files && topic.files.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-semibold text-gray-700 mb-2">📎 Files:</p>
                            <div className="flex flex-wrap gap-2">
                              {topic.files.map((file: any, idx: number) => (
                                <span key={idx} className="text-xs bg-white px-3 py-1 rounded-full border">
                                  {getFileIcon(file.file_name)} {file.file_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-semibold"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-semibold"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lectures Section */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Lectures</h2>
              <button
                onClick={() => setShowNewLectureForm(!showNewLectureForm)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold shadow-lg hover:shadow-xl"
              >
                {showNewLectureForm ? '✕ Cancel' : '+ Add Lecture'}
              </button>
            </div>

            {/* New Lecture Form */}
            {showNewLectureForm && (
              <div className="mb-6 p-6 bg-green-50 rounded-xl border-2 border-green-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Lecture</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Lecture Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newLecture.title}
                      onChange={(e) => setNewLecture({...newLecture, title: e.target.value})}
                      placeholder="e.g., Week 1: Introduction to Business"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newLecture.description}
                      onChange={(e) => setNewLecture({...newLecture, description: e.target.value})}
                      rows={3}
                      placeholder="Brief description of this lecture..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🎥 Lecture Files <span className="text-gray-500 text-xs">(PDF, Videos, Documents)</span>
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={handleLectureFiles}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    {lectureFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {lectureFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm flex items-center gap-2">
                              <span>{getFileIcon(file.name)}</span>
                              <span className="text-gray-700">{file.name}</span>
                              <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <button
                              onClick={() => removeLectureFile(index)}
                              className="text-red-500 hover:text-red-700 text-sm font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowNewLectureForm(false)}
                      className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddLecture}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      ✓ Add Lecture
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lectures List */}
            {lectures.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">🎓</div>
                <p className="text-lg">No lectures yet. Add your first lecture!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lectures.map((lecture: any, index: number) => (
                  <div
                    key={lecture.id || index}
                    className="border-2 border-gray-200 rounded-xl p-4 hover:border-green-300 transition-all bg-white"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">{lecture.title}</h4>
                        {lecture.content && (
                          <p className="text-sm text-gray-600 mt-1">{lecture.content}</p>
                        )}
                        
                        {/* Show file if exists */}
                        {lecture.file_path && (
                          <div className="mt-2">
                            <a 
                              href={lecture.file_path} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs bg-green-50 px-3 py-1 rounded-full border border-green-200 inline-flex items-center gap-1 hover:bg-green-100"
                            >
                              {getFileIcon(lecture.file_name || '')} {lecture.file_name}
                            </a>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => handleDeleteLecture(lecture.id)}
                        className="text-red-500 hover:text-red-700 text-sm ml-2"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Reading Section */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Additional Reading</h2>
              <button
                onClick={() => setShowReadingForm(!showReadingForm)}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all font-semibold shadow-lg hover:shadow-xl"
              >
                {showReadingForm ? '✕ Cancel' : '+ Add Reading Materials'}
              </button>
            </div>

            {/* New Reading Form */}
            {showReadingForm && (
              <div className="mb-6 p-6 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Upload Reading Materials</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📚 Reading Files <span className="text-gray-500 text-xs">(Multiple files allowed)</span>
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={handleReadingFiles}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                    />
                    {readingFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {readingFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm flex items-center gap-2">
                              <span>{getFileIcon(file.name)}</span>
                              <span className="text-gray-700">{file.name}</span>
                              <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <button
                              onClick={() => removeReadingFile(index)}
                              className="text-red-500 hover:text-red-700 text-sm font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowReadingForm(false)}
                      className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddReading}
                      className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
                    >
                      ✓ Upload Reading Materials
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Readings List */}
            {additionalReadings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📖</div>
                <p className="text-lg">No additional reading materials yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {additionalReadings.map((reading: any, index: number) => (
                  <div
                    key={reading.id || index}
                    className="border-2 border-gray-200 rounded-xl p-4 hover:border-yellow-300 transition-all bg-white"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getFileIcon(reading.file_name)}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{reading.title || reading.file_name}</p>
                        {reading.file_path && (
                          <a 
                            href={reading.file_path} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteReading(reading.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignment Brief Section */}
          {unit?.enable_assignment_submission && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Assignment Brief</h2>
                <button
                  onClick={() => setShowAssignmentBriefForm(!showAssignmentBriefForm)}
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-semibold shadow-lg hover:shadow-xl"
                >
                  {showAssignmentBriefForm ? '✕ Cancel' : '+ Upload Brief Files'}
                </button>
              </div>

              {assignmentBrief && (
                <div className="bg-orange-50 p-6 rounded-xl mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{assignmentBrief.heading || 'Assignment Brief'}</h3>
                  <p className="text-gray-700 mb-2">{assignmentBrief.description}</p>
                  {assignmentBrief.important_note && (
                    <div className="bg-white p-3 rounded-lg border-l-4 border-orange-500 mt-3">
                      <p className="text-sm font-semibold text-gray-700">⚠️ Important Note:</p>
                      <p className="text-sm text-gray-600">{assignmentBrief.important_note}</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <span className="text-sm font-semibold">
                      Grading: {assignmentBrief.grading_type === 'score' ? `Score (Pass: ${assignmentBrief.passing_score}%)` : 'Pass/Fail'}
                    </span>
                  </div>
                  
                  {/* Existing Brief Files */}
                  {assignmentBriefExistingFiles.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">📎 Brief Files:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {assignmentBriefExistingFiles.map((file: any, idx: number) => (
                          <a
                            key={idx}
                            href={file.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border hover:border-orange-300 transition-colors"
                          >
                            <span>{getFileIcon(file.file_name)}</span>
                            <span className="text-sm text-gray-700 flex-1">{file.file_name}</span>
                            <span className="text-xs text-gray-400">Download</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Brief Files Form */}
              {showAssignmentBriefForm && (
                <div className="mb-6 p-6 bg-orange-50 rounded-xl border-2 border-orange-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Upload Assignment Brief Files</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📄 Brief Files <span className="text-gray-500 text-xs">(PDF, Criteria, Rubric, etc.)</span>
                      </label>
                      <input
                        type="file"
                        multiple
                        onChange={handleAssignmentBriefFiles}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                      />
                      {assignmentBriefFiles.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {assignmentBriefFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
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

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        onClick={() => setShowAssignmentBriefForm(false)}
                        className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUploadAssignmentBriefFiles}
                        className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
                      >
                        ✓ Upload Files
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
            <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <span>💡</span>
              Quick Tips
            </h3>
            <ul className="space-y-1 text-purple-700 text-sm list-disc list-inside">
              <li><strong>Topics:</strong> Core learning materials organized by subject</li>
              <li><strong>Lectures:</strong> Video lectures and presentation slides</li>
              <li><strong>Additional Reading:</strong> Supplementary materials and references</li>
              <li><strong>Assignment Brief:</strong> Instructions and requirements for submissions</li>
              <li>All files support PDF, Word, PowerPoint, videos, and images</li>
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
