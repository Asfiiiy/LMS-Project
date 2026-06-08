# 🚀 Quick Start: Moodle Import

## 📋 In 60 Seconds

### Step 1: Export from Moodle
1. Go to Course → Backup
2. Click "Perform backup"
3. Download `.mbz` file

### Step 2: Import to LMS
1. Login as **Admin**
2. Go to **Admin Dashboard**
3. Click **"Import Moodle"** tab
4. Click **"Start Import"**
5. Upload `.mbz` file
6. Select category
7. Click **"Import Moodle Course"**
8. Wait for completion ✅

### Step 3: Verify
1. Go to **Course Management**
2. Find your imported course
3. Click **"Manage Files"**
4. See all content! 🎉

---

## 📦 What's Imported

✅ Course title & description  
✅ Sections → Units  
✅ PDF files → Cloudinary  
✅ Videos → Cloudinary  
✅ Word/PowerPoint → Cloudinary  
✅ Images → Cloudinary  

---

## 🔗 URLs

- **Import Page:** `http://localhost:3000/dashboard/admin/import-moodle`
- **API Endpoint:** `POST /api/admin/courses/restore`

---

## 📚 Full Documentation

See: `MOODLE_IMPORT_COMPLETE.md`

---

**That's it!** 🎊 Import Moodle courses in minutes, not hours!

