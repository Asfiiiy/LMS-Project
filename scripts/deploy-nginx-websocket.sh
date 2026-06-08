#!/bin/bash
# Deploy Nginx WebSocket proxy for Socket.IO
# Run with: sudo bash scripts/deploy-nginx-websocket.sh
#
# Fixes: WebSocket connection to 'wss://.../socket.io/...' failed
#        [Socket] Connection error: websocket error

set -e

NGINX_SITES="/etc/nginx/sites-available"
for name in lms default; do
  [ -f "${NGINX_SITES}/${name}" ] && NGINX_SITE="${NGINX_SITES}/${name}" && break
done
NGINX_SITE="${NGINX_SITE:-${NGINX_SITES}/default}"

if [ ! -f "$NGINX_SITE" ]; then
  echo "❌ Nginx site config not found. Run: ls /etc/nginx/sites-available/"
  exit 1
fi

if grep -q "location.*socket\.io" "$NGINX_SITE" 2>/dev/null; then
  echo "✅ WebSocket proxy for /socket.io already in $NGINX_SITE"
  echo "   If still failing: sudo nginx -t && sudo systemctl reload nginx"
  exit 0
fi

echo "📋 WebSocket proxy NOT found. Add this block to $NGINX_SITE"
echo "   Place it INSIDE the server { } block, BEFORE 'location /api'"
echo ""
echo "=============================================="
cat << 'BLOCK'

    location /socket.io/ {
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
    }

==============================================
BLOCK
echo ""
echo "Then run: sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "Reference: nginx-websocket-fix.conf in project root"
