# Critical Fixes - Quick Reference Guide

## 🚨 IMMEDIATE ACTION REQUIRED

These fixes must be implemented BEFORE scaling to 50,000+ users.

---

## 1. Add Pagination (PRIORITY 0)

### Affected Endpoints:

```javascript
// ❌ BEFORE (Will crash with 50k users)
router.get('/users', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM users ORDER BY created_at DESC');
  res.json({ users: rows }); // Returns ALL users!
});

// ✅ AFTER (Pagination added)
router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  // Get total count
  const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM users');
  const total = countResult[0].total;
  
  // Get paginated results
  const [rows] = await pool.execute(`
    SELECT * FROM users 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `, [limit, offset]);
  
  res.json({ 
    users: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});
```

### Endpoints to Fix:
- [ ] `GET /api/admin/users`
- [ ] `GET /api/admin/students`
- [ ] `GET /api/admin/courses`
- [ ] `GET /api/admin/all-assignment-submissions`
- [ ] `GET /api/admin/all-quiz-attempts`
- [ ] `GET /api/admin/tutor/:tutorId/assignment-submissions`
- [ ] `GET /api/admin/tutor/:tutorId/quiz-attempts`
- [ ] `GET /api/student/:studentId/courses`
- [ ] `GET /api/student/:studentId/assignments`
- [ ] `GET /api/cpd/list`
- [ ] `GET /api/qualification/submissions/all`
- [ ] `GET /api/chat/conversations/:userId`

---

## 2. Fix N+1 Query Problems (PRIORITY 0)

### Example 1: Student CPD Courses

**❌ BEFORE (N+1 Problem):**
```javascript
// student.js - GET /:studentId/cpd-courses
const [enrollments] = await pool.execute(/* get courses */);
const coursesWithProgress = await Promise.all(
  enrollments.map(async (course) => {
    // ❌ This runs for EACH course (N queries)
    const [topics] = await pool.execute(
      `SELECT t.*, p.final_quiz_passed FROM cpd_topics t
       LEFT JOIN cpd_progress p ON t.id = p.topic_id AND p.student_id = ?
       WHERE t.course_id = ?`,
      [studentId, course.course_id]
    );
    return { ...course, topics };
  })
);
```

**✅ AFTER (Single Query):**
```javascript
// Get all data in one query
const [coursesWithTopics] = await pool.execute(`
  SELECT 
    c.id as course_id, c.title as course_title, c.description,
    t.id as topic_id, t.title as topic_title, t.order_index,
    p.final_quiz_passed, p.completed_at
  FROM course_assignments ca
  JOIN courses c ON ca.course_id = c.id
  LEFT JOIN cpd_topics t ON t.course_id = c.id
  LEFT JOIN cpd_progress p ON p.topic_id = t.id AND p.student_id = ?
  WHERE ca.student_id = ? AND c.course_type = 'cpd'
  ORDER BY c.id, t.order_index
`, [studentId, studentId]);

// Group by course in JavaScript
const grouped = coursesWithTopics.reduce((acc, row) => {
  if (!acc[row.course_id]) {
    acc[row.course_id] = {
      course_id: row.course_id,
      course_title: row.course_title,
      description: row.description,
      topics: []
    };
  }
  if (row.topic_id) {
    acc[row.course_id].topics.push({
      id: row.topic_id,
      title: row.topic_title,
      order_index: row.order_index,
      progress: { final_quiz_passed: row.final_quiz_passed }
    });
  }
  return acc;
}, {});

const coursesWithProgress = Object.values(grouped);
```

### Example 2: Unit Progress

**❌ BEFORE:**
```javascript
// Fetches units, then queries progress for each
const [units] = await pool.execute('SELECT * FROM units WHERE course_id = ?', [courseId]);
for (const unit of units) {
  const [progress] = await pool.execute(
    'SELECT * FROM unit_progress WHERE student_id = ? AND unit_id = ?',
    [studentId, unit.id]
  );
  unit.progress = progress[0];
}
```

**✅ AFTER:**
```javascript
// Single query with JOIN
const [unitsWithProgress] = await pool.execute(`
  SELECT 
    u.*,
    up.is_unlocked, up.unlocked_at, up.is_completed, up.completed_at
  FROM units u
  LEFT JOIN unit_progress up ON up.unit_id = u.id AND up.student_id = ?
  WHERE u.course_id = ?
  ORDER BY u.order_index
`, [studentId, courseId]);
```

### N+1 Problems to Fix:
- [ ] `GET /:studentId/courses/:courseId/units` (student.js)
- [ ] `GET /:studentId/cpd-courses` (student.js)
- [ ] `GET /courses/:id/detail` (admin.js)
- [ ] `GET /:courseId/student/:studentId` (cpd.js)
- [ ] `GET /conversations/:userId` (chatController.js)

---

## 3. Add Database Indexes (PRIORITY 0)

**Run the SQL file:**
```bash
mysql -u root -p db_lms < backend/migrations/add_performance_indexes.sql
```

Or run it manually in MySQL:
```sql
-- Critical indexes for course_assignments (most queried table)
CREATE INDEX idx_course_assignments_student_id ON course_assignments(student_id);
CREATE INDEX idx_course_assignments_course_id ON course_assignments(course_id);
CREATE INDEX idx_course_assignments_student_course ON course_assignments(student_id, course_id);

-- Critical indexes for unit_progress
CREATE INDEX idx_unit_progress_student_id ON unit_progress(student_id);
CREATE INDEX idx_unit_progress_student_course ON unit_progress(student_id, course_id);
CREATE INDEX idx_unit_progress_student_unit ON unit_progress(student_id, unit_id);

-- Critical indexes for users
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Critical indexes for courses
CREATE INDEX idx_courses_course_type ON courses(course_type);
CREATE INDEX idx_courses_created_at ON courses(created_at);
CREATE INDEX idx_courses_type_status ON courses(course_type, status);
```

