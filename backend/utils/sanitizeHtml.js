const sanitizeHtml = require('sanitize-html');

const DEFAULT_OPTIONS = {
  allowedTags: ['p', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br', 'strong', 'em'],
  allowedAttributes: { a: ['href'] }
};

/**
 * Sanitize HTML to prevent XSS. Use before storing user-provided HTML in DB.
 * @param {string} dirty - Raw HTML from req.body
 * @returns {string} Sanitized HTML
 */
function sanitize(dirty) {
  if (dirty == null || typeof dirty !== 'string') return '';
  return sanitizeHtml(dirty, DEFAULT_OPTIONS);
}

module.exports = { sanitize };
