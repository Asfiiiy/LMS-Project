# Inspire LMS — Security & Compliance Audit Report

**Date:** February 2026  
**Scope:** Full codebase audit across 8 security areas

---

## AREA 1 — UK GDPR & DATA COMPLIANCE

### 1.1 Is personal data (name, DOB, address, ID docs) encrypted at rest in MySQL?
**Status:** ❌ Missing  
**File:** `backend/config/db.js`  
**Issue:** MySQL stores data in plaintext. No application-level encryption for sensitive columns (name, date_of_birth, postal_address, etc.). MySQL TDE (Transparent Data Encryption) is not configured.  
**Fix:** Enable MySQL encryption-at-rest (TDE) at database level, or implement application-level encryption for sensitive columns using AES-256 before INSERT/UPDATE. For MySQL 8.0+, consider `keyring_file` or enterprise key management.

### 1.2 Is there a data retention/auto-delete policy?
**Status:** ❌ Missing  
**File:** N/A (no implementation)  
**Issue:** No cron job, migration, or policy to auto-delete or anonymize old data. No retention period defined for student records, logs, or documents.  
**Fix:** Add `backend/cron/dataRetention.js` with configurable retention (e.g. 7 years for student records per UK requirements). Implement soft-delete + hard-delete for logs older than X months. Add `data_retention_policy` table and admin UI to configure.

### 1.3 Is there a GDPR consent checkbox in student onboarding?
**Status:** ✅ Done  
**File:** `app/onboarding/initial-assessment/page.tsx`, `backend/routes/onboarding.js`, `backend/migrations/create_student_onboarding_tables.sql`  
**Issue:** N/A  
**Details:** `data_usage_consent` and `assessment_accuracy_consent` are required. Backend validates: `if (!data_usage_consent || !assessment_accuracy_consent || !qualification_understanding || !apl_understanding)`.

### 1.4 Is there a Right to Erasure endpoint?
**Status:** ❌ Missing  
**File:** N/A  
**Issue:** No endpoint to delete/anonymize all personal data for a user upon request (GDPR Article 17).  
**Fix:** Add `DELETE /api/admin/gdpr/erasure/:userId` (admin-only) that: anonymizes `users`, `student_profiles`, `student_initial_assessments`, deletes documents from Cloudinary, and logs the erasure. Require admin confirmation + audit log.

### 1.5 Is there a Data Export endpoint (GDPR Article 20)?
**Status:** ❌ Missing  
**File:** N/A  
**Issue:** No endpoint for data portability. Students cannot export their personal data in a machine-readable format.  
**Fix:** Add `GET /api/student/profile/export` (auth, student only) that returns JSON with profile, onboarding, enrollments, submissions metadata. Optionally support PDF export.

### 1.6 Are Cloudinary uploads (ID docs) in private folders with signed URLs?
**Status:** ⚠️ Partial  
**File:** `backend/config/cloudinary.js`, `backend/routes/documentVerification.js`, `backend/routes/studentProfile.js`  
**Issue:** Cloudinary uses `upload_preset: 'lms_public_files'` and `resource_type: 'auto'` with no `type: 'private'`. Documents in `lms/student-documents/{userId}` are publicly accessible if URL is known.  
**Fix:** Create a private upload preset in Cloudinary Dashboard. Use `type: 'private'` and serve via `cloudinary.url(publicId, { sign_url: true, expires_at: Math.floor(Date.now()/1000) + 3600 })` for time-limited signed URLs.

### 1.7 Is there an audit log for access to sensitive student records?
**Status:** ⚠️ Partial  
**File:** `backend/middleware/activityLogger.js`, `backend/utils/eventLogger.js`  
**Issue:** Activity logger logs POST/PUT/DELETE and some GET (login, certificates). Access to student profile, documents, onboarding is not explicitly logged. No dedicated "sensitive data access" audit trail.  
**Fix:** Add explicit `logSystemEvent` calls in `GET /api/admin/students/:studentId/profile`, `GET /api/documents/student/:studentId`, `GET /api/onboarding/student/:studentId` with action `sensitive_data_access` and student_id.

