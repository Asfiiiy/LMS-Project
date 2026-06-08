/**
 * Login email matching: exact match first, then Gmail/GoogleMail–style equivalence.
 * Google ignores dots in the local part and treats @googlemail.com like @gmail.com;
 * plus-addressing (local+tag@) maps to the same mailbox.
 * Other providers keep strict string equality (many treat dots as significant).
 */

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

function parseEmailParts(email) {
  const trimmed = String(email || '').trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).trim().toLowerCase();
  return { local, domain, raw: trimmed };
}

function isGmailDomain(domain) {
  return GMAIL_DOMAINS.has(String(domain || '').toLowerCase());
}

/** Gmail-style canonical local: lower case, strip +tag, remove dots */
function gmailCanonicalLocal(local) {
  if (local == null) return '';
  const s = String(local).trim().toLowerCase();
  const plus = s.indexOf('+');
  const base = plus >= 0 ? s.slice(0, plus) : s;
  return base.replace(/\./g, '');
}

/**
 * @param {import('mysql2').Pool} pool
 * @param {string} rawEmail
 * @returns {Promise<object|undefined>}
 */
async function findUserForLogin(pool, rawEmail) {
  const trimmed = String(rawEmail || '').trim();
  if (!trimmed) return undefined;

  const [exact] = await pool.execute(
    'SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
    [trimmed]
  );
  if (exact[0]) return exact[0];

  const parts = parseEmailParts(trimmed);
  if (!parts || !isGmailDomain(parts.domain)) return undefined;

  const key = gmailCanonicalLocal(parts.local);
  if (!key) return undefined;

  const [rows] = await pool.execute(
    `SELECT * FROM users 
     WHERE LOWER(TRIM(SUBSTRING_INDEX(email, '@', -1))) IN ('gmail.com', 'googlemail.com')
       AND REPLACE(
         SUBSTRING_INDEX(SUBSTRING_INDEX(LOWER(TRIM(email)), '@', 1), '+', 1),
         '.',
         ''
       ) = ?
     LIMIT 4`,
    [key]
  );

  if (rows.length === 0) return undefined;
  if (rows.length > 1) {
    console.error(
      '[emailLoginLookup] Ambiguous Gmail login: normalized local matches multiple users (count=%s)',
      rows.length
    );
    return undefined;
  }
  return rows[0];
}

module.exports = {
  findUserForLogin,
  gmailCanonicalLocal,
  isGmailDomain,
  parseEmailParts
};
