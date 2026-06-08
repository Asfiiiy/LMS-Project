/**
 * Assessor Activity Logger Service
 * Tracks detailed assessor-student interactions for reporting
 */

const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class AssessorActivityLogger {
  
  /**
   * Generate or get session ID for grouping activities
   */
  static getSessionId(req) {
    // Use existing session ID from request or generate new one
    if (!req.assessorSession) {
      req.assessorSession = uuidv4();
    }
    return req.assessorSession;
  }

  /**
   * Log assessor activity
   * @param {Object} options - Activity details
   * @returns {Promise<number>} Log entry ID
   */
  static async logActivity({
    assessorId,
    studentId,
    submissionId = null,
    fileId = null,
    unitId = null,
    courseId = null,
    activityType,
    fileName = null,
    fileType = null,
    fileSize = null,
    gradeResult = null,
    feedbackText = null,
    numericScore = null,
    sessionId = null,
    durationSeconds = null,
    ipAddress = null,
    userAgent = null,
    req = null
  }) {
    try {
      // Extract from request if provided
      if (req) {
        ipAddress = ipAddress || req.ip || req.connection?.remoteAddress;
        userAgent = userAgent || req.headers['user-agent'];
        sessionId = sessionId || this.getSessionId(req);
      }

      const [result] = await pool.execute(
        `INSERT INTO assessor_student_activity_logs (
          assessor_id, student_id, submission_id, file_id, unit_id, course_id,
          activity_type, file_name, file_type, file_size,
          grade_result, feedback_text, numeric_score,
          session_id, duration_seconds, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assessorId, studentId, submissionId, fileId, unitId, courseId,
          activityType, fileName, fileType, fileSize,
          gradeResult, feedbackText, numericScore,
          sessionId, durationSeconds, ipAddress, userAgent
        ]
      );

      return result.insertId;

    } catch (error) {
      // Don't throw - logging failures shouldn't break the application
      return null;
    }
  }

  /**
   * Log file view activity
   */
  static async logFileView({ assessorId, studentId, submissionId, fileId, fileName, fileType, fileSize, unitId, courseId, req }) {
    return this.logActivity({
      assessorId,
      studentId,
      submissionId,
      fileId,
      unitId,
      courseId,
      activityType: 'file_viewed',
      fileName,
      fileType,
      fileSize,
      req
    });
  }

  /**
   * Log file closed activity (when assessor closes the viewer)
   * @param {Object} options - openedAt and closedAt for duration calculation
   */
  static async logFileClosed({ assessorId, studentId, submissionId, fileId, fileName, fileType, fileSize, unitId, courseId, openedAt, closedAt, durationSeconds, req }) {
    const duration = durationSeconds != null
      ? durationSeconds
      : (openedAt && closedAt ? Math.floor((new Date(closedAt) - new Date(openedAt)) / 1000) : null);
    return this.logActivity({
      assessorId,
      studentId,
      submissionId,
      fileId,
      unitId,
      courseId,
      activityType: 'file_closed',
      fileName,
      fileType,
      fileSize,
      durationSeconds: duration,
      req
    });
  }

  /**
   * Log file download activity
   */
  static async logFileDownload({ assessorId, studentId, submissionId, fileId, fileName, fileType, fileSize, unitId, courseId, req }) {
    return this.logActivity({
      assessorId,
      studentId,
      submissionId,
      fileId,
      unitId,
      courseId,
      activityType: 'file_downloaded',
      fileName,
      fileType,
      fileSize,
      req
    });
  }

  /**
   * Log grading activity
   */
  static async logGrading({ assessorId, studentId, submissionId, unitId, courseId, gradeResult, feedbackText, numericScore, req }) {
    return this.logActivity({
      assessorId,
      studentId,
      submissionId,
      unitId,
      courseId,
      activityType: 'submission_graded',
      gradeResult,
      feedbackText,
      numericScore,
      req
    });
  }

  /**
   * Log file approval
   */
  static async logFileApproval({ assessorId, studentId, fileId, fileName, req }) {
    return this.logActivity({
      assessorId,
      studentId,
      fileId,
      activityType: 'file_approved',
      fileName,
      req
    });
  }

  /**
   * Log file rejection
   */
  static async logFileRejection({ assessorId, studentId, fileId, fileName, feedbackText, req }) {
    return this.logActivity({
      assessorId,
      studentId,
      fileId,
      activityType: 'file_rejected',
      fileName,
      feedbackText,
      req
    });
  }

  /**
   * Get activity logs with filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Logs with pagination
   */
  static async getLogs({
    assessorId = null,
    studentId = null,
    unitId = null,
    courseId = null,
    activityType = null,
    dateFrom = null,
    dateTo = null,
    page = 1,
    limit = 50
  } = {}) {
    try {
      let query = `
        SELECT 
          asal.*,
          assessor.name as assessor_name,
          assessor.email as assessor_email,
          student.name as student_name,
          student.email as student_email,
          u.title as unit_title,
          c.title as course_title
        FROM assessor_student_activity_logs asal
        LEFT JOIN users assessor ON asal.assessor_id = assessor.id
        LEFT JOIN users student ON asal.student_id = student.id
        LEFT JOIN units u ON asal.unit_id = u.id
        LEFT JOIN courses c ON asal.course_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (assessorId) {
        query += ' AND asal.assessor_id = ?';
        params.push(assessorId);
      }

      if (studentId) {
        query += ' AND asal.student_id = ?';
        params.push(studentId);
      }

      if (unitId) {
        query += ' AND asal.unit_id = ?';
        params.push(unitId);
      }

      if (courseId) {
        query += ' AND asal.course_id = ?';
        params.push(courseId);
      }

      if (activityType) {
        query += ' AND asal.activity_type = ?';
        params.push(activityType);
      }

      if (dateFrom && dateTo) {
        query += ' AND asal.created_at BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        query += ' AND asal.created_at >= ?';
        params.push(dateFrom);
      } else if (dateTo) {
        query += ' AND asal.created_at <= ?';
        params.push(dateTo);
      }

      // Get total count - use simple count without joins
      const countQuery = `
        SELECT COUNT(*) as total
        FROM assessor_student_activity_logs asal
        WHERE 1=1
        ${assessorId ? 'AND asal.assessor_id = ?' : ''}
        ${studentId ? 'AND asal.student_id = ?' : ''}
        ${unitId ? 'AND asal.unit_id = ?' : ''}
        ${courseId ? 'AND asal.course_id = ?' : ''}
        ${activityType ? 'AND asal.activity_type = ?' : ''}
        ${dateFrom && dateTo ? 'AND asal.created_at BETWEEN ? AND ?' : ''}
        ${dateFrom && !dateTo ? 'AND asal.created_at >= ?' : ''}
        ${!dateFrom && dateTo ? 'AND asal.created_at <= ?' : ''}
      `;
      const [countRows] = await pool.execute(countQuery, params);
      const total = countRows[0].total;

      // Add pagination
      const offset = (page - 1) * limit;
      query += ` ORDER BY asal.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const [rows] = await pool.execute(query, params);

      return {
        success: true,
        logs: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get activity summary for assessor-student pair
   */
  static async getActivitySummary({ assessorId, studentId, courseId = null }) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_activities,
          SUM(CASE WHEN activity_type = 'file_viewed' THEN 1 ELSE 0 END) as files_viewed,
          SUM(CASE WHEN activity_type = 'file_downloaded' THEN 1 ELSE 0 END) as files_downloaded,
          SUM(CASE WHEN activity_type = 'submission_graded' THEN 1 ELSE 0 END) as submissions_graded,
          SUM(CASE WHEN activity_type = 'file_approved' THEN 1 ELSE 0 END) as files_approved,
          SUM(CASE WHEN activity_type = 'file_rejected' THEN 1 ELSE 0 END) as files_rejected,
          SUM(CASE WHEN grade_result = 'pass' THEN 1 ELSE 0 END) as passed_submissions,
          SUM(CASE WHEN grade_result = 'refer' THEN 1 ELSE 0 END) as referred_submissions,
          SUM(duration_seconds) as total_time_seconds,
          MIN(created_at) as first_activity,
          MAX(created_at) as last_activity
        FROM assessor_student_activity_logs
        WHERE assessor_id = ? AND student_id = ?
        ${courseId ? 'AND course_id = ?' : ''}
      `;

      const params = courseId ? [assessorId, studentId, courseId] : [assessorId, studentId];
      const [rows] = await pool.execute(query, params);

      return rows[0];

    } catch (error) {
      throw error;
    }
  }
}

module.exports = AssessorActivityLogger;
