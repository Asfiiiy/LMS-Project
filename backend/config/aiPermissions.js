/**
 * AI Permissions Whitelist
 * Defines all valid permissions for AI tokens
 */

// Whitelist of all valid permissions
const VALID_PERMISSIONS = [
  // User Management (Original)
  'users.create',
  'users.assign_tutor',
  
  // Enrollment Management (Original)
  'enrollments.read',
  'enrollments.create',
  'enrollments.setup',
  
  // Student Profile & Onboarding
  'students.profile.read',
  'students.profile.update',
  'students.onboarding.read',
  'students.onboarding.verify',
  'students.onboarding.status',
  
  // Document Management
  'students.documents.read',
  'students.documents.approve',
  'students.documents.reject'
];

// Permission descriptions
const PERMISSION_DESCRIPTIONS = {
  // Original permissions
  'users.create': 'Create new users (especially students)',
  'users.assign_tutor': 'Assign tutors to students',
  'enrollments.read': 'View courses and students list',
  'enrollments.create': 'Enroll students in courses',
  'enrollments.setup': 'Set deadlines and payment installments',
  
  // Student Profile & Onboarding
  'students.profile.read': 'View student profiles and personal information',
  'students.profile.update': 'Update student profile information',
  'students.onboarding.read': 'View student onboarding status and progress',
  'students.onboarding.verify': 'Verify and approve student onboarding (grant dashboard access)',
  'students.onboarding.status': 'Check onboarding status (new, review, verified)',
  
  // Document Management
  'students.documents.read': 'View student uploaded documents',
  'students.documents.approve': 'Approve student documents',
  'students.documents.reject': 'Reject student documents with feedback'
};

// Permission groups
const PERMISSION_GROUPS = {
  // Basic user management (original)
  user_management: ['users.create', 'users.assign_tutor'],
  enrollment_management: ['enrollments.read', 'enrollments.create', 'enrollments.setup'],
  read_only: ['enrollments.read', 'students.profile.read', 'students.onboarding.status'],
  
  // AI Agent Roles
  ai_onboarding_reviewer: [
    'students.profile.read',
    'students.onboarding.read',
    'students.onboarding.status',
    'students.onboarding.verify',
    'students.documents.read',
    'students.documents.approve',
    'students.documents.reject'
  ],
  
  ai_student_manager: [
    'students.profile.read',
    'students.profile.update',
    'students.onboarding.read',
    'students.onboarding.status',
    'enrollments.read'
  ],
  
  ai_enrollment_manager: [
    'users.create',
    'users.assign_tutor',
    'students.profile.read',
    'enrollments.read',
    'enrollments.create',
    'enrollments.setup'
  ]
};

/**
 * Check if a permission is valid
 */
const isValidPermission = (permission) => {
  return VALID_PERMISSIONS.includes(permission);
};

/**
 * Validate an array of permissions
 */
const validatePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    return { valid: false, error: 'Permissions must be an array' };
  }

  const invalidPermissions = permissions.filter(p => !isValidPermission(p) && p !== '*');
  
  if (invalidPermissions.length > 0) {
    return {
      valid: false,
      error: `Invalid permissions: ${invalidPermissions.join(', ')}`,
      invalidPermissions
    };
  }

  return { valid: true };
};

/**
 * Get permission description
 */
const getPermissionDescription = (permission) => {
  return PERMISSION_DESCRIPTIONS[permission] || 'Unknown permission';
};

/**
 * Get all valid permissions
 */
const getAllValidPermissions = () => {
  return [...VALID_PERMISSIONS];
};

/**
 * Get permissions by group
 */
const getPermissionsByGroup = (groupName) => {
  return PERMISSION_GROUPS[groupName] || [];
};

module.exports = {
  VALID_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_GROUPS,
  isValidPermission,
  validatePermissions,
  getPermissionDescription,
  getAllValidPermissions,
  getPermissionsByGroup
};
