# 🚀 GitHub Deployment Guide

Complete guide to upload your LMS project to GitHub and prepare for production deployment.

---

## 📋 Table of Contents

1. [Pre-Upload Checklist](#pre-upload-checklist)
2. [Environment Variables Setup](#environment-variables-setup)
3. [Git Configuration](#git-configuration)
4. [Upload to GitHub](#upload-to-github)
5. [VPS Deployment](#vps-deployment)
6. [Post-Deployment](#post-deployment)

---

## ✅ Pre-Upload Checklist

### 1. **Verify `.gitignore` is Configured**

Make sure these files/folders are in your `.gitignore`:

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Next.js
.next/
out/
build/
dist/

# Production
.env
.env.local
.env.production
.env.development.local
.env.test.local
.env.production.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local

# Vercel
.vercel

# Typescript
*.tsbuildinfo
next-env.d.ts

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Uploads & Generated Files
backend/uploads/
backend/generated_certificates/
backend/certificate_templates/

# Logs
logs/
*.log

# Redis
dump.rdb
```

### 2. **Create `.env.example` Files**

Create example environment files (without sensitive data) for reference:

**Frontend `.env.example`:**
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

# Stripe (Use test keys for development)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

**Backend `.env.example`:**
```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=db_lms
DB_POOL_SIZE=250

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# LibreOffice Path (for certificate generation)
LIBREOFFICE_PATH=/usr/bin/soffice

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1200

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 3. **Remove Sensitive Data**

**Check these files for sensitive information:**
- ❌ Remove any hardcoded passwords
- ❌ Remove API keys from code
- ❌ Remove database credentials
- ❌ Remove email addresses (if private)
- ❌ Remove any personal information

**Files to check:**
```bash
# Search for common sensitive patterns
grep -r "password" --exclude-dir=node_modules --exclude-dir=.git
grep -r "api_key" --exclude-dir=node_modules --exclude-dir=.git
grep -r "secret" --exclude-dir=node_modules --exclude-dir=.git
```

### 4. **Clean Up Temporary Files**

```bash
# Remove temporary files
cd D:\Lms\lms-app

# Clean frontend
cd lms-app
rm -rf node_modules
rm -rf .next
rm -rf out

# Clean backend
cd backend
rm -rf node_modules
rm -rf uploads/*
rm -rf generated_certificates/*
rm -rf certificate_templates/*
rm -rf logs/*
```

---

## 🔐 Environment Variables Setup

### **Option 1: Using GitHub Secrets (Recommended for CI/CD)**

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each environment variable from your `.env` files

### **Option 2: Manual Setup on VPS**

You'll manually create `.env` files on your VPS after cloning.

---

## 🔧 Git Configuration

### 1. **Initialize Git Repository**

```bash
cd D:\Lms\lms-app

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Complete LMS system with certificate generation"
```

### 2. **Create Repository on GitHub**

1. Go to [GitHub](https://github.com)
2. Click **New Repository**
3. Name it: `inspire-lms` (or your preferred name)
4. **DO NOT** initialize with README, .gitignore, or license
5. Click **Create repository**

### 3. **Connect Local Repository to GitHub**

```bash
# Add GitHub remote (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/inspire-lms.git

# Verify remote
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 📤 Upload to GitHub

### **Full Upload Process**

```bash
cd D:\Lms\lms-app

# Check status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: Complete LMS with certificate system, auto-logout, and VPS optimization"

# Push to GitHub
git push origin main
```

### **If Repository is Too Large**

If you encounter size issues:

```bash
# Check repository size
git count-objects -vH

# Remove large files from history (if needed)
git filter-branch --tree-filter 'rm -rf path/to/large/files' HEAD

# Or use BFG Repo-Cleaner (recommended)
# Download from: https://reclaimtheweb.org/bfg-repo-cleaner/
```

---

## 🖥️ VPS Deployment

### **1. Connect to Your VPS**

```bash
ssh root@your_vps_ip
```

### **2. Install Required Software**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL 8.x
sudo apt install -y mysql-server

# Install Redis
sudo apt install -y redis-server

# Install LibreOffice (for certificate generation)
sudo apt install -y libreoffice

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

### **3. Clone Repository**

```bash
# Navigate to web directory
cd /var/www

# Clone your repository
git clone https://github.com/YOUR_USERNAME/inspire-lms.git
cd inspire-lms
```

### **4. Setup Environment Variables**

```bash
# Frontend environment
cd lms-app
nano .env

# Paste your production environment variables
# CTRL+X, then Y, then Enter to save

# Backend environment
cd backend
nano .env

# Paste your production environment variables
# CTRL+X, then Y, then Enter to save
```

### **5. Install Dependencies**

```bash
# Install frontend dependencies
cd /var/www/inspire-lms/lms-app
npm install --legacy-peer-deps

# Install backend dependencies
cd /var/www/inspire-lms/lms-app/backend
npm install
```

### **6. Build Frontend**

```bash
cd /var/www/inspire-lms/lms-app
npm run build
```

### **7. Setup MySQL Database**

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE db_lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Create user
CREATE USER 'lms_user'@'localhost' IDENTIFIED BY 'your_strong_password';

# Grant privileges
GRANT ALL PRIVILEGES ON db_lms.* TO 'lms_user'@'localhost';
FLUSH PRIVILEGES;

# Exit MySQL
EXIT;

# Import your database schema
mysql -u lms_user -p db_lms < /path/to/your/database_backup.sql

# Run optimization script
mysql -u root -p < /var/www/inspire-lms/lms-app/backend/mysql-optimization.sql
```

### **8. Configure MySQL (Permanent Settings)**

```bash
# Edit MySQL configuration
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# Add the contents from mysql-my.cnf-optimization.conf
# (Copy from lms-app/backend/mysql-my.cnf-optimization.conf)

# Restart MySQL
sudo systemctl restart mysql
```

### **9. Start Redis**

```bash
# Start Redis
sudo systemctl start redis-server

# Enable Redis on boot
sudo systemctl enable redis-server

# Check Redis status
sudo systemctl status redis-server
```

### **10. Start Application with PM2**

```bash
cd /var/www/inspire-lms/lms-app/backend

# Start using PM2 ecosystem file
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status
pm2 logs
```

### **11. Setup Nginx (Reverse Proxy)**

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/inspire-lms

# Paste the following configuration:
```

```nginx
# Frontend (Next.js)
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for long-running requests
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/inspire-lms /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx on boot
sudo systemctl enable nginx
```

### **12. Setup SSL with Let's Encrypt**

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### **13. Setup Firewall**

```bash
# Allow SSH
sudo ufw allow 22

# Allow HTTP
sudo ufw allow 80

# Allow HTTPS
sudo ufw allow 443

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 🔄 Post-Deployment

### **1. Verify Everything is Running**

```bash
# Check PM2 processes
pm2 status

# Check logs
pm2 logs lms-server
pm2 logs lms-worker

# Check Nginx
sudo systemctl status nginx

# Check MySQL
sudo systemctl status mysql

# Check Redis
sudo systemctl status redis-server
```

### **2. Test Your Application**

1. Visit `https://yourdomain.com`
2. Try logging in
3. Test certificate generation
4. Test file uploads
5. Test chat functionality
6. Test notifications

### **3. Monitor Performance**

```bash
# PM2 monitoring
pm2 monit

# Check system resources
htop

# Check MySQL connections
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"
mysql -u root -p -e "SHOW STATUS LIKE 'Max_used_connections';"

# Check Redis
redis-cli INFO stats
```

### **4. Setup Automated Backups**

```bash
# Create backup script
sudo nano /usr/local/bin/backup-lms.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/lms"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u lms_user -p'your_password' db_lms | gzip > $BACKUP_DIR/db_lms_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/inspire-lms/lms-app/backend/uploads

# Backup certificates
tar -czf $BACKUP_DIR/certificates_$DATE.tar.gz /var/www/inspire-lms/lms-app/backend/generated_certificates

# Delete backups older than 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make script executable
sudo chmod +x /usr/local/bin/backup-lms.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e

# Add this line:
0 2 * * * /usr/local/bin/backup-lms.sh
```

### **5. Setup Log Rotation**

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/lms
```

```
/var/www/inspire-lms/lms-app/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 🚨 Troubleshooting

### **Application Won't Start**

```bash
# Check PM2 logs
pm2 logs --lines 100

# Check environment variables
cd /var/www/inspire-lms/lms-app/backend
cat .env

# Restart application
pm2 restart all
```

### **Database Connection Issues**

```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u lms_user -p db_lms -e "SELECT 1;"

# Check MySQL logs
sudo tail -f /var/log/mysql/error.log
```

### **Certificate Generation Issues**

```bash
# Check LibreOffice installation
which soffice

# Test LibreOffice
soffice --version

# Check permissions
ls -la /var/www/inspire-lms/lms-app/backend/generated_certificates
```

### **High Memory Usage**

```bash
# Check memory usage
free -h

# Restart PM2 processes
pm2 restart all

# Check for memory leaks
pm2 monit
```

---

## 📚 Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [MySQL 8.0 Reference](https://dev.mysql.com/doc/refman/8.0/en/)
- [Redis Documentation](https://redis.io/documentation)
- [Let's Encrypt](https://letsencrypt.org/getting-started/)

---

## ✅ Final Checklist

- [ ] Code pushed to GitHub
- [ ] Environment variables configured
- [ ] Database imported and optimized
- [ ] PM2 processes running
- [ ] Nginx configured with SSL
- [ ] Firewall configured
- [ ] Automated backups setup
- [ ] Log rotation configured
- [ ] Application tested and working
- [ ] Monitoring setup

---

**🎉 Congratulations! Your LMS is now deployed and ready for production!**

For support or issues, refer to the documentation or check the logs.

