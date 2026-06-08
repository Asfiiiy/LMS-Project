#!/bin/bash
# Quick diagnostic script for site downtime

echo "=========================================="
echo "🔍 DIAGNOSING SITE DOWNTIME"
echo "=========================================="
echo ""

echo "1️⃣  PM2 STATUS:"
echo "----------------------------------------"
pm2 status
echo ""

echo "2️⃣  NGINX STATUS:"
echo "----------------------------------------"
systemctl status nginx --no-pager -l | head -20
echo ""

echo "3️⃣  PORTS LISTENING (80, 443, 3000, 5000):"
echo "----------------------------------------"
netstat -tlnp | grep -E ':(80|443|3000|5000)' || ss -tlnp | grep -E ':(80|443|3000|5000)'
echo ""

echo "4️⃣  SERVER RESOURCES:"
echo "----------------------------------------"
echo "CPU Load:"
uptime
echo ""
echo "Memory:"
free -h
echo ""
echo "Disk Space:"
df -h | grep -E '/$|/var'
echo ""

echo "5️⃣  RECENT PM2 ERRORS (last 30 lines):"
echo "----------------------------------------"
pm2 logs lms-server --lines 30 --nostream | tail -30
echo ""

echo "6️⃣  NGINX ERROR LOG (last 20 lines):"
echo "----------------------------------------"
tail -20 /var/log/nginx/error.log 2>/dev/null || echo "Nginx error log not found"
echo ""

echo "7️⃣  CHECK IF BACKEND IS RESPONDING:"
echo "----------------------------------------"
curl -I http://localhost:5000/api/health 2>&1 | head -5 || echo "❌ Backend not responding on port 5000"
echo ""

echo "8️⃣  CHECK IF FRONTEND IS RESPONDING:"
echo "----------------------------------------"
curl -I http://localhost:3000 2>&1 | head -5 || echo "❌ Frontend not responding on port 3000"
echo ""

echo "=========================================="
echo "✅ DIAGNOSIS COMPLETE"
echo "=========================================="




