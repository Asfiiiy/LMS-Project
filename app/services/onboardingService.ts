// Service for student onboarding API calls
import { apiService } from './api';
import type {
  OnboardingStatusResponse,
  OnboardingStatus,
  CourseSelectionResponse,
  QualificationSelectionResponse,
  DocumentUploadResponse,
  DocumentsListResponse,
  InitialAssessmentResponse,
  InitialAssessment,
  AutoSetupResponse,
  QualificationUpgradeResponse
} from '../types/onboarding.types';

class OnboardingService {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('lms-token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const response = await fetch(`${apiService.baseUrlPublic}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Get onboarding status
  async getStatus(): Promise<OnboardingStatusResponse> {
    return this.request('/onboarding/status', { method: 'GET' });
  }

  // Update onboarding status
  async updateStatus(updates: Partial<OnboardingStatus>): Promise<OnboardingStatusResponse> {
    return this.request('/onboarding/status', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Save course selection
  async saveCourseSelection(cpd_courses: boolean, qualifications: boolean): Promise<CourseSelectionResponse> {
    return this.request('/onboarding/course-selection', {
      method: 'POST',
      body: JSON.stringify({ cpd_courses, qualifications })
    });
  }

  // Get course selection
  async getCourseSelection(): Promise<CourseSelectionResponse> {
    return this.request('/onboarding/course-selection', { method: 'GET' });
  }

  // Save qualification level
  async saveQualificationLevel(level: number): Promise<QualificationSelectionResponse> {
    return this.request('/onboarding/qualification-level', {
      method: 'POST',
      body: JSON.stringify({ level })
    });
  }

  // Get qualification level
  async getQualificationLevel(): Promise<QualificationSelectionResponse> {
    return this.request('/onboarding/qualification-level', { method: 'GET' });
  }

  // Upload document
  async uploadDocument(file: File, document_type: 'qualification' | 'identity' | 'cv' | 'address'): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', document_type);

    const token = localStorage.getItem('lms-token');
    const response = await fetch(`${apiService.baseUrlPublic}/onboarding/documents/upload`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload document');
    }

    return response.json();
  }

  // Get all documents
  async getDocuments(): Promise<DocumentsListResponse> {
    return this.request('/onboarding/documents', { method: 'GET' });
  }

  // Delete document
  async deleteDocument(documentId: number): Promise<{ success: boolean; message: string }> {
    return this.request(`/onboarding/documents/${documentId}`, { method: 'DELETE' });
  }

  /** Replace a rejected document (multipart to document verification API) */
  async replaceDocument(documentId: number, file: File): Promise<{ success: boolean; message?: string; documentId?: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('lms-token');
    const response = await fetch(`${apiService.baseUrlPublic}/documents/replace/${documentId}`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to replace document');
    }
    return data;
  }

  // Submit initial assessment
  async submitInitialAssessment(assessment: Omit<InitialAssessment, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<InitialAssessmentResponse> {
    return this.request('/onboarding/initial-assessment', {
      method: 'POST',
      body: JSON.stringify(assessment)
    });
  }

  // Get initial assessment
  async getInitialAssessment(): Promise<InitialAssessmentResponse> {
    return this.request('/onboarding/initial-assessment', { method: 'GET' });
  }

  // Check if all required documents uploaded
  async areDocumentsComplete(): Promise<boolean> {
    const response = await this.getDocuments();
    if (!response.success) return false;

    const docs = response.documents.filter(d => d.status !== 'replaced');
    const requiredRejected = docs.some(
      d =>
        ['qualification', 'identity', 'cv'].includes(d.document_type) && d.status === 'rejected'
    );
    if (requiredRejected) return false;

    const hasQualification = docs.some(
      d => d.document_type === 'qualification' && d.status !== 'rejected'
    );
    const hasIdentity = docs.some(d => d.document_type === 'identity' && d.status !== 'rejected');
    const hasCV = docs.some(d => d.document_type === 'cv' && d.status !== 'rejected');

    return hasQualification && hasIdentity && hasCV;
  }

  // Complete a step and move to next
  async completeStep(currentStep: string, nextStep: string): Promise<void> {
    const updates: any = {
      [`${currentStep.replace(/-/g, '_')}_completed`]: true,
      current_step: nextStep
    };
    
    await this.updateStatus(updates);
  }

  // Auto-setup course selection based on detected enrollment type
  async autoSetupOnboarding(): Promise<AutoSetupResponse> {
    return this.request('/onboarding/auto-setup', { method: 'POST' });
  }

  // Check if a CPD-only student has later enrolled in a qualification course
  async checkQualificationUpgrade(): Promise<QualificationUpgradeResponse> {
    return this.request('/onboarding/qualification-upgrade-needed', { method: 'GET' });
  }

  // Start qualification upgrade for a CPD-only student who got enrolled in a qualification
  async startQualificationUpgrade(): Promise<{ success: boolean; message: string; next_step?: string }> {
    return this.request('/onboarding/start-qualification-upgrade', { method: 'POST' });
  }
}

export const onboardingService = new OnboardingService();
