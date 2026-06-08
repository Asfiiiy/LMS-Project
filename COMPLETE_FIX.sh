#!/bin/bash

echo "=========================================="
echo "  COMPLETE DIAGNOSTIC & FIX SCRIPT"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check current status
echo "📊 STEP 1: Current Status"
echo "----------------------------------------"
cd /var/www/lms-app/backend
pm2 status
echo ""

# Step 2: Check .env file
echo "📋 STEP 2: Checking .env Configuration"
echo "----------------------------------------"
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file NOT FOUND!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ .env file exists${NC}"
echo ""
echo "Key variables:"
grep -E '^DB_|^REDIS_|^PORT=|^JWT_SECRET=' .env | sed 's/=.*/=***/' | head -10
echo ""

# Step 3: Test MySQL Connection
echo "🗄️  STEP 3: Testing MySQL Connection"
echo "----------------------------------------"
DB_HOST=$(grep '^DB_HOST=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_PORT=$(grep '^DB_PORT=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "3306")
DB_USER=$(grep '^DB_USER=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_PASSWORD=$(grep '^DB_PASSWORD=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_NAME=$(grep '^DB_NAME=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}❌ DB_PASSWORD not found in .env${NC}"
else
    echo "Testing connection to MySQL on port ${DB_PORT}..."
    mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" "$DB_NAME" 2>&1 | head -3
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ MySQL connection successful${NC}"
    else
        echo -e "${RED}❌ MySQL connection failed${NC}"
        echo "Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in .env"
    fi
fi
echo ""

# Step 4: Test Redis Connection (if configured)
echo "🔴 STEP 4: Testing Redis Configuration"
echo "----------------------------------------"
REDIS_HOST=$(grep '^REDIS_HOST=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
REDIS_PORT=$(grep '^REDIS_PORT=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
REDIS_PASSWORD=$(grep '^REDIS_PASSWORD=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PASSWORD" ]; then
    echo "Redis configured: ${REDIS_HOST}:${REDIS_PORT}"
    echo "Password length: ${#REDIS_PASSWORD} characters"
    # Check if password has quotes
    if [[ "$REDIS_PASSWORD" == *'"'* ]] || [[ "$REDIS_PASSWORD" == *"'"* ]]; then
        echo -e "${YELLOW}⚠️  Warning: Password may contain quotes${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Redis not configured (optional)${NC}"
fi
echo ""

# Step 5: Check Frontend Build
echo "📦 STEP 5: Checking Frontend Build"
echo "----------------------------------------"
cd /var/www/lms-app

if [ -d ".next/standalone" ]; then
    echo -e "${GREEN}✅ Frontend build exists${NC}"
    ls -lh .next/standalone | head -3
else
    echo -e "${YELLOW}⚠️  Frontend build missing - will rebuild${NC}"
    echo ""
    echo "Building frontend (this may take 2-5 minutes)..."
    
    # Fix permissions
    sudo chown -R dev749inspire:dev749inspire node_modules 2>/dev/null
    sudo chmod -R +x node_modules/.bin 2>/dev/null
    
    # Build
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend build successful${NC}"
    else
        echo -e "${RED}❌ Frontend build failed${NC}"
        echo "Check build errors above"
        exit 1
    fi
fi
echo ""

# Step 6: Check PM2 Logs for Errors
echo "📋 STEP 6: Checking Previous PM2 Logs"
echo "----------------------------------------"
cd /var/www/lms-app/backend

if [ -f "logs/pm2-server-error.log" ]; then
    echo "Recent backend errors:"
    tail -10 logs/pm2-server-error.log | grep -i "error\|failed\|killed" | tail -5 || echo "No recent errors"
fi

if [ -f "logs/pm2-frontend-error.log" ]; then
    echo ""
    echo "Recent frontend errors:"
    tail -10 logs/pm2-frontend-error.log | grep -i "error\|failed\|killed" | tail -5 || echo "No recent errors"
fi
echo ""

# Step 7: Stop All PM2 Processes
echo "🛑 STEP 7: Stopping All PM2 Processes"
echo "----------------------------------------"
pm2 delete all 2>/dev/null
pm2 kill 2>/dev/null
sleep 2
echo -e "${GREEN}✅ All PM2 processes stopped${NC}"
echo ""

# Step 8: Start All Services
echo "🚀 STEP 8: Starting All PM2 Services"
echo "----------------------------------------"
pm2 start ecosystem.config.js --update-env
echo ""
echo "Waiting 35 seconds for services to initialize..."
sleep 35
echo ""

# Step 9: Check PM2 Status
echo "📊 STEP 9: PM2 Status"
echo "----------------------------------------"
pm2 status
echo ""

# Check if any services are errored
ERRORED=$(pm2 jlist | grep -o '"status":"errored"' | wc -l)
if [ "$ERRORED" -gt 0 ]; then
    echo -e "${RED}❌ Some services are errored!${NC}"
    echo "Checking logs..."
    pm2 logs --lines 20 --err --nostream | tail -30
    echo ""
fi

# Step 10: Check Ports
echo "🔍 STEP 10: Checking Ports"
echo "----------------------------------------"
PORTS=$(sudo ss -tlnp | grep -E ':(3000|5000)')
if [ -n "$PORTS" ]; then
    echo -e "${GREEN}✅ Services listening on ports:${NC}"
    echo "$PORTS"
else
    echo -e "${RED}❌ No services listening on ports 3000 or 5000${NC}"
fi
echo ""

# Step 11: Test Backend Health
echo "🧪 STEP 11: Testing Backend Health"
echo "----------------------------------------"
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health 2>/dev/null)
if [ "$BACKEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Backend health check: OK (HTTP $BACKEND_HEALTH)${NC}"
    curl -s http://localhost:5000/health | python3 -m json.tool 2>/dev/null | head -20 || curl -s http://localhost:5000/health | head -20
else
    echo -e "${RED}❌ Backend health check failed (HTTP $BACKEND_HEALTH)${NC}"
    echo "Testing connection..."
    curl -I http://localhost:5000/health 2>&1 | head -5
fi
echo ""

# Step 12: Test Backend Login Endpoint
echo "🔐 STEP 12: Testing Backend Login Endpoint"
echo "----------------------------------------"
LOGIN_TEST=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' 2>/dev/null)

if [ "$LOGIN_TEST" = "200" ] || [ "$LOGIN_TEST" = "401" ] || [ "$LOGIN_TEST" = "400" ]; then
    echo -e "${GREEN}✅ Login endpoint responding (HTTP $LOGIN_TEST)${NC}"
    echo "Endpoint is accessible (401/400 is expected for invalid credentials)"
else
    echo -e "${RED}❌ Login endpoint not responding (HTTP $LOGIN_TEST)${NC}"
    echo "Testing connection..."
    curl -I -X POST http://localhost:5000/api/auth/login 2>&1 | head -5
fi
echo ""

# Step 13: Test Frontend
echo "🎨 STEP 13: Testing Frontend"
echo "----------------------------------------"
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$FRONTEND_TEST" = "200" ] || [ "$FRONTEND_TEST" = "304" ]; then
    echo -e "${GREEN}✅ Frontend responding (HTTP $FRONTEND_TEST)${NC}"
else
    echo -e "${RED}❌ Frontend not responding (HTTP $FRONTEND_TEST)${NC}"
    echo "Testing connection..."
    curl -I http://localhost:3000 2>&1 | head -5
fi
echo ""

# Step 14: Check Recent PM2 Logs
echo "📋 STEP 14: Recent PM2 Logs (Last 20 lines)"
echo "----------------------------------------"
pm2 logs --lines 20 --nostream | tail -40
echo ""

# Step 15: Reload Nginx
echo "🔄 STEP 15: Reloading Nginx"
echo "----------------------------------------"
if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx reloaded${NC}"
else
    echo -e "${RED}❌ Nginx configuration test failed${NC}"
    sudo nginx -t
fi
echo ""

# Summary
echo "=========================================="
echo "  SUMMARY"
echo "=========================================="
echo ""
pm2 status
echo ""
echo "Ports:"
sudo ss -tlnp | grep -E ':(3000|5000)' || echo "No services listening"
echo ""
echo "Backend Health:"
curl -s http://localhost:5000/health 2>/dev/null | grep -o '"status":"[^"]*"' || echo "Backend not responding"
echo ""
echo "=========================================="
echo "  DIAGNOSTIC COMPLETE"
echo "=========================================="
echo ""
echo "If services are not running, check logs with:"
echo "  pm2 logs --lines 50"
echo ""
echo "If login fails, check backend logs:"
echo "  pm2 logs lms-server --lines 50"
echo ""


