'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { showToast } from '@/app/components/Toast';

interface Topic {
  id: number;
  topic_number: number;
  title: string;
  description: string;
  deadline: string | null;
  files: any[];
}

type UnitEditTab =
  | 'topics'
  | 'lectures'
  | 'readings'
  | 'assignment-brief'
  | 'presentation-brief'
  | 'student-progress';

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

  const [activeTab, setActiveTab] = useState<UnitEditTab>('lectures');
  const [unitTitle, setUnitTitle] = useState('');
  const [unitContent, setUnitContent] = useState('');
  const [unitSaving, setUnitSaving] = useState(false);
  
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
  
  // Replace lecture file(s)
  const [replaceLectureFileId, setReplaceLectureFileId] = useState<number | null>(null);
  const [replaceLectureFiles, setReplaceLectureFiles] = useState<File[]>([]);
  // Edit lecture title / learning outcome
  const [editLectureMetaId, setEditLectureMetaId] = useState<number | null>(null);
  const [editLectureTitle, setEditLectureTitle] = useState('');
  const [editLectureContent, setEditLectureContent] = useState('');
  const [reordering, setReordering] = useState(false);

  const [editingReadingId, setEditingReadingId] = useState<number | null>(null);
  const [editReadingTitle, setEditReadingTitle] = useState('');
  const [editReadingNewFile, setEditReadingNewFile] = useState<File | null>(null);

  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicDescription, setEditTopicDescription] = useState('');
  const [editTopicDeadline, setEditTopicDeadline] = useState('');
  
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

      if (response.success) {
        setUnit(response.unit);
        setUnitTitle(response.unit?.title || '');
        setUnitContent(response.unit?.content || '');
        setTopics(response.topics || []);
        // Backend returns 'announcements' for lectures
        setLectures(response.announcements || []);
        setAdditionalReadings(response.readings || []);
        setAssignmentBrief(response.assignmentBrief || null);
        setAssignmentBriefExistingFiles(response.briefFiles || []);
        setPresentationBrief(response.presentationBrief || null);
      } else {
        showToast('Failed to load unit data', 'error');
      }
    } catch (error) {
      showToast('Error loading unit data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sortedLectures = useMemo(
    () =>
      [...lectures].sort(
        (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
      ),
    [lectures]
  );

  const handleMoveLecture = async (lectureId: number, direction: 'up' | 'down') => {
    const sorted = [...lectures].sort(
      (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );

    const currentIndex = sorted.findIndex((l: any) => l.id === lectureId);

    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sorted.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    const current = sorted[currentIndex];
    const swapWith = sorted[swapIndex];

    const reordered = sorted.map((l: any, i: number) => {
      if (i === currentIndex) {
        return { ...l, order_index: swapWith.order_index ?? swapIndex };
      }
      if (i === swapIndex) {
        return { ...l, order_index: current.order_index ?? currentIndex };
      }
      return l;
    });

    setReordering(true);
    try {
      await apiService.reorderLectures(
        unitId,
        reordered.map((l: any) => ({
          id: l.id,
          order_index: l.order_index
        }))
      );
      await loadUnitData();
    } catch {
      showToast('Failed to reorder', 'error');
    } finally {
      setReordering(false);
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

  const handleSaveUnit = async () => {
    if (!unitTitle.trim()) {
      showToast('Unit title is required', 'warning');
      return;
    }
    setUnitSaving(true);
    try {
      await apiService.updateQualificationUnit(unitId, {
        title: unitTitle.trim(),
        content: unitContent
      });
      showToast('Unit updated successfully', 'success');
      await loadUnitData();
    } catch {
      showToast('Failed to update unit', 'error');
    } finally {
      setUnitSaving(false);
    }
  };

  const handleSaveLectureMeta = async (lectureId: number) => {
    try {
      await apiService.updateLectureTitle(unitId, lectureId, {
        title: editLectureTitle,
        content: editLectureContent
      });
      setEditLectureMetaId(null);
      showToast('Lecture updated', 'success');
      await loadUnitData();
    } catch {
      showToast('Failed to update lecture', 'error');
    }
  };

  const handleSaveReading = async (readingId: number) => {
    try {
      if (!editReadingTitle.trim() && !editReadingNewFile) {
        showToast('Change the title or choose a new file', 'warning');
        return;
      }
      await apiService.updateAdditionalReading(unitId, readingId, {
        title: editReadingTitle.trim() || undefined,
        file: editReadingNewFile || undefined
      });
      setEditingReadingId(null);
      setEditReadingNewFile(null);
      showToast('Reading updated', 'success');
      await loadUnitData();
    } catch {
      showToast('Failed to update reading', 'error');
    }
  };

  const handleSaveTopicEdit = async (topicId: number) => {
    try {
      await apiService.updateQualificationTopic(unitId, topicId, {
        title: editTopicTitle,
        description: editTopicDescription,
        deadline: editTopicDeadline || null
      });
      setEditingTopicId(null);
      showToast('Topic updated', 'success');
      await loadUnitData();
    } catch {
      showToast('Failed to update topic', 'error');
    }
  };

  const handleDeleteTopic = async (topicId: number, topicLabel: string) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Delete topic?',
      text: `Remove "${topicLabel}" and its files? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Delete'
    });
    if (!isConfirmed) return;
    try {
      await apiService.deleteQualificationTopic(unitId, topicId);
      showToast('Topic deleted', 'success');
      await loadUnitData();
    } catch {
      showToast('Failed to delete topic', 'error');
    }
  };

  const handleAddTopic = async () => {
    if (!newTopic.title) {
      showToast('Please enter topic title', 'warning');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('topic_number', (topics.length + 1).toString());
      formData.append('order_index', String(topics.length));
      formData.append('title', newTopic.title);
      formData.append('description', newTopic.description || '');
      formData.append('deadline', newTopic.deadline || '');

      topicFiles.forEach((file) => {
        formData.append('files', file);
      });

      const res = await apiService.addQualificationTopic(unitId, formData);
      if (res.success) {
        showToast('Topic added', 'success');
        setShowNewTopicForm(false);
        setNewTopic({ title: '', description: '', deadline: '' });
        setTopicFiles([]);
        await loadUnitData();
      } else {
        showToast(res.message || 'Failed to add topic', 'error');
      }
    } catch {
      showToast('Error adding topic', 'error');
    }
  };

  const handleAddLecture = async () => {
    if (!newLecture.title) {
      showToast('Please enter lecture title', 'warning');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', newLecture.title);
      formData.append('description', newLecture.description || '');

      lectureFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await apiService.addQualificationLecture(unitId, formData);
      
      if (response.success) {
        showToast('Lecture added successfully', 'success');
        setShowNewLectureForm(false);
        setNewLecture({ title: '', description: '' });
        setLectureFiles([]);
        await loadUnitData();
      } else {
        showToast(response.message || 'Error adding lecture', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error adding lecture', 'error');
    }
  };

  const handleAddReading = async () => {
    if (readingFiles.length === 0) {
      showToast('Please select files to upload', 'warning');
      return;
    }

    try {
      const formData = new FormData();
      const titles = readingFiles.map((f) => f.name);
      formData.append('titles', JSON.stringify(titles));
      readingFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await apiService.addQualificationReading(unitId, formData);
      
      if (response.success) {
        showToast('Reading materials added successfully', 'success');
        setShowReadingForm(false);
        setReadingFiles([]);
        await loadUnitData();
      } else {
        showToast(response.message || 'Error adding reading', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error adding reading', 'error');
    }
  };

  const handleUploadAssignmentBriefFiles = async () => {
    if (assignmentBriefFiles.length === 0) {
      showToast('Please select files to upload', 'warning');
      return;
    }

    try {
      const formData = new FormData();
      assignmentBriefFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await apiService.addAssignmentBriefFiles(unitId, formData);
      
      if (response.success) {
        showToast('Assignment brief files uploaded successfully', 'success');
        setShowAssignmentBriefForm(false);
        setAssignmentBriefFiles([]);
        await loadUnitData();
      } else {
        showToast(response.message || 'Error uploading files', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error uploading files', 'error');
    }
  };

  const handleDeleteAssignmentBriefFile = async (fileId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const response = await apiService.deleteAssignmentBriefFile(unitId, fileId);
      
      if (response.success) {
        showToast('File deleted successfully', 'success');
        await loadUnitData();
      } else {
        showToast(response.message || 'Error deleting file', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error deleting file', 'error');
    }
  };

  const handleUpdateLectureFiles = async (lectureId: number, currentTitle: string, currentDescription: string) => {
    if (replaceLectureFiles.length === 0) {
      showToast('Please select files to upload', 'warning');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', currentTitle);
      formData.append('description', currentDescription || '');
      
      replaceLectureFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await apiService.updateQualificationLectureFiles(unitId, lectureId, formData);
      
      if (response.success) {
        showToast('Lecture files updated successfully', 'success');
        setReplaceLectureFiles([]);
        setReplaceLectureFileId(null);
        await loadUnitData();
      } else {
        showToast(response.message || 'Error updating lecture', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error updating lecture', 'error');
    }
  };

  const handleDeleteLecture = async (lectureId: number) => {
    if (!confirm('Are you sure you want to delete this lecture? This will also delete the associated file.')) {
      return;
    }

    try {
      const response = await apiService.deleteQualificationLecture(unitId, lectureId);
      
      if (response.success) {
        showToast('Lecture deleted successfully', 'success');
        await loadUnitData();
      } else {
        showToast(response.message || 'Error deleting lecture', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error deleting lecture', 'error');
    }
  };

  const handleDeleteReading = async (readingId: number) => {
    if (!confirm('Are you sure you want to delete this reading material? This will also delete the associated file.')) {
      return;
    }

    try {
      const response = await apiService.deleteQualificationReading(unitId, readingId);
      
      if (response.success) {
        showToast('Reading material deleted successfully', 'success');
        await loadUnitData();
      } else {
        showToast(response.message || 'Error deleting reading', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error deleting reading', 'error');
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
    <ProtectedRoute allowedRoles={['Admin', 'Assessor']} userRole={userRole as any}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-t-4 border-purple-600">
            <div className="flex justify-between items-start mb-4 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-4xl shrink-0">📝</span>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                  {unitTitle.trim() || unit?.title || 'Edit Unit'}
                </h1>
              </div>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              >
                ← Back
              </button>
            </div>

            <div className="mb-6 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Unit details</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={unitTitle}
                    onChange={(e) => setUnitTitle(e.target.value)}
                    placeholder="Enter unit title..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Unit description</label>
                  <textarea
                    value={unitContent}
                    onChange={(e) => setUnitContent(e.target.value)}
                    placeholder="Describe this unit for staff and students..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveUnit}
                  disabled={unitSaving || !unitTitle.trim()}
                  className="px-6 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {unitSaving ? 'Saving…' : '💾 Save unit details'}
                </button>
              </div>
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
            <div className="border-b border-gray-200 overflow-x-auto">
              <nav className="flex flex-wrap gap-x-6 gap-y-1 px-6 min-w-min" aria-label="Tabs">
                <button
                  type="button"
                  onClick={() => setActiveTab('topics')}
                  className={
                    activeTab === 'topics'
                      ? 'border-b-2 border-purple-600 py-4 px-1 text-sm font-medium text-purple-600'
                      : 'border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                >
                  📚 Topics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('lectures')}
                  className={
                    activeTab === 'lectures'
                      ? 'border-b-2 border-purple-600 py-4 px-1 text-sm font-medium text-purple-600'
                      : 'border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                >
                  🎓 Lectures
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('readings')}
                  className={
                    activeTab === 'readings'
                      ? 'border-b-2 border-purple-600 py-4 px-1 text-sm font-medium text-purple-600'
                      : 'border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                >
                  📖 Additional Reading
                </button>
                {unit?.enable_assignment_submission && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('assignment-brief')}
                    className={
                      activeTab === 'assignment-brief'
                        ? 'border-b-2 border-purple-600 py-4 px-1 text-sm font-medium text-purple-600'
                        : 'border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  >
                    📝 Assignment Brief
                  </button>
                )}
                {unit?.enable_presentation_submission && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('presentation-brief')}
                    className={
                      activeTab === 'presentation-brief'
                        ? 'border-b-2 border-purple-600 py-4 px-1 text-sm font-medium text-purple-600'
                        : 'border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  >
                    🎤 Presentation Brief
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('student-progress')}
                  className={
                    activeTab === 'student-progress'
                      ? 'border-b-2 border-purple-600 py-4 px-1 text-sm font-medium text-purple-600'
                      : 'border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                >
                  📊 Student Progress
                </button>
              </nav>
            </div>
          </div>

          {activeTab === 'topics' && (
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
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        {editingTopicId === topic.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editTopicTitle}
                              onChange={(e) => setEditTopicTitle(e.target.value)}
                              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-semibold"
                              placeholder="Topic title"
                            />
                            <textarea
                              value={editTopicDescription}
                              onChange={(e) => setEditTopicDescription(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="Description"
                            />
                            <input
                              type="date"
                              value={editTopicDeadline}
                              onChange={(e) => setEditTopicDeadline(e.target.value)}
                              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveTopicEdit(topic.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                              >
                                ✓ Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTopicId(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>

                      {editingTopicId !== topic.id && (
                        <div className="flex gap-2 ml-0 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTopicId(topic.id);
                              setEditTopicTitle(topic.title || '');
                              setEditTopicDescription(topic.description || '');
                              setEditTopicDeadline(
                                topic.deadline
                                  ? new Date(topic.deadline).toISOString().slice(0, 10)
                                  : ''
                              );
                            }}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-semibold"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTopic(topic.id, topic.title)}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-semibold"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {activeTab === 'lectures' && (
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
                {sortedLectures.map((lecture: any, index: number) => {
                  const isFirstLecture = index === 0;
                  const isLastLecture = index === sortedLectures.length - 1;
                  return (
                  <div
                    key={lecture.id || index}
                    className="border-2 border-gray-200 rounded-xl p-4 hover:border-green-300 transition-all bg-white"
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex-1 min-w-0">
                        {editLectureMetaId === lecture.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editLectureTitle}
                              onChange={(e) => setEditLectureTitle(e.target.value)}
                              className="w-full px-3 py-2 border border-green-400 rounded-lg text-sm font-semibold"
                              placeholder="Lecture title"
                            />
                            <textarea
                              value={editLectureContent}
                              onChange={(e) => setEditLectureContent(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                              placeholder="Learning outcome / description"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveLectureMeta(lecture.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700"
                              >
                                ✓ Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditLectureMetaId(null)}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-bold text-gray-900">{lecture.title}</h4>
                            {lecture.content && (
                              <p className="text-sm text-gray-600 mt-1">{lecture.content}</p>
                            )}

                            {lecture.file_path && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <a
                                  href={lecture.file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs bg-green-50 px-3 py-1 rounded-full border border-green-200 inline-flex items-center gap-1 hover:bg-green-100"
                                >
                                  {getFileIcon(lecture.file_name || '')} {lecture.file_name}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditLectureMetaId(null);
                                    setReplaceLectureFileId(lecture.id);
                                    setReplaceLectureFiles([]);
                                  }}
                                  className="text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 text-blue-700"
                                >
                                  ✏️ Replace file
                                </button>
                              </div>
                            )}
                            {!lecture.file_path && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditLectureMetaId(null);
                                  setReplaceLectureFileId(lecture.id);
                                  setReplaceLectureFiles([]);
                                }}
                                className="mt-2 text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-100"
                              >
                                📎 Attach file(s)
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {editLectureMetaId !== lecture.id && (
                        <div className="flex gap-1 ml-0 shrink-0 items-start">
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveLecture(lecture.id, 'up')}
                              disabled={isFirstLecture || reordering}
                              title="Move Up"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '12px',
                                cursor: isFirstLecture ? 'not-allowed' : 'pointer',
                                opacity: isFirstLecture ? 0.4 : 1
                              }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveLecture(lecture.id, 'down')}
                              disabled={isLastLecture || reordering}
                              title="Move Down"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '12px',
                                cursor: isLastLecture ? 'not-allowed' : 'pointer',
                                opacity: isLastLecture ? 0.4 : 1
                              }}
                            >
                              ↓
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setReplaceLectureFileId(null);
                              setReplaceLectureFiles([]);
                              setEditLectureMetaId(lecture.id);
                              setEditLectureTitle(lecture.title || '');
                              setEditLectureContent(lecture.content || '');
                            }}
                            className="text-blue-500 hover:text-blue-700 text-sm px-1"
                            title="Edit title & outcome"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditLectureMetaId(null);
                              setReplaceLectureFileId(lecture.id);
                              setReplaceLectureFiles([]);
                            }}
                            className="text-sky-500 hover:text-sky-700 text-sm px-1"
                            title="Replace file"
                          >
                            📎
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLecture(lecture.id)}
                            className="text-red-500 hover:text-red-700 text-sm px-1"
                            title="Delete lecture"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Edit/Replace File Form */}
                    {replaceLectureFileId === lecture.id && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                        <h5 className="font-semibold text-gray-900 mb-2">Replace Lecture File</h5>
                        <input
                          type="file"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setReplaceLectureFiles(files);
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-2"
                        />
                        {replaceLectureFiles.length > 0 && (
                          <div className="mb-2 space-y-1">
                            {replaceLectureFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                                <span className="text-sm flex items-center gap-2">
                                  <span>{getFileIcon(file.name)}</span>
                                  <span className="text-gray-700">{file.name}</span>
                                </span>
                                <button
                                  onClick={() => setReplaceLectureFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-700 text-sm"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateLectureFiles(lecture.id, lecture.title, lecture.content || '')}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                          >
                            ✓ Update Files
                          </button>
                          <button
                            onClick={() => {
                              setReplaceLectureFileId(null);
                              setReplaceLectureFiles([]);
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {activeTab === 'readings' && (
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
                    {editingReadingId === reading.id ? (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-600">Title</label>
                        <input
                          type="text"
                          value={editReadingTitle}
                          onChange={(e) => setEditReadingTitle(e.target.value)}
                          className="w-full px-3 py-2 border border-yellow-400 rounded-lg text-sm"
                        />
                        <label className="block text-xs font-semibold text-gray-600">Replace file (optional)</label>
                        <input
                          type="file"
                          onChange={(e) => setEditReadingNewFile(e.target.files?.[0] || null)}
                          className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-yellow-50"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveReading(reading.id)}
                            className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-bold hover:bg-yellow-700"
                          >
                            ✓ Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReadingId(null);
                              setEditReadingNewFile(null);
                            }}
                            className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-lg text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{getFileIcon(reading.file_name)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {reading.title || reading.file_name}
                            </p>
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
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReadingId(reading.id);
                              setEditReadingTitle(reading.title || reading.file_name || '');
                              setEditReadingNewFile(null);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReading(reading.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            🗑️ Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {activeTab === 'assignment-brief' && unit?.enable_assignment_submission && (
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
                      Grading: {assignmentBrief.grading_type === 'score' ? `Score (Pass: ${assignmentBrief.passing_score}%)` : 'Pass/Refer'}
                    </span>
                  </div>
                  
                  {/* Existing Brief Files */}
                  {assignmentBriefExistingFiles.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">📎 Brief Files:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {assignmentBriefExistingFiles.map((file: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border hover:border-orange-300 transition-colors"
                          >
                            <span>{getFileIcon(file.file_name)}</span>
                            <a
                              href={file.file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-gray-700 flex-1 hover:text-orange-600"
                            >
                              {file.file_name}
                            </a>
                            <button
                              onClick={() => handleDeleteAssignmentBriefFile(file.id, file.file_name)}
                              className="text-red-500 hover:text-red-700 text-sm ml-2"
                              title="Delete File"
                            >
                              🗑️
                            </button>
                          </div>
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

          {activeTab === 'presentation-brief' && unit?.enable_presentation_submission && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Presentation brief</h2>
              {presentationBrief ? (
                <div className="bg-pink-50 p-6 rounded-xl border border-pink-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {presentationBrief.heading || 'Presentation brief'}
                  </h3>
                  {presentationBrief.description && (
                    <p className="text-gray-700 mb-3">{presentationBrief.description}</p>
                  )}
                  {presentationBrief.important_note && (
                    <div className="bg-white p-3 rounded-lg border-l-4 border-pink-500">
                      <p className="text-sm font-semibold text-gray-700">Note</p>
                      <p className="text-sm text-gray-600">{presentationBrief.important_note}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">
                  No presentation brief is stored for this unit yet. If your workflow uses a separate admin screen to
                  create briefs, add it there; this page shows the linked record when it exists.
                </p>
              )}
            </div>
          )}

          {activeTab === 'student-progress' && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Student progress</h2>
              <p className="text-gray-600 leading-relaxed">
                Assignment and presentation submissions for this unit are graded in the tutor workflow (pending
                submissions and grading tools). This edit screen focuses on unit content; open the tutor dashboard or
                qualification submissions views to review student work.
              </p>
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
