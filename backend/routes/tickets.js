const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const ticketController = require('../controllers/ticketController');

// Multer for ticket file uploads (memory storage for Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// All routes require auth
router.use(auth);

// Public-ish (student can create)
router.get('/departments', ticketController.getDepartments);
router.get('/categories', ticketController.getCategories);
router.get('/agents', ticketController.getAgents);

// Ticket file upload (before :id to avoid conflict)
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Max 10MB.' });
    }
    if (err) return next(err);
    ticketController.uploadFile(req, res, next);
  });
});

// Team management (Operation Manager, etc.) - must be before /:id
router.get('/team', ticketController.getMyTeam);
router.get('/team/available', ticketController.getAvailableForTeam);
router.post('/team', ticketController.addToTeam);
router.post('/team/create', ticketController.createTeamMember);
router.delete('/team/:userId', ticketController.removeFromTeam);

// Ticket CRUD
router.post('/', ticketController.createTicket);
router.get('/', ticketController.getTickets);
router.get('/stats', ticketController.getStats);
router.get('/student/:studentId/academic-progress', ticketController.getStudentAcademicProgress);
router.get('/student/:studentId/qual-progress', ticketController.getStudentQualProgress);
router.get('/student/:studentId/payment-installments', ticketController.getStudentPaymentInstallments);
router.get('/students', ticketController.getStudents);
router.patch('/students/:studentId', ticketController.updateStudentCredentials);
router.get('/courses', ticketController.getTicketsCourses);
router.get('/course-categories', ticketController.getTicketsCourseCategories);
router.get('/:id', ticketController.getTicket);

// Actions
router.post('/:id/claim', ticketController.claimTicket);
router.put('/:id/status', ticketController.updateStatus);
router.put('/:id/reassign', ticketController.reassignTicket);
router.put('/:id/transfer', ticketController.transferTicket);
router.get('/:id/escalate-agents', ticketController.getEscalateAgents);
router.post('/:id/escalate', ticketController.escalateTicket);
router.post('/:id/messages', ticketController.addMessage);
router.put('/:id/messages/:messageId', ticketController.editTicketMessage);
router.delete('/:id/messages/:messageId', ticketController.deleteTicketMessage);
router.post('/:id/mark-read', ticketController.markTicketMessagesRead);
router.post('/:id/notes', ticketController.addInternalNote);

module.exports = router;