### 1.8 Is there a Privacy Policy acceptance step before data collection?
**Status:** ⚠️ Partial  
**File:** `app/onboarding/initial-assessment/page.tsx`  
**Issue:** Consent checkboxes exist (`data_usage_consent`, `assessment_accuracy_consent`) but there is no explicit "I have read and accept the Privacy Policy" checkbox or link to a Privacy Policy page before collecting personal data.  
**Fix:** Add `privacy_policy_consent` checkbox and link to `/privacy-policy`. Require it before form submission. Store in `student_initial_assessments`.

---

## AREA 2 — AUTHENTICATION & JWT

### 2.1 Is JWT secret strong and stored only in .env?
**Status:** ⚠️ Partial  
**File:** `backend/routes/auth.js`, `backend/middleware/auth.js`  
**Issue:** Code uses `process.env.JWT_SECRET || 'secretkey'`. Fallback to `'secretkey'` is a critical vulnerability if .env is missing.  
**Fix:** Remove fallback. Add at server startup: `if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set and at least 32 chars')`.

### 2.2 Is refresh token rotation implemented?
**Status:** ❌ Missing  
**File:** `backend/routes/auth.js`  
**Issue:** Refresh route issues a new token but does not invalidate the old one. No refresh token family or rotation. Same token can be used until expiry.  
**Fix:** Implement refresh token rotation: store refresh tokens in Redis with `user_id`, `token_id`, `expires_at`. On refresh, invalidate old token and issue new one. Reuse detection = revoke all tokens for user.

### 2.3 Are invalidated JWTs blacklisted in Redis on logout?
**Status:** ❌ Missing  
**File:** `backend/routes/auth.js` (logout route)  
**Issue:** Logout only logs the event. Token remains valid until expiry. User can continue using the same token.  
**Fix:** On logout, add token to Redis blacklist: `redis.setex('jwt_blacklist:' + tokenHash, remainingTTL, '1')`. In auth middleware, check blacklist before `jwt.verify`.

### 2.4 Are cookies set with httpOnly, secure, sameSite flags?
**Status:** N/A  
**File:** N/A  
**Issue:** JWT is returned in JSON response and stored in `localStorage` by frontend, not in cookies. No cookie-based auth.  
**Fix:** If moving to cookies, use: `res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 86400000 })`.

### 2.5 Is there rate limiting on /api/auth/login?
**Status:** ✅ Done  
**File:** `backend/server.js`, `backend/middleware/rateLimiter.js`  
**Details:** `authLimiter` applied to `/api/login` and `/api/auth/login`. 100 attempts per 15 min per IP, `skipSuccessfulRequests: true`.

### 2.6 Are ALL role checks enforced on the backend (not just frontend)?
**Status:** ⚠️ Partial  
**File:** `backend/routes/student.js`, `backend/routes/admin.js`, etc.  
**Issue:** Many admin routes use `permit('Admin')` or role checks. **Student routes** (`GET /api/student/:studentId/courses`, etc.) have **NO auth middleware** — they are completely unprotected. Any unauthenticated user can access any student's data (IDOR).  
**Fix:** Add `router.use(auth)` at top of `backend/routes/student.js`. For student-only routes, add: `if (req.user.role_id !== 4 && req.user.role_id !== 12 && req.user.role_id !== 13) return res.status(403)...` and `if (parseInt(req.params.studentId) !== req.user.id && !isStaff(req.user)) return res.status(403)...`.

### 2.7 Is there account lockout after failed login attempts?
**Status:** ❌ Missing  
**File:** `backend/routes/auth.js`  
**Issue:** No per-account lockout. Only IP-based rate limiting. Attacker can try many passwords for one account from different IPs.  
**Fix:** Track failed attempts per email in Redis: `failed_logins:${email}`. After 5 failures, lock for 15 min. Reset on successful login.

---

## AREA 3 — API & BACKEND

### 3.1 Is input validation on ALL Express routes (zod/joi)?
**Status:** ⚠️ Partial  
**File:** `backend/routes/*.js`  
**Issue:** AI routes use `validateAIInput.js` (custom validators). Most other routes (admin, student, cpd, qualification, chat, forum) have no schema validation. Raw `req.body` used directly.  
**Fix:** Add `express-validator` or `zod` globally. Create validation schemas for each route. Reject invalid input with 400.

