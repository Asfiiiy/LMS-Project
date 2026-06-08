/**
 * Shared qualification unit progress for staff student views (CM, tickets, etc.)
 */
const pool = require('../config/db');

async function getQualificationEnrollments(studentId) {
  const [caEnrollments] = await pool.execute(
    `SELECT c.id as course_id, c.title as course_title, c.course_type, ca.status as enroll_status
     FROM course_assignments ca
     JOIN courses c ON ca.course_id = c.id
     WHERE ca.student_id = ?
       AND LOWER(TRIM(COALESCE(c.course_type, ''))) IN ('qualification', 'qualifi')
     ORDER BY ca.created_at DESC`,
    [studentId]
  );

  const [paymentEnrollments] = await pool.execute(
    `SELECT DISTINCT c.id as course_id, c.title as course_title, c.course_type, 'Enrolled' as enroll_status
     FROM student_payment_installments spi
     JOIN courses c ON spi.course_id = c.id
     WHERE spi.student_id = ?
       AND LOWER(TRIM(COALESCE(c.course_type, ''))) IN ('qualification', 'qualifi')`,
    [studentId]
  );

  const seen = new Set((caEnrollments || []).map((e) => e.course_id));
  const enrollments = [...(caEnrollments || [])];
  for (const pe of paymentEnrollments || []) {
    if (!seen.has(pe.course_id)) {
      seen.add(pe.course_id);
      enrollments.push(pe);
    }
  }
  enrollments.sort((a, b) => (a.course_title || '').localeCompare(b.course_title || ''));
  return enrollments;
}

async function loadCourseProgress(studentId, course) {
  const courseId = course.course_id;

  const [units] = await pool.execute(
    `SELECT
       qup.unit_id,
       u.title as unit_title,
       u.order_index,
       qup.is_unlocked,
       qup.is_completed,
       qup.assignment_submitted,
       qup.assignment_status,
       std.deadline,
       std.assignment_submission_unlocked
     FROM qual_unit_progress qup
     JOIN units u ON u.id = qup.unit_id
     LEFT JOIN student_topic_deadlines std
       ON std.topic_id = qup.unit_id
       AND std.student_id = ?
       AND std.topic_type = 'qualification_unit'
     WHERE qup.student_id = ?
       AND qup.course_id = ?
     ORDER BY u.order_index ASC, u.id ASC`,
    [studentId, studentId, courseId]
  );

  if (!units.length) {
    const [fallbackUnits] = await pool.execute(
      `SELECT u.id as unit_id, u.title as unit_title, u.order_index
       FROM units u
       WHERE u.course_id = ?
       ORDER BY u.order_index ASC, u.id ASC`,
      [courseId]
    );
    return (fallbackUnits || []).map((u, idx) => ({
      unit_id: u.unit_id,
      unit_title: u.unit_title,
      unit_number: (u.order_index ?? idx) + 1,
      order_index: u.order_index ?? idx,
      is_unlocked: idx === 0,
      is_completed: false,
      assignment_submitted: false,
      assignment_status: null,
      deadline: null,
      assignment_submission_unlocked: 0,
      submissions: [],
      assessor_name: null,
    }));
  }

  const unitIds = units.map((u) => u.unit_id);
  const ph = unitIds.map(() => '?').join(',');

  const [submissions] = await pool.execute(
    `SELECT
       qs.id,
       qs.unit_id,
       qs.submission_type,
       qs.status,
       qs.pass_fail_result,
       qs.feedback,
       qs.submitted_at,
       qs.graded_at,
       grader.name as graded_by_name
     FROM qual_submissions qs
     LEFT JOIN users grader ON grader.id = qs.graded_by
     WHERE qs.student_id = ?
       AND qs.unit_id IN (${ph})
     ORDER BY qs.submitted_at DESC`,
    [studentId, ...unitIds]
  );

  const subIds = submissions.map((s) => s.id);
  let files = [];
  if (subIds.length) {
    const subPh = subIds.map(() => '?').join(',');
    const [fileRows] = await pool.execute(
      `SELECT
         asf.id,
         asf.submission_id,
         asf.file_name,
         asf.file_path,
         asf.file_type,
         asf.status,
         asf.resubmit_feedback,
         asf.uploaded_at
       FROM assignment_submission_files asf
       WHERE asf.submission_id IN (${subPh})
       ORDER BY asf.uploaded_at DESC`,
      subIds
    );
    files = fileRows || [];
  }

  return units.map((unit, idx) => {
    const unitSubs = submissions.filter((s) => s.unit_id === unit.unit_id);
    const subWithFiles = unitSubs.map((sub) => ({
      ...sub,
      files: files.filter((f) => f.submission_id === sub.id),
    }));
    const latest = subWithFiles[0] || null;
    const gradedAssessor = latest?.graded_by_name || null;

    return {
      ...unit,
      unit_number: (unit.order_index ?? idx) + 1,
      is_unlocked: unit.is_unlocked === 1 || unit.is_unlocked === true,
      is_completed: unit.is_completed === 1 || unit.is_completed === true,
      assignment_submitted: unit.assignment_submitted === 1 || unit.assignment_submitted === true,
      submissions: subWithFiles,
      assessor_name: gradedAssessor,
      latest_submission: latest,
    };
  });
}

/**
 * @param {number} studentId
 * @returns {Promise<{ courses: object[], assigned_tutor_name: string|null }>}
 */
async function fetchStudentQualProgress(studentId) {
  const enrollments = await getQualificationEnrollments(studentId);

  const [studentRow] = await pool.execute(
    `SELECT t.name as assigned_tutor_name
     FROM users u
     LEFT JOIN users t ON t.id = u.assigned_tutor_id
     WHERE u.id = ?`,
    [studentId]
  );
  const assignedTutorName = studentRow[0]?.assigned_tutor_name || null;

  const courses = [];
  for (const course of enrollments) {
    const units = await loadCourseProgress(studentId, course);
    courses.push({
      course_id: course.course_id,
      course_title: course.course_title,
      course_type: course.course_type,
      enroll_status: course.enroll_status || 'Enrolled',
      units: units.map((u) => ({
        ...u,
        assessor_name: u.assessor_name || assignedTutorName,
      })),
    });
  }

  return { courses, assigned_tutor_name: assignedTutorName };
}

module.exports = { fetchStudentQualProgress, getQualificationEnrollments };
