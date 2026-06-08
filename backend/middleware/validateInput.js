const { body, param, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors - returns 400 with error messages
 */
function handleValidationErrors(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map(e => ({ field: e.path, message: e.msg }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }
  next();
}

/**
 * Login validation: email format, password not empty
 */
const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').trim()
];

/**
 * Admin create user validation: name, email, role required
 */
const createUserValidation = [
  body('name').notEmpty().withMessage('Name is required').trim().isLength({ max: 255 }).withMessage('Name too long'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role_id').isInt({ min: 1 }).withMessage('Valid role is required')
];

/**
 * Qualification submit validation: unitId, submission_type, and file/video requirement
 */
const qualificationSubmitValidation = [
  param('unitId').isInt({ min: 1 }).withMessage('Valid unit ID is required'),
  body('submission_type').isIn(['assignment', 'presentation']).withMessage('submission_type must be assignment or presentation')
];

module.exports = {
  handleValidationErrors,
  loginValidation,
  createUserValidation,
  qualificationSubmitValidation
};