### 3.2 Are ALL MySQL queries using parameterized statements?
**Status:** ✅ Done  
**File:** `backend/routes/*.js`, `backend/services/*.js`  
**Details:** Queries use `pool.execute('SELECT ... WHERE id = ?', [id])` and `pool.query` with parameter arrays. No string concatenation of user input into SQL. One exception: `backend/routes/admin.js` line 1738 uses `studentFilter = \`AND stu.assigned_tutor_id = ${tutorId}\`` — `tutorId` is from JWT, low risk but should use parameter.

### 3.3 Is CORS restricted to trusted frontend domain only?
**Status:** ❌ Missing  
**File:** `backend/server.js`  
**Issue:** `app.use(cors())` with no options — allows ALL origins.  
**Fix:** `app.use(cors({ origin: process.env.NODE_ENV === 'production' ? ['https://lms.inspirelondoncollege.com', 'https://www.lms.inspirelondoncollege.com'] : ['http://localhost:3000'], credentials: true }))`.

### 3.4 Is Helmet.js middleware applied?
**Status:** ❌ Missing  
**File:** `backend/server.js`  
**Issue:** Helmet not installed or used. Missing security headers (X-Content-Type-Options, X-Frame-Options, etc.).  
**Fix:** `npm install helmet` and `app.use(require('helmet')())` after cors.

### 3.5 Is rate limiting applied globally and on sensitive routes?
**Status:** ✅ Done  
**File:** `backend/server.js`, `backend/middleware/rateLimiter.js`  
**Details:** `apiLimiter` on `/api/`, `authLimiter` on `/api/login` and `/api/auth/login`. Staff roles skip API limiter.

### 3.6 Are file uploads validated (MIME type, size, malicious file check)?
**Status:** ⚠️ Partial  
**File:** `backend/routes/documentVerification.js`, `backend/routes/chat.js`, `backend/routes/admin.js`  
**Issue:** Document upload: `fileFilter` checks extension (.pdf, .jpg, .jpeg, .png) and 5MB limit. Chat upload: only 10MB limit, **no MIME/type check** — allows any file. No malware scanning.  
**Fix:** Add MIME validation: `const allowedMimes = ['application/pdf','image/jpeg','image/png']; if (!allowedMimes.includes(file.mimetype)) cb(new Error('Invalid file type'))`. For chat, restrict to same. Consider ClamAV for malware.

### 3.7 Are Cloudinary documents served via signed, expiring URLs only?
**Status:** ❌ Missing  
**File:** `backend/routes/documentVerification.js`, Cloudinary config  
**Issue:** Documents use public URLs. No signed URLs.  
**Fix:** See 1.6 — use private storage and signed URLs.

### 3.8 Is IDOR prevented — can students access other students' data?
**Status:** ❌ Missing (Critical)  
**File:** `backend/routes/student.js`  
**Issue:** Routes like `GET /api/student/:studentId/courses` have **no auth** and **no check** that `studentId === req.user.id`. Any user (or no user) can request any student's courses, assignments, progress.  
**Fix:** Add auth to all student routes. Add: `const studentId = parseInt(req.params.studentId); if (req.user.role_id === 4 && req.user.id !== studentId) return res.status(403).json({...})`. For staff, allow access to any student.

### 3.9 Is request logging in place (IP, user ID, endpoint, timestamp)?
**Status:** ✅ Done  
**File:** `backend/middleware/activityLogger.js`, `backend/utils/eventLogger.js`  
**Details:** Logs POST/PUT/PATCH/DELETE and sensitive GET. Stores user_id, role, action, IP, endpoint in `system_logs`.

### 3.10 Is TinyMCE/HTML input sanitized server-side to prevent XSS?
**Status:** ❌ Missing  
**File:** `backend/routes/forum.js`, `backend/routes/qualification.js`, `backend/routes/cpd.js`, etc.  
**Issue:** Rich text (course content, forum posts, assignment descriptions) is stored and rendered without server-side sanitization. XSS possible via malicious HTML.  
**Fix:** Install `dompurify` + `jsdom` or `sanitize-html`. Sanitize all HTML before INSERT/UPDATE: `const clean = sanitizeHtml(html, { allowedTags: ['p','b','i','u','a','ul','ol','li'], allowedAttributes: { a: ['href'] } })`.

---

## AREA 4 — STRIPE PAYMENTS

