/**
 * AI Input Validation Middleware
 * Validates and sanitizes all input for AI endpoints
 */

const { logSystemEvent } = require('../utils/eventLogger');

/**
 * Sanitize string input
 */
const sanitizeString = (input, maxLength = 255) => {
  if (input === null || input === undefined) return null;
  const str = String(input);
  // Remove null bytes, control characters, and trim
  return str
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .substring(0, maxLength);
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

/**
 * Validate integer
 */
const validateInteger = (value, min = null, max = null) => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return null;
  if (min !== null && num < min) return null;
  if (max !== null && num > max) return null;
  return num;
};

/**
 * Validate date string (ISO 8601)
 */
const validateDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : dateStr;
};

/**
 * Validate action type (whitelist)
 */
const validateActionType = (actionType) => {
  const allowedTypes = [
    'user_created',
    'tutor_assigned',
    'student_enrolled',
    'deadlines_set',
    'payment_setup',
    'courses_listed',
    'students_listed'
  ];
  return allowedTypes.includes(actionType);
};

/**
 * Validate permission name
 */
const validatePermission = (permission) => {
  const allowedPermissions = [
    'users.create',
    'users.assign_tutor',
    'enrollments.read',
    'enrollments.create',
    'enrollments.setup'
  ];
  return allowedPermissions.includes(permission);
};

/**
 * Middleware to validate user creation input
 */
const validateCreateUser = (req, res, next) => {
  const errors = [];

  // Name validation
  if (!req.body.name || typeof req.body.name !== 'string') {
    errors.push('name is required and must be a string');
  } else {
    const sanitized = sanitizeString(req.body.name, 255);
    if (!sanitized || sanitized.length < 2) {
      errors.push('name must be at least 2 characters');
    } else {
      req.body.name = sanitized;
    }
  }

  // Email validation
  if (!req.body.email || typeof req.body.email !== 'string') {
    errors.push('email is required and must be a string');
  } else if (!validateEmail(req.body.email)) {
    errors.push('email must be a valid email address');
  } else {
    req.body.email = sanitizeString(req.body.email.toLowerCase(), 255);
  }

  // Password validation
  if (!req.body.password || typeof req.body.password !== 'string') {
    errors.push('password is required and must be a string');
  } else if (req.body.password.length < 8) {
    errors.push('password must be at least 8 characters');
  } else if (req.body.password.length > 128) {
    errors.push('password must be less than 128 characters');
  }

  // Role ID validation
  const roleId = validateInteger(req.body.role_id, 1, 10);
  if (roleId === null) {
    errors.push('role_id is required and must be a valid integer between 1 and 10');
  } else {
    req.body.role_id = roleId;
  }

  // Optional fields
  if (req.body.manager_id !== undefined) {
    const managerId = validateInteger(req.body.manager_id, 1);
    req.body.manager_id = managerId;
  }

  if (req.body.assigned_tutor_id !== undefined) {
    const tutorId = validateInteger(req.body.assigned_tutor_id, 1);
    req.body.assigned_tutor_id = tutorId;
  }

  if (errors.length > 0) {
    // Log validation failure
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.aiToken?.created_by || null,
        role: 'ai_token',
        action: 'validation_failed',
        description: `AI input validation failed: ${errors.join(', ')}`,
        req
      });
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Middleware to validate tutor assignment input
 */
const validateAssignTutor = (req, res, next) => {
  const errors = [];

  const studentId = validateInteger(req.body.student_id, 1);
  if (studentId === null) {
    errors.push('student_id is required and must be a valid positive integer');
  } else {
    req.body.student_id = studentId;
  }

  const tutorId = validateInteger(req.body.tutor_id, 1);
  if (tutorId === null) {
    errors.push('tutor_id is required and must be a valid positive integer');
  } else {
    req.body.tutor_id = tutorId;
  }

  if (errors.length > 0) {
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.aiToken?.created_by || null,
        role: 'ai_token',
        action: 'validation_failed',
        description: `AI input validation failed: ${errors.join(', ')}`,
        req
      });
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Middleware to validate enrollment input
 */
