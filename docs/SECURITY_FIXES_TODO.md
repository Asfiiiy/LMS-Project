# Security Fixes — Detailed To-Do List

**Source:** `docs/fixes.md`  
**Order:** Execute one by one. Wait for confirmation before moving to next.

---

## Rules (from fixes.md)

- Before fixing anything, **CHECK THE ACTUAL CODE FIRST**
- If it's already fixed → say "Already done, skipping" and move on
- Fix **one issue at a time**, show exact code change
- After each fix, tell how to **test it**
- Do not break existing functionality
- Keep the same code style as the existing codebase

---

## FIX #1 — Student Routes IDOR

**File:** `backend/routes/student.js`

**Check:**
- [ ] Does `router.use(auth)` exist at the top?
- [ ] Does every route with `:studentId` verify `req.user.id === studentId` (for students) or allow staff/admin/tutor?

**If missing, do:**
1. Add `router.use(auth)` at top of student router (after imports, before routes)
2. Create helper: `canAccessStudent(req, studentId)` — returns true if user is staff OR (student and user.id === studentId)
3. Add ownership check to all routes that use `:studentId`:
   - `GET /:studentId/courses`
   - `GET /:studentId/assignments`
   - `GET /:studentId/courses/:courseId/units`
   - `POST /:studentId/courses/:courseId/units/:unitId/complete`
   - `GET /:studentId/cpd/courses`
   - `GET /:studentId/cpd/courses/:courseId/progress`
   - `GET /:studentId/qualification/courses`
   - `GET /:studentId/qualification/courses/:courseId`
   - Any other `:studentId` routes

**Test:**
- `GET /api/student/999/courses` without token → **401**
- `GET /api/student/999/courses` with valid token for student 5 → **403**
- `GET /api/student/5/courses` with valid token for student 5 → **200**

**When done:** Say "FIX #1 COMPLETE — ready for #2?" and wait for "go"

---

## FIX #2 — Cloudinary Keys Hardcoded

**File:** `backend/config/cloudinary.js`

**Check:**
- [ ] Are `cloud_name`, `api_key`, `api_secret` hardcoded?

**If yes, do:**
1. Replace with `process.env.CLOUDINARY_CLOUD_NAME`, `process.env.CLOUDINARY_API_KEY`, `process.env.CLOUDINARY_API_SECRET`
2. Add startup check: throw if any missing
3. Add to `.env`:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
4. **Rotate Cloudinary API keys** in dashboard immediately after deploy

**When done:** Say "FIX #2 COMPLETE — ready for #3?" and wait for "go"

---

## FIX #3 — JWT Weak Fallback

**Files:** `backend/routes/auth.js`, `backend/middleware/auth.js`, `backend/server.js`

**Check:**
- [ ] Search for `process.env.JWT_SECRET || 'secretkey'` or similar fallback

**If found, do:**
1. Remove fallback entirely — use `process.env.JWT_SECRET` only
2. In `backend/server.js` (near top, after dotenv load), add:
   ```js
   if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
     throw new Error('JWT_SECRET must be set in .env and be at least 32 characters');
   }
   ```
3. Ensure `.env` has `JWT_SECRET` with 32+ random chars

**When done:** Say "FIX #3 COMPLETE — ready for #4?" and wait for "go"

---

## FIX #4 — CORS Open to All Origins

**File:** `backend/server.js`

**Check:**
- [ ] Is `app.use(cors())` with no options?

**If yes, do:**
1. Replace with:
   ```js
   app.use(cors({
     origin: process.env.FRONTEND_URL
       ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
       : process.env.NODE_ENV === 'production'
         ? ['https://lms.inspirelondoncollege.com']
         : ['http://localhost:3000'],
     credentials: true
   }));
   ```
2. Add to `.env`: `FRONTEND_URL=https://lms.inspirelondoncollege.com` (or comma-separated for multiple)

**When done:** Say "FIX #4 COMPLETE — ready for #5?" and wait for "go"

---

## FIX #5 — JWT Blacklist on Logout

**Files:** `backend/routes/auth.js`, `backend/middleware/auth.js`

**Check:**
- [ ] Does logout add token to Redis blacklist?
- [ ] Does auth middleware check blacklist before `jwt.verify`?

**If missing, do:**
1. In logout route: `const token = req.headers.authorization?.split(' ')[1]`; if token, decode and `redis.setex('jwt_blacklist:' + token, ttl, '1')`
2. In auth middleware: before `jwt.verify`, check `redis.get('jwt_blacklist:' + token)` — if truthy, return 401
3. Use `backend/config/redis.js` Redis instance (ensure it exists)

**When done:** Say "FIX #5 COMPLETE — ready for #6?" and wait for "go"

---

## FIX #6 — Add Helmet.js

