/**
 * LibreOffice Configuration
 * Handles LibreOffice path detection for local development and VPS deployment
 */

const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Get LibreOffice executable path
 * Priority:
 * 1. Environment variable (LIBREOFFICE_PATH) - for VPS/production
 * 2. Auto-detection based on OS - for local development
 */
function getLibreOfficePath() {
  // Check environment variable first (VPS deployment)
  if (process.env.LIBREOFFICE_PATH) {
    console.log('✅ Using LibreOffice from ENV:', process.env.LIBREOFFICE_PATH);
    return process.env.LIBREOFFICE_PATH;
  }

  // Auto-detect based on operating system
  const platform = os.platform();
  let possiblePaths = [];

  switch (platform) {
    case 'win32': // Windows
      possiblePaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        process.env.LOCALAPPDATA + '\\Programs\\LibreOffice\\program\\soffice.exe'
      ];
      break;

    case 'darwin': // macOS
      possiblePaths = [
        '/Applications/LibreOffice.app/Contents/MacOS/soffice'
      ];
      break;

    case 'linux': // Linux (VPS most common)
      possiblePaths = [
        '/usr/bin/soffice',
        '/usr/bin/libreoffice',
        '/snap/bin/libreoffice'
      ];
      break;

    default:
      console.warn('⚠️ Unknown platform:', platform);
      return null;
  }

  // Check each possible path
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      console.log('✅ LibreOffice found at:', path);
      return path;
    }
  }

  // Try to find using 'which' command (Linux/Mac)
  if (platform !== 'win32') {
    try {
      const whichResult = execSync('which soffice || which libreoffice', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      
      if (whichResult && fs.existsSync(whichResult)) {
        console.log('✅ LibreOffice found via which:', whichResult);
        return whichResult;
      }
    } catch (error) {
      // which command failed, continue
    }
  }

  console.error('❌ LibreOffice not found. Please install or set LIBREOFFICE_PATH in .env');
  return null;
}

/**
 * Check if LibreOffice is available
 */
function isLibreOfficeAvailable() {
  const path = getLibreOfficePath();
  if (!path) return false;
  
  try {
    // Test if executable exists (simpler check for Windows)
    if (fs.existsSync(path)) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ LibreOffice check failed:', error.message);
    return false;
  }
}

/**
 * Get LibreOffice version
 */
function getLibreOfficeVersion() {
  const path = getLibreOfficePath();
  if (!path || !fs.existsSync(path)) return null;
  
  try {
    const version = execSync(`"${path}" --version`, {
      encoding: 'utf-8',
      timeout: 10000,
      windowsHide: true
    }).trim();
    return version;
  } catch (error) {
    // Version check failed, but executable exists
    return 'Installed (version check skipped)';
  }
}

/**
 * Configuration object
 */
const config = {
  path: getLibreOfficePath(),
  isAvailable: isLibreOfficeAvailable(),
  version: getLibreOfficeVersion(),
  platform: os.platform()
};

// Log configuration on startup
console.log('\n📄 LibreOffice Configuration:');
console.log('   Platform:', config.platform);
console.log('   Path:', config.path || 'NOT FOUND');
console.log('   Available:', config.isAvailable ? '✅ YES' : '❌ NO');
console.log('   Version:', config.version || 'Unknown');

if (!config.isAvailable) {
  console.log('\n⚠️  SETUP INSTRUCTIONS:');
  console.log('   Windows: Download from https://www.libreoffice.org/download/');
  console.log('   Linux/VPS: sudo apt-get install libreoffice --no-install-recommends');
  console.log('   Custom path: Set LIBREOFFICE_PATH=/path/to/soffice in .env file');
  console.log('');
}

module.exports = config;

