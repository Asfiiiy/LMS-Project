'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

interface Topic {
  id: number;
  topic_number: number;
  title: string;
  deadline: string | null;
  type?: 'cpd_topic' | 'qualification_unit';
}

interface DeadlineSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  studentIds: number[];
  topics: Topic[];
  onSuccess: () => void;
}

const DeadlineSetupModal = ({
  isOpen,
  onClose,
  courseId,
  studentIds,
  topics,
  onSuccess
}: DeadlineSetupModalProps) => {
  const [deadlines, setDeadlines] = useState<Record<number, Record<number, string>>>({});
  const [notes, setNotes] = useState<Record<number, Record<number, string>>>({});
  const [saving, setSaving] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);

  // Initialize deadlines with course defaults
  useEffect(() => {
    if (isOpen && topics.length > 0) {
      const initial: Record<number, Record<number, string>> = {};
      studentIds.forEach(studentId => {
        initial[studentId] = {};
        topics.forEach(topic => {
          if (topic.deadline) {
            initial[studentId][topic.id] = topic.deadline;
          }
        });
      });
      setDeadlines(initial);
      setCurrentStudentIndex(0);
    }
  }, [isOpen, topics, studentIds]);

  const currentStudentId = studentIds[currentStudentIndex];
  const currentDeadlines = deadlines[currentStudentId] || {};
  const currentNotes = notes[currentStudentId] || {};

  const handleDeadlineChange = (topicId: number, value: string) => {
    setDeadlines(prev => ({
      ...prev,
      [currentStudentId]: {
        ...prev[currentStudentId],
        [topicId]: value
      }
    }));
  };

  const handleNotesChange = (topicId: number, value: string) => {
    setNotes(prev => ({
      ...prev,
      [currentStudentId]: {
        ...prev[currentStudentId],
        [topicId]: value
      }
    }));
  };

  const handleSave = async () => {
    if (currentStudentIndex < studentIds.length - 1) {
      // Move to next student
      setCurrentStudentIndex(prev => prev + 1);
      return;
    }

    // Save all deadlines for all students
    setSaving(true);
    try {
      const savePromises = studentIds.map(async (studentId) => {
        const studentDeadlines = deadlines[studentId] || {};
        const studentNotes = notes[studentId] || {};
        
        const deadlineArray = Object.entries(studentDeadlines).map(([topicId, deadline]) => {
          const topic = topics.find(t => t.id === parseInt(topicId, 10));
          return {
            topicId: parseInt(topicId, 10),
            topicType: topic?.type || 'cpd_topic', // Use topic type from topics array
            deadline,
            notes: studentNotes[parseInt(topicId, 10)] || undefined
          };
        });

        if (deadlineArray.length > 0) {
          await apiService.setStudentDeadlines(courseId, studentId, deadlineArray);
        }
      });

      await Promise.all(savePromises);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving deadlines:', error);
      alert('Failed to save deadlines. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  const isLastStudent = currentStudentIndex === studentIds.length - 1;
  const progress = ((currentStudentIndex + 1) / studentIds.length) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <h2 className="text-2xl font-bold mb-2">Set Topic Deadlines</h2>
          <p className="text-blue-100">
            Setting deadlines for student {currentStudentIndex + 1} of {studentIds.length}
          </p>
          <div className="mt-4 bg-blue-500 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> Set individual deadlines for each topic. If you don't set a deadline, 
              the course default deadline will be used. You can customize deadlines for each student.
            </p>
          </div>

          {topics.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No topics with deadlines found.</p>
          ) : (
            <div className="space-y-4">
              {topics.map((topic) => {
                const deadlineValue = currentDeadlines[topic.id] || topic.deadline || '';
                const noteValue = currentNotes[topic.id] || '';

                return (
                  <div key={topic.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {topic.type === 'qualification_unit' ? 'Unit' : 'Topic'} {topic.topic_number}: {topic.title}
                        </h3>
                        {topic.deadline && (
                          <p className="text-sm text-gray-500 mt-1">
                            Course default: {new Date(topic.deadline).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Deadline *
                        </label>
                        <input
                          type="datetime-local"
                          value={deadlineValue ? new Date(deadlineValue).toISOString().slice(0, 16) : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              handleDeadlineChange(topic.id, new Date(value).toISOString());
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes (Optional)
                        </label>
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => handleNotesChange(topic.id, e.target.value)}
                          placeholder="Add notes about this deadline..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Skip (Use Defaults)
          </button>
          <div className="flex gap-3">
            {currentStudentIndex > 0 && (
              <button
                onClick={() => setCurrentStudentIndex(prev => prev - 1)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={saving}
              >
                Previous
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : isLastStudent ? (
                'Save All Deadlines'
              ) : (
                'Next Student'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeadlineSetupModal;

