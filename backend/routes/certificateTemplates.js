/**
 * Certificate Templates API Routes
 * Handles template upload, management, and retrieval
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cloudinary = require('../config/cloudinary');

// Ensure templates directory exists
const TEMPLATES_DIR = path.join(__dirname, '../templates/active');
fs.ensureDirSync(TEMPLATES_DIR);

// Configure multer for DOCX file uploads (local storage first)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMPLATES_DIR);
  },
  filename: function (req, file, cb) {
    const templateType = req.body.template_type || 'template';
    const courseType = req.body.course_type || 'cpd';
    const timestamp = Date.now();
    const filename = `${courseType}_${templateType}_${timestamp}.docx`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.docx') {
      return cb(new Error('Only .docx files are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// =====================================================
// GET ENDPOINTS
// =====================================================

/**
 * Get all templates
 * GET /api/certificate-templates
 */
router.get('/', auth, async (req, res) => {
  try {
    const { template_type, course_type, is_active } = req.query;
    
    let query = `
      SELECT 
        ct.*,
        u.name as uploaded_by_name
      FROM certificate_templates ct
      LEFT JOIN users u ON ct.uploaded_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (template_type) {
      query += ' AND ct.template_type = ?';
      params.push(template_type);
    }
    
    if (course_type) {
      query += ' AND ct.course_type = ?';
      params.push(course_type);
    }
    
    if (is_active !== undefined) {
      query += ' AND ct.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY ct.is_active DESC, ct.uploaded_at DESC';
    
    const [templates] = await pool.execute(query, params);
    
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, message: 'Error fetching templates' });
  }
});

/**
 * Get active templates for CPD
 * GET /api/certificate-templates/active/cpd
 */
router.get('/active/cpd', auth, async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT * FROM certificate_templates 
       WHERE course_type = 'cpd' AND is_active = TRUE 
       ORDER BY template_type`
    );
    
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching active CPD templates:', error);
    res.status(500).json({ success: false, message: 'Error fetching templates' });
  }
});

/**
 * Get specific template details
 * GET /api/certificate-templates/:id
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT ct.*, u.name as uploaded_by_name
       FROM certificate_templates ct
       LEFT JOIN users u ON ct.uploaded_by = u.id
       WHERE ct.id = ?`,
      [req.params.id]
    );
    
    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    res.json({ success: true, template: templates[0] });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, message: 'Error fetching template' });
  }
});

/**
 * Download template file
 * GET /api/certificate-templates/:id/download
 */
router.get('/:id/download', auth, async (req, res) => {
  try {
    const [templates] = await pool.execute(
      'SELECT * FROM certificate_templates WHERE id = ?',
      [req.params.id]
    );
    
    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    const template = templates[0];
    const filePath = path.join(__dirname, '..', template.template_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Template file not found on server' });
    }
    
    res.download(filePath, `${template.template_name}.docx`);
  } catch (error) {
    console.error('Error downloading template:', error);
    res.status(500).json({ success: false, message: 'Error downloading template' });
  }
});

// =====================================================
// POST ENDPOINTS
// =====================================================

/**
 * Upload new template
 * POST /api/certificate-templates/upload
 */