**File:** `backend/server.js`

**Check:**
- [ ] Is `helmet` installed? (`npm list helmet` in backend)
- [ ] Is `app.use(require('helmet')())` after cors?

**If not, do:**
1. `cd backend && npm install helmet`
2. Add `app.use(require('helmet')())` right after `app.use(cors(...))`

**When done:** Say "FIX #6 COMPLETE — ready for #7?" and wait for "go"

---

## FIX #7 — Stripe Webhook Signature Validation

**Files:** `backend/routes/paymentInstallments.js`, `backend/routes/certificates.js`

**Check:**
- [ ] Is there a webhook route using `stripe.webhooks.constructEvent()`?

**If missing, do:**
1. Add route in `paymentInstallments.js` (or wherever Stripe webhooks are handled):
   ```js
   router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
     const sig = req.headers['stripe-signature'];
     try {
       const event = stripe.webhooks.constructEvent(
         req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
       );
       // handle event types (payment_intent.succeeded, etc.)
       res.json({ received: true });
     } catch (err) {
       return res.status(400).json({ error: 'Webhook signature invalid' });
     }
   });
   ```
2. Ensure this route is **before** `express.json()` or use a separate path that gets raw body
3. Add `STRIPE_WEBHOOK_SECRET` to .env (from Stripe Dashboard → Webhooks → endpoint secret)

**When done:** Say "FIX #7 COMPLETE — ready for #8?" and wait for "go"

---

## FIX #8 — GDPR Right to Erasure + Data Export

**Check:**
- [ ] Does `DELETE /api/admin/gdpr/erasure/:userId` exist?
- [ ] Does `GET /api/student/profile/export` exist?

**If erasure missing, do:**
1. Create `backend/routes/gdpr.js` (or add to admin routes)
2. Admin-only route that:
   - Anonymizes `users` (name → 'DELETED', email → 'deleted_'+id+'@deleted.com')
   - Anonymizes `student_profiles`, `student_initial_assessments`
   - Deletes Cloudinary files (user documents, profile pics)
   - Logs erasure with admin ID, timestamp, userId

**If export missing, do:**
1. Add `GET /api/student/profile/export` (auth, student only)
2. Return JSON: profile, enrollments, assignment submissions metadata (no file contents)

**When done:** Say "FIX #8 COMPLETE — ready for #9?" and wait for "go"

---

## FIX #9 — Input Validation on High Risk Routes

**Check:**
- [ ] Is `express-validator` installed?

**If not:**
1. `cd backend && npm install express-validator`

**Add validation to these 3 routes:**
1. **POST /api/login** — validate email format, password not empty
2. **POST /api/admin/users** (create user) — validate name, email, role
3. **POST /api/qualification/...** (assignment submit) — validate required fields

For each, add validation middleware before handler. Show pattern once, then apply to all 3.

**When done:** Say "FIX #9 COMPLETE — ready for #10?" and wait for "go"

---

## FIX #10 — HTML Sanitization (XSS Prevention)

**Check:**
- [ ] Is `sanitize-html` installed?

**If not:**
1. `cd backend && npm install sanitize-html`

**Find and sanitize HTML in:**
- `backend/routes/forum.js` — post title, content
- `backend/routes/qualification.js` — assignment descriptions
- `backend/routes/cpd.js` — course content

For each INSERT/UPDATE that stores HTML:
```js
const sanitizeHtml = require('sanitize-html');
const clean = sanitizeHtml(req.body.content, {
  allowedTags: ['p','b','i','u','a','ul','ol','li','br','strong','em'],
  allowedAttributes: { a: ['href'] }
});
```

**When done:** Say "ALL 10 FIXES COMPLETE" and provide final summary:
- What was already done (skipped)
- What was fixed in this session
- Future task list: GDPR data encryption, data retention policy, account lockout, Cloudinary private URLs

---

## Progress Tracker

| # | Fix | Status |
|---|-----|--------|
| 1 | Student Routes IDOR | ⬜ Pending |
| 2 | Cloudinary Keys | ⬜ Pending |
| 3 | JWT Fallback | ⬜ Pending |
| 4 | CORS | ⬜ Pending |
| 5 | JWT Blacklist | ⬜ Pending |
| 6 | Helmet.js | ⬜ Pending |
| 7 | Stripe Webhook | ⬜ Pending |
| 8 | GDPR Erasure + Export | ⬜ Pending |
| 9 | Input Validation | ⬜ Pending |
| 10 | HTML Sanitization | ⬜ Pending |

---

## Future Tasks (after 10 fixes)

- [ ] GDPR data encryption at rest (MySQL TDE or app-level)
- [ ] Data retention policy
- [ ] Account lockout after failed logins
- [ ] Cloudinary private URLs (signed, expiring)
