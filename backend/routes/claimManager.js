/**
 * Claim Manager Routes
 * Handles completed students, submissions, ZIP downloads, and CSV reports
 * for qualification course claim management.
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const archiver = require('archiver');
const https = require('https');
const http = require('http');

router.use(auth);
router.use(permit('Claim Manager', 'Admin'));

// Helper: fetch file stream from URL (Cloudinary)
function fetchFileStream(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchFileStream(response.headers.location).then(resolve).catch(reject);
      }
      resolve(response);
    }).on('error', reject);
  });
}

// =====================================================
// GET /api/claim-manager/stats - Dashboard stats
// =====================================================
router.get('/stats', async (req, res) => {
  try {
    const [coursesCount] = await pool.execute(
      `SELECT COUNT(*) as n FROM courses WHERE course_type = 'qualification'`
    );
    const [studentsCount] = await pool.execute(
      `SELECT COUNT(DISTINCT qup.student_id) as n
       FROM qual_unit_progress qup
       JOIN courses c ON c.id = qup.course_id
       JOIN units un ON un.id = qup.unit_id
       WHERE (un.is_optional = 0 OR un.is_optional IS NULL)
         AND c.course_type = 'qualification'
         AND qup.assignment_status = 'pass'`
    );
    const [unitsPassedCount] = await pool.execute(
      `SELECT COUNT(*) as n
       FROM qual_unit_progress qup
       JOIN courses c ON c.id = qup.course_id
       WHERE c.course_type = 'qualification' AND qup.assignment_status = 'pass'`
    );
    const [submissionsCount] = await pool.execute(
      `SELECT COUNT(*) as n
       FROM qual_submissions qs
       JOIN units un ON un.id = qs.unit_id
       JOIN courses c ON c.id = un.course_id
       WHERE c.course_type = 'qualification' AND qs.submission_type = 'assignment'`
    );
    res.json({
      success: true,
      stats: {
        students_with_completed_units: studentsCount[0]?.n || 0,
        total_qualification_courses: coursesCount[0]?.n || 0,
        total_units_assessed_passed: unitsPassedCount[0]?.n || 0,
        total_assignments_submitted: submissionsCount[0]?.n || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// GET /api/claim-manager/courses - List qualification courses
// =====================================================
router.get('/courses', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, title FROM courses 
       WHERE course_type = 'qualification' 
       ORDER BY title ASC`
    );
    res.json({ success: true, courses: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// GET /api/claim-manager/completed-students
// =====================================================
router.get('/completed-students', async (req, res) => {
  try {
    const { courseId, search } = req.query;

    let query = `
      SELECT DISTINCT
        u.id as student_id,
        u.name as student_name,
        u.email,
        c.id as course_id,
        c.title as course_name,
        COUNT(DISTINCT qup.unit_id) as total_units,
        COUNT(DISTINCT CASE WHEN qup.assignment_status = 'pass' THEN qup.unit_id END) as passed_units,
        MAX(qup.completed_at) as last_completed_at
      FROM users u
      JOIN qual_unit_progress qup ON qup.student_id = u.id
      JOIN courses c ON c.id = qup.course_id
      JOIN units un ON un.id = qup.unit_id
      WHERE (un.is_optional = 0 OR un.is_optional IS NULL)
        AND c.course_type = 'qualification'
    `;
    const params = [];

    if (courseId) {
      query += ' AND c.id = ?';
      params.push(courseId);
    }
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY u.id, c.id
               HAVING passed_units > 0
               ORDER BY u.name ASC`;

    const [rows] = await pool.execute(query, params);

    const students = rows.map((r) => {
      const total = Number(r.total_units) || 0;
      const passed = Number(r.passed_units) || 0;
      const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
      return {
        student_id: r.student_id,
        student_name: r.student_name,
        email: r.email,
        course_id: r.course_id,
        course_name: r.course_name,
        total_units: total,
        passed_units: passed,
        completion_percentage: pct,
        last_completed_at: r.last_completed_at,
        is_fully_complete: passed === total
      };
    });

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// GET /api/claim-manager/student/:studentId/submissions
// =====================================================
router.get('/student/:studentId/submissions', async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    let query = `
      SELECT
        qs.id as submission_id,
        qs.unit_id,
        un.title as unit_name,
        un.order_index,
        c.id as course_id,
        c.title as course_name,
        qs.submission_type,
        qs.pass_fail_result,
        qs.feedback,
        qs.submitted_at,
        qs.graded_at,
        qs.status,
        u_assessor.name as assessor_name,
        qs.graded_by
      FROM qual_submissions qs
      JOIN units un ON un.id = qs.unit_id
      JOIN courses c ON c.id = un.course_id
      LEFT JOIN users u_assessor ON u_assessor.id = qs.graded_by
      WHERE qs.student_id = ?
    `;
    const params = [studentId];
    if (courseId) {
      query += ' AND c.id = ?';
      params.push(courseId);
    }
    query += ' ORDER BY c.id, un.order_index, qs.submitted_at ASC';

    const [submissions] = await pool.execute(query, params);
    if (submissions.length === 0) {
      const [userRows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [studentId]);
      const student = userRows[0] ? { id: userRows[0].id, name: userRows[0].name, email: userRows[0].email } : null;
      return res.json({ success: true, student, courses: [] });
    }

    const submissionIds = submissions.map((s) => s.submission_id);
    const ph = submissionIds.map(() => '?').join(',');
    const [files] = await pool.execute(
      `SELECT submission_id, file_name, file_path, uploaded_at 
       FROM assignment_submission_files 
       WHERE submission_id IN (${ph}) 
       ORDER BY uploaded_at ASC`,
      submissionIds
    );
    const filesBySubmission = {};
    for (const f of files) {
      if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = [];
      filesBySubmission[f.submission_id].push({
        file_name: f.file_name,
        file_path: f.file_path,
        uploaded_at: f.uploaded_at
      });
    }

    const [userRows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [studentId]);
    const student = { id: userRows[0].id, name: userRows[0].name, email: userRows[0].email };

    const courseMap = {};
    for (const s of submissions) {
      if (!courseMap[s.course_id]) {
        courseMap[s.course_id] = {
          course_id: s.course_id,
          course_name: s.course_name,
          units: {}
        };
      }
      const unitKey = s.unit_id;
      if (!courseMap[s.course_id].units[unitKey]) {
        courseMap[s.course_id].units[unitKey] = {
          unit_id: s.unit_id,
          unit_code: `U${(s.order_index != null ? s.order_index : 0) + 1}`,
          unit_name: s.unit_name,
          unit_number: (s.order_index != null ? s.order_index : 0) + 1,
          final_result: null,
          submissions: []
        };
      }
      const subFiles = filesBySubmission[s.submission_id] || [];
      const prevSubs = courseMap[s.course_id].units[unitKey].submissions;
      const isResubmission = prevSubs.length > 0;
      prevSubs.push({
        submission_id: s.submission_id,
        submission_type: s.submission_type,
        submitted_at: s.submitted_at,
        graded_at: s.graded_at,
        pass_fail_result: s.pass_fail_result,
        feedback: s.feedback,
        assessor_name: s.assessor_name,
        files: subFiles,
        is_resubmission: isResubmission
      });
      const latest = s.pass_fail_result && s.pass_fail_result !== 'pending';
      if (latest) {
        courseMap[s.course_id].units[unitKey].final_result = s.pass_fail_result;
      }
    }

    const courses = Object.values(courseMap).map((c) => ({
      ...c,
      units: Object.values(c.units).sort((a, b) => a.unit_number - b.unit_number)
    }));

    res.json({ success: true, student, courses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// GET /api/claim-manager/student/:studentId/download-unit/:unitId
// =====================================================
router.get('/student/:studentId/download-unit/:unitId', async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const unitId = Number(req.params.unitId);
    if (!studentId || !unitId) {
      return res.status(400).json({ success: false, message: 'Invalid student or unit id' });
    }

    const [unitRows] = await pool.execute(
      `SELECT un.id, un.title, un.order_index, c.title as course_name 
       FROM units un 
       JOIN courses c ON c.id = un.course_id 
       WHERE un.id = ?`,
      [unitId]
    );
    if (unitRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Unit not found' });
    }
    const unit = unitRows[0];
    const unitNumber = String((unit.order_index != null ? unit.order_index : 0) + 1).padStart(2, '0');
    const unitCode = `U${unitNumber}`;

    const [userRows] = await pool.execute('SELECT name FROM users WHERE id = ?', [studentId]);
    const studentName = userRows[0]?.name || 'Student';

    const [submissions] = await pool.execute(
      `SELECT qs.id, qs.pass_fail_result, qs.feedback, qs.submitted_at, qs.graded_at, grader.name as assessor_name
       FROM qual_submissions qs
       LEFT JOIN users grader ON grader.id = qs.graded_by
       WHERE qs.student_id = ? AND qs.unit_id = ?
       ORDER BY qs.submitted_at ASC`,
      [studentId, unitId]
    );

    const submissionIds = submissions.map((s) => s.id);
    let allFiles = [];
    if (submissionIds.length > 0) {
      const ph = submissionIds.map(() => '?').join(',');
      const [files] = await pool.execute(
        `SELECT asf.file_name, asf.file_path, asf.uploaded_at, qs.submitted_at, qs.id as submission_id
         FROM assignment_submission_files asf
         JOIN qual_submissions qs ON qs.id = asf.submission_id
         WHERE asf.submission_id IN (${ph})
         ORDER BY qs.submitted_at ASC, asf.uploaded_at ASC`,
        submissionIds
      );
      allFiles = files;
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="Unit_${unitNumber}_${studentName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip"`);
    archive.pipe(res);

    const folder = `Unit_${unitNumber}_${unitCode}`;

    const firstSub = submissions[0];
    const lastSub = submissions[submissions.length - 1];
    const finalResult = lastSub?.pass_fail_result || firstSub?.pass_fail_result || 'N/A';
    const assessorName = lastSub?.assessor_name || firstSub?.assessor_name || 'N/A';
    const gradedAt = lastSub?.graded_at || firstSub?.graded_at || 'N/A';
    const submittedAt = firstSub?.submitted_at || 'N/A';

    let feedbackText = `Unit: ${unit.title}\nStudent: ${studentName}\nCourse: ${unit.course_name}\nResult: ${finalResult}\nSubmitted: ${submittedAt}\nAssessed by: ${assessorName}\nAssessed on: ${gradedAt}\n---\nFEEDBACK:\n`;
    const allFeedback = submissions.filter((s) => s.feedback).map((s) => s.feedback).join('\n\n---\n\n');
    feedbackText += allFeedback || '(No feedback)';

    archive.append(feedbackText, { name: `${folder}/feedback/feedback.txt` });

    let assignmentCount = 0;
    let resubmitCount = 0;
    for (const f of allFiles) {
      const isResubmit = submissions.length > 1 && f.submission_id !== submissions[0].id;
      const subfolder = isResubmit ? 'resubmissions' : 'assignments';
      const safeName = (f.file_name || 'file').replace(/[\/\\]/g, '_');
      try {
        const stream = await fetchFileStream(f.file_path);
        archive.append(stream, { name: `${folder}/${subfolder}/${safeName}` });
        if (isResubmit) resubmitCount++;
        else assignmentCount++;
      } catch (e) {
        archive.append(`(Failed to fetch: ${f.file_path})`, { name: `${folder}/${subfolder}/${safeName}.txt` });
      }
    }

    archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// =====================================================
// GET /api/claim-manager/student/:studentId/download-all
// =====================================================
router.get('/student/:studentId/download-all', async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const [userRows] = await pool.execute('SELECT name FROM users WHERE id = ?', [studentId]);
    const studentName = userRows[0]?.name || 'Student';

    let courseFilter = '';
    const params = [studentId];
    if (courseId) {
      courseFilter = ' AND c.id = ?';
      params.push(courseId);
    }

    const [unitsWithSubs] = await pool.execute(
      `SELECT DISTINCT un.id as unit_id, un.title, un.order_index, c.title as course_name, c.id as course_id
       FROM qual_submissions qs
       JOIN units un ON un.id = qs.unit_id
       JOIN courses c ON c.id = un.course_id
       WHERE qs.student_id = ? ${courseFilter}
       ORDER BY c.id, un.order_index`,
      params
    );

    if (unitsWithSubs.length === 0) {
      return res.status(404).json({ success: false, message: 'No submissions found for this student' });
    }

    const courseName = unitsWithSubs[0].course_name;
    const baseFolder = `${studentName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${courseName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${baseFolder}_Complete.zip"`);
    archive.pipe(res);

    for (const u of unitsWithSubs) {
      const unitNumber = String((u.order_index != null ? u.order_index : 0) + 1).padStart(2, '0');
      const unitCode = `U${unitNumber}`;
      const folder = `${baseFolder}/Unit_${unitNumber}_${unitCode}`;

      const [submissions] = await pool.execute(
        `SELECT qs.id, qs.pass_fail_result, qs.feedback, qs.submitted_at, qs.graded_at, grader.name as assessor_name
         FROM qual_submissions qs
         LEFT JOIN users grader ON grader.id = qs.graded_by
         WHERE qs.student_id = ? AND qs.unit_id = ?
         ORDER BY qs.submitted_at ASC`,
        [studentId, u.unit_id]
      );

      const submissionIds = submissions.map((s) => s.id);
      let allFiles = [];
      if (submissionIds.length > 0) {
        const ph = submissionIds.map(() => '?').join(',');
        const [files] = await pool.execute(
          `SELECT asf.file_name, asf.file_path, qs.id as submission_id
           FROM assignment_submission_files asf
           JOIN qual_submissions qs ON qs.id = asf.submission_id
           WHERE asf.submission_id IN (${ph})
           ORDER BY qs.submitted_at ASC, asf.uploaded_at ASC`,
          submissionIds
        );
        allFiles = files;
      }

      const firstSub = submissions[0];
      const lastSub = submissions[submissions.length - 1];
      const finalResult = lastSub?.pass_fail_result || firstSub?.pass_fail_result || 'N/A';
      const assessorName = lastSub?.assessor_name || firstSub?.assessor_name || 'N/A';
      const gradedAt = lastSub?.graded_at || firstSub?.graded_at || 'N/A';
      const submittedAt = firstSub?.submitted_at || 'N/A';

      let feedbackText = `Unit: ${u.title}\nStudent: ${studentName}\nCourse: ${u.course_name}\nResult: ${finalResult}\nSubmitted: ${submittedAt}\nAssessed by: ${assessorName}\nAssessed on: ${gradedAt}\n---\nFEEDBACK:\n`;
      const allFeedback = submissions.filter((s) => s.feedback).map((s) => s.feedback).join('\n\n---\n\n');
      feedbackText += allFeedback || '(No feedback)';

      archive.append(feedbackText, { name: `${folder}/feedback/feedback.txt` });

      for (const f of allFiles) {
        const isResubmit = submissions.length > 1 && f.submission_id !== submissions[0].id;
        const subfolder = isResubmit ? 'resubmissions' : 'assignments';
        const safeName = (f.file_name || 'file').replace(/[\/\\]/g, '_');
        try {
          const stream = await fetchFileStream(f.file_path);
          archive.append(stream, { name: `${folder}/${subfolder}/${safeName}` });
        } catch (e) {
          archive.append(`(Failed to fetch: ${f.file_path})`, { name: `${folder}/${subfolder}/${safeName}.txt` });
        }
      }
    }

    archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// =====================================================
// GET /api/claim-manager/student/:studentId/report-csv
// GET /api/claim-manager/report-csv?courseId=X
// =====================================================
function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

router.get('/student/:studentId/report-csv', async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }
    const csv = await buildReportCsv(studentId, courseId);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ClaimManager_Report_${date}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/report-csv', async (req, res) => {
  try {
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    const csv = await buildReportCsv(null, courseId);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ClaimManager_Report_${date}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

async function buildReportCsv(studentId, courseId) {
  let query = `
    SELECT
      c.title as course_name,
      u.name as student_name,
      un.order_index,
      un.title as unit_name,
      qs.submitted_at,
      qs.pass_fail_result,
      qs.graded_at,
      grader.name as assessor_name,
      qs.feedback,
      qs.id as submission_id,
      qs.unit_id,
      u.id as user_id
    FROM qual_submissions qs
    JOIN users u ON u.id = qs.student_id
    JOIN units un ON un.id = qs.unit_id
    JOIN courses c ON c.id = un.course_id
    LEFT JOIN users grader ON grader.id = qs.graded_by
    WHERE c.course_type = 'qualification' AND qs.submission_type = 'assignment'
  `;
  const params = [];
  if (studentId) {
    query += ' AND qs.student_id = ?';
    params.push(studentId);
  }
  if (courseId) {
    query += ' AND c.id = ?';
    params.push(courseId);
  }
  query += ' ORDER BY u.name, c.id, un.order_index, qs.submitted_at ASC';

  const [rows] = await pool.execute(query, params);

  const unitMap = {};
  for (const r of rows) {
    const key = `${r.user_id}-${r.course_name}-${r.unit_id}`;
    if (!unitMap[key]) {
      unitMap[key] = {
        course_name: r.course_name,
        student_name: r.student_name,
        unit_number: (r.order_index != null ? r.order_index : 0) + 1,
        unit_code: `U${(r.order_index != null ? r.order_index : 0) + 1}`,
        unit_name: r.unit_name,
        first_submitted: r.submitted_at,
        first_result: r.pass_fail_result,
        refer_date: r.pass_fail_result === 'refer' ? r.graded_at : null,
        resubmission_date: null,
        final_result: r.pass_fail_result,
        assessor_name: r.assessor_name,
        feedback_summary: r.feedback ? (r.feedback.slice(0, 100) + (r.feedback.length > 100 ? '...' : '')) : ''
      };
    } else {
      const rec = unitMap[key];
      if (r.pass_fail_result === 'refer' && !rec.refer_date) rec.refer_date = r.graded_at;
      rec.resubmission_date = r.submitted_at;
      rec.final_result = r.pass_fail_result;
      rec.assessor_name = r.assessor_name;
      rec.feedback_summary = r.feedback ? (r.feedback.slice(0, 100) + (r.feedback.length > 100 ? '...' : '')) : '';
    }
  }

  const header = 'Course Name,Student Name,Unit Number,Unit Code,Unit Name,Assignment Submitted Date,First Result (Pass/Refer/Fail),Refer Date,Resubmission Date,Final Result,Assessor Name,Feedback Summary';
  const lines = [header];
  for (const rec of Object.values(unitMap)) {
    lines.push([
      escapeCsv(rec.course_name),
      escapeCsv(rec.student_name),
      rec.unit_number,
      rec.unit_code,
      escapeCsv(rec.unit_name),
      formatDate(rec.first_submitted),
      rec.first_result || '',
      formatDate(rec.refer_date),
      formatDate(rec.resubmission_date),
      rec.final_result || '',
      escapeCsv(rec.assessor_name),
      escapeCsv(rec.feedback_summary)
    ].join(','));
  }
  return lines.join('\n');
}

module.exports = router;
