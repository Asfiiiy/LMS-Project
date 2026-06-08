# Fix 413 Request Entity Too Large Error

## Problem
When uploading large files (like qualification course intro files), Nginx returns a 413 error because the default `client_max_body_size` is too small (usually 1MB).

## Solution

### Step 1: Update Nginx Configuration

SSH into your VPS and edit the Nginx configuration:

```bash
# Edit your Nginx site configuration
sudo nano /etc/nginx/sites-available/default
# OR if you have a specific config file:
sudo nano /etc/nginx/sites-available/lms.inspirelondoncollege.com
```

Add or update these lines inside the `server { }` block:

```nginx
client_max_body_size 200M;
client_body_buffer_size 200M;
client_header_buffer_size 1k;
large_client_header_buffers 4 16k;
client_body_timeout 300s;
client_header_timeout 300s;
send_timeout 300s;
```

### Step 2: Test Nginx Configuration

```bash
# Test the configuration for syntax errors
sudo nginx -t
```

### Step 3: Reload Nginx

```bash
# If test passes, reload Nginx
sudo systemctl reload nginx
# OR
sudo service nginx reload
```

### Step 4: Restart Backend (already updated in code)

The backend limits have been increased to 200MB in:
- `backend/server.js` - Express body parser limits
- `backend/routes/admin.js` - Multer file size limits

After pulling the code, restart the backend:

```bash
cd /var/www/lms-app/backend
pm2 restart lms-server
```

## Verification

After making these changes, try uploading a large file again. The 413 error should be resolved.

## Notes

- The limit is set to 200MB which should be sufficient for most course intro files
- If you need larger files, increase the `200M` value accordingly
- Make sure your VPS has enough memory to handle large file uploads

