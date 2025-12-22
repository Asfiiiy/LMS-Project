const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const initSocket = require('./socket');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const metrics = require('./utils/metrics');
const logger = require('./config/logger');
const { logSystemEvent } = require('./utils/eventLogger');
const pool = require('./config/db');
const { registerLogRotation } = require('./cron/logRotation');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Make io accessible to routes
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Serve uploaded files (legacy only - new files are stored in Cloudinary, not locally)
// This is kept for backward compatibility with any old files
app.use('/uploads', express.static('uploads'));

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/auth/login', authLimiter);

// Activity logging middleware (logs all requests to system_logs)
// Must be after rate limiting but before routes
app.use(require('./middleware/activityLogger'));

// Health check endpoint (before other routes)
app.use('/health', require('./routes/health'));

// Test endpoint for geoip-lite (remove in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test-geoip', require('./routes/test-geoip'));
}

// Routes
app.use('/api/login', require('./routes/auth')); // Auth route (login)
app.use('/api/users', require('./routes/users')); // Users CRUD
app.use('/api/courses', require('./routes/courses')); // Courses CRUD
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes); // Admin management
if (adminRoutes.tutorRouter) {
  app.use('/api/tutor', adminRoutes.tutorRouter); // Tutor routes
}
app.use('/api/student', require('./routes/student')); // Student-specific routes
app.use('/api/student', require('./routes/studentProfile')); // Student profile routes
app.use('/api', require('./routes/paymentInstallments')); // Payment installments routes
app.use('/api/chat', require('./routes/chat')); // Chat system
app.use('/api/cpd', require('./routes/cpd')); // CPD Courses
app.use('/api/qualification', require('./routes/qualification')); // Qualification Courses
app.use('/api/manager', require('./routes/manager')); // Manager routes
app.use('/api/forum', require('./routes/forum')); // Forum system
app.use('/api/notifications', require('./routes/notifications')); // Notifications system
app.use('/api/admin/logs', require('./routes/logs')); // Logging routes (Admin Only)
app.use('/api/certificates', require('./routes/certificates')); // Certificate claiming system
app.use('/api/certificate-templates', require('./routes/certificateTemplates')); // Certificate template management

// Global error handler with comprehensive logging
app.use((err, req, res, next) => {
  // Log error to pino
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user_id: req.user?.id || null,
    ip: req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0] || null
  }, '[GLOBAL ERROR]');

  // Record error metric
  metrics.recordError();

  // Log error to database (async, non-blocking)
  setImmediate(async () => {
    try {
      await logSystemEvent({
        userId: req.user?.id || null,
        action: 'system_error',
        description: `Error: ${err.message} - ${req.method} ${req.originalUrl}`,
        req
      });
    } catch (logErr) {
      // Don't crash if logging fails
      logger.error({ error: logErr.message }, '[Error Logger] Failed to log error to database');
    }
  });

  // Send response
  res.status(err.status || 500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' 
      ? "Internal Server Error" 
      : err.message 
  });
});

// Register log rotation cron job (runs daily at 3:00 AM UTC)
registerLogRotation(pool);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT} with Socket.IO`));
