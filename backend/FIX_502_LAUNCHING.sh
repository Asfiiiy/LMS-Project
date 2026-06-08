#!/bin/bash
# Fix 502 error caused by processes stuck in "launching" state

echo "=========================================="
echo "🔧 FIXING 502 ERROR - PROCESSES STUCK LAUNCHING"
echo "=========================================="
echo ""

echo "1️⃣  CHECKING CURRENT PM2 STATUS:"
echo "----------------------------------------"
pm2 status
echo ""

echo "2️⃣  CHECKING FRONTEND LOGS (Why it's stuck):"
echo "----------------------------------------"
pm2 logs lms-frontend --lines 50 --nostream --err | tail -50
echo ""

echo "3️⃣  CHECKING BACKEND LOGS (Why instance 4 is stuck):"
echo "----------------------------------------"
pm2 logs lms-server --lines 50 --nostream --err | tail -50
echo ""

echo "4️⃣  STOPPING ALL PROCESSES:"
echo "----------------------------------------"
pm2 stop all
sleep 2
echo ""

echo "5️⃣  DELETING STUCK PROCESSES:"
echo "----------------------------------------"
pm2 delete all
sleep 2
echo ""

echo "6️⃣  CLEARING PM2 LOGS:"
echo "----------------------------------------"
pm2 flush
echo ""

echo "7️⃣  STARTING ALL PROCESSES FRESH:"
echo "----------------------------------------"
cd /var/www/lms-app/backend
pm2 start ecosystem.config.js --update-env
sleep 5
echo ""

echo "8️⃣  CHECKING NEW STATUS:"
echo "----------------------------------------"
pm2 status
echo ""

echo "9️⃣  WAITING 10 SECONDS AND CHECKING AGAIN:"
echo "----------------------------------------"
sleep 10
pm2 status
echo ""

echo "🔟  CHECKING IF PORTS ARE NOW LISTENING:"
echo "----------------------------------------"
echo "Port 3000 (Frontend):"
netstat -tlnp | grep 3000 || ss -tlnp | grep 3000 || echo "❌ Port 3000 not listening yet"
echo ""
echo "Port 5000 (Backend):"
netstat -tlnp | grep 5000 || ss -tlnp | grep 5000 || echo "❌ Port 5000 not listening yet"
echo ""

echo "1️⃣1️⃣  TESTING CONNECTIONS:"
echo "----------------------------------------"
echo "Testing Frontend:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 || echo "❌ Frontend not responding"
echo ""
echo "Testing Backend:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:5000/api/health || echo "❌ Backend not responding"
echo ""

echo "=========================================="
echo "✅ FIX COMPLETE"
echo "=========================================="
echo ""
echo "If processes are still stuck, check logs:"
echo "  pm2 logs lms-frontend --lines 100"
echo "  pm2 logs lms-server --lines 100"
echo ""




