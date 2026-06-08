#!/bin/bash

# Script to build frontend and run AI tokens database migration
# Usage: ./deploy-ai-system.sh

set -e  # Exit on error

echo "🚀 Starting AI System Deployment..."
echo ""

# Get database credentials from environment or .env file
if [ -f backend/.env ]; then
    source backend/.env
fi

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}
DB_NAME=${DB_NAME:-db_lms}

echo "📦 Step 1: Building Next.js frontend..."
cd /var/www/lms-app
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Frontend build completed successfully!"
else
    echo "❌ Frontend build failed!"
    exit 1
fi

echo ""
echo "🗄️  Step 2: Running database migration..."

# Check if MySQL client is available
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL client not found. Please install mysql-client or run the SQL file manually."
    echo ""
    echo "To run manually, execute:"
    echo "mysql -u $DB_USER -p $DB_NAME < backend/migrations/create_ai_tokens_table.sql"
    exit 1
fi

# Run the migration
if [ -z "$DB_PASSWORD" ]; then
    echo "Enter MySQL password for user $DB_USER:"
    mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME < backend/migrations/create_ai_tokens_table.sql
else
    mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < backend/migrations/create_ai_tokens_table.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully!"
else
    echo "❌ Database migration failed!"
    exit 1
fi

echo ""
echo "🔄 Step 3: Restarting PM2 processes..."

# Restart frontend (it will use the new build)
pm2 restart lms-frontend

# Restart backend to load new routes
pm2 restart lms-backend

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Go to Admin Dashboard → AI Tokens tab"
echo "2. Create a new AI token"
echo "3. Use the token to test AI endpoints"
echo ""
echo "🔍 Check PM2 status:"
pm2 status
