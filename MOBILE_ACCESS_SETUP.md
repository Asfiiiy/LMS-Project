# Mobile Access Setup Guide

## Problem
When accessing the LMS from a mobile device, you get "Failed to fetch" errors because the frontend is hardcoded to `http://localhost:5000`, which doesn't work from mobile devices.

## Solution
The frontend now automatically detects the correct API URL based on your current hostname. However, for mobile access, you need to:

### Step 1: Find Your Computer's Local IP Address

**Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually `192.168.x.x` or `10.x.x.x`)

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```
or
```bash
ip addr show
```

### Step 2: Update Backend CORS (if needed)

Make sure your backend `server.js` allows requests from your mobile device's IP. Check the CORS configuration.

### Step 3: Access from Mobile

**Option A: Automatic Detection (Recommended)**
- The frontend will automatically use `http://YOUR_COMPUTER_IP:5000/api` when accessed from mobile
- Just make sure your mobile device and computer are on the same WiFi network
- Access the app from mobile using: `http://YOUR_COMPUTER_IP:3000` (or whatever port Next.js uses)

**Option B: Environment Variable (For Production)**
Create a `.env.local` file in the `lms-app` folder:
```env
NEXT_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:5000/api
```

Replace `YOUR_COMPUTER_IP` with your actual local IP (e.g., `192.168.1.100`)

### Step 4: Test

1. Make sure backend is running on port 5000
2. Make sure frontend is running
3. On your mobile device, open browser and go to: `http://YOUR_COMPUTER_IP:3000` (or your Next.js port)
4. Try logging in

## Troubleshooting

**Still getting "Failed to fetch"?**
1. Check firewall - Windows Firewall might be blocking port 5000
2. Check backend is accessible - Try `http://YOUR_COMPUTER_IP:5000/health` from mobile browser
3. Check CORS - Make sure backend allows requests from your mobile device
4. Check network - Mobile and computer must be on same WiFi network

**Firewall Fix (Windows):**
```powershell
# Allow port 5000 through firewall
netsh advfirewall firewall add rule name="Node.js Backend" dir=in action=allow protocol=TCP localport=5000
```

## Notes

- The frontend now automatically detects the API URL from `window.location.hostname`
- This means if you access from `http://192.168.1.100:3000`, it will use `http://192.168.1.100:5000/api`
- If you access from `http://localhost:3000`, it will use `http://localhost:5000/api`
- For production, set `NEXT_PUBLIC_API_URL` environment variable

