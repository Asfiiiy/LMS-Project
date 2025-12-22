# LibreOffice Setup Guide

## Overview
Our certificate generation system uses **LibreOffice** to convert DOCX templates to PDF format. This guide explains how to set it up on different environments.

---

## 📦 Local Development (Your PC)

### Windows
1. **Download LibreOffice:**
   - Visit: https://www.libreoffice.org/download/
   - Download the Windows installer (64-bit recommended)
   - Run the installer (default settings are fine)

2. **Installation Path:**
   ```
   Default: C:\Program Files\LibreOffice\program\soffice.exe
   ```

3. **Verification:**
   ```powershell
   # Open PowerShell and run:
   & "C:\Program Files\LibreOffice\program\soffice.exe" --version
   ```

4. **System will auto-detect** - No ENV variable needed for local development!

### macOS
```bash
# Install via Homebrew
brew install --cask libreoffice

# Default path: /Applications/LibreOffice.app/Contents/MacOS/soffice
```

### Linux (Local)
```bash
sudo apt-get update
sudo apt-get install libreoffice --no-install-recommends
```

---

## 🖥️ VPS / Production Server Setup

### Ubuntu/Debian Server

1. **Install LibreOffice (Headless):**
   ```bash
   sudo apt-get update
   sudo apt-get install -y libreoffice --no-install-recommends
   ```

2. **Verify Installation:**
   ```bash
   which soffice
   # Should output: /usr/bin/soffice
   
   soffice --version
   # Should show version info
   ```

3. **Add to .env file:**
   ```bash
   # Edit your .env file
   nano /var/www/lms-app/backend/.env
   
   # Add this line:
   LIBREOFFICE_PATH=/usr/bin/soffice
   ```

4. **Restart your Node.js application:**
   ```bash
   pm2 restart lms-backend
   # or
   systemctl restart lms-backend
   ```

---

## 🐳 Docker Setup (Optional)

If you're using Docker, add this to your `Dockerfile`:

```dockerfile
# Install LibreOffice in Docker container
RUN apt-get update && \
    apt-get install -y libreoffice --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set environment variable
ENV LIBREOFFICE_PATH=/usr/bin/soffice
```

---

## ⚙️ Environment Variable Configuration

### .env File Setup

Add this line to your `backend/.env` file:

```env
# LibreOffice Path for PDF Generation
# Local development: Leave empty (auto-detected)
# VPS/Production: Set the full path

# Windows (if auto-detection fails):
# LIBREOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.exe

# Linux/VPS (recommended):
LIBREOFFICE_PATH=/usr/bin/soffice

# macOS (if auto-detection fails):
# LIBREOFFICE_PATH=/Applications/LibreOffice.app/Contents/MacOS/soffice
```

---

## 🔍 Auto-Detection Logic

Our system uses smart auto-detection:

### Priority Order:
1. **ENV Variable** (`LIBREOFFICE_PATH`) - Highest priority
2. **Auto-detection** based on OS:
   - Windows: Common installation paths
   - Linux: `/usr/bin/soffice`, `/usr/bin/libreoffice`
   - macOS: `/Applications/LibreOffice.app/`
3. **Command search** (`which soffice`)

### Detection Code:
Located in: `backend/config/libreoffice.js`

---

## 🧪 Testing LibreOffice

### Test from Command Line:

**Windows:**
```powershell
& "C:\Program Files\LibreOffice\program\soffice.exe" --version
```

**Linux/macOS:**
```bash
soffice --version
# or
/usr/bin/soffice --version
```

### Test from Node.js Application:

When you start your backend server, you should see:

```
📄 LibreOffice Configuration:
   Platform: linux
   Path: /usr/bin/soffice
   Available: ✅ YES
   Version: LibreOffice 7.3.7.2
```

If you see `❌ NO`, follow the installation instructions above.

---

## 🚨 Troubleshooting

### Issue: "LibreOffice not found"

**Solution 1: Install LibreOffice**
```bash
# Ubuntu/Debian
sudo apt-get install libreoffice --no-install-recommends

# CentOS/RHEL
sudo yum install libreoffice-headless
```

**Solution 2: Set ENV Variable**
```bash
# Find LibreOffice path
which soffice

# Add to .env
echo "LIBREOFFICE_PATH=$(which soffice)" >> .env
```

### Issue: "Permission denied"

```bash
# Make sure the binary is executable
sudo chmod +x /usr/bin/soffice

# Check if your Node.js user can execute it
sudo -u www-data soffice --version
```

### Issue: "LibreOffice fails in headless mode"

```bash
# Install additional fonts (sometimes needed)
sudo apt-get install fonts-liberation fonts-dejavu

# Create user profile directory
mkdir -p ~/.config/libreoffice
```

---

## 📊 Server Requirements

### Minimum:
- **RAM:** 512 MB (for LibreOffice process)
- **Disk:** 200 MB for LibreOffice installation
- **CPU:** Any modern CPU

### Recommended for Production:
- **RAM:** 1 GB+ (handles concurrent conversions)
- **Disk:** 1 GB (includes fonts and temp files)

---

## 🔒 Security Notes

1. **Headless Mode:** LibreOffice runs in `--headless` mode (no GUI)
2. **Process Isolation:** Each conversion spawns a separate process
3. **Timeout:** Conversions timeout after 30 seconds
4. **Temp Files:** Automatically cleaned up after conversion

---

## 📝 VPS Deployment Checklist

When deploying to VPS:

- [ ] Install LibreOffice: `sudo apt-get install libreoffice --no-install-recommends`
- [ ] Verify installation: `soffice --version`
- [ ] Add to .env: `LIBREOFFICE_PATH=/usr/bin/soffice`
- [ ] Test conversion: Check server logs on startup
- [ ] Monitor performance: Watch CPU/memory during PDF generation
- [ ] Set up logging: Track conversion failures

---

## 🆘 Support

If you encounter issues:

1. Check server logs: `pm2 logs lms-backend`
2. Verify LibreOffice: `soffice --version`
3. Check ENV file: `cat .env | grep LIBREOFFICE`
4. Test manually: Try converting a DOCX to PDF using command line

---

## 🔄 Alternative: Cloud Conversion Services (Future)

If LibreOffice installation is problematic on your VPS, consider:

1. **Cloudmersive** - DOCX to PDF API
2. **ConvertAPI** - File conversion service
3. **Adobe PDF Services** - Enterprise solution

These require API keys but eliminate server-side dependencies.

---

## ✅ Success Indicators

Your LibreOffice setup is working correctly when:

1. Server logs show: `✅ LibreOffice found at: /usr/bin/soffice`
2. Certificate generation completes without errors
3. Generated PDFs open correctly and maintain formatting
4. No timeout errors during conversion

---

**Last Updated:** December 2024
**Maintained By:** LMS Development Team

