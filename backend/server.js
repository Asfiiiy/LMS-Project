// NOTE: All console.log and console.error calls
// have been removed from production code.
// For future debugging use:
//   if (process.env.NODE_ENV === 'development') {
//     console.log(...)
//   }
// Never log req.body, req.user, tokens, SQL queries,
// or any user personal data in any environment.

// Load .env FIRST (before db/pool) - fixes "Access denied for user 'root'" when PM2 cwd differs
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set in .env and be at least 32 characters');
}

process.on('unhandledRejection', (reason) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('Unhandled Rejection:', reason);
  }
});

process.on('uncaughtException', (err) => {
  if (
    err.message?.includes('enableOfflineQueue') ||
    err.message?.includes('Stream')
  ) {
    return;
  }
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

const express = require('express');
const cors = require('cors');
const http = require('http');
const initSocket = require('./socket');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const metrics = require('./utils/metrics');
const logger = require('./config/logger');
const { logSystemEvent } = require('./utils/eventLogger');
const pool = require('./config/db');
const { registerLogRotation } = require('./cron/logRotation');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Make io accessible to routes
app.set('io', io);

const corsOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim()).filter(Boolean)
  : process.env.NODE_ENV === 'production'
    ? ['https://lms.inspirelondoncollege.com', 'https://www.lms.inspirelondoncollege.com']
    : ['http://localhost:3000', 'http://localhost:5000'];
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(require('helmet')());
// Stripe webhook - must use raw body for signature verification (before express.json)
app.post('/api/webhook', express.raw({ type: 'application/json' }), require('./routes/paymentInstallments').stripeWebhookHandler);
// Increase body size limits for large file uploads (qualification course intro files)
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(require('cookie-parser')());
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
app.use('/api/health', require('./routes/health'));

// Server time for countdown timers (avoids client timezone drift)
app.get('/api/time', (req, res) => res.json({ serverTime: new Date().toISOString() }));

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
app.use('/api/onboarding', require('./routes/onboarding')); // Student onboarding flow
app.use('/api/documents', require('./routes/documentVerification')); // Document verification system
app.use('/api/staff', require('./routes/staffProfile')); // Staff profile routes (Admin, Tutor, Moderator)
app.use('/api', require('./routes/paymentInstallments')); // Payment installments routes
app.use('/api', require('./routes/paymentReminders')); // Payment reminders, pending/received, email templates
app.use('/api/chat', require('./routes/chat')); // Chat system
app.use('/api/tickets', require('./routes/tickets')); // Ticket system
app.use('/api/cpd', require('./routes/cpd')); // CPD Courses
app.use('/api/qualification', require('./routes/qualification')); // Qualification Courses
app.use('/api/manager', require('./routes/manager')); // Manager routes
app.use('/api/forum', require('./routes/forum')); // Forum system
app.use('/api/notifications', require('./routes/notifications')); // Notifications system
app.use('/api', require('./routes/consultations')); // Zoom video consultation booking
app.use('/api/admin/logs', require('./routes/logs')); // Logging routes (Admin Only)
app.use('/api/claim-manager', require('./routes/claimManager')); // Claim Manager
app.use('/api/consultation-manager', require('./routes/consultationManager')); // Consultation Manager
app.use('/api/consultation-messages', require('./routes/consultationMessages')); // Consultation messaging (chat + files)
app.use('/api/settings', require('./routes/settings')); // System settings (Stripe mode, etc.)
app.use('/api/certificates', require('./routes/certificates')); // Certificate claiming system
app.use('/api/certificate-templates', require('./routes/certificateTemplates')); // Certificate template management
app.use('/api/ai', require('./routes/ai')); // AI automation routes (AI token auth required)
app.use('/api/admin/ai-security', require('./routes/ai-security')); // AI security monitoring (Admin only)
app.use('/api/backup', require('./routes/backup')); // Database backup management (Admin only)
app.use('/api/email-templates', require('./routes/emailTemplates')); // Admin email templates & sends

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

// Register auto-reminder cron (runs hourly; checks interval in DB)
try {
  const { registerAutoReminder } = require('./cron/autoReminder');
  registerAutoReminder();
} catch (e) {
  console.warn('[Server] Auto-reminder cron not loaded:', e.message);
}

try {
  const { registerConsultationReminders } = require('./cron/consultationReminders');
  registerConsultationReminders(io);
} catch (e) {
  console.warn('[Server] Consultation reminders cron not loaded:', e.message);
}

try {
  const { registerDatabaseBackup } = require('./cron/databaseBackup');
  registerDatabaseBackup();
} catch (e) {
  console.warn('[Server] Database backup cron not loaded:', e.message);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, '127.0.0.1', () => {
  // startup log - safe to keep
  console.log(`✅ Server running on port ${PORT} (localhost only) with Socket.IO`);
  // Send ready signal to PM2 if running under PM2
  if (process.send) {
    process.send('ready');
  }
});
