# VPS Status Check - Connection Timeout Fix

## Problem
Website not loading - ERR_CONNECTION_TIMED_OUT

## Quick Diagnostics

### 1. Check if services are running
```bash
pm2 status
```

### 2. Check if Nginx is running
```bash
sudo systemctl status nginx
```

### 3. Check if ports are listening
```bash
# Check if ports 80, 443, 3000, 5000 are listening
sudo netstat -tulpn | grep -E ":(80|443|3000|5000)"
# OR
sudo ss -tulpn | grep -E ":(80|443|3000|5000)"
```

### 4. Check Nginx error logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### 5. Check PM2 logs
```bash
pm2 logs --lines 50
```

## Common Fixes

### Fix 1: Restart all services
```bash
# Restart PM2 services
pm2 restart all

# Restart Nginx
sudo systemctl restart nginx

# Check status
pm2 status
sudo systemctl status nginx
```

### Fix 2: Check if frontend/backend crashed
```bash
# Check PM2 logs for errors
pm2 logs lms-frontend --lines 50
pm2 logs lms-server --lines 50

# If crashed, restart
pm2 restart lms-frontend
pm2 restart lms-server
```

### Fix 3: Check firewall
```bash
# Check firewall status
sudo ufw status

# If ports are blocked, allow them
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Fix 4: Check if services are actually listening
```bash
# Check what's listening on ports
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :3000
sudo lsof -i :5000
```

### Fix 5: Test backend directly
```bash
# Test if backend is accessible
curl http://localhost:5000/health
curl http://localhost:3000
```

### Fix 6: Check Nginx configuration
```bash
# Test Nginx config
sudo nginx -t

# If errors, check config
sudo nano /etc/nginx/sites-available/default
# OR
sudo nano /etc/nginx/sites-available/lms.inspirelondoncollege.com
```

## Emergency Restart Everything
```bash
# Stop everything
pm2 stop all
sudo systemctl stop nginx

# Start everything
pm2 start all
sudo systemctl start nginx

# Check status
pm2 status
sudo systemctl status nginx
```

## If Still Not Working

### Check system resources
```bash
# Check memory
free -h

# Check disk space
df -h

# Check CPU
top
```

### Check if VPS is accessible
```bash
# Ping test
ping lms.inspirelondoncollege.com

# Check DNS
nslookup lms.inspirelondoncollege.com
```

