# 🚀 LMS Deployment Guide

## 📦 Project Structure Verified
- ✅ Frontend: Next.js 16 + React 18 + TypeScript
- ✅ Backend: Node.js + Express + MySQL + Redis
- ✅ All dependencies installed and tested
- ✅ Production build successful
- ✅ All TypeScript errors fixed

---

## 📋 Dependencies Checklist

### Frontend Dependencies (package.json)
```json
{
  "dependencies": {
    "next": "16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-icons": "^5.4.0",
    "socket.io-client": "^4.8.1",
    "stripe": "^17.5.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.0.0",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```

### Backend Dependencies (backend/package.json)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "cloudinary": "^1.41.0",
    "socket.io": "^4.8.1",
    "redis": "^4.7.0",
    "bull": "^4.16.3",
    "docxtemplater": "^3.50.0",
    "pizzip": "^3.1.7",
    "libreoffice-convert": "^1.6.0",
    "fs-extra": "^11.2.0",
    "mammoth": "^1.8.0",
    "html-docx-js": "^0.3.1",
    "geoip-lite": "^1.4.10",
    "express-rate-limit": "^7.4.1",
    "rate-limit-redis": "^4.2.0",
    "stripe": "^17.5.0"
  }
}
```

---

## 🔧 VPS Requirements

### System Requirements
- **OS**: Ubuntu 22.04 LTS
- **CPU**: 8 vCPU
- **RAM**: 32 GB
- **Storage**: 400 GB NVMe
- **Node.js**: v18.x or higher
- **MySQL**: 8.x
- **Redis**: Latest
- **PM2**: Latest
- **Nginx**: Latest (optional for production)
- **LibreOffice**: For PDF generation

### Ports Required
- **3000**: Next.js frontend
- **5000**: Express backend
- **3306**: MySQL
- **6379**: Redis

---

## 📤 GitHub Deployment Steps

### Step 1: Push to GitHub (Local)
```powershell
cd D:\Lms\lms-app

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Production ready - All TypeScript errors fixed, duplicate rendering fixed"

# Add remote
git remote add origin git@github.com:Asfiiiy/LMS-Project.git

# Push to main branch
git branch -M main
git push -u origin main
```

### Step 2: Clone on VPS
```bash
# Install Git (if not installed)
sudo apt update
sudo apt install git -y

# Navigate to web directory
cd /var/www

# Backup old version
mv lms-app lms-app-backup-$(date +%Y%m%d-%H%M%S)

# Clone repository
git clone git@github.com:Asfiiiy/LMS-Project.git lms-app

# Or if using HTTPS:
git clone https://github.com/Asfiiiy/LMS-Project.git lms-app
```

### Step 3: Install Dependencies on VPS
```bash
cd /var/www/lms-app

# Install frontend dependencies
npm install --legacy-peer-deps

# Install backend dependencies
cd backend
npm install --legacy-peer-deps
cd ..
```

### Step 4: Configure Environment Variables
```bash
# Frontend environment
nano .env.local
```
Add:
```env
NEXT_PUBLIC_API_URL=http://72.62.7.184:5000
```

```bash
# Backend environment
nano backend/.env
```
Ensure all variables are set (MySQL, Redis, Cloudinary, Stripe, JWT_SECRET, etc.)

### Step 5: Build Frontend
```bash
cd /var/www/lms-app
npm run build
```

### Step 6: Start Services with PM2
```bash
cd /var/www/lms-app/backend

# Start all services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it gives you

# Check status
pm2 status
pm2 logs
```

### Step 7: Set Permissions
```bash
sudo chown -R www-data:www-data /var/www/lms-app
sudo chmod -R 755 /var/www/lms-app
```

### Step 8: Configure Firewall
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 5000/tcp
sudo ufw status
```

---

## 🔄 Future Updates

When you make changes locally and want to update VPS:

```bash
# On VPS
cd /var/www/lms-app
git pull origin main
npm install --legacy-peer-deps
npm run build
cd backend
npm install --legacy-peer-deps
cd ..
pm2 restart all
```

---

## ✅ Verification Checklist

After deployment, verify:
- [ ] Frontend accessible at `http://72.62.7.184:3000`
- [ ] Backend API responding at `http://72.62.7.184:5000/health`
- [ ] Login working
- [ ] All dashboards loading (Admin, Tutor, Student)
- [ ] No duplicate rendering
- [ ] Database connected
- [ ] Redis connected
- [ ] Socket.IO working
- [ ] File uploads working
- [ ] Certificate generation working
- [ ] PM2 processes running

---

## 🐛 Troubleshooting

### If frontend won't build:
```bash
rm -rf .next
rm -rf node_modules
npm install --legacy-peer-deps
npm run build
```

### If PM2 processes crash:
```bash
pm2 logs --err
pm2 restart all
```

### If database connection fails:
```bash
mysql -u root -p
# Check MySQL is running
sudo systemctl status mysql
```

### If Redis connection fails:
```bash
redis-cli ping
# Should return PONG
```

---

## 📊 Performance Monitoring

```bash
# Check PM2 status
pm2 status

# Monitor logs
pm2 logs

# Monitor system resources
pm2 monit

# Check memory usage
free -h

# Check disk usage
df -h
```

---

## 🔒 Security Notes

- ✅ All sensitive data in `.env` files (not in GitHub)
- ✅ JWT tokens for authentication
- ✅ Rate limiting enabled
- ✅ CORS configured
- ✅ SQL injection protection (parameterized queries)
- ✅ Password hashing with bcrypt
- ✅ File upload validation

---

## 📞 Support

For issues, check:
1. PM2 logs: `pm2 logs`
2. Browser console (F12)
3. Network tab for API errors
4. MySQL logs: `/var/log/mysql/error.log`
5. Redis logs: `redis-cli monitor`

---

**Deployment Date**: December 23, 2025
**Version**: 1.0.0
**Developer**: Asfand Yar
**Status**: ✅ Production Ready

