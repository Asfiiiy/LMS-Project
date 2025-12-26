# VPS Fix Commands - 404 Errors, MIME Types, Access Denied

## Step 1: Fix Nginx MIME Types

SSH into your VPS and run:

```bash
# Backup current Nginx config
sudo cp /etc/nginx/sites-available/lms /etc/nginx/sites-available/lms.backup

# Edit Nginx config
sudo nano /etc/nginx/sites-available/lms
```

Add these lines inside the `server` block (before the closing `}`):

```nginx
# Fix MIME types for JavaScript files
location ~* \.js$ {
    add_header Content-Type application/javascript;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# Fix MIME types for Next.js static chunks
location /_next/static/ {
    add_header Content-Type application/javascript;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}

# Fix for Turbopack chunks
location /_next/static/chunks/ {
    add_header Content-Type application/javascript;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}
```

Then test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 2: Rebuild Frontend Completely

```bash
cd /var/www/lms-app

# Remove old build
rm -rf .next
rm -rf node_modules/.cache

# Rebuild
npm run build

# Check if build succeeded
ls -la .next/static/chunks/ | head -10
```

## Step 3: Restart All Services

```bash
cd /var/www/lms-app/backend
pm2 restart all
pm2 status
```

## Step 4: Pull Latest Code (if not done)

```bash
cd /var/www/lms-app
git pull origin main
rm -rf .next
npm run build
cd backend
pm2 restart all
```

## Step 5: Verify

1. Check browser console - should see no 404 errors
2. Check Network tab - JS files should have `Content-Type: application/javascript`
3. Try accessing course - should not show "Access Denied"
4. Try opening PDF - should work without Mixed Content error

