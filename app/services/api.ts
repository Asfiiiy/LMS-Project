import { getStoredToken, persistTokenAfterRefresh } from '@/app/utils/authStorage';

// Reusable API service for making HTTP requests
class ApiService {
  private baseUrl: string;
  public readonly baseUrlPublic: string;

  constructor() {
    // Use environment variable or detect from window location
    // For HTTPS sites, use same domain (Nginx will proxy /api to backend)
    // For HTTP (development), use port 5000
    let apiUrl: string;
    
    if (process.env.NEXT_PUBLIC_API_URL) {
      apiUrl = process.env.NEXT_PUBLIC_API_URL;
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;
      
      // If on HTTPS (production), use same domain (Nginx proxies /api to backend)
      if (protocol === 'https:') {
        apiUrl = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
      } else {
        // For HTTP (development), use port 5000
        apiUrl = `${protocol}//${hostname}:5000`;
      }
    } else {
      // Server-side fallback
      apiUrl = 'http://localhost:5000';
    }
    
    this.baseUrl = apiUrl.endsWith("/api") ? apiUrl : `${apiUrl}/api`;
    this.baseUrlPublic = apiUrl.endsWith("/api") ? apiUrl : `${apiUrl}/api`;
  }

  private getToken(): string | null {
    return getStoredToken();
  }

  private getHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    try {
      const token = this.getToken();
      
      // Check if body is FormData
      const isFormData = options.body instanceof FormData;
      
      // Build headers
      let headers: Record<string, string> = {};
      
      if (!isFormData) {
        // Only add Content-Type for non-FormData requests
        headers = this.getHeaders();
      } else {
        // For FormData, only add Authorization
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        credentials: 'include', // Send cookies (needed for impersonation restore)
        headers: {
          ...headers,
          ...options.headers
        }
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          const msg = errorData.message || errorData.error;
          if (msg) {
            errorMessage = typeof msg === 'string' ? msg : errorMessage;
          }
        } catch (e) {
          // Response is not JSON
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Token refresh method
  async refreshToken() {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No token available to refresh');
      }

      const response = await fetch(`${this.baseUrl}/login/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      if (data.token) {
        persistTokenAfterRefresh(data.token);
        return data.token;
      }

      throw new Error('No token in refresh response');
    } catch (error) {
      throw error;
    }
  }

  // Admin API methods
  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async getUsers(page: number = 1, limit: number = 50) {
    return this.request(`/admin/users?page=${page}&limit=${limit}`);
  }

  async getRoles() {
    return this.request('/admin/roles');
  }

  async getManagers() {
    return this.request('/admin/managers');
  }

  async getTutors() {
    return this.request('/admin/tutors');
  }
  
  async getSubTutors(tutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/sub-tutors`);
  }
  
  async getSubTutorStudents(tutorId: number, subTutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/students/${subTutorId}`);
  }
  
  async getSubTutorStatsDetails(tutorId: number, subTutorId: number, statType: 'today' | 'pending' | 'feedback') {
    return this.request(`/admin/tutor/${tutorId}/sub-tutor-details/${subTutorId}/${statType}`);
  }
  
  async getTeamProgress(tutorId: number, filters?: { dateFrom?: string; dateTo?: string; sortBy?: string }) {
    const params = new URLSearchParams();
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    const queryString = params.toString();
    return this.request(`/admin/tutor/${tutorId}/team-progress${queryString ? `?${queryString}` : ''}`);
  }
  
  async getSubTutorAllSubmissions(tutorId: number, subTutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/sub-tutor-all-submissions/${subTutorId}`);
  }
  