**See full list in:** `backend/migrations/add_performance_indexes.sql`

---

## 4. Increase Connection Pool (PRIORITY 1)

**❌ BEFORE:**
```javascript
// config/db.js
const pool = mysql.createPool({
  connectionLimit: 10,  // ❌ Too small
  queueLimit: 0         // ❌ Unlimited queue
});
```

**✅ AFTER:**
```javascript
// config/db.js
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_lms',
  waitForConnections: true,
  connectionLimit: 50,        // ✅ Increased
  queueLimit: 100,            // ✅ Limited queue
  acquireTimeout: 60000,      // 60 seconds
  timeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});
```

---

## 5. Add Rate Limiting (PRIORITY 1)

**Install:**
```bash
npm install express-rate-limit
```

**Add to server.js:**
```javascript
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.'
});

app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/auth/login', authLimiter);
```

---

## 6. Add Request Validation (PRIORITY 2)

**Install:**
```bash
npm install express-validator
```

**Example:**
```javascript
const { body, validationResult } = require('express-validator');

router.post('/users', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty(),
  body('role_id').isInt({ min: 1, max: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // ... rest of handler
});
```

---

## 7. Add Query Timeouts (PRIORITY 2)

**Create middleware:**
```javascript
// middleware/queryTimeout.js
const queryTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ 
          success: false, 
          message: 'Request timeout' 
        });
      }
    }, timeout);
    
    res.on('finish', () => clearTimeout(timer));
    next();
  };
};

module.exports = queryTimeout;
```

**Use in routes:**
```javascript
const queryTimeout = require('../middleware/queryTimeout');

router.get('/users', queryTimeout(10000), async (req, res) => {
  // ... handler
});
```

---

## 8. Add Auth Middleware to Protected Routes (PRIORITY 1)

**❌ BEFORE:**
```javascript
// admin.js - NO AUTH!
router.get('/users', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM users');
  res.json({ users: rows });
});
```

**✅ AFTER:**
```javascript
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');

// Require authentication
router.get('/users', auth, permit('Admin'), async (req, res) => {
  // ... handler
});
```

**Routes to fix:**
- [ ] All routes in `admin.js` (add auth + role checks)
- [ ] All routes in `cpd.js` (add auth where needed)
- [ ] All routes in `qualification.js` (add auth where needed)

---

## 9. Implement Caching (PRIORITY 1)

**Install Redis:**
```bash
npm install redis
```

**Create cache middleware:**
```javascript
// middleware/cache.js
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await client.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        client.setex(key, duration, JSON.stringify(data));
        return originalJson(data);
      };
      
      next();
    } catch (err) {
      next(); // Continue without cache if Redis fails
    }
  };
};

module.exports = cacheMiddleware;
```

**Use in routes:**
```javascript
const cache = require('../middleware/cache');

// Cache for 5 minutes
router.get('/courses', cache(300), async (req, res) => {
  // ... handler
});
```

---

## 10. Add Structured Logging (PRIORITY 2)

**Install:**
```bash
npm install winston
```

**Create logger:**
```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

**Use in routes:**
```javascript
const logger = require('../utils/logger');

router.get('/users', async (req, res) => {
  const startTime = Date.now();
  try {
    const [rows] = await pool.execute('SELECT * FROM users');
    const duration = Date.now() - startTime;
    
    logger.info('Users fetched', { 
      count: rows.length, 
      duration,
      userId: req.user?.id 
    });
    
    res.json({ users: rows });
  } catch (err) {
    logger.error('Error fetching users', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## Testing Checklist

After implementing fixes, test:

- [ ] Pagination works on all list endpoints
- [ ] No N+1 queries (check query logs)
- [ ] Indexes are created (run `SHOW INDEXES FROM table_name`)
- [ ] Connection pool handles concurrent requests
- [ ] Rate limiting prevents abuse
- [ ] Auth middleware protects routes
- [ ] Caching reduces database load
- [ ] Logging captures errors and slow queries

---

## Performance Benchmarks

**Before fixes:**
- `GET /api/admin/users`: ~5-10 seconds (50k users)
- `GET /api/admin/all-assignment-submissions`: ~30+ seconds (crashes)
- `GET /api/student/:id/cpd-courses`: ~3-5 seconds (N+1 queries)

**After fixes (target):**
- `GET /api/admin/users`: <500ms (with pagination)
- `GET /api/admin/all-assignment-submissions`: <1 second (with pagination + indexes)
- `GET /api/student/:id/cpd-courses`: <500ms (single query + indexes)

---

## Deployment Order

1. **Week 1:** Add indexes (no code changes, safe)
2. **Week 2:** Add pagination to critical endpoints
3. **Week 3:** Fix N+1 queries
4. **Week 4:** Increase connection pool, add rate limiting
5. **Week 5:** Add caching
6. **Week 6:** Add logging and monitoring

---

## Monitoring

After deployment, monitor:
- Database query times
- Connection pool usage
- Memory usage
- Response times
- Error rates

Set up alerts for:
- Query time > 1 second
- Connection pool > 80% usage
- Memory usage > 80%
- Error rate > 1%

