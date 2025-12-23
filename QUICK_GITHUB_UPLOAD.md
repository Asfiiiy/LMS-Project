# 🚀 Quick GitHub Upload Guide

Fast and simple guide to upload your LMS to GitHub.

---

## ⚡ Quick Steps

### 1️⃣ **Prepare Your Code**

```bash
cd D:\Lms\lms-app

# Make sure .gitignore exists
# (It should already be there)
```

### 2️⃣ **Create `.env.example` Files**

**Frontend** (`lms-app/.env.example`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

**Backend** (`lms-app/backend/.env.example`):
```env
PORT=5000
NODE_ENV=production
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=db_lms
DB_POOL_SIZE=250
JWT_SECRET=your_secret_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
REDIS_HOST=localhost
REDIS_PORT=6379
LIBREOFFICE_PATH=/usr/bin/soffice
RATE_LIMIT_MAX=1200
CORS_ORIGIN=http://localhost:3000
```

### 3️⃣ **Initialize Git (if not done)**

```bash
cd D:\Lms\lms-app

# Check if git is initialized
git status

# If not initialized:
git init
git add .
git commit -m "Initial commit: Complete LMS system"
```

### 4️⃣ **Create GitHub Repository**

1. Go to https://github.com
2. Click **"New"** (green button)
3. Repository name: `inspire-lms`
4. **Private** or **Public** (your choice)
5. **DO NOT** check any boxes (no README, no .gitignore, no license)
6. Click **"Create repository"**

### 5️⃣ **Connect and Push**

```bash
# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/inspire-lms.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 6️⃣ **Enter GitHub Credentials**

When prompted:
- **Username**: Your GitHub username
- **Password**: Use a **Personal Access Token** (not your password)

**To create a token:**
1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: `LMS Upload`
4. Check: `repo` (full control)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)
7. Use this token as your password

---

## ✅ Done!

Your code is now on GitHub! 🎉

---

## 📝 What Gets Uploaded?

✅ **Uploaded:**
- All source code
- Configuration files
- Documentation
- `.env.example` files

❌ **NOT Uploaded (in .gitignore):**
- `node_modules/`
- `.env` files (your secrets)
- `uploads/`
- `generated_certificates/`
- `.next/`
- `logs/`

---

## 🔄 Future Updates

To push changes later:

```bash
cd D:\Lms\lms-app

# Check what changed
git status

# Add all changes
git add .

# Commit with a message
git commit -m "Your update message here"

# Push to GitHub
git push origin main
```

---

## 🆘 Troubleshooting

### **Error: "remote origin already exists"**
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/inspire-lms.git
```

### **Error: "failed to push some refs"**
```bash
# Pull first, then push
git pull origin main --rebase
git push origin main
```

### **Error: "Authentication failed"**
- Make sure you're using a **Personal Access Token**, not your password
- Create a new token at: https://github.com/settings/tokens

### **Repository too large**
```bash
# Check size
git count-objects -vH

# If too large, check what's taking space:
du -sh * | sort -h
```

---

## 📚 Next Steps

After uploading to GitHub:

1. ✅ **Verify upload**: Visit your GitHub repository
2. 📖 **Read full deployment guide**: See `GITHUB_DEPLOYMENT_GUIDE.md`
3. 🖥️ **Deploy to VPS**: Follow the VPS deployment section
4. 🔐 **Setup environment variables** on your VPS
5. 🚀 **Launch your LMS!**

---

**Need help?** Check `GITHUB_DEPLOYMENT_GUIDE.md` for detailed instructions!

