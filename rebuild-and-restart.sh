#!/bin/bash

# LMS Rebuild and Restart Script
# This script rebuilds the frontend and restarts all PM2 services

echo "🚀 Starting LMS Rebuild and Restart Process..."
echo ""

# Navigate to project directory
cd /var/www/lms-app

# Step 1: Rebuild Frontend (Next.js)
echo "📦 Step 1: Rebuilding Frontend (Next.js)..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed! Please check the errors above."
    exit 1
fi

echo "✅ Frontend build completed successfully!"
echo ""

# Step 2: Restart all PM2 services
echo "🔄 Step 2: Restarting all PM2 services..."
pm2 restart ecosystem.config.js

if [ $? -ne 0 ]; then
    echo "❌ PM2 restart failed! Please check the errors above."
    exit 1
fi

echo "✅ All services restarted successfully!"
echo ""

# Step 3: Show PM2 status
echo "📊 Current PM2 Status:"
pm2 status

echo ""
echo "✅ Rebuild and restart completed!"
echo ""
echo "📝 To view logs, run:"
echo "   pm2 logs lms-backend    # Backend logs"
echo "   pm2 logs lms-frontend   # Frontend logs"
echo "   pm2 logs lms-worker     # Worker logs"
echo "   pm2 logs               # All logs"
