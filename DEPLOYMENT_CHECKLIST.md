# 🚀 LMS Deployment Checklist

## Pre-Deployment (Local Machine)

### Step 1: Run Automated Fixes
```bash
node fix-for-production.js
```

### Step 2: Run Error Checker
```bash
node check-errors.js
```

### Step 3: Fix Any Reported Errors

Common TypeScript errors and fixes:

#### Error: `Cannot find module '../utils/apiUrl'`
**Fix:** Run `node fix-for-production.js` again

#### Error: `Property 'X' does not exist on type 'Y'`
**Fix:** Add proper type annotations or use type assertions

#### Error: `'X' is possibly 'undefined'`
**Fix:** Add null checks: `if (X) { ... }` or use optional chaining: `X?.property`

#### Error: `Argument of type 'X' is not assignable to parameter of type 'Y'`
**Fix:** Cast the type: `X as Y` or fix the type definition

### Step 4: Test Locally
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
npm run dev
```

Visit `http://localhost:3000` and test:
- ✅ Login
- ✅ Admin dashboard
- ✅ Student dashboard
- ✅ Course viewing
- ✅ File uploads
- ✅ Notifications

### Step 5: Build for Production
```bash
npm run build
```

If build succeeds, you're ready to deploy!

---

## Deployment to VPS

### Method 1: Direct SCP Upload (Recommended)

#### On Local Machine:
```bash
# Create deployment package (exclude node_modules)
tar -czf lms-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='backend/node_modules' \
  --exclude='backend/uploads' \
  --exclude='backend/certificates' \
  --exclude='.git' \
  app/ backend/ public/ package.json package-lock.json tsconfig.json next.config.ts

# Upload to VPS
scp lms-deploy.tar.gz root@YOUR_VPS_IP:/root/
```

#### On VPS:
```bash
# Backup current deployment
cd /var/www
mv lms-app lms-app-backup-$(date +%Y%m%d)

# Extract new code
mkdir lms-app
cd lms-app
tar -xzf ~/lms-deploy.tar.gz

# Copy environment files from backup
cp /var/www/lms-app-backup-*/backend/.env backend/.env
cp /var/www/lms-app-backup-*/.env.local .env.local

# Update API URL for VPS
sed -i 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP:5000|' .env.local

# Install dependencies
npm install --legacy-peer-deps
cd backend && npm install --legacy-peer-deps && cd ..

# Build frontend
npm run build

# Restart services
pm2 restart all
pm2 save
```

### Method 2: Git Push/Pull

#### On Local Machine:
```bash
git add .
git commit -m "Production ready - all errors fixed"
git push origin main
```

#### On VPS:
```bash
cd /var/www/lms-app
git pull origin main

# Update environment
sed -i 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP:5000|' .env.local

# Rebuild
npm install --legacy-peer-deps
npm run build
pm2 restart all
```

---

## Post-Deployment Verification

### 1. Check Services Status
```bash
pm2 status
```

Expected output:
- ✅ lms-frontend: online
- ✅ lms-server (4 instances): online
- ✅ lms-worker (2 instances): online

### 2. Check Logs
```bash
# Frontend logs
pm2 logs lms-frontend --lines 50

# Backend logs
pm2 logs lms-server --lines 50

# Worker logs
pm2 logs lms-worker --lines 50
```

### 3. Test in Browser

Visit `http://YOUR_VPS_IP:3000`

Test checklist:
- [ ] Login page loads
- [ ] Can login successfully
- [ ] Dashboard loads without errors
- [ ] No console errors (F12 → Console)
- [ ] API calls go to correct URL (not localhost)
- [ ] Notifications work
- [ ] File uploads work
- [ ] Responsive design works on mobile

### 4. Check API Endpoints
```bash
# From VPS
curl http://localhost:5000/health

# From your computer
curl http://YOUR_VPS_IP:5000/health
```

Should return: `{"status":"ok",...}`

---

## Common Deployment Issues & Fixes

### Issue: "Failed to fetch" errors in browser
**Cause:** Frontend calling wrong API URL
**Fix:**
```bash
cd /var/www/lms-app
cat .env.local | grep NEXT_PUBLIC_API_URL
# Should show: NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP:5000

# If wrong, fix it:
sed -i 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP:5000|' .env.local
rm -rf .next
npm run build
pm2 restart lms-frontend
```

### Issue: "404 Not Found" on API calls
**Cause:** Missing `/api/` prefix
**Fix:** Already handled by `api.ts` if you ran `fix-for-production.js`

### Issue: "localhost:5000" in browser console
**Cause:** Hardcoded URLs not fixed
**Fix:** Run `node fix-for-production.js` locally, then redeploy

### Issue: PM2 process keeps restarting
**Cause:** Application crash, check logs
**Fix:**
```bash
pm2 logs lms-server --err --lines 100
# Fix the error shown, then:
pm2 restart all
```

### Issue: Database connection failed
**Cause:** Wrong credentials in backend/.env
**Fix:**
```bash
nano backend/.env
# Update DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
pm2 restart lms-server
```

---

## Rollback Procedure

If deployment fails:

```bash
cd /var/www
pm2 stop all
rm -rf lms-app
mv lms-app-backup-YYYYMMDD lms-app
cd lms-app
pm2 restart all
```

---

## Performance Monitoring

```bash
# CPU & Memory usage
pm2 monit

# Detailed status
pm2 status

# Application logs
pm2 logs

# Restart if needed
pm2 restart all
```

---

## Security Checklist

- [ ] Changed default JWT_SECRET
- [ ] Updated database passwords
- [ ] Firewall configured (ufw)
- [ ] SSL certificate installed (optional but recommended)
- [ ] Environment files not in Git
- [ ] Admin password changed from default

---

## Need Help?

1. Check logs: `pm2 logs`
2. Check this checklist for common issues
3. Run error checker: `node check-errors.js`
4. Review browser console (F12)

---

**Last Updated:** $(date)
**VPS IP:** YOUR_VPS_IP
**Ports:** Frontend: 3000, Backend: 5000

