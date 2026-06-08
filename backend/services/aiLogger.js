/**
 * AI Action Logger Service
 * Logs all AI operations for audit and tracking
 */

const pool = require('../config/db');
const geoip = require('geoip-lite');

class AILogger {
  /**
   * Log an AI action
   * @param {Object} options - Log options
   * @param {number} options.tokenId - AI token ID
   * @param {string} options.tokenName - Token name (denormalized)
   * @param {string} options.actionType - Type of action (user_created, tutor_assigned, etc.)
   * @param {string} options.actionDescription - Human-readable description
   * @param {string} options.endpoint - API endpoint
   * @param {string} options.method - HTTP method
   * @param {string} options.ipAddress - IP address
   * @param {string} options.userAgent - User agent
   * @param {Object} options.requestBody - Request body (will be stringified)
   * @param {number} options.responseStatus - HTTP response status
   * @param {number} options.responseTimeMs - Response time in milliseconds
   * @param {Object} options.responseBody - Response body (will be stringified)
   * @param {string} options.errorMessage - Error message if failed
   * @param {Object} options.affectedIds - Object with affected entity IDs (userId, studentId, courseId, enrollmentId)
   * @returns {Promise<number>} Log entry ID
   */
  static async logAction(options) {
    const {
      tokenId,
      tokenName,
      actionType,
      actionDescription,
      endpoint,
      method,
      ipAddress,
      userAgent,
      requestBody,
      responseStatus,
      responseTimeMs,
      responseBody,
      errorMessage,
      affectedIds = {}
    } = options;

    try {
      // Get geo location
      const geo = geoip.lookup(ipAddress);

      // Stringify request/response bodies (truncate if too long)
      // Sanitize to prevent injection - escape special characters
      const sanitizeString = (str) => {
        if (!str) return null;
        try {
          const jsonStr = JSON.stringify(str);
          return jsonStr.substring(0, 5000);
        } catch (e) {
          // If stringification fails, return null
          return null;
        }
      };

      const requestBodyStr = requestBody ? sanitizeString(requestBody) : null;
      const responseBodyStr = responseBody ? sanitizeString(responseBody) : null;
      
      // Sanitize other string fields
      const sanitizeField = (field, maxLength = 500) => {
        if (!field) return null;
        const str = String(field);
        // Remove null bytes and control characters
        return str.replace(/[\x00-\x1F\x7F]/g, '').substring(0, maxLength);
      };

      // Sanitize all input fields before insertion
      const sanitizedTokenId = tokenId ? parseInt(tokenId, 10) : null;
      const sanitizedTokenName = sanitizeField(tokenName, 100);
      const sanitizedActionType = sanitizeField(actionType, 100);
      const sanitizedActionDescription = sanitizeField(actionDescription, 1000);
      const sanitizedEndpoint = sanitizeField(endpoint, 500);
      const sanitizedMethod = sanitizeField(method, 10);
      const sanitizedIpAddress = sanitizeField(ipAddress, 50);
      const sanitizedUserAgent = sanitizeField(userAgent, 500);
      const sanitizedErrorMessage = sanitizeField(errorMessage, 1000);
      
      // Validate numeric fields
      const sanitizedResponseStatus = responseStatus ? parseInt(responseStatus, 10) : null;
      const sanitizedResponseTimeMs = responseTimeMs ? parseInt(responseTimeMs, 10) : null;
      const sanitizedUserId = affectedIds.userId ? parseInt(affectedIds.userId, 10) : null;
      const sanitizedStudentId = affectedIds.studentId ? parseInt(affectedIds.studentId, 10) : null;
      const sanitizedCourseId = affectedIds.courseId ? parseInt(affectedIds.courseId, 10) : null;
      const sanitizedEnrollmentId = affectedIds.enrollmentId ? parseInt(affectedIds.enrollmentId, 10) : null;

      const [result] = await pool.execute(
        `INSERT INTO ai_action_logs (
          token_id, token_name, action_type, action_description,
          endpoint, method, ip_address, country_code, country_name, user_agent,
          request_body, response_status, response_time_ms, response_body, error_message,
          affected_user_id, affected_student_id, affected_course_id, affected_enrollment_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sanitizedTokenId,
          sanitizedTokenName,
          sanitizedActionType,
          sanitizedActionDescription,
          sanitizedEndpoint,
          sanitizedMethod,
          sanitizedIpAddress,
          geo?.country || null,
          geo?.country || null,
          sanitizedUserAgent,
          requestBodyStr,
          sanitizedResponseStatus,
          sanitizedResponseTimeMs,
          responseBodyStr,
          sanitizedErrorMessage,
          sanitizedUserId,
          sanitizedStudentId,
          sanitizedCourseId,
          sanitizedEnrollmentId
        ]
      );

      return result.insertId;
    } catch (error) {
      // Don't throw - logging failures shouldn't break the application
      return null;
    }
  }

  /**
   * Get AI action logs with filters
   * @param {Object} filters - Filter options
   * @param {number} filters.tokenId - Filter by token ID
   * @param {string} filters.actionType - Filter by action type
   * @param {number} filters.affectedUserId - Filter by affected user ID
   * @param {number} filters.affectedStudentId - Filter by affected student ID
   * @param {number} filters.affectedCourseId - Filter by affected course ID
   * @param {string} filters.dateFrom - Start date (ISO string)
   * @param {string} filters.dateTo - End date (ISO string)
   * @param {number} filters.page - Page number
   * @param {number} filters.limit - Items per page
   * @returns {Promise<Object>} Logs with pagination
   */
  static async getLogs(filters = {}) {
    try {
      const {
        tokenId,
        actionType,
        affectedUserId,
        affectedStudentId,
        affectedCourseId,
        dateFrom,
        dateTo,
        page = 1,
        limit = 50
      } = filters;

      // Input validation and sanitization
      const sanitizedTokenId = tokenId ? parseInt(tokenId, 10) : null;
      const sanitizedAffectedUserId = affectedUserId ? parseInt(affectedUserId, 10) : null;
      const sanitizedAffectedStudentId = affectedStudentId ? parseInt(affectedStudentId, 10) : null;
      const sanitizedAffectedCourseId = affectedCourseId ? parseInt(affectedCourseId, 10) : null;
      const sanitizedPage = Math.max(1, parseInt(page, 10) || 1);
      const sanitizedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50)); // Max 200 per page

      // Sanitize actionType - only allow alphanumeric, underscore, and hyphen
      const sanitizedActionType = actionType && /^[a-zA-Z0-9_-]+$/.test(actionType) ? actionType : null;

      // Validate date format (ISO 8601)
      const validateDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : dateStr;
      };

      const sanitizedDateFrom = validateDate(dateFrom);
      const sanitizedDateTo = validateDate(dateTo);

      let query = 'SELECT * FROM ai_action_logs WHERE 1=1';
      const params = [];

      if (sanitizedTokenId && !isNaN(sanitizedTokenId)) {
        query += ' AND token_id = ?';
        params.push(sanitizedTokenId);
      }

      if (sanitizedActionType) {
        query += ' AND action_type = ?';
        params.push(sanitizedActionType);
      }

      if (sanitizedAffectedUserId && !isNaN(sanitizedAffectedUserId)) {
        query += ' AND affected_user_id = ?';
        params.push(sanitizedAffectedUserId);
      }

      if (sanitizedAffectedStudentId && !isNaN(sanitizedAffectedStudentId)) {
        query += ' AND affected_student_id = ?';
        params.push(sanitizedAffectedStudentId);
      }

      if (sanitizedAffectedCourseId && !isNaN(sanitizedAffectedCourseId)) {
        query += ' AND affected_course_id = ?';
        params.push(sanitizedAffectedCourseId);
      }

      if (sanitizedDateFrom && sanitizedDateTo) {
        query += ' AND created_at BETWEEN ? AND ?';
        params.push(sanitizedDateFrom, sanitizedDateTo);
      } else if (sanitizedDateFrom) {
        query += ' AND created_at >= ?';
        params.push(sanitizedDateFrom);
      } else if (sanitizedDateTo) {
        query += ' AND created_at <= ?';
        params.push(sanitizedDateTo);
      }

      // Get total count - use parameterized query
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const [countRows] = await pool.execute(countQuery, params);
      const total = countRows[0].total;

      // Add pagination - ensure LIMIT and OFFSET are integers
      const offset = (sanitizedPage - 1) * sanitizedLimit;
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      
      // Execute with LIMIT and OFFSET as separate parameters (must be integers)
      const [rows] = await pool.query(
        query.replace('LIMIT ?', `LIMIT ${sanitizedLimit}`).replace('OFFSET ?', `OFFSET ${offset}`),
        params
      );

      return {
        success: true,
        logs: rows,
        pagination: {
          total,
          page: sanitizedPage,
          limit: sanitizedLimit,
          totalPages: Math.ceil(total / sanitizedLimit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get logs for a specific token
   * @param {number} tokenId - Token ID
   * @param {Object} filters - Additional filters
   * @returns {Promise<Object>} Logs with pagination
   */
  static async getTokenLogs(tokenId, filters = {}) {
    return this.getLogs({ ...filters, tokenId });
  }

  /**
   * Get action statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics(filters = {}) {
    try {
      const { tokenId, dateFrom, dateTo } = filters;

      // Input validation and sanitization
      const sanitizedTokenId = tokenId ? parseInt(tokenId, 10) : null;
      
      // Validate date format
      const validateDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : dateStr;
      };

      const sanitizedDateFrom = validateDate(dateFrom);
      const sanitizedDateTo = validateDate(dateTo);

      let query = `
        SELECT 
          action_type,
          COUNT(*) as count,
          SUM(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN response_status >= 400 OR error_message IS NOT NULL THEN 1 ELSE 0 END) as error_count,
          AVG(response_time_ms) as avg_response_time
        FROM ai_action_logs
        WHERE 1=1
      `;
      const params = [];

      if (sanitizedTokenId && !isNaN(sanitizedTokenId)) {
        query += ' AND token_id = ?';
        params.push(sanitizedTokenId);
      }

      if (sanitizedDateFrom && sanitizedDateTo) {
        query += ' AND created_at BETWEEN ? AND ?';
        params.push(sanitizedDateFrom, sanitizedDateTo);
      }

      query += ' GROUP BY action_type ORDER BY count DESC';

      const [rows] = await pool.execute(query, params);

      return {
        success: true,
        statistics: rows
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AILogger;
