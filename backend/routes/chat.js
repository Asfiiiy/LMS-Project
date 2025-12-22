const express = require("express");
const router = express.Router();
const multer = require("multer");
const chatController = require("../controllers/chatController");
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// Multer config for file upload (memory storage for Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common document types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed!'));
    }
  }
});

// Conversation routes
router.post("/start", chatController.startConversation);
router.get("/conversations/:userId", cacheMiddleware(10), chatController.getUserConversations);
router.get("/users/all", chatController.getAllUsers);
router.get("/:conversationId", cacheMiddleware(3), chatController.getMessages);

// Message routes
router.post("/message", chatController.sendMessage);
router.post("/upload", upload.single('file'), chatController.uploadFile);
router.post("/mark-read", chatController.markAsRead);

module.exports = router;
