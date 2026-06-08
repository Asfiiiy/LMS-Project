#!/bin/bash

echo "🔍 VPS Socket.IO & Notification Diagnostic Tool"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check environment variables
echo "1️⃣ Checking Environment Variables..."
if [ -f "/var/www/lms-app/.env.local" ]; then
    if grep -q "NEXT_PUBLIC_SOCKET_URL" /var/www/lms-app/.env.local; then
        SOCKET_URL=$(grep "NEXT_PUBLIC_SOCKET_URL" /var/www/lms-app/.env.local | cut -d '=' -f2)
        echo -e "${GREEN}✅ NEXT_PUBLIC_SOCKET_URL: $SOCKET_URL${NC}"
        
        # Check if port 5000 is included (WRONG)
        if [[ "$SOCKET_URL" == *":5000"* ]]; then
            echo -e "${RED}❌ ERROR: NEXT_PUBLIC_SOCKET_URL includes port 5000!${NC}"
            echo -e "${YELLOW}   Should be: https://lms.inspirelondoncollege.com${NC}"
            echo -e "${YELLOW}   Not: https://lms.inspirelondoncollege.com:5000${NC}"
        fi
    else
        echo -e "${RED}❌ NEXT_PUBLIC_SOCKET_URL not found in .env.local${NC}"
        echo -e "${YELLOW}   Adding it now...${NC}"
        echo "NEXT_PUBLIC_SOCKET_URL=https://lms.inspirelondoncollege.com" >> /var/www/lms-app/.env.local
        echo -e "${GREEN}✅ Added NEXT_PUBLIC_SOCKET_URL${NC}"
    fi
    
    if grep -q "NEXT_PUBLIC_API_URL" /var/www/lms-app/.env.local; then
        API_URL=$(grep "NEXT_PUBLIC_API_URL" /var/www/lms-app/.env.local | cut -d '=' -f2)
        echo -e "${GREEN}✅ NEXT_PUBLIC_API_URL: $API_URL${NC}"
    else
        echo -e "${RED}❌ NEXT_PUBLIC_API_URL not found${NC}"
    fi
else
    echo -e "${RED}❌ .env.local file not found at /var/www/lms-app/.env.local${NC}"
fi

echo ""

# 2. Check Nginx WebSocket configuration
echo "2️⃣ Checking Nginx WebSocket Configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/default"
if [ -f "/etc/nginx/sites-available/lms.inspirelondoncollege.com" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/lms.inspirelondoncollege.com"
fi

if grep -q "location /socket.io/" "$NGINX_CONFIG"; then
    echo -e "${GREEN}✅ WebSocket location block found${NC}"
    
    # Check if it has the required headers
    if grep -q "proxy_set_header Upgrade" "$NGINX_CONFIG" && grep -q "proxy_set_header Connection" "$NGINX_CONFIG"; then
        echo -e "${GREEN}✅ WebSocket headers configured${NC}"
    else
        echo -e "${RED}❌ WebSocket headers missing!${NC}"
    fi
    
    # Check order - socket.io should be before /api
    SOCKET_LINE=$(grep -n "location /socket.io/" "$NGINX_CONFIG" | cut -d: -f1)
    API_LINE=$(grep -n "location /api" "$NGINX_CONFIG" | cut -d: -f1)
    
    if [ ! -z "$SOCKET_LINE" ] && [ ! -z "$API_LINE" ]; then
        if [ "$SOCKET_LINE" -lt "$API_LINE" ]; then
            echo -e "${GREEN}✅ WebSocket block is BEFORE /api block (correct order)${NC}"
        else
            echo -e "${RED}❌ ERROR: WebSocket block is AFTER /api block!${NC}"
            echo -e "${YELLOW}   WebSocket block MUST be before /api block${NC}"
        fi
    fi
else
    echo -e "${RED}❌ WebSocket location block NOT found in Nginx config!${NC}"
    echo -e "${YELLOW}   See: nginx-websocket-fix.conf for configuration${NC}"
fi

echo ""

# 3. Check backend status
echo "3️⃣ Checking Backend Status..."
if pm2 list | grep -q "lms-server.*online"; then
    echo -e "${GREEN}✅ Backend (lms-server) is running${NC}"
    
    # Check if Socket.IO is initialized
    if pm2 logs lms-server --lines 20 --nostream 2>/dev/null | grep -q "Socket.IO\|socket"; then
        echo -e "${GREEN}✅ Socket.IO appears to be initialized${NC}"
    else
        echo -e "${YELLOW}⚠️ Socket.IO not found in recent logs${NC}"
    fi
else
    echo -e "${RED}❌ Backend (lms-server) is NOT running!${NC}"
    echo -e "${YELLOW}   Start with: cd /var/www/lms-app/backend && pm2 start ecosystem.config.js${NC}"
fi

echo ""

# 4. Test backend Socket.IO endpoint
echo "4️⃣ Testing Backend Socket.IO Endpoint..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/socket.io/?EIO=4&transport=polling | grep -q "200\|400"; then
    echo -e "${GREEN}✅ Backend Socket.IO endpoint is accessible${NC}"
else
    echo -e "${RED}❌ Backend Socket.IO endpoint is NOT accessible${NC}"
    echo -e "${YELLOW}   Check if backend is running on port 5000${NC}"
fi

echo ""

# 5. Check frontend status
echo "5️⃣ Checking Frontend Status..."
if pm2 list | grep -q "lms-frontend.*online"; then
    echo -e "${GREEN}✅ Frontend (lms-frontend) is running${NC}"
else
    echo -e "${RED}❌ Frontend (lms-frontend) is NOT running!${NC}"
fi

echo ""

# 6. Check Nginx status
echo "6️⃣ Checking Nginx Status..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx is running${NC}"
    
    # Test Nginx config
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
    else
        echo -e "${RED}❌ Nginx configuration has errors!${NC}"
        echo -e "${YELLOW}   Run: sudo nginx -t${NC}"
    fi
else
    echo -e "${RED}❌ Nginx is NOT running!${NC}"
fi

echo ""

# 7. Check ports
echo "7️⃣ Checking Ports..."
if netstat -tulpn 2>/dev/null | grep -q ":5000"; then
    echo -e "${GREEN}✅ Port 5000 is in use (backend)${NC}"
else
    echo -e "${RED}❌ Port 5000 is NOT in use!${NC}"
fi

if netstat -tulpn 2>/dev/null | grep -q ":3000"; then
    echo -e "${GREEN}✅ Port 3000 is in use (frontend)${NC}"
else
    echo -e "${YELLOW}⚠️ Port 3000 is NOT in use (might be proxied)${NC}"
fi

echo ""

# Summary
echo "================================================"
echo "📋 Summary & Recommendations"
echo "================================================"
echo ""
echo "If notifications/chat are not working:"
echo "1. Ensure NEXT_PUBLIC_SOCKET_URL is set (without port 5000)"
echo "2. Ensure Nginx has WebSocket config BEFORE /api block"
echo "3. Restart services:"
echo "   cd /var/www/lms-app/backend && pm2 restart lms-server"
echo "   cd /var/www/lms-app && npm run build && pm2 restart lms-frontend"
echo "   sudo systemctl reload nginx"
echo ""
echo "Check logs:"
echo "   pm2 logs lms-server --lines 50 | grep -i socket"
echo "   sudo tail -f /var/log/nginx/error.log"
echo ""