  async getMyStudentsSubmissions(tutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/my-students-submissions`);
  }

  async getAllStudentsSubmissions() {
    return this.request('/admin/all-students-submissions');
  }

  async createUser(userData: any) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async updateUser(userId: number, userData: any) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  async deleteUser(userId: number) {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }

  async impersonateUser(userId: number) {
    return this.request(`/admin/impersonate/${userId}`, {
      method: 'POST'
    });
  }

  async stopImpersonation() {
    return this.request('/admin/stop-impersonate', {
      method: 'POST',
      credentials: 'include'
    });
  }

  async getImpersonationLogs(page: number = 1, limit: number = 50) {
    return this.request(`/admin/impersonation-logs?page=${page}&limit=${limit}`);
  }

  async getCourses() {
    return this.request('/admin/courses');
  }

  async getTicketsCourses() {
    return this.request('/tickets/courses');
  }

  async getTicketsCourseCategories() {
    return this.request('/tickets/course-categories');
  }

  async getTicketsStudentPaymentInstallments(studentId: number) {
    return this.request(`/tickets/student/${studentId}/payment-installments`);
  }

  // Get student academic progress (qualification courses + units pass/refer) – staff only
  async getStudentAcademicProgress(studentId: number) {
    return this.request(`/tickets/student/${studentId}/academic-progress`);
  }

  async getStudentQualProgress(studentId: number) {
    return this.request(`/tickets/student/${studentId}/qual-progress`);
  }

  // Get onboarding data for a specific student (staff)
  async getStudentOnboardingById(studentId: number) {
    return this.request(`/onboarding/student/${studentId}`);
  }

  async getTutorCourses(tutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/courses`);
  }

  async createCourse(courseData: any) {
    return this.request('/admin/courses', {
      method: 'POST',
      body: JSON.stringify(courseData)
    });
  }

  async updateCourse(courseId: number, courseData: any) {
    return this.request(`/admin/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(courseData)
    });
  }

  async deleteCourse(courseId: number) {
    return this.request(`/admin/courses/${courseId}`, {
      method: 'DELETE'
    });
  }

  async getCourseCategories() {
    return this.request('/admin/course-categories');
  }

  // Alias for consistency
  async getCategories() {
    return this.request('/admin/course-categories');
  }

  async createCourseCategory(categoryData: any) {
    return this.request('/admin/course-categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  }

  async getSubCategories(categoryId?: number) {
    if (categoryId) {
      return this.request(`/admin/sub-categories/${categoryId}`);
    }
    // Get all sub-categories
    return this.request('/admin/sub-categories');
  }

  async createSubCategory(subCategoryData: any) {
    return this.request('/admin/sub-categories', {
      method: 'POST',
      body: JSON.stringify(subCategoryData)
    });
  }

  async deleteCourseCategory(categoryId: number) {
    return this.request(`/admin/course-categories/${categoryId}`, {
      method: 'DELETE'
    });
  }

  async deleteSubCategory(subCategoryId: number) {
    return this.request(`/admin/sub-categories/${subCategoryId}`, {
      method: 'DELETE'
    });
  }

  async uploadCourseFile(courseId: number, file: File, fileType: string = 'resource') {
    const formData = new FormData();
    formData.append('courseFile', file);
    formData.append('courseId', courseId.toString());
    formData.append('fileType', fileType);

    return fetch(`${this.baseUrl}/admin/courses/upload`, {
      method: 'POST',
      headers: {
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` })
      },
      body: formData
    }).then(response => response.json());
  }

  async getCourseFiles(courseId: number) {
    return this.request(`/admin/courses/${courseId}/files`);
  }

  async getCourseDetail(courseId: number) {
    return this.request(`/admin/courses/${courseId}/detail`);
  }

  async getCourseOutline(courseId: number) {
    return this.request(`/admin/courses/${courseId}/outline`);
  }

  async createUnit(courseId: number, payload: any) {
    return this.request(`/admin/courses/${courseId}/units`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateUnit(unitId: number, payload: any) {
    return this.request(`/admin/units/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async deleteUnit(unitId: number) {
    return this.request(`/admin/units/${unitId}`, {
      method: 'DELETE'
    });
  }

  async uploadUnitResource(unitId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${this.baseUrl}/admin/units/${unitId}/resources`, {
      method: 'POST',
      headers: {
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` })
      },
      body: form
    }).then(r => r.json());
  }

  async updateResource(resourceId: number, title: string) {
    return this.request(`/admin/resources/${resourceId}`, {
      method: 'PUT',
      body: JSON.stringify({ title })
    });
  }

  async deleteResource(resourceId: number) {
    return this.request(`/admin/resources/${resourceId}`, {
      method: 'DELETE'
    });
  }

  async updateQuiz(quizId: number, title: string) {
    return this.request(`/admin/quizzes/${quizId}`, {
      method: 'PUT',
      body: JSON.stringify({ title })
    });
  }

  async deleteQuiz(quizId: number) {
    return this.request(`/admin/quizzes/${quizId}`, {
      method: 'DELETE'
    });
  }

  async submitAssignment(assignmentId: number, studentId: number, file: File) {
    const form = new FormData();
    form.append('submission', file);
    form.append('student_id', String(studentId));
    return fetch(`${this.baseUrl}/admin/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: {
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` })
      },
      body: form
    }).then(r => r.json());
  }

  async backupCourses() {
    return this.request('/admin/courses/backup', {
      method: 'POST'
    });
  }

  async restoreCourses(backupFile: File) {
    const formData = new FormData();
    formData.append('backupFile', backupFile);

    return fetch(`${this.baseUrl}/admin/courses/restore`, {
      method: 'POST',
      headers: {
        ...(this.getToken() && { 'Authorization': `Bearer ${this.getToken()}` })
      },
      body: formData
    }).then(response => response.json());
  }

  async getAssignments() {
    return this.request('/admin/assignments');
  }

  async getQuizzes() {
    return this.request('/admin/quizzes');
  }

  async getForums() {
    return this.request('/admin/forums');
  }

  async getCertificates() {
    return this.request('/admin/certificates');
  }

  // Test admin API connection
  async testAdminApi() {
    return this.request('/admin/test');
  }

  // Quiz import (GIFT)
  async importGift(courseId: number, gift: string, title?: string, unitId?: number, quizType?: 'practice' | 'final', passingScore?: number) {
    return this.request(`/admin/courses/${courseId}/quizzes/import-gift`, {
      method: 'POST',
      body: JSON.stringify({ 
        gift, 
        title, 
        unit_id: unitId, 
        quiz_type: quizType || 'practice',
        passing_score: passingScore || 70
      })
    });
  }

  async getQuiz(quizId: number) {
    return this.request(`/admin/quizzes/${quizId}`);
  }

  async attemptQuiz(quizId: number, studentId: number, answers: Array<{question_id: number; answer: string;}>) {
    return this.request(`/admin/quizzes/${quizId}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, answers })
    });
  }

  async getStudentCourses(studentId: number) {
    return this.request(`/student/${studentId}/courses`);
  }

  async getStudentAssignments(studentId: number) {
    return this.request(`/student/${studentId}/assignments`);
  }

  async getStudentTutors(studentId: number) {
    return this.request(`/student/${studentId}/tutors`);
  }

  async getStudentCPDCourses(studentId: number) {
    return this.request(`/student/${studentId}/cpd-courses`);
  }

  async getStudentQualificationCourses(studentId: number) {
    return this.request(`/student/${studentId}/qualification-courses`);
  }

  async getStudentGrades(studentId: number) {
    return this.request(`/student/${studentId}/grades`);
  }

  async getStudentCourseUnits(studentId: number, courseId: number) {
    return this.request(`/student/${studentId}/courses/${courseId}/units`);
  }

  async completeStudentUnit(studentId: number, courseId: number, unitId: number) {
    return this.request(`/student/${studentId}/courses/${courseId}/units/${unitId}/complete`, {
      method: 'POST'
    });
  }

  async unlockUnitForStudent(
    studentId: number,
    courseId: number,
    unitId: number,
    payload: { unlockMethod?: string; unlockedBy?: number; reason?: string } = {}
  ) {
    return this.request(`/admin/students/${studentId}/courses/${courseId}/units/${unitId}/unlock`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async unlockStudentAssignment(studentId: number, unitId: number, courseId: number) {
    return this.request(`/admin/students/${studentId}/units/${unitId}/unlock-assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ courseId, unlock: true })
    });
  }

  async lockStudentAssignment(studentId: number, unitId: number, courseId: number) {
    return this.request(`/admin/students/${studentId}/units/${unitId}/lock-assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ courseId, unlock: false })
    });
  }

  async getAllStudents() {
    return this.request('/admin/students');
  }

  async getCourseEnrollments(courseId: number) {
    return this.request(`/admin/courses/${courseId}/enrollments`);
  }

  async getTutorCourseEnrollments(tutorId: number, courseId: number) {
    return this.request(`/admin/tutor/${tutorId}/courses/${courseId}/enrollments`);
  }

  async getTutorAssignments(tutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/assignments`);
  }

  async getTutorQuizzes(tutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/quizzes`);
  }

  async getTutorAssignmentSubmissions(tutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/assignment-submissions`);
  }

  async getTutorQuizAttempts(tutorId: number) {
    return this.request(`/admin/tutor/${tutorId}/quiz-attempts`);
  }

  // Tutor - Get qualification submissions for grading
  async getTutorQualificationSubmissions() {
    return this.request('/qualification/submissions/pending');
  }

  // Grade qualification submission (assignment or presentation)
  async gradeQualificationSubmission(submissionId: number, data: {
    grading_type: 'score' | 'pass_fail';
    numeric_grade?: number;
    pass_fail_result: 'pass' | 'fail';
    feedback?: string;
  }) {
    return this.request(`/qualification/submissions/${submissionId}/grade`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Admin - Get all assignments and quizzes across all courses
  async getAllAssignmentSubmissions() {
    return this.request('/admin/all-assignment-submissions');
  }

  async getAllQuizAttempts() {
    return this.request('/admin/all-quiz-attempts');
  }

  // ========================================
  // UNIT PROGRESSION & ASSIGNMENT SYSTEM
  // ========================================
  
  // Toggle assignment requirement for a unit
  async toggleUnitAssignmentRequirement(unitId: number, requiresAssignment: boolean, passingScore: number = 70) {
    return this.request(`/courses/units/${unitId}/assignment-requirement`, {
      method: 'PUT',
      body: JSON.stringify({ requiresAssignment, passingScore })
    });
  }

  // Get unit progression status for a student
  async getUnitProgression(courseId: number, studentId: number) {
    return this.request(`/courses/${courseId}/progression/${studentId}`);
  }

  // Create assignment linked to a unit
  async createAssignment(courseId: number, unitId: number | null, title: string, description: string, dueDate: string, createdBy: number) {
    return this.request('/admin/assignments', {
      method: 'POST',
      body: JSON.stringify({
        course_id: courseId,
        unit_id: unitId,
        title,
        description,
        due_date: dueDate,
        created_by: createdBy
      })
    });
  }

  // Update assignment
  async updateAssignment(assignmentId: number, data: { title: string; description: string; due_date: string; unit_id?: number | null }) {
    return this.request(`/admin/assignments/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Delete assignment
  async deleteAssignment(assignmentId: number) {
    return this.request(`/admin/assignments/${assignmentId}`, {
      method: 'DELETE'
    });
  }

  // Grade assignment submission
  async gradeAssignmentSubmission(submissionId: number, score: number, feedback: string, gradedBy: number) {
    return this.request(`/courses/submissions/${submissionId}/grade`, {
      method: 'PUT',
      body: JSON.stringify({ score, feedback, gradedBy })
    });
  }

  // Import Moodle backup
  async restoreMoodleBackup(formData: FormData) {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/admin/courses/restore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async enrollStudents(studentIds: number[], courseId: number, tutorId?: number, assigned_tutor_id?: number) {
    return this.request('/admin/enrollments', {
      method: 'POST',
      body: JSON.stringify({ studentIds, courseId, tutorId, assigned_tutor_id })
    });
  }

  async unenrollStudent(courseId: number, studentId: number, tutorId?: number) {
    const params = tutorId ? `?tutorId=${tutorId}` : '';
    return this.request(`/admin/enrollments/${courseId}/${studentId}${params}`, {
      method: 'DELETE'
    });
  }

  // Set student-specific topic deadlines
  async setStudentDeadlines(courseId: number, studentId: number, deadlines: Array<{ topicId: number; deadline: string | null; notes?: string; topicType?: 'cpd_topic' | 'qualification_unit' }>) {
    return this.request(`/admin/enrollments/${courseId}/${studentId}/deadlines`, {
      method: 'POST',
      body: JSON.stringify({ deadlines })
    });
  }

  // Get student-specific deadlines for a course
  async getStudentDeadlines(courseId: number, studentId: number) {
    return this.request(`/admin/enrollments/${courseId}/${studentId}/deadlines`);
  }

  // Get CPD topics for a course
  async getCPDTopics(courseId: number) {
    return this.request(`/admin/courses/${courseId}/cpd-topics`);
  }

  // Get qualification units for a course
  async getQualificationUnits(courseId: number) {
    return this.request(`/admin/courses/${courseId}/qualification-units`);
  }

  // =====================================================
  // PAYMENT INSTALLMENTS API METHODS
  // =====================================================

  // Save payment installments for a student-course enrollment
  async savePaymentInstallments(
    courseId: number,
    studentId: number,
    paymentType: 'all_paid' | 'installment',
    installments: Array<{
      installment_number: number;
      installment_name: string;
      amount: number;
      due_date: string | null;
      status: 'paid' | 'due' | 'overdue';
      paid_at?: string | null;
      payment_reference?: string | null;
    }>
  ) {
    return this.request(`/admin/enrollments/${courseId}/${studentId}/installments`, {
      method: 'POST',
      body: JSON.stringify({ payment_type: paymentType, installments })
    });
  }

  // Get payment installments for a student-course
  async getPaymentInstallments(courseId: number, studentId: number) {
    return this.request(`/admin/enrollments/${courseId}/${studentId}/installments`);
  }

  // Update payment installment status
  async updatePaymentStatus(
    installmentId: number,
    status: 'paid' | 'due' | 'overdue',
    paid_at?: string,
    payment_reference?: string,
    notes?: string
  ) {
    return this.request(`/admin/installments/${installmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, paid_at, payment_reference, notes })
    });
  }

  // Get payment statistics (Admin)
  async getPaymentStats(params?: { fromDate?: string; toDate?: string; month?: string; year?: string }) {
    const q = new URLSearchParams();
    if (params?.fromDate) q.append('fromDate', params.fromDate);
    if (params?.toDate) q.append('toDate', params.toDate);
    if (params?.month) q.append('month', params.month);
    if (params?.year) q.append('year', params.year);
    const qs = q.toString();
    return this.request(`/admin/payments/stats${qs ? `?${qs}` : ''}`);
  }

  async exportPayments(params: {
    tab: string;
    fromDate?: string;
    toDate?: string;
    month?: string;
    year?: string;
    courseId?: string;
  }) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.append(k, v));
    return `/api/admin/payments/export?${q.toString()}`;
  }

  // Get all payment installments (Admin)
  async getAllPayments(status?: string, search?: string, page?: number, limit?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    return this.request(`/admin/payments?${params.toString()}`);
  }

  // Get tutor's students payment installments
  async getTutorPayments(tutorId: number, status?: string, search?: string, page?: number, limit?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    return this.request(`/tutor/payments?${params.toString()}`);
  }

  // Get student's own payment installments
  async getStudentInstallments(courseId?: number) {
    const params = courseId ? `?courseId=${courseId}` : '';
    return this.request(`/student/installments${params}`);
  }

  // Create payment intent for installment (student pays online)
  async createInstallmentPaymentIntent(installmentId: number) {
    return this.request(`/installments/${installmentId}/pay`, {
      method: 'POST'
    });
  }

  // Confirm installment payment after Stripe success
  async confirmInstallmentPayment(installmentId: number, paymentIntentId: string) {
    return this.request(`/installments/${installmentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId })
    });
  }

  // Get all installments for a specific student (Admin)
  async getStudentInstallmentsByAdmin(studentId: number) {
    return this.request(`/admin/students/${studentId}/installments`);
  }

  // Payment Reminders - Pending/Received/Logs (Accounts Manager + Team)
  async getPendingPayments(params?: { search?: string; course?: string; fromDate?: string; toDate?: string; reminderStatus?: string; timeFilter?: string }) {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.course) q.append('course', params.course);
    if (params?.fromDate) q.append('fromDate', params.fromDate);
    if (params?.toDate) q.append('toDate', params.toDate);
    if (params?.reminderStatus) q.append('reminderStatus', params.reminderStatus);
    if (params?.timeFilter) q.append('timeFilter', params.timeFilter);
    return this.request(`/admin/payments/pending?${q.toString()}`);
  }
  async getPendingPaymentsStats() {
    return this.request('/admin/payments/pending/stats');
  }
  async getReceivedPayments(params?: { search?: string; course?: string; fromDate?: string; toDate?: string; month?: string; year?: string; paymentPlan?: string }) {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.course) q.append('course', params.course);
    if (params?.fromDate) q.append('fromDate', params.fromDate);
    if (params?.toDate) q.append('toDate', params.toDate);
    if (params?.month) q.append('month', params.month);
    if (params?.year) q.append('year', params.year);
    if (params?.paymentPlan) q.append('paymentPlan', params.paymentPlan);
    return this.request(`/admin/payments/received?${q.toString()}`);
  }
  async getReceivedPaymentsStats() {
    return this.request('/admin/payments/received/stats');
  }
  async getReminderLogs(params?: { fromDate?: string; toDate?: string; sentBy?: string; method?: string; search?: string }) {
    const q = new URLSearchParams();
    if (params?.fromDate) q.append('fromDate', params.fromDate);
    if (params?.toDate) q.append('toDate', params.toDate);
    if (params?.sentBy) q.append('sentBy', params.sentBy);
    if (params?.method) q.append('method', params.method);
    if (params?.search) q.append('search', params.search);
    return this.request(`/admin/reminders/logs?${q.toString()}`);
  }
  async sendReminder(installmentId: number, method?: 'dashboard' | 'email' | 'both', templateId?: number) {
    return this.request('/admin/reminders/send', {
      method: 'POST',
      body: JSON.stringify({ installmentId, method: method || 'both', templateId })
    });
  }
  async sendBulkReminders(installmentIds: number[], method?: 'dashboard' | 'email' | 'both', templateId?: number) {
    return this.request('/admin/reminders/send-bulk', {
      method: 'POST',
      body: JSON.stringify({ installmentIds, method: method || 'both', templateId })
    });
  }
  /** Payment reminder templates (Accounts Manager) — /api/admin/email-templates */
  async getPaymentReminderEmailTemplates() {
    return this.request('/admin/email-templates');
  }
  async createPaymentReminderEmailTemplate(data: { name: string; subject: string; body: string; is_default?: boolean }) {
    return this.request('/admin/email-templates', { method: 'POST', body: JSON.stringify(data) });
  }
  async updatePaymentReminderEmailTemplate(id: number, data: { name?: string; subject?: string; body?: string; is_default?: boolean }) {
    return this.request(`/admin/email-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deletePaymentReminderEmailTemplate(id: number) {
    return this.request(`/admin/email-templates/${id}`, { method: 'DELETE' });
  }

  /** Admin email management — /api/email-templates */
  async getEmailTemplates() {
    return this.request('/email-templates');
  }
  async getEmailTemplate(id: number) {
    return this.request(`/email-templates/${id}`);
  }
  async createEmailTemplate(data: {
    display_name: string;
    category?: string;
    subject: string;
    body: string;
    variables?: string | unknown[];
  }) {
    return this.request('/email-templates', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateEmailTemplate(
    id: number,
    data: {
      display_name?: string;
      category?: string;
      subject?: string;
      body?: string;
      variables?: string | unknown[];
      is_active?: boolean;
    }
  ) {
    return this.request(`/email-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteEmailTemplate(id: number) {
    return this.request(`/email-templates/${id}`, { method: 'DELETE' });
  }
  /** Bulk / targeted sends from admin Email Management */
  async sendEmail(data: Record<string, unknown>) {
    return this.request('/email-templates/send', { method: 'POST', body: JSON.stringify(data) });
  }
  async getEmailLogs(params: Record<string, string | number | undefined>) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.append(k, String(v));
    });
    return this.request(`/email-templates/logs?${q.toString()}`);
  }
  /** Same as getEmailLogs — explicit name for filtered history */
  async getEmailLogsFiltered(params: Record<string, string | number | undefined>) {
    return this.getEmailLogs(params);
  }
  async getEmailLogStats() {
    return this.request('/email-templates/logs/stats');
  }
  async getEmailLogDetail(id: number) {
    return this.request(`/email-templates/logs/${id}`);
  }
  async resendEmailLog(logId: number) {
    return this.request(`/email-templates/logs/${logId}/resend`, { method: 'POST' });
  }
  async previewEmailTemplate(data: Record<string, unknown>) {
    return this.request('/email-templates/preview', { method: 'POST', body: JSON.stringify(data) });
  }
  async resendVerificationEmail(studentId: number) {
    return this.request(`/admin/students/${studentId}/resend-verification-email`, { method: 'POST' });
  }
  async getAutoReminderSettings() {
    return this.request('/admin/auto-reminder/settings');
  }
  async updateAutoReminderSettings(data: { is_enabled?: boolean; interval_hours?: number }) {
    return this.request('/admin/auto-reminder/settings', { method: 'PATCH', body: JSON.stringify(data) });
  }
  async getStudentNotifications() {
    return this.request('/student/notifications');
  }
  async markNotificationRead(id: number) {
    return this.request(`/student/notifications/${id}/read`, { method: 'PATCH' });
  }

  // =====================================================
  // CONSULTATIONS (Zoom Video Booking) API METHODS
  // =====================================================
  async getConsultationSlotsAll(params?: {
    date_from?: string;
    date_to?: string;
    status?: string;
    page?: number;
    per_page?: number;
    limit?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    const lim = params?.limit ?? params?.per_page;
    if (lim != null) q.set('per_page', String(lim));
    const query = q.toString();
    return this.request(`/consultations/slots/all${query ? '?' + query : ''}`);
  }
  async createConsultationSlotSingle(data: { date: string; start_time: string; duration_minutes: number }) {
    return this.request('/consultations/slots/single', { method: 'POST', body: JSON.stringify(data) });
  }
  async createConsultationSlotsDay(data: { date: string; slots: { start_time: string; duration_minutes: number }[] }) {
    return this.request('/consultations/slots/day', { method: 'POST', body: JSON.stringify(data) });
  }
  async createConsultationSlotsBulk(data: {
    date_from: string;
    date_to: string;
    repeat_on: string[];
    slots: { start_time: string; duration_minutes: number }[];
    skip_dates?: string[];
  }) {
    return this.request('/consultations/slots/bulk', { method: 'POST', body: JSON.stringify(data) });
  }
  async createConsultationSlots(slots: { date: string; start_time: string; end_time: string }[]) {
    return this.request('/consultations/slots', { method: 'POST', body: JSON.stringify(slots) });
  }
  async deleteConsultationSlot(slotId: number) {
    return this.request(`/consultations/slots/${slotId}`, { method: 'DELETE' });
  }
  async toggleConsultationSlotActive(slotId: number) {
    return this.request(`/consultations/slots/${slotId}/toggle-active`, { method: 'PATCH' });
  }
  async deleteConsultationSlotsBulk(ids: number[]) {
    return this.request('/consultations/slots/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) });
  }
  async getConsultationBookings(params?: {
    scope?: string;
    student_id?: number;
    status?: string;
    booking_status?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.scope) q.set('scope', params.scope);
    if (params?.student_id != null) q.set('student_id', String(params.student_id));
    if (params?.status) q.set('status', params.status);
    if (params?.booking_status) q.set('booking_status', params.booking_status);
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    const query = q.toString();
    return this.request(`/consultations/bookings${query ? '?' + query : ''}`);
  }
  async getConsultationManagerSettings() {
    return this.request('/consultation-manager/settings');
  }
  async updateConsultationManagerSettings(data: { is_enabled: boolean; disabled_message: string }) {
    return this.request('/consultation-manager/settings', { method: 'PUT', body: JSON.stringify(data) });
  }
  async getTodaysConsultations() {
    return this.request('/consultation-manager/today');
  }
  async getUpcomingConsultationsCm() {
    return this.request('/consultation-manager/upcoming');
  }
  async markConsultationComplete(bookingId: number) {
    return this.request(`/consultation-manager/bookings/${bookingId}/complete`, { method: 'PATCH' });
  }
  async getConsultationManagerTeam() {
    return this.request('/consultation-manager/team');
  }
  async getConsultationManagerStudentEnrollments(studentId: number) {
    return this.request(`/consultation-manager/students/${studentId}/enrollments`);
  }
  async getConsultationManagerStudentQualProgress(studentId: string | number) {
    return this.request(`/consultation-manager/students/${studentId}/qual-progress`);
  }
  async cancelConsultationBooking(bookingId: number) {
    return this.request(`/consultations/bookings/${bookingId}/cancel`, { method: 'PUT' });
  }
  async getConsultationSlotsAvailable() {
    return this.request('/consultations/slots/available');
  }
  async bookConsultationSlot(slotId: number, data?: { student_note?: string; notes?: string }) {
    const body = typeof data === 'string' ? { student_note: data, notes: data } : data || {};
    return this.request(`/consultations/book/${slotId}`, { method: 'POST', body: JSON.stringify(body) });
  }
  async confirmConsultationBooking(bookingId: number, data?: { tutor_note?: string }) {
    return this.request(`/consultations/bookings/${bookingId}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify(data || {})
    });
  }
  async denyConsultationBooking(bookingId: number, data: { tutor_note: string }) {
    return this.request(`/consultations/bookings/${bookingId}/deny`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  async rescheduleConsultationBooking(
    bookingId: number,
    data: { reschedule_date: string; reschedule_time: string; tutor_note: string }
  ) {
    return this.request(`/consultations/bookings/${bookingId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  async confirmConsultationReschedule(bookingId: number) {
    return this.request(`/consultations/bookings/${bookingId}/confirm-reschedule`, { method: 'PATCH', body: '{}' });
  }
  async acceptMyConsultationReschedule(bookingId: number) {
    return this.request(`/consultations/my-bookings/${bookingId}/accept-reschedule`, { method: 'PATCH', body: '{}' });
  }
  async getMyConsultationBookings() {
    return this.request('/consultations/my-bookings');
  }

  // Consultation Messages (chat thread per booking, with file attachments)
  async getConsultationMessages(bookingId: number) {
    return this.request(`/consultation-messages/${bookingId}`);
  }
  async sendConsultationMessage(bookingId: number, data: { body?: string; files?: File[] }) {
    const formData = new FormData();
    if (typeof data.body === 'string') formData.append('body', data.body);
    if (Array.isArray(data.files)) {
      for (const f of data.files) formData.append('files', f);
    }
    return this.request(`/consultation-messages/${bookingId}`, {
      method: 'POST',
      body: formData,
    });
  }
  async getServerTime() {
    return this.request('/time');
  }
  async cancelMyConsultationBooking(bookingId: number) {
    return this.request(`/consultations/my-bookings/${bookingId}`, { method: 'DELETE' });
  }

  // =====================================================
  // STUDENT PROFILE API METHODS
  // =====================================================

  // Get current student's profile
  async getStudentProfile() {
    return this.request('/student/profile');
  }

  // Update student profile
  async updateStudentProfile(profileData: {
    gender?: string;
    date_of_birth?: string;
    nationality?: string;
    ethnicity?: string;
    current_role?: string;
    previous_qualification?: string;
    motivation?: string;
    vark_visual?: number;
    vark_auditory?: number;
    vark_reading?: number;
    vark_kinesthetic?: number;
    english_literacy?: string;
    ict_skills?: string;
    special_learning_needs?: string;
  }) {
    return this.request('/student/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  // Upload profile picture
  async uploadProfilePicture(file: File) {
    const formData = new FormData();
    formData.append('picture', file);
    
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/student/profile/picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Get profile completion status
  async getProfileStatus() {
    return this.request('/student/profile/status');
  }

  // Get profile completion details with missing fields
  async getProfileCompletion() {
    return this.request('/student/profile/completion');
  }

  // Get onboarding documents (uploaded in steps 4–7)
  async getOnboardingDocuments() {
    return this.request('/onboarding/documents');
  }

  // Get full onboarding data for current student (status, course selection, qualification, assessment, documents)
  async getOnboardingMe() {
    return this.request('/onboarding/me');
  }

  // Document Verification APIs
  async getMyDocuments() {
    return this.request('/documents/my-documents');
  }

  async getStudentDocuments(studentId: number) {
    return this.request(`/documents/student/${studentId}`);
  }

  async approveDocument(documentId: number, notes?: string) {
    return this.request(`/documents/verify/${documentId}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', notes })
    });
  }

  async rejectDocument(documentId: number, reason: string) {
    return this.request(`/documents/verify/${documentId}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reject', reason })
    });
  }

  async bulkVerifyDocuments(documentIds: number[], action: 'approve' | 'reject', reason?: string) {
    return this.request('/documents/verify-bulk', {
      method: 'POST',
      body: JSON.stringify({ document_ids: documentIds, action, reason })
    });
  }

  async replaceDocument(documentId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(`/documents/replace/${documentId}`, {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  }

  async deleteDocument(documentId: number) {
    return this.request(`/documents/${documentId}`, {
      method: 'DELETE'
    });
  }

  async getDocumentHistory(documentId: number) {
    return this.request(`/documents/${documentId}/history`);
  }

  // VARK Learning Style Assessment
  async getVarkQuestions() {
    return this.request('/student/profile/vark-questions');
  }

  async submitVarkAssessment(answers: string[]) {
    return this.request('/student/profile/vark-assessment', {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
  }

  // Get all students profiles (Admin)
  async getAllStudentsProfiles(
    search?: string,
    status?: 'complete' | 'incomplete' | 'new' | 'review' | 'verified',
    doc_status?: 'rejected_awaiting' | 'resubmitted' | 'review'
  ) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (doc_status) params.append('doc_status', doc_status);
    return this.request(`/admin/students/profiles?${params.toString()}`);
  }

  // Get single student profile (Admin)
  async getStudentProfileById(studentId: number) {
    return this.request(`/admin/students/${studentId}/profile`);
  }

  // Get single student profile (Tutor)
  async getTutorStudentProfileById(studentId: number) {
    return this.request(`/tutor/students/${studentId}/profile`);
  }

  // Get tutor's students profiles
  async getTutorStudentsProfiles(search?: string, status?: 'complete' | 'incomplete') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    return this.request(`/tutor/students/profiles?${params.toString()}`);
  }

  // =====================================================
  // STAFF PROFILE METHODS (Admin, Tutor, Moderator)
  // =====================================================

  // Get staff profile (own profile)
  async getStaffProfile() {
    return this.request('/staff/profile');
  }

  // Update staff profile
  async updateStaffProfile(profileData: {
    date_of_birth?: string;
    phone?: string;
    address?: string;
    professional_title?: string;
    department?: string;
    bio?: string;
    qualifications?: string;
    specializations?: string;
  }) {
    return this.request('/staff/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  // Upload staff profile picture
  async uploadStaffProfilePicture(formData: FormData) {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/staff/profile/picture`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Course introduction management
  async updateCourseIntro(courseId: number, intro_heading: string, intro_subheading: string, intro_content: string) {
    return this.request(`/admin/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify({ intro_heading, intro_subheading, intro_content })
    });
  }

  async uploadIntroFile(courseId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return fetch(`${this.baseUrl}/admin/courses/${courseId}/intro-files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    }).then(res => res.json());
  }

  async getIntroFiles(courseId: number) {
    return this.request(`/admin/courses/${courseId}/intro-files`);
  }

  async deleteIntroFile(fileId: number) {
    return this.request(`/admin/courses/intro-files/${fileId}`, {
      method: 'DELETE'
    });
  }

  // =====================================================
  // CPD Course API Methods
  // =====================================================
  
  // =====================================================
  // CPD COURSES
  // =====================================================
  async createCPDCourse(formData: FormData) {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/cpd/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getCPDCourseForStudent(courseId: number, studentId: number) {
    return this.request(`/cpd/${courseId}/student/${studentId}`);
  }

  async getCPDCourseForAdmin(courseId: number) {
    return this.request(`/cpd/${courseId}/admin`);
  }

  async getAllCPDCourses() {
    return this.request('/cpd/list');
  }

  // Add CPD Topic
  async addCPDTopic(courseId: number, formData: FormData) {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/cpd/${courseId}/topics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Import CPD Quiz using GIFT format
  async importCPDQuizGift(
    topicId: number,
    gift: string,
    title: string,
    quizType: 'practice' | 'final',
    passingScore: number
  ) {
    return this.request(`/cpd/topics/${topicId}/quizzes/import-gift`, {
      method: 'POST',
      body: JSON.stringify({
        gift,
        title,
        quiz_type: quizType,
        passing_score: passingScore
      })
    });
  }

  // Add Quiz Question
  async addCPDQuizQuestion(quizId: number, questionData: {
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: string;
  }) {
    return this.request(`/cpd/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: JSON.stringify(questionData)
    });
  }

  // Submit CPD Quiz
  async submitCPDQuiz(quizId: number, studentId: number, answers: Record<number, string>) {
    return this.request(`/cpd/quizzes/${quizId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, answers })
    });
  }

  // Get latest CPD quiz attempt with details
  async getCPDQuizAttemptDetails(quizId: number, studentId: number) {
    return this.request(`/cpd/quizzes/${quizId}/latest-attempt/${studentId}`);
  }

  // Delete CPD Quiz
  async deleteCPDQuiz(quizId: number) {
    return this.request(`/cpd/quizzes/${quizId}`, {
      method: 'DELETE'
    });
  }

  async deleteCPDFile(fileId: number) {
    return this.request(`/cpd/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  async getCPDQuizAttemptsForTutor(tutorId: number) {
    return this.request(`/cpd/quiz-attempts/tutor/${tutorId}`);
  }

  // Claim CPD Certificate
  async claimCPDCertificate(courseId: number, studentId: number) {
    return this.request(`/cpd/${courseId}/claim-certificate/${studentId}`, {
      method: 'POST'
    });
  }

  // =====================================================
  // QUALIFICATION COURSES API
  // =====================================================

  // Create qualification course
  async createQualificationCourse(formData: FormData) {
    const token = this.getToken();

    const response = await fetch(`${this.baseUrl}/qualification/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Do NOT set Content-Type - browser sets it with boundary
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Log detailed student activity (course view, unit view, file open/close) for admin Event Logs
  async logStudentActivity(params: {
    action: 'student_course_view' | 'student_unit_view' | 'student_file_view';
    course_id?: number;
    course_name?: string;
    unit_id?: number;
    unit_name?: string;
    file_name?: string;
    opened_at?: string;
    closed_at?: string;
    duration_seconds?: number;
  }) {
    return this.request('/student/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  }

  // Get qualification course details
  async getQualificationCourse(courseId: number) {
    return this.request(`/qualification/${courseId}`);
  }

  // Get unit for a submission (avoids N+1 when deep-linking)
  async getQualificationUnitForSubmission(submissionId: number) {
    return this.request(`/qualification/submissions/${submissionId}/unit`);
  }

  // Update Rule Level 3 settings
  async updateQualificationRuleLevel3(
    courseId: number,
    enabled: boolean,
    requiredUnits: number,
    selectableUnits: number
  ) {
    return this.request(`/qualification/${courseId}/rule-level-3`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled,
        required_units: requiredUnits,
        selectable_units: selectableUnits
      })
    });
  }

  // Get student's selected units for Rule Level 3
  async getStudentSelectedUnits(courseId: number) {
    return this.request(`/qualification/${courseId}/selected-units`);
  }

  // Select units for Rule Level 3
  async selectUnitsForRuleLevel3(courseId: number, unitIds: number[]) {
    return this.request(`/qualification/${courseId}/select-units`, {
      method: 'POST',
      body: JSON.stringify({ unit_ids: unitIds })
    });
  }

  // Create unit
  async createQualificationUnit(courseId: number, unitData: any) {
    // Check if unitData is FormData (with files) or plain object
    if (unitData instanceof FormData) {
      const token = this.getToken();
      
      // Ensure URL uses correct protocol (HTTPS in production, HTTP in dev)
      let url: string;
      if (typeof window !== 'undefined') {
        // Use same protocol as current page to avoid ALPN negotiation errors
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        
        // Construct URL with correct protocol
        if (protocol === 'https:') {
          // Production: use same domain (Nginx proxies /api to backend)
          url = `${protocol}//${hostname}${port ? `:${port}` : ''}/api/qualification/${courseId}/units`;
        } else {
          // Development: use port 5000
          url = `${protocol}//${hostname}:5000/api/qualification/${courseId}/units`;
        }
      } else {
        // Server-side: use baseUrl
        url = `${this.baseUrl}/qualification/${courseId}/units`;
      }
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: unitData
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        return await response.json();
      } catch (fetchError) {
        throw fetchError;
      }
    } else {
      // Plain JSON data
      return this.request(`/qualification/${courseId}/units`, {
        method: 'POST',
        body: JSON.stringify(unitData)
      });
    }
  }

  // Get unit details
  async getQualificationUnit(unitId: number, studentId?: number) {
    const query = studentId ? `?studentId=${studentId}` : '';
    return this.request(`/qualification/units/${unitId}${query}`);
  }

  // Delete unit
  async deleteQualificationUnit(unitId: number) {
    return this.request(`/qualification/units/${unitId}`, {
      method: 'DELETE'
    });
  }

  async updateQualificationUnit(
    unitId: number,
    data: {
      title?: string;
      content?: string;
      unit_number?: number;
      enable_assignment_submission?: boolean | number;
      enable_presentation_submission?: boolean | number;
    }
  ) {
    return this.request(`/qualification/units/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async updateLectureTitle(
    unitId: number,
    lectureId: number,
    data: { title?: string; content?: string }
  ) {
    return this.request(`/qualification/units/${unitId}/lectures/${lectureId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async reorderLectures(unitId: number, lectures: Array<{ id: number; order_index: number }>) {
    return this.request(`/qualification/units/${unitId}/lectures/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ lectures })
    });
  }

  async updateQualificationTopic(
    unitId: number,
    topicId: number,
    data: {
      title?: string;
      description?: string;
      deadline?: string | null;
      topic_number?: number;
      order_index?: number;
    }
  ) {
    return this.request(`/qualification/units/${unitId}/topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteQualificationTopic(unitId: number, topicId: number) {
    return this.request(`/qualification/units/${unitId}/topics/${topicId}`, {
      method: 'DELETE'
    });
  }

  // Add topic to unit
  async addQualificationTopic(unitId: number, formData: FormData) {
    const response = await fetch(`${this.baseUrl}/qualification/units/${unitId}/topics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Add additional reading
  async addQualificationReading(unitId: number, formData: FormData) {
    const response = await fetch(`${this.baseUrl}/qualification/units/${unitId}/readings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Add lecture with files
  async addQualificationLecture(unitId: number, formData: FormData) {
    const response = await fetch(`${this.baseUrl}/qualification/units/${unitId}/lectures`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to add lecture' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Delete lecture
  async deleteQualificationLecture(unitId: number, lectureId: number) {
    return this.request(`/qualification/units/${unitId}/lectures/${lectureId}`, {
      method: 'DELETE'
    });
  }

  // Update/replace lecture files
  async updateQualificationLectureFiles(unitId: number, lectureId: number, formData: FormData) {
    const response = await fetch(`${this.baseUrl}/qualification/units/${unitId}/lectures/${lectureId}/files`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update lecture' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Add assignment brief files
  async addAssignmentBriefFiles(unitId: number, formData: FormData) {
    const response = await fetch(`${this.baseUrl}/qualification/units/${unitId}/assignment-brief/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to upload files' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Delete assignment brief file
  async deleteAssignmentBriefFile(unitId: number, fileId: number) {
    return this.request(`/qualification/units/${unitId}/assignment-brief/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  // Delete additional reading
  async deleteQualificationReading(unitId: number, readingId: number) {
    return this.request(`/qualification/units/${unitId}/readings/${readingId}`, {
      method: 'DELETE'
    });
  }

  async updateAdditionalReading(
    unitId: number,
    readingId: number,
    data: { title?: string; file?: File | null }
  ) {
    const formData = new FormData();
    if (data.title !== undefined && data.title !== null) {
      formData.append('title', data.title);
    }
    if (data.file) {
      formData.append('file', data.file);
    }
    const response = await fetch(
      `${this.baseUrl}/qualification/units/${unitId}/readings/${readingId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.getToken()}`
        },
        body: formData
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Failed to update reading' }));
      throw new Error(err.message || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  // Create assignment brief
  async createAssignmentBrief(unitId: number, formData: FormData) {
    const response = await fetch(`${this.baseUrl}/qualification/units/${unitId}/assignment-brief`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Submit assignment or presentation
  async submitQualificationWork(unitId: number, submissionType: 'assignment' | 'presentation', formData: FormData) {
    const response = await fetch(`${this.baseUrl}/qualification/units/${unitId}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Get pending submissions for tutor
  async getPendingSubmissions() {
    return this.request('/qualification/submissions/pending');
  }

  // Grade submission
  async gradeSubmission(submissionId: number, gradeData: {
    grading_type: 'score' | 'pass_fail';
    numeric_grade?: number;
    pass_fail_result: 'pass' | 'fail';
    feedback?: string;
  }) {
    return this.request(`/qualification/submissions/${submissionId}/grade`, {
      method: 'POST',
      body: JSON.stringify(gradeData)
    });
  }

  // Enroll student in qualification course
  async enrollStudentInQualification(courseId: number, studentId: number) {
    return this.request(`/qualification/${courseId}/enroll/${studentId}`, {
      method: 'POST'
    });
  }

  // Get student progress
  async getQualificationProgress(courseId: number, studentId: number) {
    return this.request(`/qualification/${courseId}/progress/${studentId}`);
  }

  // Get health check status
  async getHealthStatus() {
    // Health endpoint is at /api/health (consistent with other API routes)
    const response = await this.request('/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response;
  }

  // Get event logs with filters
  async getLogs(params: {
    page?: number;
    limit?: number;
    range?: 'today' | 'week' | 'month';
    date_from?: string;
    date_to?: string;
    user_id?: number;
    role?: string;
    action?: string;
    endpoint?: string;
    search?: string;
    search_user?: string;
    service?: string;
    courseId?: number;
    studentId?: number;
    format?: 'json' | 'csv';
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });
    const queryString = queryParams.toString();
    return this.request(`/admin/logs${queryString ? `?${queryString}` : ''}`);
  }

  // Delete logs (optional filters; no filters = delete all)
  async deleteLogs(params: {
    date_from?: string;
    date_to?: string;
    range?: string;
    role?: string;
    action?: string;
    service?: string;
    courseId?: number;
    studentId?: number;
    search_user?: string;
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });
    const queryString = queryParams.toString();
    return this.request(`/admin/logs${queryString ? `?${queryString}` : ''}`, { method: 'DELETE' });
  }

  // =====================================================
  // AI TOKEN MANAGEMENT METHODS
  // =====================================================

  async getAITokens(filters?: { isActive?: boolean; isRevoked?: boolean }) {
    const queryParams = new URLSearchParams();
    if (filters?.isActive !== undefined) {
      queryParams.append('isActive', String(filters.isActive));
    }
    if (filters?.isRevoked !== undefined) {
      queryParams.append('isRevoked', String(filters.isRevoked));
    }
    const queryString = queryParams.toString();
    return this.request(`/admin/ai-tokens${queryString ? `?${queryString}` : ''}`);
  }

  async createAIToken(data: {
    name: string;
    description?: string;
    expiresAt?: string;
    permissions?: string[];
    rateLimit?: number;
  }) {
    return this.request('/admin/ai-tokens', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getAIToken(tokenId: number) {
    return this.request(`/admin/ai-tokens/${tokenId}`);
  }

  async revokeAIToken(tokenId: number, reason?: string) {
    return this.request(`/admin/ai-tokens/${tokenId}/revoke`, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    });
  }

  async getAITokenLogs(tokenId: number, params?: {
    page?: number;
    limit?: number;
    actionType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    return this.request(`/admin/ai-tokens/${tokenId}/logs${queryString ? `?${queryString}` : ''}`);
  }

  async getAITokenSecurity(tokenId: number) {
    return this.request(`/admin/ai-tokens/${tokenId}/security`);
  }

  async deleteAIToken(tokenId: number) {
    return this.request(`/admin/ai-tokens/${tokenId}`, {
      method: 'DELETE'
    });
  }

  // Get log filter presets
  async getLogPresets() {
    return this.request('/admin/logs/presets');
  }

  // Save log filter preset
  async saveLogPreset(presetName: string, filters: any) {
    return this.request('/admin/logs/presets', {
      method: 'POST',
      body: JSON.stringify({ preset_name: presetName, filters })
    });
  }

  // Delete log filter preset
  async deleteLogPreset(presetId: number) {
    return this.request(`/admin/logs/presets/${presetId}`, {
      method: 'DELETE'
    });
  }

  // Get export history
  async getLogExports(page: number = 1, limit: number = 50) {
    return this.request(`/admin/logs/exports?page=${page}&limit=${limit}`);
  }

  // Get active/online users
  async getActiveUsers(params: { page?: number; limit?: number } = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    const queryString = queryParams.toString();
    return this.request(`/admin/logs/active-users${queryString ? `?${queryString}` : ''}`);
  }

  // =====================================================
  // MANAGER API METHODS
  // =====================================================

  // Get all students under manager
  async getManagerStudents() {
    return this.request('/manager/students');
  }

  // Get staff members under manager
  async getManagerStaff() {
    return this.request('/manager/staff');
  }

  // Get students under a staff member
  async getStaffStudents(staffId: number) {
    return this.request(`/manager/staff/${staffId}/students`);
  }

  // Get student course progress
  // =====================================================
  // FORUM API METHODS
  // =====================================================

  // Categories
  async getForumCategories() {
    return this.request('/forum/categories');
  }

  // Stats (lightweight — no post payload)
  async getForumStats() {
    return this.request('/forum/stats');
  }

  // Posts
  async getForumPosts(params?: {
    category_id?: number;
    status?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.category_id) queryParams.append('category_id', params.category_id.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return this.request(`/forum/posts${query ? `?${query}` : ''}`);
  }

  async getForumPost(postId: number) {
    return this.request(`/forum/posts/${postId}`);
  }

  async createForumPost(data: {
    category_id?: number;
    title: string;
    content: string;
  }) {
    return this.request('/forum/posts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateForumPost(postId: number, data: {
    title: string;
    content: string;
  }) {
    return this.request(`/forum/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteForumPost(postId: number) {
    return this.request(`/forum/posts/${postId}`, {
      method: 'DELETE'
    });
  }

  async pinForumPost(postId: number, isPinned: boolean) {
    return this.request(`/forum/posts/${postId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ is_pinned: isPinned })
    });
  }

  async lockForumPost(postId: number, isLocked: boolean) {
    return this.request(`/forum/posts/${postId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ is_locked: isLocked })
    });
  }

  async toggleForumComments(postId: number, commentsDisabled: boolean) {
    return this.request(`/forum/posts/${postId}/toggle-comments`, {
      method: 'POST',
      body: JSON.stringify({ comments_disabled: commentsDisabled })
    });
  }

  // Comments
  async createForumComment(postId: number, data: {
    content: string;
    parent_comment_id?: number;
  }) {
    return this.request(`/forum/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateForumComment(commentId: number, content: string) {
    return this.request(`/forum/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
  }

  async deleteForumComment(commentId: number) {
    return this.request(`/forum/comments/${commentId}`, {
      method: 'DELETE'
    });
  }

  // Reactions
  async reactForumPost(postId: number, reactionType: string) {
    return this.request(`/forum/posts/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reaction_type: reactionType })
    });
  }

  // Likes (backward compatibility)
  async likeForumPost(postId: number) {
    return this.reactForumPost(postId, 'like');
  }

  // React to comment (7 reaction types)
  async reactForumComment(commentId: number, reactionType: string) {
    return this.request(`/forum/comments/${commentId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reaction_type: reactionType })
    });
  }

  // Like comment (backward compatibility)
  async likeForumComment(commentId: number) {
    return this.reactForumComment(commentId, 'like');
  }

  async getForumLikes(postId: number) {
    return this.request(`/forum/posts/${postId}/likes`);
  }

  // =====================================================
  // NOTIFICATIONS API METHODS
  // =====================================================

  async getNotifications(limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return this.request(`/notifications${query ? `?${query}` : ''}`);
  }

  async getUnreadNotificationCount() {
    return this.request('/notifications/unread-count');
  }

  async markNotificationAsRead(notificationId: number) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/mark-all-read', {
      method: 'PUT'
    });
  }

  async deleteNotification(notificationId: number) {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE'
    });
  }

  async getStudentProgress(studentId: number) {
    return this.request(`/manager/students/${studentId}/progress`);
  }

  // =====================================================
  // SYSTEM SETTINGS (Stripe)
  // =====================================================

  async getStripeSettings() {
    return this.request('/settings/stripe');
  }

  async saveStripeSettings(data: Record<string, unknown>) {
    return this.request('/settings/stripe', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getStripeConfig() {
    return this.request('/settings/stripe-config');
  }

  // =====================================================
  // CERTIFICATE CLAIMING API METHODS
  // =====================================================

  // Get all certificates from catalog
  async getCertificateCatalog() {
    return this.request('/certificates/catalog/certificates');
  }

  // Get level courses by level
  async getLevelCourses(level: string) {
    return this.request(`/certificates/catalog/level-courses/${level}`);
  }

  // Get pricing based on level and certificate type
  async getCertificatePricing(level: string, certificateType: string) {
    return this.request(`/certificates/pricing/${level}/${encodeURIComponent(certificateType)}`);
  }

  // Get all pricing (for admin)
  async getAllCertificatePricing() {
    return this.request('/certificates/pricing/all');
  }

  async createCertificatePricing(data: {
    level_name: string;
    certificate_type: string;
    base_price: number;
    normal_courier_price: number;
    special_courier_price: number;
  }) {
    return this.request('/certificates/pricing', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Submit CPD certificate claim
  async submitCPDCertificateClaim(formData: FormData) {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/certificates/claim/cpd`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to submit certificate claim');
    }

    return await response.json();
  }

  // Submit qualification certificate claim
  async submitQualificationCertificateClaim(data: any) {
    return this.request('/certificates/claim/qualification', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Create Stripe payment intent
  async createPaymentIntent(claimId: number, amount: number) {
    return this.request('/certificates/payment/create-intent', {
      method: 'POST',
      body: JSON.stringify({ claimId, amount })
    });
  }

  // Confirm payment
  async confirmCertificatePayment(claimId: number, paymentIntentId: string) {
    return this.request('/certificates/payment/confirm', {
      method: 'POST',
      body: JSON.stringify({ claimId, paymentIntentId })
    });
  }

  // Get student's own certificate claims
  async getMyMyCertificateClaims() {
    return this.request('/certificates/my-claims');
  }

  // Get certificate claims (admin/tutor)
  async getCertificateClaims(filters?: any) {
    const params = new URLSearchParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
    }
    return this.request(`/certificates/claims?${params.toString()}`);
  }

  // Get single certificate claim details
  async getCertificateClaimDetails(claimId: number) {
    return this.request(`/certificates/claims/${claimId}`);
  }

  // Update certificate claim status
  async updateCertificateClaimStatus(claimId: number, data: any) {
    return this.request(`/certificates/claims/${claimId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Update certificate pricing (admin)
  async updateCertificatePricing(
    pricingId: number,
    data: {
      base_price: number;
      normal_courier_price: number;
      special_courier_price: number;
      is_active?: number | boolean;
    }
  ) {
    return this.request(`/certificates/pricing/${pricingId}`, {
      method: 'PUT',
      body: JSON.stringify({
        base_price: data.base_price,
        normal_courier_price: data.normal_courier_price,
        special_courier_price: data.special_courier_price,
        is_active: data.is_active
      })
    });
  }

  // Delete certificate claim
  async deleteCertificateClaim(claimId: number) {
    return this.request(`/certificates/claims/${claimId}`, {
      method: 'DELETE'
    });
  }

  // =====================================================
  // CERTIFICATE GENERATION & TEMPLATE MANAGEMENT
  // =====================================================

  // Template Management
  async getCertificateTemplates(filters?: any) {
    const params = new URLSearchParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined) params.append(key, filters[key]);
      });
    }
    return this.request(`/certificate-templates?${params.toString()}`);
  }

  async uploadCertificateTemplate(formData: FormData) {
    return this.request('/certificate-templates/upload', {
      method: 'POST',
      body: formData
    });
  }

  async updateCertificateTemplate(templateId: number, formData: FormData) {
    return this.request(`/certificate-templates/${templateId}`, {
      method: 'PUT',
      body: formData
    });
  }

  async deleteCertificateTemplate(templateId: number) {
    return this.request(`/certificate-templates/${templateId}`, {
      method: 'DELETE'
    });
  }

  downloadCertificateTemplate(templateId: number) {
    return `/api/certificate-templates/${templateId}/download`;
  }

  // Download certificate template with authentication
  async downloadCertificateTemplateFile(templateId: number): Promise<Blob> {
    const token = this.getToken();
    const url = `${this.baseUrl}/certificate-templates/${templateId}/download`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to download template' }));
      throw new Error(error.message || 'Failed to download template');
    }

    return await response.blob();
  }

  // Generated Certificates
  async getGeneratedCertificates(filters?: any) {
    const params = new URLSearchParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
    }
    return this.request(`/certificates/generated?${params.toString()}`);
  }

  async getGeneratedCertificateDetails(certId: number) {
    return this.request(`/certificates/generated/${certId}`);
  }

  async triggerCertificateGeneration(claimId: number) {
    return this.request(`/certificates/generate/${claimId}`, {
      method: 'POST'
    });
  }

  async addRegistrationNumber(certId: number, registrationNumber: string) {
    return this.request(`/certificates/generated/${certId}/registration`, {
      method: 'POST',
      body: JSON.stringify({ registration_number: registrationNumber })
    });
  }

  async getNextRegistrationNumber(studentId: number) {
    return this.request(`/certificates/next-registration-number?studentId=${studentId}`);
  }

  async deliverCertificate(certId: number) {
    return this.request(`/certificates/generated/${certId}/deliver`, {
      method: 'POST'
    });
  }

  async getMyDeliveredCertificates() {
    return this.request('/certificates/my-delivered');
  }

  async downloadCertificatePDF(certId: number, type: 'certificate' | 'transcript') {
    return `/api/certificates/download/${certId}/${type}`;
  }

  async getGeneratedCertificateByClaim(claimId: number) {
    return this.request(`/certificates/generated/by-claim/${claimId}`);
  }

  async deliverMultipleCertificates(certificateIds: number[]) {
    return this.request('/certificates/deliver-all', {
      method: 'POST',
      body: JSON.stringify({ certificateIds })
    });
  }

  // Download DOCX for editing (returns URL; use downloadCertificateDOCXFile for auth-aware download)
  async downloadCertificateDOCX(certId: number, type: 'cert' | 'trans') {
    const token = this.getToken();
    return `${this.baseUrl}/certificates/generated/${certId}/docx/${type}?token=${token}`;
  }

  /** Download certificate/transcript DOCX as file (uses auth header, triggers save-as) */
  async downloadCertificateDOCXFile(certId: number, type: 'cert' | 'trans', suggestedName: string): Promise<void> {
    const url = `${this.baseUrl}/certificates/generated/${certId}/docx/${type}`;
    const headers = this.getHeaders() as HeadersInit;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Download failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = suggestedName || (type === 'cert' ? 'certificate.docx' : 'transcript.docx');
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Upload edited DOCX
  async uploadEditedDOCX(certId: number, type: 'cert' | 'trans', file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(`/certificates/generated/${certId}/upload-docx/${type}`, {
      method: 'POST',
      body: formData
    });
  }

  // Reconvert DOCX to PDF
  async reconvertCertificateToPDF(certId: number, type: 'cert' | 'trans') {
    return this.request(`/certificates/generated/${certId}/reconvert/${type}`, {
      method: 'POST'
    });
  }

  // Get view URL for certificate (inline view, not download)
  getViewCertificateURL(regNumber: string, type: 'cert' | 'trans') {
    return `/api/certificates/public-download/${type}/${regNumber}?view=true`;
  }

  // Get certificate placeholder data for editing
  async getCertificatePlaceholders(certId: number) {
    return this.request(`/certificates/generated/${certId}/placeholders`);
  }

  // Save edited certificate placeholders
  async saveCertificatePlaceholders(certId: number, data: any) {
    return this.request(`/certificates/generated/${certId}/placeholders`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // =====================================================
  // QUALIFICATION FILE MANAGEMENT
  // =====================================================

  // Reject qualification file
  async rejectQualificationFile(fileId: number, feedback: string) {
    return this.request(`/qualification/files/${fileId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ feedback })
    });
  }

  async rejectVideoLink(submissionId: number, reason?: string) {
    return this.request(`/qualification/submissions/${submissionId}/reject-video-link`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason ?? '' })
    });
  }

  async resubmitVideoLink(submissionId: number, videoLink: string) {
    return this.request(`/qualification/submissions/${submissionId}/resubmit-video-link`, {
      method: 'PATCH',
      body: JSON.stringify({ video_link: videoLink })
    });
  }

  // Mark qualification file as viewed
  async markQualificationFileAsViewed(fileId: number) {
    return this.request(`/qualification/files/${fileId}/mark-viewed`, {
      method: 'POST'
    });
  }

  // Mark qualification file as downloaded (log assessor activity)
  async markQualificationFileAsDownloaded(fileId: number) {
    return this.request(`/qualification/files/${fileId}/mark-downloaded`, {
      method: 'POST'
    });
  }

  // Mark qualification file as closed (log assessor activity with duration)
  // Use keepalive: true for beforeunload so the request survives page unload
  async markQualificationFileAsClosed(fileId: number, openedAt: string, options?: { keepalive?: boolean }) {
    const url = `${this.baseUrl}/qualification/files/${fileId}/mark-closed`;
    const fetchOpts: RequestInit = {
      method: 'POST',
      headers: this.getHeaders() as HeadersInit,
      body: JSON.stringify({ opened_at: openedAt })
    };
    if (options?.keepalive) {
      (fetchOpts as any).keepalive = true;
    }
    return fetch(url, fetchOpts).then(r => r.json());
  }
  // =====================================================
  // ASSESSOR-STUDENT ACTIVITY REPORTS
  // =====================================================

  async getAssessorStudentReports(filters?: {
    assessorId?: number;
    studentId?: number;
    unitId?: number;
    courseId?: number;
    activityType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    return this.request(`/admin/assessor-student-reports?${queryParams.toString()}`);
  }

  async getAssessorStudentSummary(assessorId: number, studentId: number, courseId?: number) {
    const params = new URLSearchParams({
      assessorId: String(assessorId),
      studentId: String(studentId)
    });
    if (courseId) {
      params.append('courseId', String(courseId));
    }
    
    return this.request(`/admin/assessor-student-summary?${params.toString()}`);
  }

  async getAssessorStudentUnifiedLogs(filters: {
    assessorId: number;
    studentId: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) {
    const params = new URLSearchParams({
      assessorId: String(filters.assessorId),
      studentId: String(filters.studentId)
    });
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.limit) params.append('limit', String(filters.limit));
    
    return this.request(`/admin/assessor-student-unified-logs?${params.toString()}`);
  }

  // =====================================================
  // DATABASE BACKUP MANAGEMENT
  // =====================================================

  async getBackupStatus() {
    return this.request('/backup/status');
  }

  async listDatabaseBackups() {
    return this.request('/backup/list');
  }

  async createDatabaseBackup() {
    return this.request('/backup/create', { method: 'POST' });
  }

  async deleteDatabaseBackup(filename: string) {
    return this.request(`/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  }

  async getBackupLogs(page: number = 1) {
    return this.request(`/backup/logs?page=${page}`);
  }

  async getBackupSettings() {
    return this.request('/backup/settings');
  }

  async updateBackupSettings(settings: {
    daily_enabled: boolean;
    weekly_enabled: boolean;
    max_daily_backups: number;
    max_weekly_backups: number;
    notify_admin_email: boolean;
    r2_enabled?: boolean;
    r2_auto_upload?: boolean;
    r2_delete_local_after_upload?: boolean;
  }) {
    return this.request('/backup/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  async downloadDatabaseBackup(filename: string) {
    const token = this.getToken();
    const res = await fetch(`${this.baseUrl}/backup/download/${encodeURIComponent(filename)}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) }
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // =====================================================
  // CLOUDFLARE R2 CLOUD BACKUP
  // =====================================================

  async testR2Connection() {
    return this.request('/backup/r2/test');
  }

  async listR2Backups() {
    return this.request('/backup/r2/list');
  }

  async uploadToR2(filename: string) {
    return this.request(`/backup/r2/upload/${encodeURIComponent(filename)}`, { method: 'POST' });
  }

  async uploadAllToR2() {
    return this.request('/backup/r2/upload-all', { method: 'POST' });
  }

  async deleteFromR2(filename: string) {
    return this.request(`/backup/r2/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  }

  async downloadFromR2(filename: string) {
    const token = this.getToken();
    const res = await fetch(`${this.baseUrl}/backup/r2/download/${encodeURIComponent(filename)}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) }
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const apiService = new ApiService();
