# WebSocket / Socket.IO Deployment Guide

## Problem

The student dashboard shows:

```
WebSocket connection to 'wss://lms.inspirelondoncollege.com/socket.io/?EIO=4&transport=websocket' failed
[Socket] Connection error: websocket error
[Navbar] Socket connection error: websocket error
[Navbar] Socket disconnected: transport close
```

## Cause

The frontend connects to Socket.IO at `wss://lms.inspirelondoncollege.com/socket.io/`. Nginx proxies `/api` to the backend (port 5000) but **does not proxy `/socket.io`**. WebSocket upgrade requests never reach the backend, so the connection fails.

## Solution

Add a WebSocket proxy block for `/socket.io` in your Nginx site configuration.

### Step 1: Edit Nginx config

```bash
sudo nano /etc/nginx/sites-available/lms
```

(Or your actual site config file – check `ls /etc/nginx/sites-available/`)

### Step 2: Add the block

Inside the `server { }` block for HTTPS (port 443), add this **before** the `location /api` block:

```nginx
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
```

### Step 3: Test and reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Verify

1. Ensure the backend is running: `curl -s http://localhost:5000/api/health`
2. Open the student dashboard and check the browser console – the WebSocket errors should be gone.

## Helper script

From the project root:

```bash
sudo bash scripts/deploy-nginx-websocket.sh
```

This checks if the WebSocket block is already present and prints the block to add if it is missing.

## Reference

- Full example: `nginx-websocket-fix.conf` in project root
