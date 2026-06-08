#!/bin/bash
echo "=== LMS Health Check ==="
echo ""
echo "1. PM2 Services:"
pm2 status
echo ""
echo "2. Backend Health:"
curl -s http://localhost:5000/health && echo " ✅" || echo "❌ Backend not responding"
echo ""
echo "3. Frontend Health:"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$STATUS" = "200" ]; then
    echo "✅ Frontend OK (HTTP $STATUS)"
else
    echo "❌ Frontend issue (HTTP $STATUS)"
fi
echo ""
echo "4. MySQL Connection:"
mysql -h localhost -P 3399 -u lms_user -p"7wTpm7_cCHdnbNKHTUw_fw" -e "SELECT 1" 2>&1 | grep -q "ERROR" && echo "❌ MySQL error" || echo "✅ MySQL OK"
echo ""
echo "5. Nginx Status:"
sudo systemctl is-active nginx
echo ""
echo "6. Check for ROOT PM2 processes (should be empty):"
sudo pm2 list 2>&1 | grep -q "online\|stopped" && echo "⚠️ WARNING: ROOT processes found!" || echo "✅ No ROOT processes"
echo ""
echo "=== Check Complete ==="

