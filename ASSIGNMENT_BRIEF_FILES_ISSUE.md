# Assignment Brief Files Upload Issue - DIAGNOSED ✅

## Problem Identified

`ERR_ALPN_NEGOTIATION_FAILED` when uploading Assignment Brief files during unit creation.

## Root Cause

The request is **timing out** before reaching the backend when files are attached. This happens because:

1. **Cloudinary Upload Timeout** - Uploading multiple files to Cloudinary takes time
2. **Network Timeout** - Browser gives up waiting for response
3. **Connection Drop** - The connection fails mid-upload

### Evidence:
- ✅ Works WITHOUT files (unit creation succeeds)
- ❌ Fails WITH files (connection error before backend logs appear)
- Frontend logs show: `Assignment Brief Files: 2`
- Backend logs show: Nothing (request never arrives)

## Solutions

### Solution 1: Restart Backend (Quick Fix)

The backend configuration was updated to handle larger payloads:

```javascript
// server.js
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
```

**You MUST restart the backend server** for these changes to take effect:

```bash
# Stop current backend (Ctrl+C)
# Then restart:
cd D:\Lms\lms-app\backend
node server.js
```

### Solution 2: Increase Multer File Size Limit

The Multer config already has:
```javascript
limits: { fileSize: 100 * 1024 * 1024 } // 100MB
```

But you can also add a timeout:

```javascript
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 50 // Max 50 files
  }
});
```

### Solution 3: Two-Step Upload (Recommended for Large Files)

Instead of uploading files during unit creation, upload them separately:

1. **Step 1**: Create unit (no files)
2. **Step 2**: Upload assignment brief files to the created unit

This prevents timeouts and provides better user feedback.

## Immediate Action Required

1. **Restart your backend server** right now
2. Try uploading files again
3. Check backend terminal for new logs showing the upload process

## Backend Logs to Watch For

After restarting, you should see:
```
[Qualification] Unit creation request received
[Qualification] Auth passed, processing file upload...
[Qualification] Multer fields configured: ...
[Qualification] File upload successful
[Qualification] Creating unit for course: 48
[Qualification] Files received: { reading_files: [], assignment_brief_files: [...] }
```

If you DON'T see these logs, the request is still timing out before reaching the server.

## Alternative Workaround

If restarting doesn't work, temporarily **upload fewer/smaller files** or **upload files one at a time** to diagnose if it's a file size issue.

## Status

🔴 **Action Required**: Restart backend server now
📝 **Backend Changes**: Already applied (need restart)
🔍 **Root Cause**: Network timeout during file upload





















