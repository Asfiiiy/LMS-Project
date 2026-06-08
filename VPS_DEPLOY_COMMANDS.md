# VPS Deployment Commands - Complete Fix

## Step 1: Install Redis Adapter (Fix Peer Dependency Issue)

```bash
cd /var/www/lms-app/backend
npm install @socket.io/redis-adapter redis --legacy-peer-deps
```

## Step 2: Verify Redis is Running

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start it
sudo systemctl start redis
sudo systemctl enable redis
```

## Step 3: Set Redis Environment Variable (if needed)

```bash
cd /var/www/lms-app/backend

# Check if REDIS_URL is set
grep REDIS_URL .env

# If not set, add it
echo "REDIS_URL=redis://localhost:6379" >> .env
```

## Step 4: Restart Services

```bash
# Restart backend (to load Redis adapter)
cd /var/www/lms-app/backend
pm2 restart lms-server

# Restart frontend (already built, just restart)
cd /var/www/lms-app
pm2 restart lms-frontend
```

## Step 5: Verify Everything is Working

```bash
# Check PM2 status
pm2 status

# Check if Redis adapter is connected
pm2 logs lms-server --lines 30 | grep -i "redis\|adapter"

# Should see:
# ✅ [Socket] Redis adapter connected for cluster mode

# Check if notifications are working (no more errors)
pm2 logs lms-server --lines 50 | grep -i "notification\|chat"

# Check if messages are being delivered (should see sockets in room > 0)
pm2 logs lms-server --lines 50 | grep -i "sockets in room"
```

## Complete One-Liner (After Git Pull)

```bash
cd /var/www/lms-app/backend && npm install @socket.io/redis-adapter redis --legacy-peer-deps && echo "REDIS_URL=redis://localhost:6379" >> .env && pm2 restart lms-server && cd .. && pm2 restart lms-frontend && pm2 status
```

## Troubleshooting

### If Redis is not installed:
```bash
# Install Redis
sudo apt update
sudo apt install redis-server -y

# Start and enable Redis
sudo systemctl start redis
sudo systemctl enable redis

# Verify
redis-cli ping
```

### If still seeing "Sockets in room: 0":
1. Verify Redis adapter is connected (check logs)
2. Make sure Redis is running: `redis-cli ping`
3. Check REDIS_URL is set: `grep REDIS_URL /var/www/lms-app/backend/.env`
4. Restart all services: `pm2 restart all`

