const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { invalidateCache } = require('../middleware/cache');
const { createNotification } = require('../utils/notificationHelper');
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');

// Configure multer for document uploads
const documentStorage = multer.memoryStorage();

const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'));
    }
  }
});

// Helper function to upload document to Cloudinary
async function uploadDocumentToCloudinary(file, userId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `lms/student-documents/${userId}`,
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(file.buffer);
  });
}

// Helper to create admin notification
async function createAdminNotification(type, title, message, data) {
  try {
    await pool.execute(
      `INSERT INTO admin_notifications (type, title, message, data, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [type, title, message, JSON.stringify(data)]
    );
    console.log('Admin notification created:', { type, title });
  } catch (error) {
    console.error('Error creating admin notification:', error);
  }
}

// Helper to add document history
async function addDocumentHistory(documentId, action, performedBy, previousStatus, newStatus, comments) {
  try {
    await pool.execute(
      `INSERT INTO document_verification_history 
       (document_id, action, performed_by, previous_status, new_status, comments, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [documentId, action, performedBy, previousStatus, newStatus, comments]
    );
  } catch (error) {
    console.error('Error adding document history:', error);
  }
}

// GET /api/documents/student/:studentId - Get all documents for a student (Admin view)
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const userRole = req.user?.role;

    // Check admin authorization
    const adminRoles = ['Admin', 'Certificate Manager', 'Admission Manager', 'Accounts Manager', 'Operation Manager'];
    if (!adminRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // First check if the new verification columns exist
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'student_documents' 
       AND COLUMN_NAME IN ('status', 'verified_by', 'replaced_by', 'version')`
    );

    const columnsExist = columns.length >= 4;

    let documents;
    if (columnsExist) {
      // New query with verification columns
      [documents] = await pool.execute(
        `SELECT 
          d.*,
          u.name as verified_by_name,
          rd.file_name as replaced_by_file_name
        FROM student_documents d
        LEFT JOIN users u ON d.verified_by = u.id
        LEFT JOIN student_documents rd ON d.replaced_by = rd.id
        WHERE d.user_id = ?
        ORDER BY d.document_type, d.version DESC, d.uploaded_at DESC`,
        [studentId]
      );
    } else {
      // Fallback to old query without verification columns
      [documents] = await pool.execute(
        `SELECT 
          d.*,
          'pending' as status,
          NULL as rejection_reason,
          NULL as verified_by,
          NULL as verified_at,
          NULL as replaced_by,
          1 as version,
          NULL as previous_version_id,
          NULL as verified_by_name,
          NULL as replaced_by_file_name
        FROM student_documents d
        WHERE d.user_id = ?
        ORDER BY d.document_type, d.uploaded_at DESC`,
        [studentId]
      );
    }

    // Get student name
    const [studentRows] = await pool.execute(
      'SELECT name FROM users WHERE id = ?',
      [studentId]
    );

    res.json({
      success: true,
      student: studentRows.length > 0 ? studentRows[0] : null,
      documents: documents,
      migrationNeeded: !columnsExist
    });
  } catch (error) {
    console.error('Error fetching student documents:', error);
    res.status(500).json({ success: false, message: 'Error fetching documents', error: error.message });
  }
});

// GET /api/documents/my-documents - Get current student's own documents
router.get('/my-documents', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // First check if the verification columns exist
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'student_documents' 
       AND COLUMN_NAME IN ('status', 'rejection_reason', 'verified_by', 'verified_at', 'replaced_by', 'version', 'previous_version_id')`
    );

    const columnsExist = columns.length >= 7;

    let documents;
    if (columnsExist) {
      // New query with verification columns
      [documents] = await pool.execute(
        `SELECT 
          d.*,
          u.name as verified_by_name,
          rd.file_name as replaced_by_file_name
        FROM student_documents d
        LEFT JOIN users u ON d.verified_by = u.id
        LEFT JOIN student_documents rd ON d.replaced_by = rd.id
        WHERE d.user_id = ? AND d.status != 'replaced'
        ORDER BY d.document_type, d.uploaded_at DESC`,
        [userId]
      );
    } else {
      // Fallback to old query without verification columns
      [documents] = await pool.execute(
        `SELECT 
          d.*,
          'pending' as status,
          NULL as rejection_reason,
          NULL as verified_by,
          NULL as verified_at,
          NULL as replaced_by,
          1 as version,
          NULL as previous_version_id,
          NULL as verified_by_name,
          NULL as replaced_by_file_name
        FROM student_documents d
        WHERE d.user_id = ?
        ORDER BY d.document_type, d.uploaded_at DESC`,
        [userId]
      );
    }

    // Calculate verification progress
    const totalDocs = documents.length;
    const approvedDocs = documents.filter(d => d.status === 'approved').length;
    const rejectedDocs = documents.filter(d => d.status === 'rejected').length;
    const pendingDocs = documents.filter(d => d.status === 'pending').length;
    const progress = totalDocs > 0 ? Math.round((approvedDocs / totalDocs) * 100) : 0;

    res.json({
      success: true,
      documents: documents,
      stats: {
        total: totalDocs,
        approved: approvedDocs,
        rejected: rejectedDocs,
        pending: pendingDocs,
        progress: progress
      },
      migrationNeeded: !columnsExist
    });
  } catch (error) {
    console.error('Error fetching my documents:', error);
    res.status(500).json({ success: false, message: 'Error fetching documents', error: error.message });
  }
});

