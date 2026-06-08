# LMS Restart & Troubleshooting Commands

## Quick Status Check

```bash
# Check all PM2 processes status
pm2 status

# Check if services are responding
curl -s http://localhost:5000/health
curl -s http://localhost:3000 | head -5

# Check if there are any ROOT PM2 processes (should be empty)
sudo pm2 list
```

---

## Restart Commands

### 1. Restart Individual Services

```bash
# Restart backend only
pm2 restart lms-backend --update-env

# Restart frontend only  
pm2 restart lms-frontend --update-env

# Restart worker only
pm2 restart lms-worker --update-env

# Restart ALL services
pm2 restart all --update-env
```

### 2. Complete Fresh Restart (if services are stuck)

```bash
# Stop all services
pm2 stop all

# Delete all processes
pm2 delete all

# Kill PM2 daemon
pm2 kill

# Start fresh from ecosystem config
cd /var/www/lms-app
pm2 start ecosystem.config.js

# Save the process list
pm2 save
```

### 3. If Services Won't Start (Nuclear Option)

```bash
# Clean everything and start fresh
pm2 kill
cd /var/www/lms-app
pm2 start ecosystem.config.js
pm2 save

# Check status
pm2 status
```

---

## Log Commands

```bash
# View real-time logs for all services
pm2 logs

# View logs for specific service
pm2 logs lms-backend
pm2 logs lms-frontend
pm2 logs lms-worker

# View last 50 lines of logs
pm2 logs lms-backend --lines 50 --nostream

# View error logs only
pm2 logs --err

# Clear all logs
pm2 flush
```

---

## Database Connection Test

```bash
# Test MySQL connection
mysql -h localhost -P 3399 -u lms_user -p"7wTpm7_cCHdnbNKHTUw_fw" db_lms -e "SELECT COUNT(*) FROM users;"

# Test Redis connection (if needed)
cd /var/www/lms-app/backend
node -e "require('dotenv').config({path: '.env'}); const Redis = require('ioredis'); const redis = new Redis(process.env.REDIS_URL); redis.ping((e,r) => {console.log(r || e); redis.quit();});"
```

---

## Nginx Commands

```bash
# Test Nginx configuration
sudo nginx -t

# Reload Nginx (after config changes)
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx
```

---

## Service Health Checks

```bash
# Check backend health
curl http://localhost:5000/health

# Check frontend (should return HTML)
curl -I http://localhost:3000

# Check via Nginx (through domain)
curl https://lms.inspirelondoncollege.com/health
```

---

## Useful PM2 Commands

```bash
# Monitor CPU and Memory in real-time
pm2 monit

# Show detailed info about a process
pm2 describe lms-backend

# Show process environment variables
pm2 env 0

# List saved processes
pm2 list

# Resurrect saved processes (after server reboot)
pm2 resurrect
```

---

## If Website Shows 502 Bad Gateway

```bash
# 1. Check if backend is running
pm2 status

# 2. Check if backend is responding
curl http://localhost:5000/health

# 3. If not responding, restart backend
pm2 restart lms-backend --update-env

# 4. Check backend logs for errors
pm2 logs lms-backend --lines 50

# 5. Reload Nginx
sudo systemctl reload nginx
```

---

## If Website Shows 404 Not Found

```bash
# 1. Check if frontend is running
pm2 status

# 2. Check if frontend is responding
curl -I http://localhost:3000

# 3. If not responding, restart frontend
pm2 restart lms-frontend --update-env

# 4. Check frontend logs
pm2 logs lms-frontend --lines 50
```

---

## One-Command Health Check Script

Save this as `check-lms.sh`:

```bash
#!/bin/bash
echo "=== LMS Health Check ==="
echo ""
echo "1. PM2 Services:"
pm2 status
echo ""
echo "2. Backend Health:"
curl -s http://localhost:5000/health || echo "❌ Backend not responding"
echo ""
echo "3. Frontend Health:"
curl -s -I http://localhost:3000 | head -1 || echo "❌ Frontend not responding"
echo ""
echo "4. MySQL Connection:"
mysql -h localhost -P 3399 -u lms_user -p"7wTpm7_cCHdnbNKHTUw_fw" -e "SELECT 1" 2>&1 | grep -q "ERROR" && echo "❌ MySQL error" || echo "✅ MySQL OK"
echo ""
echo "5. Nginx Status:"
sudo systemctl is-active nginx
echo ""
echo "=== Check Complete ==="
```

Make it executable:
```bash
chmod +x /var/www/lms-app/check-lms.sh
```

Run it:
```bash
/var/www/lms-app/check-lms.sh
```

---

## Emergency Contact Info

- **User**: dev749inspire
- **Project Path**: /var/www/lms-app
- **Backend Port**: 5000
- **Frontend Port**: 3000
- **MySQL Port**: 3399
- **Domain**: https://lms.inspirelondoncollege.com

---

## Auto-Restart on Server Reboot

PM2 processes are already saved. To ensure they start on boot, run once:

```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u dev749inspire --hp /home/dev749inspire
```

---

**Last Updated**: 2026-01-07
**Version**: Production v1.0

