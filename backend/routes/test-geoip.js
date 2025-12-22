// backend/routes/test-geoip.js
// Test endpoint to verify geoip-lite is working correctly
const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');

/**
 * Test endpoint to verify geoip-lite functionality
 * GET /api/test-geoip?ip=8.8.8.8
 */
router.get('/', (req, res) => {
  const testIPs = [
    { ip: '8.8.8.8', name: 'Google DNS (US)' },
    { ip: '1.1.1.1', name: 'Cloudflare DNS (US)' },
    { ip: '103.152.112.162', name: 'Example IP (India)' },
    { ip: '::1', name: 'Localhost IPv6' },
    { ip: '127.0.0.1', name: 'Localhost IPv4' },
    { ip: '192.168.1.1', name: 'Private IP' },
    { ip: req.query.ip || req.ip || '8.8.8.8', name: 'Your IP or Custom' }
  ];

  const results = testIPs.map(({ ip, name }) => {
    try {
      // Clean IP (same logic as in eventLogger.js)
      const cleanIP = ip.replace('::ffff:', '').replace('::1', '127.0.0.1');
      
      // Check if it's localhost/private
      const isLocalhost = cleanIP === '127.0.0.1' || cleanIP === 'localhost' || 
                         cleanIP.startsWith('192.168.') || 
                         cleanIP.startsWith('10.') || 
                         cleanIP.startsWith('172.');
      
      // Lookup with geoip-lite
      const geo = geoip.lookup(cleanIP);
      
      return {
        inputIP: ip,
        cleanedIP: cleanIP,
        name,
        isLocalhost,
        geoipResult: geo,
        countryCode: geo?.country || null,
        countryName: geo?.country || null,
        region: geo?.region || null,
        city: geo?.city || null,
        timezone: geo?.timezone || null,
        latitude: geo?.ll?.[0] || null,
        longitude: geo?.ll?.[1] || null,
        metro: geo?.metro || null,
        range: geo?.range || null
      };
    } catch (error) {
      return {
        inputIP: ip,
        name,
        error: error.message
      };
    }
  });

  res.json({
    success: true,
    message: 'geoip-lite test results',
    geoipVersion: require('geoip-lite/package.json').version,
    results,
    instructions: {
      note: 'Localhost and private IPs will return null (expected behavior)',
      testCustomIP: 'Add ?ip=YOUR_IP to test a specific IP address',
      example: '/api/test-geoip?ip=8.8.8.8'
    }
  });
});

module.exports = router;

