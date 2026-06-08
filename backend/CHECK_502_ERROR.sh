#!/bin/bash
# Diagnostic script for 502 Bad Gateway errors

echo "=========================================="
echo "🔍 DIAGNOSING 502 BAD GATEWAY ERROR"
echo "=========================================="
echo ""

echo "1️⃣  PM2 STATUS (Check if processes are running):"
echo "----------------------------------------"
pm2 status
echo ""

echo "2️⃣  CHECK IF BACKEND PORT 5000 IS LISTENING:"
echo "----------------------------------------"
if netstat -tlnp 2>/dev/null | grep -q ':5000'; then
    echo "✅ Port 5000 is listening"
    netstat -tlnp | grep ':5000'
else
    echo "❌ Port 5000 is NOT listening - Backend is down!"
fi
echo ""

echo "3️⃣  CHECK IF FRONTEND PORT 3000 IS LISTENING:"
echo "----------------------------------------"
if netstat -tlnp 2>/dev/null | grep -q ':3000'; then
    echo "✅ Port 3000 is listening"
    netstat -tlnp | grep ':3000'
else
    echo "❌ Port 3000 is NOT listening - Frontend is down!"
fi
echo ""

echo "4️⃣  TEST BACKEND CONNECTION:"
echo "----------------------------------------"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null | grep -q "200\|404"; then
    echo "✅ Backend is responding"
    curl -I http://localhost:5000/api/health 2>&1 | head -3
else
    echo "❌ Backend is NOT responding"
    curl -v http://localhost:5000/api/health 2>&1 | head -10
fi
echo ""

echo "5️⃣  TEST FRONTEND CONNECTION:"
echo "----------------------------------------"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>&1 | grep -q "200\|404"; then
    echo "✅ Frontend is responding"
    curl -I http://localhost:3000 2>&1 | head -3
else
    echo "❌ Frontend is NOT responding"
    curl -v http://localhost:3000 2>&1 | head -10
fi
echo ""

echo "6️⃣  NGINX ERROR LOG (Last 50 lines - Most recent first):"
echo "----------------------------------------"
tail -50 /var/log/nginx/error.log | tail -30
echo ""

echo "7️⃣  NGINX ACCESS LOG (Last 20 lines):"
echo "----------------------------------------"
tail -20 /var/log/nginx/access.log
echo ""

echo "8️⃣  PM2 BACKEND LOGS (Last 30 lines with errors):"
echo "----------------------------------------"
pm2 logs lms-server --lines 30 --nostream --err | tail -30
echo ""

echo "9️⃣  PM2 FRONTEND LOGS (Last 30 lines with errors):"
echo "----------------------------------------"
pm2 logs lms-frontend --lines 30 --nostream --err | tail -30
echo ""

echo "🔟  CHECK FOR RECENT CRASHES/RESTARTS:"
echo "----------------------------------------"
pm2 logs lms-server --lines 100 --nostream | grep -E "error|Error|ERROR|crash|Crash|restart|Restart|killed|Killed" | tail -20
echo ""

echo "1️⃣1️⃣  SERVER RESOURCES (Memory/Disk):"
echo "----------------------------------------"
echo "Memory:"
free -h
echo ""
echo "Disk:"
df -h | grep -E '/$|/var'
echo ""

echo "=========================================="
echo "✅ DIAGNOSIS COMPLETE"
echo "=========================================="
echo ""
echo "💡 QUICK FIXES TO TRY:"
echo "----------------------------------------"
echo "1. Restart backend:  pm2 restart lms-server"
echo "2. Restart frontend: pm2 restart lms-frontend"
echo "3. Restart all:      pm2 restart all"
echo "4. Restart Nginx:    systemctl restart nginx"
echo "5. Check Nginx config: nginx -t"
echo ""




