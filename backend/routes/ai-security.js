/**
 * AI Security Routes
 * Admin endpoints for security monitoring and patching
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const AISecurityPatch = require('../utils/aiSecurityPatch');

// All routes require admin authentication
router.use(auth);
router.use(permit('Admin'));

/**
 * POST /api/admin/ai-security/run-patch
 * Run all security patches
 */
router.post('/run-patch', async (req, res) => {
  try {
    const results = await AISecurityPatch.runAllPatches();
    res.json({ success: true, results });
  } catch (error) {
    console.error('[AI Security] Error running patch:', error);
    res.status(500).json({ success: false, message: 'Error running security patch' });
  }
});

/**
 * GET /api/admin/ai-security/report
 * Get security report
 */
router.get('/report', async (req, res) => {
  try {
    const result = await AISecurityPatch.generateSecurityReport();
    res.json(result);
  } catch (error) {
    console.error('[AI Security] Error generating report:', error);
    res.status(500).json({ success: false, message: 'Error generating security report' });
  }
});

/**
 * GET /api/admin/ai-security/monitor
 * Monitor token usage for anomalies
 */
router.get('/monitor', async (req, res) => {
  try {
    const result = await AISecurityPatch.monitorTokenUsage();
    res.json(result);
  } catch (error) {
    console.error('[AI Security] Error monitoring:', error);
    res.status(500).json({ success: false, message: 'Error monitoring token usage' });
  }
});

module.exports = router;
