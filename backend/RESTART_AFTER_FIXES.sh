#!/bin/bash
# Restart all services after fixing the issues

echo "=========================================="
echo "🔧 RESTARTING SERVICES AFTER FIXES"
echo "=========================================="
echo ""

echo "1️⃣  STOPPING ALL PM2 PROCESSES:"
echo "----------------------------------------"
pm2 stop all
sleep 2
echo ""

echo "2️⃣  DELETING ALL PM2 PROCESSES:"
echo "----------------------------------------"
pm2 delete all
sleep 2
echo ""

echo "3️⃣  CLEARING PM2 LOGS:"
echo "----------------------------------------"
pm2 flush
echo ""

echo "4️⃣  NAVIGATING TO BACKEND DIRECTORY:"
echo "----------------------------------------"
cd /var/www/lms-app/backend
echo "Current directory: $(pwd)"
echo ""

echo "5️⃣  STARTING ALL PROCESSES:"
echo "----------------------------------------"
pm2 start ecosystem.config.js --update-env
sleep 10
echo ""

echo "6️⃣  CHECKING PM2 STATUS:"
echo "----------------------------------------"
pm2 status
echo ""

echo "7️⃣  WAITING 15 SECONDS FOR PROCESSES TO START:"
echo "----------------------------------------"
sleep 15
pm2 status
echo ""

echo "8️⃣  CHECKING IF PORTS ARE LISTENING:"
echo "----------------------------------------"
echo "Port 5000 (Backend):"
if netstat -tlnp 2>/dev/null | grep -q ':5000'; then
    echo "✅ Port 5000 is listening"
    netstat -tlnp | grep ':5000'
else
    echo "❌ Port 5000 is NOT listening"
fi
echo ""
echo "Port 3000 (Frontend):"
if netstat -tlnp 2>/dev/null | grep -q ':3000'; then
    echo "✅ Port 3000 is listening"
    netstat -tlnp | grep ':3000'
else
    echo "❌ Port 3000 is NOT listening"
fi
echo ""

echo "9️⃣  TESTING CONNECTIONS:"
echo "----------------------------------------"
echo "Testing Backend:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:5000/api/health || echo "❌ Backend not responding"
echo ""
echo "Testing Frontend:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 || echo "❌ Frontend not responding"
echo ""

echo "🔟  CHECKING RECENT ERRORS:"
echo "----------------------------------------"
echo "Backend errors (last 10 lines):"
pm2 logs lms-server --lines 10 --nostream --err | tail -10
echo ""
echo "Frontend errors (last 10 lines):"
pm2 logs lms-frontend --lines 10 --nostream --err | tail -10
echo ""

echo "=========================================="
echo "✅ RESTART COMPLETE"
echo "=========================================="
echo ""
echo "If services are still not running, check logs:"
echo "  pm2 logs lms-server --lines 100"
echo "  pm2 logs lms-frontend --lines 100"
echo ""




