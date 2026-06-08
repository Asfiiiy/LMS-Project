#!/bin/bash

# Get list of available tutors
# Usage: ./get-tutors.sh

TOKEN="${1:-ai_tok_199948873db7b589536eefe554e441950ad35048cd4e797b4d6eee60afc80e34}"
BASE_URL="https://lms.inspirelondoncollege.com/api"

echo "👨‍🏫 Getting list of available tutors..."
echo ""

# Note: We need to use admin endpoint or create a helper endpoint
# For now, let's query the database directly or use a workaround

echo "To find available tutors, you can:"
echo ""
echo "1. Check in Admin Dashboard → User Management → Filter by Tutor"
echo ""
echo "2. Query database directly:"
echo "   mysql -u lms_user -p'YOUR_PASSWORD' db_lms -e \"SELECT id, name, email FROM users WHERE role_id = 2 LIMIT 10;\""
echo ""
echo "3. Or use this SQL query:"
echo "   SELECT u.id, u.name, u.email, r.name as role_name"
echo "   FROM users u"
echo "   LEFT JOIN roles r ON u.role_id = r.id"
echo "   WHERE r.name = 'Tutor' OR u.role_id = 2"
echo "   LIMIT 10;"
