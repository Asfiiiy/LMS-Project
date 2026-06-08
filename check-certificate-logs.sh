#!/bin/bash

echo "=========================================="
echo "  Certificate Worker - Logs & Status Check"
echo "=========================================="
echo ""

echo "=== 1. Worker PM2 Status ==="
pm2 status | grep -E "name|worker"
echo ""

echo "=== 2. Worker Logs (Last 50 lines) ==="
pm2 logs lms-worker --lines 50 --nostream
echo ""

echo "=== 3. Worker Error Logs (Last 50 lines) ==="
pm2 logs lms-worker --err --lines 50 --nostream
echo ""

echo "=== 4. Backend Server Logs (Certificate Related) ==="
pm2 logs lms-server --lines 100 --nostream | grep -i -E "certificate|claim|worker|queue|bull|job" | tail -30
echo ""

echo "=== 5. Check Worker Log Files Directly ==="
echo "Worker Error Log:"
tail -50 /var/www/lms-app/backend/logs/worker-error.log 2>/dev/null || tail -50 /root/.pm2/logs/lms-worker-error.log 2>/dev/null || echo "   ⚠️  Log file not found"
echo ""
echo "Worker Output Log:"
tail -50 /var/www/lms-app/backend/logs/worker-out.log 2>/dev/null || tail -50 /root/.pm2/logs/lms-worker-out.log 2>/dev/null || echo "   ⚠️  Log file not found"
echo ""

echo "=== 6. Check Backend Logs for Certificate Errors ==="
echo "Backend Error Log (Certificate related):"
tail -100 /var/www/lms-app/backend/logs/server-error.log 2>/dev/null | grep -i -E "certificate|claim|error|failed" | tail -20 || tail -100 /root/.pm2/logs/lms-server-error.log 2>/dev/null | grep -i -E "certificate|claim|error|failed" | tail -20 || echo "   ⚠️  No certificate errors found"
echo ""

echo "=== 7. Check Redis Connection (for Bull Queue) ==="
cd /var/www/lms-app/backend 2>/dev/null || cd /root/lms-app/backend 2>/dev/null
node -e "
const redis = require('./config/redis');
redis.on('error', (err) => console.log('❌ Redis Error:', err.message));
redis.on('connect', () => console.log('✅ Redis Connected'));
redis.on('ready', () => console.log('✅ Redis Ready'));
setTimeout(() => {
  console.log('Redis Status:', redis.status);
  process.exit(0);
}, 2000);
" 2>&1 || echo "   ⚠️  Could not check Redis"
echo ""

echo "=== 8. Check Recent Certificate Claims in Database ==="
mysql -u lms_user -p$(grep DB_PASSWORD /var/www/lms-app/backend/.env 2>/dev/null | cut -d '=' -f2) db_lms -e "SELECT id, course_id, student_id, payment_status, reg_number, status, created_at FROM certificate_claims ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "   ⚠️  Could not query database (check credentials)"
echo ""

echo "=== 9. Check Bull Queue Status (if accessible) ==="
cd /var/www/lms-app/backend 2>/dev/null || cd /root/lms-app/backend 2>/dev/null
node -e "
const Queue = require('bull');
const redis = require('./config/redis');
const certQueue = new Queue('certificate-generation', { createClient: () => redis });
certQueue.getJobs(['waiting', 'active', 'completed', 'failed']).then(jobs => {
  console.log('Queue Jobs:');
  console.log('  Waiting:', jobs.filter(j => j.opts && j.opts.delay).length);
  console.log('  Active:', jobs.filter(j => !j.finishedOn && !j.failedReason).length);
  console.log('  Completed:', jobs.filter(j => j.finishedOn).length);
  console.log('  Failed:', jobs.filter(j => j.failedReason).length);
  if (jobs.filter(j => j.failedReason).length > 0) {
    console.log('\\nFailed Jobs:');
    jobs.filter(j => j.failedReason).forEach(j => {
      console.log('  Job ID:', j.id);
      console.log('  Error:', j.failedReason);
    });
  }
  process.exit(0);
}).catch(err => {
  console.log('⚠️  Could not check queue:', err.message);
  process.exit(0);
});
" 2>&1
echo ""

echo "=========================================="
echo "  Check Complete!"
echo "=========================================="

