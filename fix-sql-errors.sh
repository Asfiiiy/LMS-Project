#!/bin/bash

# Fix SQL errors in backend routes

echo "=== Fixing SQL Errors ==="

# Fix 1: Notifications.js - Ensure parameters are properly converted
echo "Fixing notifications.js..."
cd /var/www/lms-app/backend/routes

# The issue is that limit and offset might be strings, ensure they're integers
sed -i 's/\[userId, parseInt(limit), parseInt(offset)\]/[userId, limit, offset]/' notifications.js

# Fix 2: Admin.js - Same issue with limit and offset
echo "Fixing admin.js..."
sed -i 's/\], \[limit, offset\]\);/], [parseInt(limit), parseInt(offset)]);/' admin.js

# Fix 3: Student.js - Fix undefined unitProgressColumn
echo "Fixing student.js..."
# Add a safety check to ensure unitProgressColumn is never undefined
sed -i '731a\            // Safety check: ensure column_name exists\n            if (!progressColumnCheck[0].column_name) {\n              console.log('"'"'[Qualification Courses] Warning: column_name is undefined, using default'"'"');\n              unitProgressColumn = '"'"'is_completed'"'"';\n            }' student.js

echo "✅ All fixes applied!"
echo ""
echo "Now restart PM2:"
echo "pm2 restart all"

