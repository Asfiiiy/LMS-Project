/**
 * Auto-start certificate worker when server starts
 * This is optional - you can also run it separately with: npm run worker
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting certificate generation worker...');

const workerProcess = spawn('node', [path.join(__dirname, 'workers/certificateWorker.js')], {
  stdio: 'inherit',
  shell: true
});

workerProcess.on('error', (error) => {
  console.error('❌ Failed to start worker:', error);
});

workerProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Worker exited with code ${code}`);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down worker...');
  workerProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down worker...');
  workerProcess.kill('SIGINT');
});

module.exports = workerProcess;