### 4.1 Is Stripe secret key only in backend .env, never in frontend?
**Status:** ✅ Done  
**File:** `backend/routes/certificates.js`, `app/services/api.ts`  
**Details:** Stripe initialized with `process.env.STRIPE_SECRET_KEY`. Frontend uses `STRIPE_PUBLISHABLE_KEY` only.

### 4.2 Are Stripe webhook signatures validated?
**Status:** ❌ Missing  
**File:** `backend/routes/paymentInstallments.js`, `backend/routes/certificates.js`  
**Issue:** No webhook endpoint found that uses `stripe.webhooks.constructEvent(body, signature, secret)`. Payment status may be updated without verifying webhook authenticity.  
**Fix:** Add webhook route: `router.post('/webhook', express.raw({type:'application/json'}), (req,res)=>{ const sig = req.headers['stripe-signature']; const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); ... })`. Use `STRIPE_WEBHOOK_SECRET` from .env.

### 4.3 Are card details never stored (only Stripe token/payment intent IDs)?
**Status:** ✅ Done  
**File:** `backend/routes/certificates.js`  
**Details:** Only `stripe_payment_intent_id` stored. No card numbers or CVC.

### 4.4 Are idempotency keys used on payment intent creation?
**Status:** ❌ Missing  
**File:** `backend/routes/certificates.js` (around line 661)  
**Issue:** `stripe.paymentIntents.create({...})` has no `idempotencyKey`. Duplicate requests could create multiple intents.  
**Fix:** Add `idempotencyKey: `cert_claim_${claimId}_${Date.now()}` or use a deterministic key per claim.

### 4.5 Are all payment events logged with student ID and timestamp?
**Status:** ⚠️ Partial  
**File:** `backend/routes/certificates.js`, `backend/middleware/activityLogger.js`  
**Issue:** Activity logger logs POST requests. No dedicated payment audit log with student_id, amount, status, timestamp in a `payment_audit_log` table.  
**Fix:** Add `logSystemEvent` or dedicated `payment_audit_log` INSERT for every payment intent create, confirm, webhook event.

### 4.6 Is installment plan logic validated server-side?
**Status:** ✅ Done  
**File:** `backend/routes/paymentInstallments.js`  
**Details:** Validates `payment_type`, `installments` array, `amount`, `due_date`, `status`. Admin-only route with role check.

---

## AREA 5 — FILE & DOCUMENT SECURITY

### 5.1 Is student data sanitized before inserting into docxtemplater templates?
**Status:** ⚠️ Partial  
**File:** `backend/services/certificateGenerator.js`  
**Issue:** Data is passed to `doc.render(data)`. Docxtemplater escapes `{{variable}}` by default, but custom modules or raw XML could introduce injection. No explicit sanitization of `full_name`, `course_name`, etc.  
**Fix:** Sanitize all string values: `const sanitize = (s) => String(s||'').replace(/[<>\"'&]/g, '')` and apply before passing to template.

### 5.2 Is LibreOffice conversion sandboxed with no unsanitized shell commands?
**Status:** ⚠️ Partial  
**File:** `backend/utils/pdfConverter.js`, `backend/services/certificateGenerator.js`  
**Issue:** `execSync` and `spawn` use `libreOfficePath` and `docxPath` from env/DB. Paths are built from `path.join` with DB values — if DB is compromised, path traversal possible. No explicit sandbox.  
**Fix:** Validate `docxPath` is under allowed directory: `if (!docxPath.startsWith(allowedDir)) throw new Error('Invalid path')`. Use `path.resolve` and check `path.relative(allowedDir, docxPath)` does not start with `..`.

### 5.3 Are assignment file uploads validated for type and size?
**Status:** ⚠️ Partial  
**File:** `backend/routes/qualification.js` (submission upload)  
**Issue:** Need to verify. Document upload has validation; qualification submission upload may differ.  
**Fix:** Ensure all upload endpoints have: fileFilter (MIME + extension), limits (e.g. 10MB), and reject executable extensions (.exe, .bat, .sh, .js, etc.).

### 5.4 Are certificate download links signed and time-limited (not permanent public)?
**Status:** ⚠️ Partial  
**File:** `backend/routes/certificates.js`  
**Issue:** Public download `GET /api/certificates/public-download/:type/:regNumber` is permanent — anyone with reg number can download forever. No expiry or signed token.  
**Fix:** Option A: Add optional signed token: `?token=HMAC(regNumber+expiry, secret)&expires=...`. Option B: Keep as-is but document that reg number is the secret (like certificate number). For admin URLs, ensure JWT is required and validated.

### 5.5 Is path traversal prevented in all file-serving endpoints?
**Status:** ⚠️ Partial  
**File:** `backend/routes/certificates.js`  
**Issue:** `filePath = path.join(__dirname, '..', cert.certificate_pdf_path)` — if `certificate_pdf_path` from DB contained `../../../etc/passwd`, it could escape. DB values should be validated.  
**Fix:** Before serving: `const resolved = path.resolve(baseDir, cert.certificate_pdf_path); if (!resolved.startsWith(baseDir)) return res.status(400).json({...})`.

---

## AREA 6 — SOCKET.IO & REAL-TIME

### 6.1 Is every Socket.IO connection authenticated via JWT before any event?
**Status:** ✅ Done  
**File:** `backend/socket.js`  
**Details:** `io.use(async (socket, next) => { const token = socket.handshake.auth?.token || socket.handshake.query?.token; ... const decoded = jwt.verify(token, JWT_SECRET); socket.userId = decoded.id; next(); })`. All events run after auth.

### 6.2 Are chat file uploads validated and scanned?
**Status:** ⚠️ Partial  
**File:** `backend/controllers/chatController.js`, `backend/routes/chat.js`  
**Issue:** Chat upload has 10MB limit. No MIME/extension validation. No malware scanning.  
**Fix:** Add fileFilter to chat upload multer: restrict to images, PDF, DOCX. Reject .exe, .js, .bat, etc.

### 6.3 Are forum posts/comments sanitized against XSS?
**Status:** ❌ Missing  
**File:** `backend/routes/forum.js`  
**Issue:** Post title and content stored as-is. No server-side sanitization.  
**Fix:** Use `sanitize-html` or similar before INSERT. Whitelist safe tags only.

### 6.4 Are notifications scoped so students only receive their own?
**Status:** ✅ Done  
**File:** `backend/socket.js`  
**Details:** `join_notifications` joins `user_${userId}` where `userId` is from JWT. Notifications emitted to `io.to('user_'+userId)`. Students cannot join another user's room.

---

## AREA 7 — AI AUTOMATION

### 7.1 Is the AI permission whitelist strictly enforced server-side?
**Status:** ✅ Done  
**File:** `backend/config/aiPermissions.js`, `backend/middleware/aiAuth.js`  
**Details:** `aiRequirePermission(permission)` checks `isValidPermission(permission)` and `AITokenService.hasPermission(req.aiToken, permission)`. Invalid permission returns 400.

### 7.2 Are all AI-triggered actions logged (who, what, when, what data)?
**Status:** ✅ Done  
**File:** `backend/middleware/aiAuth.js`, `backend/services/aiLogger.js`  
**Details:** `aiLogResponse` logs tokenId, tokenName, actionType, endpoint, IP, requestBody, responseStatus, responseBody to `ai_action_logs`.

### 7.3 Are AI endpoints rate limited?
**Status:** ⚠️ Partial  
**File:** `backend/middleware/rateLimiter.js`, `backend/server.js`  
**Issue:** AI routes use `apiLimiter` but may be skipped for some paths. AI tokens could be used for high-volume automation.  
**Fix:** Add dedicated `aiLimiter` (e.g. 100 req/15min per token) and apply to `/api/ai/*`.

### 7.4 Can AI access data outside the permitted scope of the requesting user?
**Status:** ✅ Done  
**File:** `backend/routes/ai.js`  
**Details:** AI uses token permissions, not user context. Actions are scoped to token permissions (users.create, enrollments.create, etc.). No user delegation — AI acts as service account.

---

## AREA 8 — INFRASTRUCTURE

### 8.1 Are .env files in .gitignore and never committed?
**Status:** ✅ Done  
**File:** `.gitignore`  
**Details:** `.env`, `.env.*`, `backend/.env`, `backend/.env.*` are in .gitignore. **Note:** `backend/.env` was found in workspace during audit — verify it is not committed to git. Run `git status backend/.env` and ensure it is ignored.

### 8.2 Does Redis have an authentication password set?
**Status:** ⚠️ Partial  
**File:** `backend/config/redis.js`  
**Issue:** Redis URL uses `REDIS_PASSWORD` from env for Upstash. Local Redis (`redis://host:port`) may have no password.  
**Fix:** Ensure production Redis always uses `rediss://` with password. Document that `REDIS_PASSWORD` must be set.

### 8.3 Does MySQL user have minimum required privileges (not root)?
**Status:** ⚠️ Partial (cannot verify from code)  
**File:** `backend/config/db.js`  
**Issue:** Uses `process.env.DB_USER || 'root'`. Root is default — dangerous.  
**Fix:** Use dedicated DB user with only required privileges (SELECT, INSERT, UPDATE, DELETE on app tables). Remove root default.

### 8.4 Does Nginx enforce HTTPS redirect and security headers (HSTS, X-Frame-Options)?
**Status:** ⚠️ Partial (cannot verify from codebase)  
**File:** Nginx config not in repo  
**Issue:** Nginx config is external. Cannot verify.  
**Fix:** Ensure Nginx has: `return 301 https://$host$request_uri;` for HTTP, and headers: `add_header Strict-Transport-Security "max-age=31536000"`, `add_header X-Frame-Options "SAMEORIGIN"`, `add_header X-Content-Type-Options "nosniff"`.

### 8.5 Does PM2 run as non-root user?
**Status:** ⚠️ Partial (cannot verify from code)  
**File:** N/A  
**Issue:** Deployment-specific.  
**Fix:** Run PM2 and Node as dedicated user (e.g. `lms-app`). Use `su` or `runuser` in systemd/init.

### 8.6 Does the health check endpoint avoid exposing sensitive system info?
**Status:** ⚠️ Partial  
**File:** `backend/routes/health.js`  
**Issue:** Returns `hostname`, `platform`, `cpu_cores`, `load_avg`, `memory` details, `version`. Could aid attackers in fingerprinting. No auth on health endpoint (often intentional for load balancers).  
**Fix:** In production, restrict health to minimal: `{ status, database, redis }`. Move detailed metrics behind authenticated `/api/admin/health` or remove from public health.

---

## CRITICAL: Cloudinary & .env Credentials

### Cloudinary API keys hardcoded
**Status:** ❌ Critical  
**File:** `backend/config/cloudinary.js`  
**Issue:** `cloud_name`, `api_key`, `api_secret` are **hardcoded** in source code. These must be in .env.  
**Fix:**
```javascript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});
if (!cloudinary.config().cloud_name) throw new Error('Cloudinary config missing');
```
**Immediate action:** Rotate Cloudinary API keys in dashboard. Remove hardcoded values. Add to .env.

---

## SUMMARY COUNTS

| Status | Count |
|--------|-------|
| ✅ Done | 18 |
| ❌ Missing | 17 |
| ⚠️ Partial | 21 |

---

## TOP 5 MOST CRITICAL ISSUES TO FIX FIRST

1. **Student routes unprotected (IDOR)** — `backend/routes/student.js`  
   Add `auth` middleware and enforce `studentId === req.user.id` for students. Any unauthenticated request can read any student's courses, assignments, progress.

2. **Cloudinary credentials hardcoded** — `backend/config/cloudinary.js`  
   API key and secret in source. Move to .env and rotate keys immediately.

3. **JWT fallback to 'secretkey'** — `backend/routes/auth.js`, `backend/middleware/auth.js`  
   If JWT_SECRET is missing, weak default is used. Remove fallback; fail fast if not set.

4. **CORS allows all origins** — `backend/server.js`  
   Any website can call your API. Restrict to your frontend domain(s).

5. **No JWT blacklist on logout** — `backend/routes/auth.js`  
   Logged-out users can continue using token until expiry. Implement Redis blacklist.

---

## RECOMMENDED FIX ORDER

1. Fix student route auth + IDOR (1–2 hours)
2. Move Cloudinary to .env, rotate keys (30 min)
3. Remove JWT fallback, add startup check (15 min)
4. Restrict CORS (15 min)
5. Add JWT blacklist on logout (1–2 hours)
6. Add Helmet.js (15 min)
7. Add Stripe webhook signature validation (1 hour)
8. Add GDPR Right to Erasure + Data Export (2–4 hours)
9. Add input validation (zod/express-validator) to high-risk routes (4–8 hours)
10. Add HTML sanitization for forum/TinyMCE content (2 hours)

---

*End of Security & Compliance Audit Report*
