// Types for the student onboarding flow

export interface OnboardingStatus {
  id?: number;
  user_id: number;
  current_step: OnboardingStep;
  welcome_completed: boolean;
  course_selection_completed: boolean;
  qualification_selection_completed: boolean;
  documents_uploaded: boolean;
  initial_assessment_completed: boolean;
  vark_assessment_completed: boolean;
  admin_verified: boolean;
  dashboard_access_granted: boolean;
  verification_requested_at: string | null;
  admin_verified_at: string | null;
  admin_verified_by: number | null;
  admin_notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export type OnboardingStep =
  | 'welcome'
  | 'course-selection'
  | 'qualification-level'
  | 'documents'
  | 'initial-assessment'
  | 'vark'
  | 'verification-pending';

export interface CourseSelection {
  id?: number;
  user_id: number;
  cpd_courses: boolean;
  qualifications: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface QualificationSelection {
  id?: number;
  user_id: number;
  level: 2 | 3 | 4 | 5 | 6 | 7;
  entry_requirements_acknowledged: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DocumentType = 'qualification' | 'identity' | 'cv' | 'address';

export interface StudentDocument {
  id: number;
  user_id: number;
  document_type: DocumentType;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  cloudinary_public_id?: string;
  uploaded_at: string;
  /** From verification flow; omitted on older rows */
  status?: 'pending' | 'approved' | 'rejected' | 'replaced' | string;
  rejection_reason?: string | null;
  previous_version_id?: number | null;
}

export interface InitialAssessment {
  id?: number;
  user_id: number;
  
  // Personal Information
  full_name: string;
  gender: string;
  date_of_birth: string;
  nationality: string;
  primary_language: string;
  contact_number: string;
  email: string;
  postal_address: string;
  ethnicity: string;
  
  // Motivation & Background
  why_qualification: string;
  career_goals: string;
  employer_support: string;
  
  // Skills Assessment
  english_literacy: string;
  ict_skills: string;
  special_learning_needs?: string;
  
  // E-Signature & Agreements
  data_usage_consent: boolean;
  assessment_accuracy_consent: boolean;
  qualification_understanding: boolean;
  apl_understanding: boolean;
  privacy_policy_consent?: boolean;
  terms_conditions_consent?: boolean;
  signature_name: string;
  signature_date: string;
  
  created_at?: string;
  updated_at?: string;
}

export interface QualificationLevel {
  level: number;
  title: string;
  description: string;
  entryRequirements: string;
}

export const QUALIFICATION_LEVELS: QualificationLevel[] = [
  {
    level: 2,
    title: 'Level 2',
    description: 'Foundation level qualification for health and social care',
    entryRequirements: 'Learners will be expected to hold the following:\n• Work experience in the health and social care sector and demonstrate ambition with clear career goals;\n• A Level 2 qualification in another discipline and want to develop their careers in health and social care.'
  },
  {
    level: 3,
    title: 'Level 3',
    description: 'Advanced level qualification',
    entryRequirements: 'GCSE, Level 2 qualification, Secondary School Certificate, or equivalent.'
  },
  {
    level: 4,
    title: 'Level 4',
    description: 'Higher education certificate level',
    entryRequirements: 'Level 3 qualification, HND, ND, O Levels, Bachelor\'s degree, or equivalent.'
  },
  {
    level: 5,
    title: 'Level 5',
    description: 'Higher education diploma level',
    entryRequirements: 'Level 4 qualification, Bachelor\'s degree, HND, or Master\'s degree.'
  },
  {
    level: 6,
    title: 'Level 6',
    description: 'Bachelor\'s degree level',
    entryRequirements: 'Bachelor\'s degree or Master\'s degree with relevant work experience.'
  },
  {
    level: 7,
    title: 'Level 7',
    description: 'Master\'s degree level',
    entryRequirements: 'Bachelor\'s degree or Master\'s degree with relevant professional experience.'
  }
];

export interface EnrollmentType {
  hasQualification: boolean;
  hasCPD: boolean;
  hasBoth: boolean;
  hasNone: boolean;
}

// API Response types
export interface OnboardingStatusResponse {
  success: boolean;
  status: OnboardingStatus;
  enrollment_type?: EnrollmentType;
  message?: string;
}

export interface AutoSetupResponse {
  success: boolean;
  message: string;
  enrollment_type: EnrollmentType;
  auto_setup: boolean;
  next_step?: string;
  path?: 'cpd-only' | 'qualification';
}

export interface QualificationUpgradeResponse {
  success: boolean;
  upgrade_needed: boolean;
  enrollment_type?: EnrollmentType;
}

export interface CourseSelectionResponse {
  success: boolean;
  selection?: CourseSelection;
  message?: string;
  next_step?: OnboardingStep;
}

export interface QualificationSelectionResponse {
  success: boolean;
  selection?: QualificationSelection;
  message?: string;
  next_step?: OnboardingStep;
}

export interface DocumentUploadResponse {
  success: boolean;
  document?: StudentDocument;
  message?: string;
}

export interface DocumentsListResponse {
  success: boolean;
  documents: StudentDocument[];
  message?: string;
}

export interface InitialAssessmentResponse {
  success: boolean;
  assessment?: InitialAssessment;
  message?: string;
  next_step?: OnboardingStep | 'dashboard';
  cpd_only?: boolean;
  dashboard_access_granted?: boolean;
}
