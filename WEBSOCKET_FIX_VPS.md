# WebSocket 502 Error Fix - VPS Setup Guide

## Problem
WebSocket connections to Socket.IO are failing with **502 Bad Gateway** error:
```
WebSocket connection to 'wss://lms.inspirelondoncollege.com/socket.io/...' failed: 
Error during WebSocket handshake: Unexpected response code: 502
```

## Solution
Add WebSocket proxy configuration to Nginx.

## Steps to Fix on VPS

### 1. SSH into your VPS
```bash
ssh your-user@your-vps-ip
```

### 2. Edit Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/lms
```

### 3. Add WebSocket proxy block BEFORE the `/api` location block

Find your existing `/api` location block and add this **BEFORE** it:

```nginx
# WebSocket proxy for Socket.IO (MUST BE BEFORE /api block)
location /socket.io/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    
    # WebSocket upgrade headers (CRITICAL)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket timeouts (long-lived connections)
    proxy_read_timeout 86400s;  # 24 hours
    proxy_send_timeout 86400s;  # 24 hours
    
    # Disable buffering for WebSocket
    proxy_buffering off;
    proxy_cache off;
}
```

### 4. Test Nginx configuration
```bash
sudo nginx -t
```

### 5. Reload Nginx
```bash
sudo systemctl reload nginx
```

### 6. Verify WebSocket is working
- Open browser console on your site
- Check for WebSocket connection errors
- Should see successful Socket.IO connection

## Important Notes

1. **Order Matters**: The `/socket.io/` location block MUST be placed BEFORE the `/api` location block in your Nginx config.

2. **Upgrade Headers**: The `Upgrade` and `Connection` headers are CRITICAL for WebSocket to work.

3. **Timeouts**: WebSocket connections are long-lived, so we set long timeouts (24 hours).

4. **No Buffering**: WebSocket requires real-time streaming, so buffering must be disabled.

## Troubleshooting

### If you still get 502 errors:
1. Check backend is running: `pm2 status`
2. Check backend logs: `pm2 logs lms-server --lines 50`
3. Verify Socket.IO is initialized: Look for "Server running on port 5000 with Socket.IO" in logs
4. Test backend directly: `curl http://localhost:5000/socket.io/`

### If WebSocket connects but disconnects immediately:
- Check firewall: `sudo ufw status`
- Verify backend Socket.IO CORS settings in `backend/socket.js`

### Check Nginx error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

## Full Example Nginx Config

See `nginx-websocket-fix.conf` for a complete example server block.

