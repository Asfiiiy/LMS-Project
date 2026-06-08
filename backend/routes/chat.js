const express = require("express");
const router = express.Router();
const multer = require("multer");
const auth = require("../middleware/auth");
const chatController = require("../controllers/chatController");
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

router.use(auth);

// Multer config for file upload (memory storage for Cloudinary) - images, PDF, DOCX only
const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
];
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max (Cloudinary free tier for chat)
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Only images (JPEG, PNG, GIF, WebP), PDF, and DOCX are accepted. Received: ${file.mimetype}`));
    }
  }
});

// Conversation routes
router.post("/start", chatController.startConversation);
router.get("/conversations/:userId", cacheMiddleware(10), chatController.getUserConversations);
router.get("/conversation/:conversationId", chatController.getConversationById);
router.get("/conversations/:userId/unread-count", chatController.getUnreadConversationCount);
router.get("/users/all", chatController.getAllUsers);
router.get("/user/:userId/profile", chatController.getUserProfile);
router.get("/merged-ticket-messages", chatController.getMergedTicketMessages);
router.get("/:conversationId", cacheMiddleware(3), chatController.getMessages);

// Message routes
router.post("/message", chatController.sendMessage);
router.put("/message/edit", chatController.editMessage);
router.delete("/message/delete", chatController.deleteMessage);
// Handle multer LIMIT_FILE_SIZE so we return a clean JSON message (Cloudinary free tier 10MB)
router.post("/upload", (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Chat files are limited to 10MB (Cloudinary free tier). Please use a smaller file or compress it.'
      });
    }
    if (err && err.message && err.message.includes('File type not allowed')) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    if (err) return next(err);
    chatController.uploadFile(req, res, next);
  });
});
router.post("/mark-read", chatController.markAsRead);

module.exports = router;
