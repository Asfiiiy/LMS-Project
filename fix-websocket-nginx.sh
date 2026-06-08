#!/bin/bash

# One-command script to check, add, verify, and test WebSocket Nginx configuration
# Usage: sudo bash fix-websocket-nginx.sh

NGINX_CONFIG="/etc/nginx/sites-available/lms"
WEBSOCKET_BLOCK='location /socket.io/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_buffering off;
    proxy_cache off;
}'

echo "=========================================="
echo "WebSocket Nginx Configuration Checker"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Error: Please run with sudo"
    echo "Usage: sudo bash fix-websocket-nginx.sh"
    exit 1
fi

# Check if config file exists
if [ ! -f "$NGINX_CONFIG" ]; then
    echo "❌ Error: Nginx config file not found: $NGINX_CONFIG"
    echo "Please update NGINX_CONFIG variable in the script"
    exit 1
fi

echo "📋 Step 1: Checking if WebSocket block exists..."
echo ""

# Check if socket.io location block exists
if grep -q "location /socket.io/" "$NGINX_CONFIG"; then
    echo "✅ WebSocket block already exists in config"
    echo ""
    echo "Current WebSocket configuration:"
    echo "-----------------------------------"
    grep -A 15 "location /socket.io/" "$NGINX_CONFIG" | head -16
    echo "-----------------------------------"
    echo ""
else
    echo "⚠️  WebSocket block NOT found"
    echo ""
    echo "📝 Step 2: Adding WebSocket block..."
    echo ""
    
    # Create backup
    BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$NGINX_CONFIG" "$BACKUP_FILE"
    echo "✅ Backup created: $BACKUP_FILE"
    echo ""
    
    # Find the /api location block and add WebSocket block before it
    if grep -q "location /api" "$NGINX_CONFIG"; then
        # Use sed to insert before /api block
        sed -i '/location \/api/i\
    # WebSocket proxy for Socket.IO (MUST BE BEFORE /api block)\
    location /socket.io/ {\
        proxy_pass http://localhost:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_read_timeout 86400s;\
        proxy_send_timeout 86400s;\
        proxy_buffering off;\
        proxy_cache off;\
    }\
' "$NGINX_CONFIG"
        echo "✅ WebSocket block added before /api location"
    else
        # If no /api block, add at the end of server block (before closing brace)
        if grep -q "^}" "$NGINX_CONFIG"; then
            sed -i '/^}/i\
    # WebSocket proxy for Socket.IO\
    location /socket.io/ {\
        proxy_pass http://localhost:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_read_timeout 86400s;\
        proxy_send_timeout 86400s;\
        proxy_buffering off;\
        proxy_cache off;\
    }\
' "$NGINX_CONFIG"
            echo "✅ WebSocket block added to config"
        else
            echo "❌ Error: Could not find insertion point in config file"
            exit 1
        fi
    fi
    echo ""
fi

echo "📋 Step 3: Verifying WebSocket block was added..."
echo ""

if grep -q "location /socket.io/" "$NGINX_CONFIG"; then
    echo "✅ Verification: WebSocket block is present"
    echo ""
    echo "Current WebSocket configuration:"
    echo "-----------------------------------"
    grep -A 15 "location /socket.io/" "$NGINX_CONFIG" | head -16
    echo "-----------------------------------"
    echo ""
else
    echo "❌ Error: WebSocket block verification failed"
    exit 1
fi

echo "📋 Step 4: Testing Nginx configuration..."
echo ""

if nginx -t 2>&1; then
    echo ""
    echo "✅ Nginx configuration test PASSED"
    echo ""
    echo "📋 Step 5: Reloading Nginx..."
    echo ""
    
    if systemctl reload nginx 2>&1; then
        echo ""
        echo "✅ Nginx reloaded successfully"
        echo ""
        echo "=========================================="
        echo "✅ SUCCESS: WebSocket configuration complete!"
        echo "=========================================="
        echo ""
        echo "Next steps:"
        echo "1. Check browser console for WebSocket connection"
        echo "2. Verify Socket.IO is working"
        echo "3. Check Nginx logs if issues persist: sudo tail -f /var/log/nginx/error.log"
        echo ""
    else
        echo ""
        echo "❌ Error: Failed to reload Nginx"
        echo "Check logs: sudo journalctl -u nginx -n 50"
        exit 1
    fi
else
    echo ""
    echo "❌ Error: Nginx configuration test FAILED"
    echo ""
    echo "Restoring backup..."
    if ls ${NGINX_CONFIG}.backup.* 1> /dev/null 2>&1; then
        LATEST_BACKUP=$(ls -t ${NGINX_CONFIG}.backup.* | head -1)
        cp "$LATEST_BACKUP" "$NGINX_CONFIG"
        echo "✅ Backup restored: $LATEST_BACKUP"
    fi
    echo ""
    echo "Please check the Nginx configuration manually"
    exit 1
fi
