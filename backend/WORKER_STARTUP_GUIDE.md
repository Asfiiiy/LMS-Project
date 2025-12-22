# Certificate Worker Startup Guide

## 📋 Overview

The certificate generation worker is a **separate process** that must be running to process certificate generation jobs from the queue.

**Important**: Both the server AND the worker must be running for certificates to be generated!

---

## 🚀 Option 1: Manual Start (Development)

### Start Server Only
```bash
npm start
# or
npm run dev
```

### Start Worker Only (in a separate terminal)
```bash
npm run worker
# or for auto-reload during development
npm run worker:dev
```

**You need 2 terminals:**
- Terminal 1: `npm start` (server)
- Terminal 2: `npm run worker` (worker)

---

## 🚀 Option 2: Start Both Together (Development)

### Install concurrently (one-time)
```bash
npm install --save-dev concurrently
```

### Start both with one command
```bash
npm run start:all    # Production mode
npm run dev:all      # Development mode (with auto-reload)
```

This starts both server and worker in the same terminal.

---

## 🚀 Option 3: PM2 (Production - Recommended)

PM2 keeps both processes running automatically and restarts them if they crash.

### Install PM2 (one-time, globally)
```bash
npm install -g pm2
```

### Start both processes
```bash
npm run pm2:start
```

### Other PM2 commands
```bash
npm run pm2:status   # Check if both are running
npm run pm2:logs     # View logs from both
npm run pm2:restart  # Restart both
npm run pm2:stop     # Stop both
```

### Auto-start on server reboot
```bash
pm2 startup
pm2 save
```

This ensures both server and worker start automatically when your VPS reboots.

---

## ✅ How to Verify Worker is Running

### Check 1: Look for this in worker logs
```
✅ Certificate worker started successfully!
   Waiting for jobs...
```

### Check 2: Make a payment
1. Complete a certificate claim payment
2. Check backend logs: Should see `✅ Certificate generation job added to queue`
3. Check worker logs: Should see `🔄 Processing certificate for claim X...`

### Check 3: Check queue status
Visit: `http://localhost:5000/api/certificates/queue/status`

Should show:
```json
{
  "waiting": 0,
  "active": 0,
  "completed": 1,
  "failed": 0
}
```

---

## 🔧 Troubleshooting

### Worker not processing jobs?
1. **Check if worker is running**: Look for "Waiting for jobs..." in logs
2. **Check Redis connection**: Should see "✅ Certificate queue connected to Redis"
3. **Check for errors**: Look for `ECONNRESET` or connection errors

### Jobs stuck in queue?
1. Check worker logs for errors
2. Restart worker: `npm run pm2:restart` (if using PM2)
3. Check LibreOffice is installed and accessible

### Worker keeps crashing?
1. Check logs: `npm run pm2:logs` or check terminal output
2. Verify environment variables are set correctly
3. Check Redis connection is working

---

## 📝 Summary

| Method | Use Case | Auto-restart? | Best For |
|--------|----------|---------------|----------|
| Manual (2 terminals) | Development | ❌ No | Quick testing |
| `npm run start:all` | Development | ❌ No | Local development |
| PM2 | Production | ✅ Yes | VPS/Production |

**For Production/VPS**: Use **PM2** (Option 3) - it's the most reliable.