const validateEnrollment = (req, res, next) => {
  const errors = [];

  const courseId = validateInteger(req.body.courseId, 1);
  if (courseId === null) {
    errors.push('courseId is required and must be a valid positive integer');
  } else {
    req.body.courseId = courseId;
  }

  const studentId = validateInteger(req.body.studentId, 1);
  if (studentId === null) {
    errors.push('studentId is required and must be a valid positive integer');
  } else {
    req.body.studentId = studentId;
  }

  if (req.body.assignedTutorId !== undefined) {
    const tutorId = validateInteger(req.body.assignedTutorId, 1);
    req.body.assignedTutorId = tutorId;
  }

  if (errors.length > 0) {
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.aiToken?.created_by || null,
        role: 'ai_token',
        action: 'validation_failed',
        description: `AI input validation failed: ${errors.join(', ')}`,
        req
      });
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Middleware to validate deadline setup input
 */
const validateDeadlineSetup = (req, res, next) => {
  const errors = [];

  const courseId = validateInteger(req.body.courseId, 1);
  if (courseId === null) {
    errors.push('courseId is required and must be a valid positive integer');
  } else {
    req.body.courseId = courseId;
  }

  const studentId = validateInteger(req.body.studentId, 1);
  if (studentId === null) {
    errors.push('studentId is required and must be a valid positive integer');
  } else {
    req.body.studentId = studentId;
  }

  if (!Array.isArray(req.body.deadlines)) {
    errors.push('deadlines must be an array');
  } else if (req.body.deadlines.length === 0) {
    errors.push('deadlines array cannot be empty');
  } else {
    // Validate each deadline object
    req.body.deadlines.forEach((deadline, index) => {
      if (!deadline.topicId || validateInteger(deadline.topicId, 1) === null) {
        errors.push(`deadlines[${index}].topicId is required and must be a valid positive integer`);
      }
      if (!deadline.topicType || !['cpd_topic', 'qualification_unit'].includes(deadline.topicType)) {
        errors.push(`deadlines[${index}].topicType must be 'cpd_topic' or 'qualification_unit'`);
      }
      // Deadline date is optional, but if provided, should be valid
      if (deadline.deadline && !validateDate(deadline.deadline)) {
        errors.push(`deadlines[${index}].deadline must be a valid date string`);
      }
    });
  }

  if (errors.length > 0) {
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.aiToken?.created_by || null,
        role: 'ai_token',
        action: 'validation_failed',
        description: `AI input validation failed: ${errors.join(', ')}`,
        req
      });
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Middleware to validate payment setup input
 */
const validatePaymentSetup = (req, res, next) => {
  const errors = [];

  const courseId = validateInteger(req.body.courseId, 1);
  if (courseId === null) {
    errors.push('courseId is required and must be a valid positive integer');
  } else {
    req.body.courseId = courseId;
  }

  const studentId = validateInteger(req.body.studentId, 1);
  if (studentId === null) {
    errors.push('studentId is required and must be a valid positive integer');
  } else {
    req.body.studentId = studentId;
  }

  if (!req.body.paymentType || !['all_paid', 'installment'].includes(req.body.paymentType)) {
    errors.push('paymentType must be either "all_paid" or "installment"');
  }

  if (req.body.paymentType === 'installment') {
    if (!Array.isArray(req.body.installments)) {
      errors.push('installments must be an array when paymentType is "installment"');
    } else if (req.body.installments.length === 0) {
      errors.push('installments array cannot be empty when paymentType is "installment"');
    } else {
      req.body.installments.forEach((inst, index) => {
        if (!inst.installment_name || typeof inst.installment_name !== 'string') {
          errors.push(`installments[${index}].installment_name is required`);
        }
        const amount = parseFloat(inst.amount);
        if (isNaN(amount) || amount < 0) {
          errors.push(`installments[${index}].amount must be a valid positive number`);
        }
        if (!inst.due_date || !validateDate(inst.due_date)) {
          errors.push(`installments[${index}].due_date must be a valid date string`);
        }
        if (inst.status && !['paid', 'due', 'overdue'].includes(inst.status)) {
          errors.push(`installments[${index}].status must be 'paid', 'due', or 'overdue'`);
        }
      });
    }
  }

  if (errors.length > 0) {
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.aiToken?.created_by || null,
        role: 'ai_token',
        action: 'validation_failed',
        description: `AI input validation failed: ${errors.join(', ')}`,
        req
      });
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Middleware to validate adding a single installment row
 */