router.post('/upload', auth, upload.single('template'), async (req, res) => {
  try {
    const { template_type, course_type, template_name, description } = req.body;
    const userId = req.user.id;
    
    // Validate inputs
    if (!template_type || !course_type || !template_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: template_type, course_type, template_name'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No template file uploaded'
      });
    }
    
    // Get relative path
    const relativePath = path.relative(path.join(__dirname, '..'), req.file.path);
    
    // Optional: Upload to Cloudinary as backup
    let cloudinaryUrl = null;
    try {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'certificate_templates',
        resource_type: 'raw',
        public_id: path.basename(req.file.filename, '.docx')
      });
      cloudinaryUrl = uploadResult.secure_url;
    } catch (cloudinaryError) {
      console.warn('Cloudinary upload failed (continuing with local storage):', cloudinaryError.message);
    }
    
    // Deactivate previous template of same type
    await pool.execute(
      `UPDATE certificate_templates 
       SET is_active = FALSE 
       WHERE template_type = ? AND course_type = ? AND is_active = TRUE`,
      [template_type, course_type]
    );
    
    // Insert new template
    const [result] = await pool.execute(
      `INSERT INTO certificate_templates (
        template_type, course_type, template_name, template_path,
        cloudinary_url, is_active, uploaded_by, description
      ) VALUES (?, ?, ?, ?, ?, TRUE, ?, ?)`,
      [
        template_type, 
        course_type, 
        template_name, 
        relativePath, 
        cloudinaryUrl || null, 
        userId, 
        description || null
      ]
    );
    
    console.log(`✅ Template uploaded: ${template_name} (ID: ${result.insertId})`);
    
    res.json({
      success: true,
      message: 'Template uploaded successfully',
      templateId: result.insertId,
      template: {
        id: result.insertId,
        template_type,
        course_type,
        template_name,
        template_path: relativePath,
        cloudinary_url: cloudinaryUrl
      }
    });
  } catch (error) {
    console.error('Error uploading template:', error);
    res.status(500).json({ success: false, message: 'Error uploading template' });
  }
});

// =====================================================
// PUT ENDPOINTS
// =====================================================

/**
 * Update template (replace file or metadata)
 * PUT /api/certificate-templates/:id
 */
router.put('/:id', auth, upload.single('template'), async (req, res) => {
  try {
    const { template_name, description, is_active } = req.body;
    const templateId = req.params.id;
    
    // Get existing template
    const [templates] = await pool.execute(
      'SELECT * FROM certificate_templates WHERE id = ?',
      [templateId]
    );
    
    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    const existingTemplate = templates[0];
    let updateFields = [];
    let updateValues = [];
    
    // Update name if provided
    if (template_name) {
      updateFields.push('template_name = ?');
      updateValues.push(template_name);
    }
    
    // Update description if provided
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    
    // Update is_active if provided
    if (is_active !== undefined) {
      const activeValue = is_active === 'true' || is_active === true ? 1 : 0;
      updateFields.push('is_active = ?');
      updateValues.push(activeValue);
      
      // If activating, deactivate others of same type
      if (activeValue === 1) {
        await pool.execute(
          `UPDATE certificate_templates 
           SET is_active = FALSE 
           WHERE template_type = ? AND course_type = ? AND id != ?`,
          [existingTemplate.template_type, existingTemplate.course_type, templateId]
        );
      }
    }
    
    // Update file if provided
    if (req.file) {
      const relativePath = path.relative(path.join(__dirname, '..'), req.file.path);
      updateFields.push('template_path = ?');
      updateValues.push(relativePath);
      
      // Optional: Upload to Cloudinary
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'certificate_templates',
          resource_type: 'raw',
          public_id: path.basename(req.file.filename, '.docx')
        });
        updateFields.push('cloudinary_url = ?');
        updateValues.push(uploadResult.secure_url);
      } catch (cloudinaryError) {
        console.warn('Cloudinary upload failed:', cloudinaryError.message);
      }
      
      // Delete old file
      const oldFilePath = path.join(__dirname, '..', existingTemplate.template_path);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    
    updateValues.push(templateId);
    const query = `UPDATE certificate_templates SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await pool.execute(query, updateValues);
    
    res.json({
      success: true,
      message: 'Template updated successfully'
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, message: 'Error updating template' });
  }
});

// =====================================================
// DELETE ENDPOINTS
// =====================================================

/**
 * Delete template
 * DELETE /api/certificate-templates/:id
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    // Get template
    const [templates] = await pool.execute(
      'SELECT * FROM certificate_templates WHERE id = ?',
      [req.params.id]
    );
    
    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    const template = templates[0];
    
    // Don't allow deleting active templates
    if (template.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active template. Please set another template as active first.'
      });
    }
    
    // Delete file
    const filePath = path.join(__dirname, '..', template.template_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete from database
    await pool.execute('DELETE FROM certificate_templates WHERE id = ?', [req.params.id]);
    
    console.log(`🗑️ Template deleted: ${template.template_name} (ID: ${req.params.id})`);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, message: 'Error deleting template' });
  }
});

module.exports = router;

