# VPS Notification & Real-Time Chat Fix Guide

## Problem
Notifications and real-time messaging work on localhost but not on VPS production.

## Root Causes
1. **Nginx WebSocket Configuration Missing/Incorrect**
2. **Environment Variables Not Set**
3. **Socket.IO CORS Issues**
4. **Backend Not Running or Not Accessible**

## Step-by-Step Fix

### 1. Check Environment Variables on VPS

```bash
cd /var/www/lms-app
cat .env.local | grep -E "NEXT_PUBLIC_API_URL|NEXT_PUBLIC_SOCKET_URL"
```

**Should show:**
```
NEXT_PUBLIC_API_URL=https://lms.inspirelondoncollege.com
NEXT_PUBLIC_SOCKET_URL=https://lms.inspirelondoncollege.com
```

**If missing, add to `.env.local`:**
```bash
echo "NEXT_PUBLIC_API_URL=https://lms.inspirelondoncollege.com" >> .env.local
echo "NEXT_PUBLIC_SOCKET_URL=https://lms.inspirelondoncollege.com" >> .env.local
```

### 2. Verify Nginx WebSocket Configuration

```bash
sudo nano /etc/nginx/sites-available/default
# OR
sudo nano /etc/nginx/sites-available/lms.inspirelondoncollege.com
```

**The `/socket.io/` location block MUST be BEFORE the `/api` block:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name lms.inspirelondoncollege.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name lms.inspirelondoncollege.com;
    
    # SSL configuration (your existing certs)
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # WebSocket proxy for Socket.IO (MUST BE FIRST/BEFORE /api)
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
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Test Nginx Configuration

```bash
sudo nginx -t
```

If OK, reload:
```bash
sudo systemctl reload nginx
```

### 4. Verify Backend Socket.IO is Running

```bash
# Check PM2 status
pm2 status

# Check backend logs
pm2 logs lms-server --lines 50 | grep -i "socket\|Server running"
```

**Should see:**
```
✅ Server running on port 5000 with Socket.IO
```

### 5. Test Socket.IO Connection from VPS

```bash
# Test if Socket.IO endpoint is accessible
curl -i http://localhost:5000/socket.io/?EIO=4&transport=polling

# Should return HTTP 200 with Socket.IO handshake
```

### 6. Check Backend Socket.IO CORS

Verify `backend/socket.js` has correct CORS:

```javascript
cors: { 
  origin: process.env.NODE_ENV === 'production' 
    ? ["https://lms.inspirelondoncollege.com", "https://www.lms.inspirelondoncollege.com"]
    : ["http://localhost:3000", "http://localhost:5000"],
  methods: ["GET", "POST"],
  credentials: true
}
```

### 7. Rebuild Frontend with Environment Variables

```bash
cd /var/www/lms-app
npm run build
pm2 restart lms-frontend
```

### 8. Check Browser Console for Errors

Open browser DevTools (F12) → Console tab, look for:
- `WebSocket connection failed`
- `ERR_SSL_PROTOCOL_ERROR`
- `502 Bad Gateway`
- `CORS error`

### 9. Verify Socket Connection in Browser

In browser console, you should see:
```
🔌 [ChatBox] Connecting to socket: https://lms.inspirelondoncollege.com
✅ [ChatBox] Socket connected: [socket-id]
```

## Debugging Commands

### Check Nginx Error Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### Check Backend Logs
```bash
pm2 logs lms-server --lines 100 | grep -i "socket\|connection\|error"
```

### Check Frontend Logs
```bash
pm2 logs lms-frontend --lines 50
```

### Test WebSocket Connection
```bash
# Install wscat if needed
npm install -g wscat

# Test WebSocket connection
wscat -c wss://lms.inspirelondoncollege.com/socket.io/?EIO=4&transport=websocket
```

## Common Issues & Solutions

### Issue 1: 502 Bad Gateway
**Cause:** Nginx can't reach backend on port 5000
**Fix:**
```bash
# Verify backend is running
pm2 status
netstat -tulpn | grep 5000

# Restart backend
cd /var/www/lms-app/backend
pm2 restart lms-server
```

### Issue 2: ERR_SSL_PROTOCOL_ERROR
**Cause:** Trying to connect to port 5000 over HTTPS
**Fix:** Ensure `NEXT_PUBLIC_SOCKET_URL` does NOT include port 5000:
```bash
# WRONG
NEXT_PUBLIC_SOCKET_URL=https://lms.inspirelondoncollege.com:5000

# CORRECT
NEXT_PUBLIC_SOCKET_URL=https://lms.inspirelondoncollege.com
```

### Issue 3: CORS Errors
**Cause:** Backend CORS not allowing production domain
**Fix:** Check `backend/socket.js` CORS configuration includes your domain

### Issue 4: Notifications Not Appearing
**Cause:** User not joining notification room
**Fix:** Check browser console for:
```
✅ Socket joined notification room for user [userId]
```

### Issue 5: Messages Not Appearing in Real-Time
**Cause:** Socket not joining conversation room
**Fix:** Check backend logs for:
```
✅ [Socket] Socket [id] (user [userId]) joined conversation [id]
```

## Quick Fix Script

Run this script to check and fix common issues:

```bash
#!/bin/bash
echo "🔍 Checking VPS Socket.IO Configuration..."

# Check environment variables
echo "1. Checking environment variables..."
if grep -q "NEXT_PUBLIC_SOCKET_URL" /var/www/lms-app/.env.local; then
    echo "✅ NEXT_PUBLIC_SOCKET_URL found"
    grep "NEXT_PUBLIC_SOCKET_URL" /var/www/lms-app/.env.local
else
    echo "❌ NEXT_PUBLIC_SOCKET_URL missing"
    echo "NEXT_PUBLIC_SOCKET_URL=https://lms.inspirelondoncollege.com" >> /var/www/lms-app/.env.local
    echo "✅ Added NEXT_PUBLIC_SOCKET_URL"
fi

# Check Nginx configuration
echo "2. Checking Nginx WebSocket configuration..."
if grep -q "location /socket.io/" /etc/nginx/sites-available/default; then
    echo "✅ Nginx WebSocket config found"
else
    echo "❌ Nginx WebSocket config missing - see nginx-websocket-fix.conf"
fi

# Check backend is running
echo "3. Checking backend status..."
if pm2 list | grep -q "lms-server.*online"; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running"
    echo "Starting backend..."
    cd /var/www/lms-app/backend && pm2 start ecosystem.config.js
fi

# Check Socket.IO in logs
echo "4. Checking Socket.IO initialization..."
if pm2 logs lms-server --lines 10 --nostream | grep -q "Socket.IO"; then
    echo "✅ Socket.IO initialized"
else
    echo "⚠️ Socket.IO not found in logs"
fi

echo "✅ Check complete!"
```

## Final Verification Checklist

- [ ] Environment variables set in `.env.local`
- [ ] Nginx WebSocket config present and BEFORE `/api` block
- [ ] Nginx config tested and reloaded
- [ ] Backend running with Socket.IO
- [ ] Frontend rebuilt with environment variables
- [ ] Browser console shows successful Socket connection
- [ ] Notifications appear in real-time
- [ ] Chat messages appear in real-time

## Still Not Working?

1. **Check firewall:** Ensure ports 80, 443, 3000, 5000 are open
2. **Check SSL certificate:** Ensure valid SSL for WebSocket upgrade
3. **Check backend logs:** `pm2 logs lms-server --lines 100`
4. **Check Nginx logs:** `sudo tail -f /var/log/nginx/error.log`
5. **Test direct connection:** `curl http://localhost:5000/socket.io/`