const validateAddInstallment = (req, res, next) => {
  const errors = [];

  const courseId = validateInteger(req.body.courseId, 1);
  if (courseId === null) errors.push('courseId is required and must be a valid positive integer');
  else req.body.courseId = courseId;

  const studentId = validateInteger(req.body.studentId, 1);
  if (studentId === null) errors.push('studentId is required and must be a valid positive integer');
  else req.body.studentId = studentId;

  if (!req.body.installment_name || typeof req.body.installment_name !== 'string') {
    errors.push('installment_name is required');
  } else {
    req.body.installment_name = sanitizeString(req.body.installment_name, 255);
  }

  const amount = parseFloat(req.body.amount);
  if (isNaN(amount) || amount < 0) errors.push('amount must be a valid positive number');
  else req.body.amount = amount;

  if (!req.body.due_date || !validateDate(req.body.due_date)) {
    errors.push('due_date is required and must be a valid date string');
  }

  if (req.body.status && !['paid', 'due', 'overdue'].includes(req.body.status)) {
    errors.push("status must be 'paid', 'due', or 'overdue'");
  }

  if (req.body.paid_at && !validateDate(req.body.paid_at)) {
    errors.push('paid_at must be a valid date string');
  }

  if (req.body.payment_reference !== undefined) {
    req.body.payment_reference = sanitizeString(req.body.payment_reference, 255);
  }

  if (req.body.notes !== undefined) {
    req.body.notes = sanitizeString(req.body.notes, 500);
  }

  if (errors.length > 0) {
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.aiToken?.created_by || null,
        role: 'ai_token',
        action: 'validation_failed',
        description: `AI input validation failed: ${errors.join(', ')}`,
        req
      });
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Middleware to validate updating installment status
 */
const validateUpdateInstallmentStatus = (req, res, next) => {
  const errors = [];

  const installmentId = validateInteger(req.params.installmentId, 1);
  if (installmentId === null) errors.push('installmentId param must be a valid positive integer');
  else req.params.installmentId = installmentId;

  const courseId = validateInteger(req.body.courseId, 1);
  if (courseId === null) errors.push('courseId is required and must be a valid positive integer');
  else req.body.courseId = courseId;

  const studentId = validateInteger(req.body.studentId, 1);
  if (studentId === null) errors.push('studentId is required and must be a valid positive integer');
  else req.body.studentId = studentId;

  if (!req.body.status || !['paid', 'due', 'overdue'].includes(req.body.status)) {
    errors.push("status is required and must be 'paid', 'due', or 'overdue'");
  }

  if (req.body.paid_at && !validateDate(req.body.paid_at)) {
    errors.push('paid_at must be a valid date string');
  }

  if (req.body.payment_reference !== undefined) {
    req.body.payment_reference = sanitizeString(req.body.payment_reference, 255);
  }

  if (req.body.notes !== undefined) {
    req.body.notes = sanitizeString(req.body.notes, 500);
  }

  if (errors.length > 0) {
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.aiToken?.created_by || null,
        role: 'ai_token',
        action: 'validation_failed',
        description: `AI input validation failed: ${errors.join(', ')}`,
        req
      });
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = {
  validateCreateUser,
  validateAssignTutor,
  validateEnrollment,
  validateDeadlineSetup,
  validatePaymentSetup,
  validateAddInstallment,
  validateUpdateInstallmentStatus,
  sanitizeString,
  validateEmail,
  validateInteger,
  validateDate,
  validateActionType,
  validatePermission
};