// GET /api/documents/:documentId/history - Get document verification history
router.get('/:documentId/history', auth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    
    const [history] = await pool.execute(
      `SELECT 
        h.*,
        u.name as performed_by_name
      FROM document_verification_history h
      LEFT JOIN users u ON h.performed_by = u.id
      WHERE h.document_id = ?
      ORDER BY h.created_at DESC`,
      [documentId]
    );

    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('Error fetching document history:', error);
    res.status(500).json({ success: false, message: 'Error fetching history' });
  }
});

// POST /api/documents/verify/:documentId - Verify (approve/reject) a document
router.post('/verify/:documentId', auth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const { action, reason } = req.body; // action: 'approve' or 'reject'
    const adminId = req.user?.id;
    const userRole = req.user?.role;

    // Check authorization
    const adminRoles = ['Admin', 'Certificate Manager', 'Admission Manager', 'Accounts Manager', 'Operation Manager'];
    if (!adminRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    if (action === 'reject' && !reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    // Get document details
    const [docRows] = await pool.execute(
      'SELECT * FROM student_documents WHERE id = ?',
      [documentId]
    );

    if (docRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const document = docRows[0];
    const previousStatus = document.status || 'pending';
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update document status
    await pool.execute(
      `UPDATE student_documents 
       SET status = ?, rejection_reason = ?, verified_by = ?, verified_at = NOW()
       WHERE id = ?`,
      [newStatus, action === 'reject' ? reason : null, adminId, documentId]
    );

    // Add to history (action column is ENUM: 'uploaded','approved','rejected','replaced')
    await addDocumentHistory(
      documentId,
      action === 'approve' ? 'approved' : 'rejected',
      adminId,
      previousStatus,
      newStatus,
      reason || null
    );

    if (action === 'reject') {
      await pool.execute(
        `UPDATE student_onboarding_status
         SET profile_status = 'review',
             verification_requested_at = COALESCE(verification_requested_at, NOW()),
             updated_at = NOW()
         WHERE user_id = ?
           AND (profile_status IS NULL OR profile_status <> 'verified')`,
        [document.user_id]
      );
      await pool.execute(
        `UPDATE users
         SET onboarding_profile_status = 'review'
         WHERE id = ?
           AND (onboarding_profile_status IS NULL OR onboarding_profile_status <> 'verified')`,
        [document.user_id]
      );
      await createNotification({
        userId: document.user_id,
        type: 'file_rejected',
        title: 'Document requires attention',
        message: `Your ${document.document_type} document was not approved. Reason: ${reason}. Please upload a new document.`,
        relatedUserId: adminId,
        req
      });
      await invalidateCache('cache:/api/admin/students/profiles*');
      await invalidateCache('cache:/api/tutor/students/profiles*');
    }

    res.json({
      success: true,
      message: `Document ${action}d successfully`
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ success: false, message: 'Error verifying document' });
  }
});

// POST /api/documents/verify-bulk - Bulk verify documents
router.post('/verify-bulk', auth, async (req, res) => {
  try {
    const { documentIds, action, reason } = req.body;
    const adminId = req.user?.id;
    const userRole = req.user?.role;

    // Check authorization
    const adminRoles = ['Admin', 'Certificate Manager', 'Admission Manager', 'Accounts Manager', 'Operation Manager'];
    if (!adminRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Document IDs required' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    if (action === 'reject' && !reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason required for bulk reject' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    let updated = 0;
    const bulkRejectByUser = new Map();

    for (const documentId of documentIds) {
      const [docRows] = await pool.execute(
        'SELECT * FROM student_documents WHERE id = ?',
        [documentId]
      );

      if (docRows.length > 0) {
        const docRow = docRows[0];
        const previousStatus = docRow.status || 'pending';

        await pool.execute(
          `UPDATE student_documents 
           SET status = ?, rejection_reason = ?, verified_by = ?, verified_at = NOW()
           WHERE id = ?`,
          [newStatus, action === 'reject' ? reason : null, adminId, documentId]
        );

        await addDocumentHistory(
          documentId,
          action === 'approve' ? 'approved' : 'rejected',
          adminId,
          previousStatus,
          newStatus,
          reason || null
        );

        if (action === 'reject') {
          await pool.execute(
            `UPDATE student_onboarding_status
             SET profile_status = 'review',
                 verification_requested_at = COALESCE(verification_requested_at, NOW()),
                 updated_at = NOW()
             WHERE user_id = ?
               AND (profile_status IS NULL OR profile_status <> 'verified')`,
            [docRow.user_id]
          );
          await pool.execute(
            `UPDATE users
             SET onboarding_profile_status = 'review'
             WHERE id = ?
               AND (onboarding_profile_status IS NULL OR onboarding_profile_status <> 'verified')`,
            [docRow.user_id]
          );
          bulkRejectByUser.set(docRow.user_id, {
            document_type: docRow.document_type,
            reason: reason || ''
          });
        }

        updated++;
      }
    }

    if (action === 'reject' && bulkRejectByUser.size > 0) {
      for (const [studentUserId, info] of bulkRejectByUser) {
        await createNotification({
          userId: studentUserId,
          type: 'file_rejected',
          title: 'Document requires attention',
          message: `Your ${info.document_type} document was not approved. Reason: ${info.reason}. Please upload a new document.`,
          relatedUserId: adminId,
          req
        });
      }
      await invalidateCache('cache:/api/admin/students/profiles*');
      await invalidateCache('cache:/api/tutor/students/profiles*');
    }

    res.json({
      success: true,
      message: `${updated} document(s) ${action}d successfully`,
      updated: updated
    });
  } catch (error) {
    console.error('Error bulk verifying documents:', error);
    res.status(500).json({ success: false, message: 'Error bulk verifying documents' });
  }
});

// POST /api/documents/replace/:documentId - Student uploads new version of rejected document
router.post('/replace/:documentId', auth, documentUpload.single('file'), async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const userId = req.user?.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Get original document
    const [docRows] = await pool.execute(
      'SELECT * FROM student_documents WHERE id = ? AND user_id = ?',
      [documentId, userId]
    );

    if (docRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const originalDoc = docRows[0];

    // Only allow replacing rejected documents
    if (originalDoc.status !== 'rejected') {
      return res.status(400).json({ success: false, message: 'Can only replace rejected documents' });
    }

    // Upload new file to Cloudinary
    const uploadResult = await uploadDocumentToCloudinary(file, userId);

    // Create new document record
    const [insertResult] = await pool.execute(
      `INSERT INTO student_documents 
       (user_id, document_type, file_name, file_url, file_size, mime_type, status, version, previous_version_id, uploaded_at) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())`,
      [
        userId,
        originalDoc.document_type,
        file.originalname,
        uploadResult.secure_url,
        file.size,
        file.mimetype,
        (originalDoc.version || 1) + 1,
        documentId
      ]
    );

    const newDocumentId = insertResult.insertId;

    // Update original document status to 'replaced'
    await pool.execute(
      `UPDATE student_documents SET status = 'replaced', replaced_by = ? WHERE id = ?`,
      [newDocumentId, documentId]
    );

    // Add history for both documents
    await addDocumentHistory(
      documentId,
      'replaced',
      userId,
      'rejected',
      'replaced',
      'Student uploaded new version'
    );

    await addDocumentHistory(
      newDocumentId,
      'uploaded',
      userId,
      null,
      'pending',
      'New version uploaded by student'
    );

    await pool.execute(
      `UPDATE student_onboarding_status
       SET profile_status = 'review',
           verification_requested_at = COALESCE(verification_requested_at, NOW()),
           updated_at = NOW()
       WHERE user_id = ?`,
      [userId]
    );
    await pool.execute(
      `UPDATE users
       SET onboarding_profile_status = 'review'
       WHERE id = ?
         AND (onboarding_profile_status IS NULL OR onboarding_profile_status <> 'verified')`,
      [userId]
    );

    const [adminRows] = await pool.execute(
      `SELECT u.id FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'Admin'`
    );
    for (const admin of adminRows) {
      await createNotification({
        userId: admin.id,
        type: 'file_resubmitted',
        title: 'Document resubmitted',
        message: `A student resubmitted their ${originalDoc.document_type} document. Ready for review.`,
        relatedUserId: userId,
        req
      });
    }

    await createAdminNotification(
      'document_replaced',
      'New Document Version Uploaded',
      `Student has uploaded a new version of ${originalDoc.document_type}`,
      { documentId: newDocumentId, studentId: userId, originalDocumentId: documentId }
    );

    await invalidateCache('cache:/api/admin/students/profiles*');
    await invalidateCache('cache:/api/tutor/students/profiles*');

    res.json({
      success: true,
      message: 'New document version uploaded successfully',
      documentId: newDocumentId
    });
  } catch (error) {
    console.error('Error replacing document:', error);
    res.status(500).json({ success: false, message: 'Error uploading new document version' });
  }
});

// DELETE /api/documents/:documentId - Student deletes their own rejected document
router.delete('/:documentId', auth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const userId = req.user?.id;

    // Get document
    const [docRows] = await pool.execute(
      'SELECT * FROM student_documents WHERE id = ? AND user_id = ?',
      [documentId, userId]
    );

    if (docRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const document = docRows[0];

    // Only allow deleting rejected documents
    if (document.status !== 'rejected') {
      return res.status(400).json({ success: false, message: 'Can only delete rejected documents' });
    }

    // Delete from Cloudinary
    if (document.file_url) {
      const publicId = document.file_url.split('/').slice(-2).join('/').split('.')[0];
      try {
        await cloudinary.uploader.destroy(`lms/student-documents/${userId}/${publicId}`);
      } catch (err) {
        console.error('Error deleting from Cloudinary:', err);
      }
    }

    // Delete from database
    await pool.execute('DELETE FROM student_documents WHERE id = ?', [documentId]);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, message: 'Error deleting document' });
  }
});

module.exports = router;
