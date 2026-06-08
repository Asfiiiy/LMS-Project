#!/bin/bash
# Script to fix intermittent 502 Bad Gateway errors in Nginx
# This script provides instructions and shows what needs to be added

echo "🔧 Fixing Nginx 502 Bad Gateway Errors"
echo "======================================="
echo ""
echo "This script will help you add timeout and retry settings to your Nginx config."
echo ""

# Detect Nginx config location
NGINX_SITE_CONFIG="/etc/nginx/sites-available/lms"
if [ ! -f "$NGINX_SITE_CONFIG" ]; then
    # Try to find the config file
    POSSIBLE_CONFIGS=$(find /etc/nginx/sites-available -name "*lms*" -o -name "default" 2>/dev/null | head -1)
    if [ -n "$POSSIBLE_CONFIGS" ]; then
        NGINX_SITE_CONFIG="$POSSIBLE_CONFIGS"
    else
        echo "❌ Could not find Nginx site configuration"
        echo "   Please edit your Nginx config file manually"
        echo "   Usually located at: /etc/nginx/sites-available/lms or /etc/nginx/sites-available/default"
        exit 1
    fi
fi

echo "📄 Found Nginx config: $NGINX_SITE_CONFIG"
echo ""

# Check if already fixed
if grep -q "proxy_connect_timeout 60s" "$NGINX_SITE_CONFIG" 2>/dev/null; then
    echo "✅ Timeout settings already exist in the config!"
    echo ""
    echo "Current timeout settings:"
    grep -A 2 "proxy_connect_timeout\|proxy_read_timeout\|proxy_next_upstream" "$NGINX_SITE_CONFIG" | head -10
    echo ""
    echo "If you're still seeing 502 errors, check:"
    echo "  1. Backend status: pm2 status"
    echo "  2. Backend logs: pm2 logs lms-server --lines 50"
    echo "  3. Nginx error logs: sudo tail -50 /var/log/nginx/error.log"
    exit 0
fi

echo "📝 MANUAL INSTRUCTIONS:"
echo "======================"
echo ""
echo "1. Edit your Nginx config file:"
echo "   sudo nano $NGINX_SITE_CONFIG"
echo ""
echo "2. Find your location /api/ block (or location blocks that proxy to backend)"
echo ""
echo "3. Add these settings AFTER the proxy_pass line:"
echo ""
echo "   # Connection and timeout settings (fixes 502 errors)"
echo "   proxy_connect_timeout 60s;"
echo "   proxy_send_timeout 600s;"
echo "   proxy_read_timeout 600s;"
echo "   "
echo "   # Retry on backend failures"
echo "   proxy_next_upstream error timeout http_502 http_503 http_504;"
echo "   proxy_next_upstream_tries 3;"
echo "   proxy_next_upstream_timeout 10s;"
echo "   "
echo "   # Buffer settings"
echo "   proxy_buffering on;"
echo "   proxy_buffer_size 4k;"
echo "   proxy_buffers 8 4k;"
echo "   "
echo "   # Keep-alive (if not already present)"
echo "   proxy_http_version 1.1;"
echo "   proxy_set_header Connection \"\";"
echo ""
echo "4. Save and test:"
echo "   sudo nginx -t"
echo ""
echo "5. If test passes, reload:"
echo "   sudo systemctl reload nginx"
echo ""
echo "📋 Full example location block:"
echo "================================"
cat << 'EXAMPLE'
location /api/ {
    proxy_pass http://localhost:5000;
    
    # Connection and timeout settings (fixes 502 errors)
    proxy_connect_timeout 60s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    
    # Retry on backend failures
    proxy_next_upstream error timeout http_502 http_503 http_504;
    proxy_next_upstream_tries 3;
    proxy_next_upstream_timeout 10s;
    
    # Buffer settings
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    
    # Keep-alive
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    
    # Standard headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
EXAMPLE

echo ""
echo "💡 What these settings do:"
echo "  - proxy_connect_timeout: Wait up to 60s to connect to backend"
echo "  - proxy_read_timeout: Wait up to 10 minutes for backend response"
echo "  - proxy_next_upstream: Retry failed requests automatically"
echo "  - proxy_next_upstream_tries: Try up to 3 times before giving up"
echo ""
echo "✅ After applying these changes, 502 errors should be much less frequent!"

