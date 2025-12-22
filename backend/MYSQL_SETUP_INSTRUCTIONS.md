# 🗄️ MySQL Optimization Setup Instructions

## Quick Setup Guide

### Step 1: Apply Temporary Settings (Immediate Effect)

```bash
cd /path/to/lms-app/backend
mysql -u root -p < mysql-optimization.sql
```

This applies settings immediately but they will be lost on MySQL restart.

### Step 2: Apply Permanent Settings (Recommended)

```bash
# 1. Backup current MySQL configuration
sudo cp /etc/mysql/mysql.conf.d/mysqld.cnf /etc/mysql/mysql.conf.d/mysqld.cnf.backup

# 2. Edit MySQL configuration
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# 3. Add the [mysqld] section from mysql-my.cnf-optimization.conf
#    Or copy the entire file content
```

**Or use the provided config file:**

```bash
# Copy the optimized config
sudo cp mysql-my.cnf-optimization.conf /etc/mysql/mysql.conf.d/mysqld-optimization.cnf

# Include it in main config (add this line to mysqld.cnf)
# !includedir /etc/mysql/mysql.conf.d/
```

### Step 3: Handle InnoDB Log Files (If Changed)

If you're changing `innodb_log_file_size`, you need to:

```bash
# 1. Stop MySQL
sudo systemctl stop mysql

# 2. Remove old log files (MySQL will recreate them)
sudo rm /var/lib/mysql/ib_logfile*

# 3. Start MySQL
sudo systemctl start mysql
```

### Step 4: Verify Settings

```bash
# Check key settings
mysql -u root -p -e "
SHOW VARIABLES WHERE Variable_name IN (
  'innodb_buffer_pool_size',
  'max_connections',
  'max_user_connections',
  'thread_cache_size',
  'tmp_table_size',
  'innodb_io_capacity'
);
"

# Check current connections
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"
mysql -u root -p -e "SHOW STATUS LIKE 'Max_used_connections';"
```

## Configuration Summary

| Setting | Value | Reason |
|---------|-------|--------|
| `innodb_buffer_pool_size` | 12GB | 37.5% of 32GB RAM |
| `max_connections` | 400 | Must be >= DB_POOL_SIZE (350) |
| `max_user_connections` | 350 | Matches DB_POOL_SIZE |
| `innodb_io_capacity` | 2000 | Optimized for NVMe SSD |
| `tmp_table_size` | 256MB | Reduces disk I/O |
| `table_open_cache` | 4000 | Faster table access |

## Important Notes

1. **Connection Pool Mismatch:**
   - Application `DB_POOL_SIZE` = 350
   - MySQL `max_connections` = 400 ✅ (Safe)
   - MySQL `max_user_connections` = 350 ✅ (Matches)

2. **Memory Allocation:**
   - MySQL Buffer Pool: 12GB
   - Node.js Servers: ~20GB
   - Node.js Workers: ~2.4GB
   - Redis: ~4GB
   - System: ~2GB
   - **Total: ~40GB** (slightly over 32GB, but with swap it's manageable)

3. **If You Need to Reduce Memory:**
   - Option 1: Reduce `innodb_buffer_pool_size` to 8GB
   - Option 2: Reduce PM2 instances from 10 to 8
   - Option 3: Reduce Redis memory limit

## Monitoring

### Check Buffer Pool Usage
```sql
SHOW STATUS LIKE 'Innodb_buffer_pool%';
```

### Check Connection Usage
```sql
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';
SHOW PROCESSLIST;
```

### Check Slow Queries
```bash
tail -f /var/log/mysql/slow-query.log
```

## Troubleshooting

### "Too many connections" Error
```bash
# Check current connections
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"

# If close to max_connections (400), increase it:
# Edit my.cnf: max_connections = 500
# Restart MySQL: sudo systemctl restart mysql
```

### High Memory Usage
```bash
# Check MySQL memory usage
ps aux | grep mysqld

# If too high, reduce innodb_buffer_pool_size to 8GB
# Edit my.cnf: innodb_buffer_pool_size = 8G
# Restart MySQL
```

### Slow Queries
```bash
# Enable slow query log (already enabled in config)
# Check slow queries
mysql -u root -p -e "SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;"

# Or check log file
tail -100 /var/log/mysql/slow-query.log
```

## Performance Testing

After applying settings, test performance:

```bash
# Test connection pool
# Run multiple concurrent requests to your API

# Monitor connections
watch -n 1 'mysql -u root -p -e "SHOW STATUS LIKE \"Threads_connected\";"'

# Check buffer pool hit rate (should be > 99%)
mysql -u root -p -e "
SELECT 
  (1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)) * 100 AS hit_rate
FROM 
  (SELECT VARIABLE_VALUE AS Innodb_buffer_pool_reads 
   FROM information_schema.GLOBAL_STATUS 
   WHERE VARIABLE_NAME = 'Innodb_buffer_pool_reads') AS reads,
  (SELECT VARIABLE_VALUE AS Innodb_buffer_pool_read_requests 
   FROM information_schema.GLOBAL_STATUS 
   WHERE VARIABLE_NAME = 'Innodb_buffer_pool_read_requests') AS requests;
"
```

**Expected Results:**
- Buffer pool hit rate: > 99%
- Connection usage: < 80% of max_connections
- Response time: < 100ms (cached), < 200ms (uncached)

---

**Last Updated:** December 2025  
**MySQL Version:** 8.x  
**VPS:** 12 vCPU, 32GB RAM, 300GB NVMe

