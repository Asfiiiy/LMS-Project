#!/bin/bash
# Script to check notification system on VPS

echo "🔍 Checking Notification System..."
echo "=================================="
echo ""

# 1. Check if notification enum has 'chat' type
echo "1️⃣ Checking notification type enum in database..."
echo "Run this SQL query in your database:"
echo "-----------------------------------"
echo "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type';"
echo ""
echo "If 'chat' is NOT in the enum, run:"
echo "mysql -u YOUR_USER -p YOUR_DATABASE < backend/fix-notifications-enum.sql"
echo ""
echo "Or manually run the ALTER TABLE command from backend/fix-notifications-enum.sql"
echo ""

# 2. Check backend logs for notification creation
echo "2️⃣ Checking backend logs for notification errors..."
echo "-----------------------------------"
pm2 logs lms-server --lines 50 --nostream | grep -i -E "(notification|chat|📬|❌.*notification)" | tail -20
echo ""

# 3. Check Redis adapter connection (for Socket.IO cluster mode)
echo "3️⃣ Checking if Redis adapter is connected..."
echo "-----------------------------------"
pm2 logs lms-server --lines 100 --nostream | grep -i -E "(Redis|redis adapter|cluster mode)" | tail -10
echo ""

# 4. Check if Redis is running
echo "4️⃣ Checking Redis status..."
echo "-----------------------------------"
if command -v redis-cli &> /dev/null; then
    redis-cli ping 2>/dev/null && echo "✅ Redis is running" || echo "❌ Redis is not responding"
else
    echo "⚠️  redis-cli not found - Redis might not be installed"
fi
echo ""

# 5. Check environment variables
echo "5️⃣ Checking Redis environment variables..."
echo "-----------------------------------"
pm2 env 0 | grep -i redis || echo "No Redis environment variables found"
echo ""

# 6. Test notification creation manually
echo "6️⃣ To test notification creation, send a chat message from student to tutor"
echo "   Then check logs with: pm2 logs lms-server --lines 100 | grep -i '📬\|notification'"
echo ""

echo "✅ Diagnostic complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Ensure notification enum has 'chat' type (run fix-notifications-enum.sql)"
echo "   2. Check backend logs when sending a message"
echo "   3. Ensure Redis is running if using PM2 cluster mode"
echo "   4. Verify tutor is logged in and socket is connected (check browser console)"

