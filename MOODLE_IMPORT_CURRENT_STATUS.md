# 📦 Moodle .mbz Import - Current Status

## 🗂️ Main File That Handles .mbz Import

**File:** `lms-app/backend/routes/admin.js`

**Function:** `handleMoodleBackup(filePath, categoryId, subCategoryId)`  
**Lines:** Approximately 1800-2050

---

## 📋 What It Does

### 1️⃣ **Endpoint**
```
POST /api/admin/courses/restore
```
- Accepts `.mbz` file upload
- Uses Multer middleware for file handling
- Calls `handleMoodleBackup()` function

### 2️⃣ **Processing Steps**

```javascript
1. Extract .mbz (ZIP file) using AdmZip
2. Find and parse XML files:
   - course/course.xml (course info)
   - sections/section_*/section.xml (units)
   - activities/resource_*/resource.xml (files)
3. Extract files from /files/ folders
4. Upload files to Cloudinary
5. Create database records:
   - courses table
   - units table
   - resources table
```

---

## 📊 Current Implementation

### ✅ Working
- ✅ File upload (.mbz accepted)
- ✅ ZIP extraction
- ✅ Course creation
- ✅ Cloudinary upload
- ✅ Database insertion logic

### ⚠️ Issues
- ⚠️ **Sections not being parsed** (0 units created)
- ⚠️ **Resources not being created** (0 resources created)
- ⚠️ .mbz structure may not match parser expectations

---

## 🔧 Key Code Sections

### File Location
```
lms-app/backend/routes/admin.js
```

### Import Endpoint (Line ~1603)
```javascript
router.post('/courses/restore', upload.single('backupFile'), async (req, res) => {
  // Handles .mbz file upload
  // Calls handleMoodleBackup()
})
```

### Main Parser Function (Line ~1800)
```javascript
async function handleMoodleBackup(filePath, categoryId, subCategoryId) {
  // 1. Extract ZIP
  // 2. Parse XMLs
  // 3. Upload to Cloudinary
  // 4. Return structured data
}
```

### Database Insertion (Line ~1660)
```javascript
// Creates courses, units, resources in database
if (backupData.courses) { ... }
if (backupData.units) { ... }
if (backupData.resources) { ... }
```

---

## 📁 Database Tables Used

1. **courses** - Stores course metadata
2. **units** - Stores sections/topics from Moodle
3. **resources** - Stores uploaded files (PDFs, videos, etc.)

---

## 🎯 What's Expected in .mbz

```
backup.mbz (ZIP file)
├── moodle_backup.xml
├── course/
│   └── course.xml .................. Course info
├── sections/
│   ├── section_12345/
│   │   └── section.xml ............. Section/Unit data
│   └── section_67890/
│       └── section.xml
└── activities/
    └── resource_11111/
        ├── resource.xml
        └── files/
            ├── document.pdf ........ Files to extract
            └── video.mp4
```

---

## 🐛 Current Problem

**Course created but empty (0 units, 0 resources)**

**Likely causes:**
1. XML parsing not finding sections
2. Section XML structure different than expected
3. Files not in expected `/files/` location
4. Different Moodle version format

---

## 🔍 Next Debug Step

**Restart backend and import again to see logs:**
- What entries are in .mbz?
- How many sections found?
- Are units being created?
- Are resources being created?

The enhanced logging will show the actual .mbz structure!

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| **Main File** | `backend/routes/admin.js` |
| **Function** | `handleMoodleBackup()` |
| **Endpoint** | `POST /api/admin/courses/restore` |
| **Frontend Page** | `app/dashboard/admin/import-moodle/page.tsx` |
| **Tables** | `courses`, `units`, `resources` |

---

**Status:** 🟡 Partially working - Course imports but content is empty



