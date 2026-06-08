#!/bin/bash

# Deploy SQL fixes to VPS
# Run this script from your local machine (Git Bash on Windows)

echo "=== Deploying SQL Fixes to VPS ==="

# 1. Commit changes to GitHub
echo "Step 1: Committing fixes to GitHub..."
git add backend/routes/notifications.js backend/routes/admin.js backend/routes/student.js
git commit -m "Fix SQL parameter errors in notifications, admin, and student routes"
git push origin main

echo ""
echo "Step 2: SSH into VPS and pull changes..."
echo "Run these commands on your VPS:"
echo ""
echo "cd /var/www/lms-app"
echo "git pull origin main"
echo "pm2 restart all"
echo "sleep 5"
echo "pm2 logs --lines 20 | grep -E 'MySQL connected|Error'"
echo ""
echo "=== Instructions ==="
echo "1. Copy the commands above"
echo "2. SSH into your VPS"
echo "3. Paste and run the commands"
echo "4. Check if errors are gone"

