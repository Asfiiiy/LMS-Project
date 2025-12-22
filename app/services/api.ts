// Reusable API service for making HTTP requests
class ApiService {
  private baseUrl: string;
  public readonly baseUrlPublic: string;

  constructor() {
    // Use environment variable or detect from window location
    // For mobile/network access, use your computer's local IP (e.g., http://192.168.1.100:5000)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                   (typeof window !== 'undefined' 
                     ? `${window.location.protocol}//${window.location.hostname}:5000/api`
                     : 'http://localhost:5000/api');
    
    this.baseUrl = apiUrl;
    this.baseUrlPublic = apiUrl;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('lms-token');
    } catch {
      return null;
    }
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
      console.log(`[API Request] ${options.method || 'GET'} ${endpoint}`);
      console.log(`[API Request] Token present:`, !!token);
      
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
          if (errorData.message) {
            errorMessage = errorData.message;
            console.error(`[API Error] ${response.status}:`, errorData.message);
          }
        } catch (e) {
          // Response is not JSON
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
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
        if (typeof window !== 'undefined') {
          localStorage.setItem('lms-token', data.token);
        }
        return data.token;
      }

      throw new Error('No token in refresh response');
    } catch (error) {
      console.error('Token refresh error:', error);
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

  async getCourses() {
    return this.request('/admin/courses');
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

  async enrollStudents(studentIds: number[], courseId: number, tutorId?: number) {
    return this.request('/admin/enrollments', {
      method: 'POST',
      body: JSON.stringify({ studentIds, courseId, tutorId })
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
      due_date: string;
      status: 'paid' | 'due' | 'overdue';
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
  async getPaymentStats() {
    return this.request('/admin/payments/stats');
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

  // Get all installments for a specific student (Admin)
  async getStudentInstallmentsByAdmin(studentId: number) {
    return this.request(`/admin/students/${studentId}/installments`);
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

  // Get all students profiles (Admin)
  async getAllStudentsProfiles(search?: string, status?: 'complete' | 'incomplete') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
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
    console.log('[API] Creating qualification course, token present:', !!token);
    console.log('[API] FormData entries:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: ${value.name} (${value.size} bytes)`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    const response = await fetch(`${this.baseUrl}/qualification/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Do NOT set Content-Type - browser sets it with boundary
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Get qualification course details
  async getQualificationCourse(courseId: number) {
    return this.request(`/qualification/${courseId}`);
  }

  // Create unit
  async createQualificationUnit(courseId: number, unitData: any) {
    // Check if unitData is FormData (with files) or plain object
    if (unitData instanceof FormData) {
      const token = this.getToken();
      const url = `${this.baseUrl}/qualification/${courseId}/units`;
      
      console.log('[API] Creating unit with files');
      console.log('[API] URL:', url);
      console.log('[API] Token present:', !!token);
      console.log('[API] FormData entries:', Array.from(unitData.keys()).length);
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: unitData
        });

        console.log('[API] Response status:', response.status);
        console.log('[API] Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[API] Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        return await response.json();
      } catch (fetchError) {
        console.error('[API] Fetch error:', fetchError);
        console.error('[API] Error details:', {
          name: (fetchError as Error).name,
          message: (fetchError as Error).message,
          stack: (fetchError as Error).stack
        });
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
    // Health endpoint is at /health (not /api/health)
    const response = await fetch('http://localhost:5000/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
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
  async updateCertificatePricing(pricingId: number, data: any) {
    return this.request(`/certificates/pricing/${pricingId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
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

  async getNextRegistrationNumber() {
    return this.request('/certificates/next-registration-number');
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

  // Download DOCX for editing
  async downloadCertificateDOCX(certId: number, type: 'cert' | 'trans') {
    const token = this.getToken();
    return `${this.baseUrl}/certificates/generated/${certId}/docx/${type}?token=${token}`;
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
}

export const apiService = new ApiService();
