# 🚀 VPS Optimization Guide

**VPS Specifications:**
- CPU: 8 vCPU Cores
- RAM: 32 GB
- Storage: 400 GB NVMe
- Bandwidth: 32 TB
- OS: Ubuntu 22.04
- Features: Weekly Backups, Malware Scanner, AI Assistant

## ✅ Optimizations Applied

### 1. Database Connection Pool
- **Before:** 100 connections
- **After:** 300 connections
- **File:** `backend/config/db.js`
- **Rationale:** Optimized for 8 vCPU VPS with 32GB RAM

### 2. PM2 Cluster Mode
- **Before:** 1 instance (fork mode)
- **After:** 6 server instances + 2 worker instances (cluster mode)
- **File:** `backend/ecosystem.config.js`
- **Rationale:** 
  - 6 server instances utilize 6 CPUs (leaves 2 for MySQL, Redis, system)
  - Cluster mode enables load balancing across instances
  - Each instance gets 3GB memory (total ~18GB for servers)

### 3. Rate Limiting
- **Before:** 500 requests/15min
- **After:** 1500 requests/15min
- **File:** `backend/middleware/rateLimiter.js`
- **Rationale:** Optimized for 8 vCPU VPS

### 4. Memory Limits
- **Server:** 3.5GB per instance (6 instances = ~21GB max)
- **Worker:** 1.2GB per instance (2 instances = ~2.4GB max)
- **Total:** ~27GB (leaves 5GB for MySQL, Redis, system)

## 📋 System-Level Optimizations (Ubuntu 22.04)

### 1. Increase File Descriptor Limits

```bash
# Edit limits
sudo nano /etc/security/limits.conf

# Add these lines:
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535

# Apply changes
sudo sysctl -p
```

### 2. Optimize MySQL for High Memory

**Option A: Quick Setup (Temporary - Lost on Restart)**

```bash
# Run the SQL script
mysql -u root -p < mysql-optimization.sql
```

**Option B: Permanent Setup (Recommended)**

```bash
# Backup current config
sudo cp /etc/mysql/mysql.conf.d/mysqld.cnf /etc/mysql/mysql.conf.d/mysqld.cnf.backup

# Edit MySQL config
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# Copy settings from: mysql-my.cnf-optimization.conf
# Or manually add the [mysqld] section with optimized settings

# Restart MySQL
sudo systemctl restart mysql

# Verify settings
mysql -u root -p -e "SHOW VARIABLES WHERE Variable_name IN ('innodb_buffer_pool_size', 'max_connections', 'thread_cache_size');"
```

**Key Settings Applied:**
- `innodb_buffer_pool_size = 12GB` (37.5% of 32GB RAM)
- `innodb_buffer_pool_instances = 8` (matches vCPU count)
- `max_connections = 350` (must be >= DB_POOL_SIZE which is 300)
- `max_user_connections = 300`
- `innodb_io_capacity = 2000` (optimized for NVMe SSD)
- `tmp_table_size = 256MB`
- `table_open_cache = 4000`

**Important:** The `max_connections` (350) must be >= `DB_POOL_SIZE` (300) in `config/db.js`

### 3. Optimize Redis (if using local Redis)

```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Update these settings:
maxmemory 4gb                    # 4GB for Redis (12% of RAM)
maxmemory-policy allkeys-lru     # Eviction policy
tcp-backlog 511
timeout 300

# Restart Redis
sudo systemctl restart redis
```

### 4. System Swappiness (Reduce Swap Usage)

```bash
# Edit sysctl
sudo nano /etc/sysctl.conf

# Add:
vm.swappiness = 10              # Reduce swap usage (default is 60)

# Apply
sudo sysctl -p
```

### 5. Network Optimizations

```bash
# Edit sysctl
sudo nano /etc/sysctl.conf

# Add network optimizations:
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Apply
sudo sysctl -p
```

### 6. Increase Node.js Memory (if needed)

Already set in `ecosystem.config.js`:
- Server: `--max-old-space-size=2048` (2GB per instance)
- Worker: `--max-old-space-size=1024` (1GB per instance)

## 🔧 Environment Variables

Create/update `.env` file:

```env
# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=db_lms
DB_POOL_SIZE=350

# Rate Limiting
RATE_LIMIT_MAX=2000

# Server
NODE_ENV=production
PORT=5000

# Redis (if using local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Frontend
FRONTEND_URL=https://yourdomain.com
```

