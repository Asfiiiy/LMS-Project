'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';

interface Topic {
  id: number;
  topic_number: number;
  title: string;
  deadline: string | null;
  type?: 'cpd_topic' | 'qualification_unit';
}

interface PaymentInstallment {
  id?: number;
  installment_name: string;
  amount: number;
  due_date: string;
  status?: 'paid' | 'due' | 'overdue';
}

interface CourseInfo {
  id: number;
  title: string;
  type: 'cpd' | 'qualification';
}

interface StudentInfo {
  id: number;
  name: string;
  email: string;
}

const EnrollmentSetupPage = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.courseId as string, 10);
  const studentId = parseInt(params.studentId as string, 10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  
  // Deadline state
  const [deadlines, setDeadlines] = useState<Record<number, string>>({});
  const [clearedDeadlines, setClearedDeadlines] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});
  
  // Payment state
  const [paymentType, setPaymentType] = useState<'all_paid' | 'installment'>('installment');
  const [installments, setInstallments] = useState<PaymentInstallment[]>([
    { installment_name: 'Enrolment Fee', amount: 0, due_date: '', status: 'due' }
  ]);

  useEffect(() => {
    // Get user role from localStorage
    const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
    setUserRole(user?.role || null);
    fetchData();
  }, [courseId, studentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get user role
      const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
      const role = user?.role || null;
      
      // Fetch course info
      const coursesResponse = await apiService.getCourses();
      const course = coursesResponse?.courses?.find((c: any) => c.id === courseId);
      
      if (course) {
        setCourseInfo({
          id: course.id,
          title: course.title,
          type: course.course_type === 'qualification' ? 'qualification' : 'cpd'
        });
      }

      // Fetch student info - use different API based on role
      let student: any = null;
      if (role === 'Tutor') {
        // For tutors, try multiple approaches to get student info
        try {
          // First, try to get from enrollments (most reliable for tutors)
          const tutorId = user?.id;
          if (tutorId) {
            const enrollmentsResponse = await apiService.getTutorCourseEnrollments(tutorId, courseId);
            if (enrollmentsResponse?.enrollments || enrollmentsResponse?.students) {
              const enrollments = enrollmentsResponse.enrollments || enrollmentsResponse.students || [];
              student = enrollments.find((e: any) => e.id === studentId || e.student_id === studentId);
            }
          }
          
          // If not found in enrollments, try profile endpoint
          if (!student) {
            try {
              const studentResponse = await apiService.getTutorStudentProfileById(studentId);
              if (studentResponse?.success && studentResponse?.profile) {
                // The tutor profile endpoint returns data in profile object
                const profile = studentResponse.profile;
                student = {
                  id: profile.user_id || studentId,
                  name: profile.name,
                  email: profile.email
                };
              }
            } catch (profileError) {
              console.error('Error fetching tutor student profile:', profileError);
            }
          }
        } catch (error) {
          console.error('Error fetching tutor student:', error);
        }
      } else {
        // For admin, use admin endpoint
        try {
          const usersResponse = await apiService.getUsers(1, 1000);
          student = usersResponse?.users?.find((u: any) => u.id === studentId);
        } catch (error) {
          console.error('Error fetching admin users:', error);
        }
      }
      
      if (student) {
        setStudentInfo({
          id: student.id || student.student_id || student.user_id,
          name: student.name || student.student_name || student.user_name,
          email: student.email || student.student_email || student.user_email
        });
      } else {
        console.error('Student not found. StudentId:', studentId, 'CourseId:', courseId, 'Role:', role);
      }

      // Fetch topics/units based on course type
      if (course?.course_type === 'qualification') {
        // Fetch qualification units
        const unitsResponse = await apiService.getQualificationUnits(courseId);
        if (unitsResponse?.success && unitsResponse?.units) {
          const units: Topic[] = unitsResponse.units.map((unit: any) => ({
            id: unit.id,
            topic_number: (unit.order_index || 0) + 1,
            title: unit.title,
            deadline: unit.deadline || null,
            type: 'qualification_unit' as const
          }));
          setTopics(units);
          
          // Initialize deadlines with course defaults
          const initial: Record<number, string> = {};
          units.forEach(unit => {
            if (unit.deadline) {
              initial[unit.id] = unit.deadline;
            }
          });
          setDeadlines(initial);
        }
      } else {
        // Fetch CPD topics
        const topicsResponse = await apiService.getCPDTopics(courseId);
        if (topicsResponse?.success && topicsResponse?.topics) {
          const cpdTopics: Topic[] = topicsResponse.topics.map((topic: any) => ({
            id: topic.id,
            topic_number: topic.topic_number || 1,
            title: topic.title,
            deadline: topic.deadline || null,
            type: 'cpd_topic' as const
          }));
          setTopics(cpdTopics);
          
          // Initialize deadlines with course defaults
          const initial: Record<number, string> = {};
          cpdTopics.forEach(topic => {
            if (topic.deadline) {
              initial[topic.id] = topic.deadline;
            }
          });
          setDeadlines(initial);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showSweetAlert('Error', 'Failed to load enrollment setup data. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeadlineChange = (topicId: number, value: string) => {
    if (value) {
      // Set the deadline and remove from cleared set
      setDeadlines(prev => ({
        ...prev,
        [topicId]: value
      }));
      setClearedDeadlines(prev => {
        const updated = new Set(prev);
        updated.delete(topicId);
        return updated;
      });
    } else {
      // Clear the deadline by removing it from state and adding to cleared set
      setDeadlines(prev => {
        const updated = { ...prev };
        delete updated[topicId];
        return updated;
      });
      setClearedDeadlines(prev => new Set(prev).add(topicId));
    }
  };

  const handleNotesChange = (topicId: number, value: string) => {
    setNotes(prev => ({
      ...prev,
      [topicId]: value
    }));
  };

  const handleAddInstallment = () => {
    setInstallments(prev => [
      ...prev,
      { installment_name: '', amount: 0, due_date: '', status: 'due' }
    ]);
  };

  const handleRemoveInstallment = (index: number) => {
    setInstallments(prev => prev.filter((_, i) => i !== index));
  };

  const handleInstallmentChange = (index: number, field: keyof PaymentInstallment, value: string | number) => {
    setInstallments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleStatusChange = (index: number, status: 'paid' | 'due' | 'overdue') => {
    setInstallments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status };
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save deadlines - include all topics with deadlines set or cleared
      if (topics.length > 0) {
        const deadlineArray = topics.map((topic) => {
          const deadline = deadlines[topic.id];
          const topicNotes = notes[topic.id];
          const isCleared = clearedDeadlines.has(topic.id);
          
          // Include topics that have:
          // 1. A deadline set in state
          // 2. Notes added
          // 3. Been explicitly cleared (to send null to backend)
          // 4. Had a course default deadline (to save or clear it)
          const shouldInclude = deadline || topicNotes || isCleared || topic.deadline;
          
          if (!shouldInclude) return null;
          
          // If explicitly cleared, send null; otherwise send the deadline value
          const deadlineToSend = isCleared ? null : (deadline || null);
          
          return {
            topicId: topic.id,
            topicType: (topic.type as "cpd_topic" | "qualification_unit") || 'cpd_topic',
            deadline: deadlineToSend,
            notes: topicNotes || undefined
          };
        }).filter(item => item !== null) as Array<{ topicId: number; topicType: "cpd_topic" | "qualification_unit"; deadline: string | null; notes?: string }>;

        if (deadlineArray.length > 0) {
          await apiService.setStudentDeadlines(courseId, studentId, deadlineArray);
        }
      }

      // Save payment installments
      if (paymentType === 'installment') {
        // Validate installments
        const invalidInstallments = installments.filter(
          inst => !inst.installment_name || !inst.due_date || inst.amount <= 0
        );

        if (invalidInstallments.length > 0) {
          showSweetAlert('Validation Error', 'Please fill in all installment fields (name, amount, due date) before saving.', 'warning');
          setSaving(false);
          return;
        }

        // Format installments for API
        const formattedInstallments = installments.map((inst, index) => ({
          installment_number: index + 1,
          installment_name: inst.installment_name,
          amount: parseFloat(inst.amount.toString()),
          due_date: inst.due_date,
          status: inst.status || 'due'
        }));

        await apiService.savePaymentInstallments(
          courseId,
          studentId,
          'installment',
          formattedInstallments
        );
      } else if (paymentType === 'all_paid') {
        // Save all_paid status
        await apiService.savePaymentInstallments(
          courseId,
          studentId,
          'all_paid',
          []
        );
      }

      const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
      const role = user?.role || 'Admin';
      const redirectPath = role === 'Tutor' ? '/dashboard/tutor' : '/dashboard/admin';
      
      showSweetAlert(
        'Success!',
        'Enrollment setup completed successfully!',
        'success',
        {
          onConfirm: () => {
            router.push(redirectPath);
          }
        }
      );
    } catch (error) {
      console.error('Error saving enrollment setup:', error);
      showSweetAlert('Error', 'Failed to save enrollment setup. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enrollment setup...</p>
        </div>
      </div>
    );
  }

  if (!courseInfo || !studentInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Course or student not found.</p>
          <button
            onClick={() => router.push(userRole === 'Tutor' ? '/dashboard/tutor' : '/dashboard/admin')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Enrollment Setup
              </h1>
              <p className="text-gray-600">
                <span className="font-semibold">Course:</span> {courseInfo.title}
              </p>
              <p className="text-gray-600">
                <span className="font-semibold">Student:</span> {studentInfo.name} ({studentInfo.email})
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/admin')}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Deadline Setup Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📅</span>
            Topic Deadlines
          </h2>
          
          {topics.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No topics with deadlines found for this course.
            </p>
          ) : (
            <div className="space-y-4">
              {topics.map((topic) => {
                // If deadline is explicitly cleared, don't use course default
                const isCleared = clearedDeadlines.has(topic.id);
                const deadlineValue = isCleared ? '' : (deadlines[topic.id] || topic.deadline || '');
                const noteValue = notes[topic.id] || '';

                return (
                  <div
                    key={topic.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {topic.type === 'qualification_unit' ? 'Unit' : 'Topic'} {topic.topic_number}: {topic.title}
                        </h3>
                        {topic.deadline && !isCleared && (
                          <p className="text-sm text-gray-500 mt-1">
                            Course default: {new Date(topic.deadline).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Deadline
                        </label>
                        <input
                          type="datetime-local"
                          value={deadlineValue ? new Date(deadlineValue).toISOString().slice(0, 16) : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              handleDeadlineChange(topic.id, new Date(value).toISOString());
                            } else {
                              // Clear the deadline
                              handleDeadlineChange(topic.id, '');
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {(deadlineValue || topic.deadline) && (
                          <button
                            type="button"
                            onClick={() => handleDeadlineChange(topic.id, '')}
                            className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
                          >
                            Clear deadline
                          </button>
                        )}
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

        {/* Payment Setup Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">💳</span>
            Payment Setup
          </h2>

          {/* Payment Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="all_paid"
                  checked={paymentType === 'all_paid'}
                  onChange={(e) => setPaymentType(e.target.value as 'all_paid' | 'installment')}
                  className="mr-2"
                />
                <span>All Paid</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="installment"
                  checked={paymentType === 'installment'}
                  onChange={(e) => setPaymentType(e.target.value as 'all_paid' | 'installment')}
                  className="mr-2"
                />
                <span>Installment</span>
              </label>
            </div>
          </div>

          {/* Installment Table */}
          {paymentType === 'installment' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      No.
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Instalment
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Amount (£)
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Due Date
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((installment, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {index + 1}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="text"
                          value={installment.installment_name}
                          onChange={(e) =>
                            handleInstallmentChange(index, 'installment_name', e.target.value)
                          }
                          placeholder="e.g., Enrolment Fee"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="number"
                          value={installment.amount || ''}
                          onChange={(e) =>
                            handleInstallmentChange(index, 'amount', parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="date"
                          value={installment.due_date || ''}
                          onChange={(e) =>
                            handleInstallmentChange(index, 'due_date', e.target.value)
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <select
                          value={installment.status || 'due'}
                          onChange={(e) => handleStatusChange(index, e.target.value as 'paid' | 'due' | 'overdue')}
                          className={`w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium ${
                            installment.status === 'paid' 
                              ? 'bg-green-50 text-green-800 border-green-300' 
                              : installment.status === 'overdue'
                              ? 'bg-red-50 text-red-800 border-red-300'
                              : 'bg-yellow-50 text-yellow-800 border-yellow-300'
                          }`}
                        >
                          <option value="due">Due</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {installments.length > 1 && (
                          <button
                            onClick={() => handleRemoveInstallment(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={handleAddInstallment}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Row
              </button>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button
              onClick={() => router.push(userRole === 'Tutor' ? '/dashboard/tutor' : '/dashboard/admin')}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                'Save Enrollment Setup'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentSetupPage;

