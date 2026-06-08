const STUDENT_ROLE_NAMES = ['Student', 'ManagerStudent', 'InstituteStudent'];

function isStudentRoleName(roleName) {
  return !!roleName && STUDENT_ROLE_NAMES.includes(roleName);
}

function normalizeLearnerId(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function formatLearnerId(sequenceNumber) {
  return `ILC${String(sequenceNumber).padStart(3, '0')}`;
}

/**
 * Extract Reg # (registration number) from learner_id.
 * ILC001 -> '001', ILC123 -> '123'. Returns null if invalid.
 */
function extractRegNumberFromLearnerId(learnerId) {
  if (!learnerId || typeof learnerId !== 'string') return null;
  const trimmed = learnerId.trim();
  const match = trimmed.match(/^ILC-?([0-9]+)$/i);
  return match ? match[1] : null;
}

/**
 * Format learner_id for certificate display: ILC130 -> ILC-130
 */
function formatLearnerIdForCertificate(learnerId) {
  if (!learnerId || typeof learnerId !== 'string') return null;
  const trimmed = learnerId.trim();
  const match = trimmed.match(/^ILC-?([0-9]+)$/i);
  return match ? `ILC-${match[1]}` : null;
}

async function generateNextLearnerId(db) {
  const [rows] = await db.execute(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(learner_id, 4) AS UNSIGNED)), 0) AS max_num
     FROM users
     WHERE learner_id REGEXP '^ILC[0-9]+$'`
  );

  const nextNumber = (rows[0]?.max_num || 0) + 1;
  return formatLearnerId(nextNumber);
}

module.exports = {
  STUDENT_ROLE_NAMES,
  isStudentRoleName,
  normalizeLearnerId,
  formatLearnerId,
  generateNextLearnerId,
  extractRegNumberFromLearnerId,
  formatLearnerIdForCertificate
};