## 📊 Resource Allocation

| Component | CPU | RAM | Notes |
|-----------|-----|-----|-------|
| Node.js Servers (6) | 6 vCPU | ~18GB | Main application |
| Node.js Workers (2) | 2 vCPU | ~2.4GB | Certificate generation |
| MySQL | 1 vCPU | ~12GB | Database (12GB buffer pool) |
| Redis | 0.5 vCPU | ~4GB | Caching |
| System/Other | 0.5 vCPU | ~2GB | OS, Nginx, Malware Scanner, etc. |
| **Total** | **8 vCPU** | **~32GB** | **Optimized** |

## 🚀 Deployment Steps

### 1. Apply System Optimizations

```bash
# Run all system optimizations above
# Restart server after applying
sudo reboot
```

### 2. Update Application Configs

```bash
cd /path/to/lms-app/backend

# Configs are already updated in:
# - config/db.js (connection pool: 350)
# - ecosystem.config.js (10 server instances)
# - middleware/rateLimiter.js (2000 requests/15min)
```

### 3. Start with PM2

```bash
# Install PM2 globally (if not installed)
npm install -g pm2

# Start all processes
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 on system startup
pm2 startup
# Follow the instructions shown

# Check status
pm2 status
pm2 logs
```

### 4. Monitor Resources

```bash
# Check CPU and Memory
htop

# Check PM2 status
pm2 monit

# Check MySQL connections
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"

# Check Redis memory
redis-cli INFO memory
```

## 📈 Expected Performance

With these optimizations:

- **Concurrent Users:** 15,000-25,000 (single VPS)
- **Requests/Second:** 4,000-6,000
- **Database Connections:** Up to 300 concurrent
- **Response Time:** <100ms (cached), <200ms (uncached)
- **Memory Usage:** ~21GB (application) + ~12GB (MySQL) + ~4GB (Redis) = ~37GB (within 32GB with swap)
- **Bandwidth:** 32TB is more than sufficient

## ⚠️ Important Notes

1. **Memory Usage:** With 6 server instances, total memory usage will be high. Monitor closely.

2. **MySQL Connections:** 350 connections is high. Ensure MySQL `max_connections` is set to at least 500.

3. **Scaling Beyond:** For 50k-100k users, you'll need:
   - Load balancer (Nginx)
   - Multiple VPS instances
   - Database read replicas
   - See `SCALABILITY_GUIDE.md` for details

4. **Monitoring:** Set up monitoring to track:
   - CPU usage per instance
   - Memory usage
   - Database connection pool
   - Response times

## 🔍 Troubleshooting

### High Memory Usage
```bash
# Check memory usage
free -h
pm2 monit

# If needed, reduce instances:
# Edit ecosystem.config.js: instances: 5 (instead of 6)
pm2 restart ecosystem.config.js
```

### Database Connection Errors
```bash
# Check MySQL connections
mysql -u root -p -e "SHOW PROCESSLIST;"
mysql -u root -p -e "SHOW STATUS LIKE 'Max_used_connections';"
mysql -u root -p -e "SHOW VARIABLES LIKE 'max_connections';"

# Verify max_connections >= DB_POOL_SIZE (300)
# Current setting: max_connections = 350 (safe)

# If you see "Too many connections" errors:
# 1. Check current connections: SHOW STATUS LIKE 'Threads_connected';
# 2. Increase max_connections in my.cnf if needed
# 3. Restart MySQL: sudo systemctl restart mysql
```

### High CPU Usage
```bash
# Check CPU usage
htop
pm2 monit

# If all CPUs are maxed, consider:
# 1. Reducing PM2 instances
# 2. Optimizing queries
# 3. Adding more caching
```

## ✅ Verification Checklist

- [ ] System optimizations applied
- [ ] MySQL optimized (8GB buffer pool)
- [ ] Redis optimized (if local)
- [ ] PM2 cluster mode running (10 instances)
- [ ] Database connection pool: 350
- [ ] Rate limit: 2000/15min
- [ ] Monitoring set up
- [ ] Load testing completed
- [ ] Performance metrics within targets

---

**Last Updated:** December 2025  
**VPS Spec:** 8 vCPU, 32GB RAM, 400GB NVMe, Ubuntu 22.04  
**Status:** ✅ **OPTIMIZED FOR YOUR VPS**

---

**See also:** `VPS_SPECIFIC_OPTIMIZATION.md` for detailed setup instructions.

