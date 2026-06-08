# 📦 Moodle Backup (.mbz) Import System

## 🎯 Overview

Import entire courses from Moodle backup files (`.mbz`) including:
- ✅ Course structure (title, description)
- ✅ Units/Topics/Sections
- ✅ PDF files → Auto-uploaded to Cloudinary
- ✅ Assignments
- ✅ Quizzes (with GIFT format support)
- ✅ Resources (documents, videos)
- ✅ Category/Subcategory selection

---

## 📋 Current Implementation Status

### ✅ Already Implemented (Backend):

1. **File Upload Handler** (`/api/admin/courses/restore`)
   - Accepts `.mbz` files
   - Extracts ZIP contents using `AdmZip`
   - Parses `course.xml` and `moodle_backup.xml`

2. **Basic XML Parsing** (`handleMoodleBackup` function)
   - Extracts course title, description
   - Finds assignments and quizzes
   - Creates basic course structure

3. **Database Insertion**
   - Creates courses in database
   - Creates categories
   - Creates assignments and quizzes

### ❌ Missing Features (Need to Implement):

1. **File Extraction from .mbz**
   - Extract PDF/document files from activities folder
   - Upload extracted files to Cloudinary
   - Link files to course resources

2. **Unit/Section Creation**
   - Parse Moodle sections
   - Create units in correct order
   - Link resources to units

3. **Enhanced Resource Handling**
   - Parse resource activities
   - Handle different file types
   - Maintain file structure

4. **Frontend Upload Interface**
   - File upload form
   - Category/subcategory selection
   - Progress indicator
   - Preview before import

5. **Cloudinary Integration**
   - Batch file upload
   - Progress tracking
   - Error handling

---

## 🏗️ Moodle .mbz File Structure

### What's inside a .mbz file:

```
backup-moodle2-course-3-1_course_name-20251112-0735-nu.mbz (ZIP file)
│
├── moodle_backup.xml          # Backup metadata
├── course/
│   └── course.xml             # Course structure & settings
├── sections/
│   ├── section_123456789/
│   │   └── section.xml        # Section/Topic info
│   └── section_987654321/
│       └── section.xml
├── activities/
│   ├── resource_123/          # PDF/File resource
│   │   ├── resource.xml       # Resource metadata
│   │   └── files/
│   │       └── document.pdf   # Actual file
│   ├── assign_456/            # Assignment
│   │   └── assign.xml
│   ├── quiz_789/              # Quiz
│   │   └── quiz.xml
│   └── ...
└── files.xml                  # File index
```

---

## 🔧 Enhanced Implementation Plan

### Phase 1: Enhanced Backend (HIGH PRIORITY)

#### 1.1 Improve `handleMoodleBackup` Function

```javascript
async function handleMoodleBackup(filePath, categoryId, subCategoryId) {
  const zip = new AdmZip(filePath);
  const zipEntries = zip.getEntries();
  
  // Step 1: Parse course.xml for basic info
  const courseData = parseCourseXml(zip);
  
  // Step 2: Parse sections (units)
  const sections = parseSections(zip);
  
  // Step 3: Extract and upload files to Cloudinary
  const uploadedFiles = await extractAndUploadFiles(zip);
  
  // Step 4: Parse activities (resources, assignments, quizzes)
  const activities = parseActivities(zip, uploadedFiles);
  
  // Step 5: Build structured data
  return {
    course: {
      title: courseData.title,
      description: courseData.description,
      category_id: categoryId,
      sub_category_id: subCategoryId
    },
    units: sections.map(s => ({
      title: s.name,
      content: s.summary,
      order_index: s.number
    })),
    resources: activities.resources,
    assignments: activities.assignments,
    quizzes: activities.quizzes
  };
}
```

#### 1.2 File Extraction & Cloudinary Upload

```javascript
async function extractAndUploadFiles(zip) {
  const uploadedFiles = new Map();
  const zipEntries = zip.getEntries();
  
  for (const entry of zipEntries) {
    // Look for files in activities/*/files/
    if (entry.entryName.includes('/files/') && !entry.isDirectory) {
      const fileName = path.basename(entry.entryName);
      const fileBuffer = entry.getData();
      
      // Upload to Cloudinary
      try {
        const result = await cloudinary.uploader.upload_stream({
          resource_type: 'auto',
          folder: 'moodle_imports',
          public_id: `${Date.now()}_${fileName}`
        }, (error, result) => {
          if (error) throw error;
          return result;
        }).end(fileBuffer);
        
        uploadedFiles.set(entry.entryName, {
          originalPath: entry.entryName,
          cloudinaryUrl: result.secure_url,
          fileName: fileName,
          fileSize: entry.header.size
        });
      } catch (error) {
        console.error(`Error uploading ${fileName}:`, error);
      }
    }
  }
  
  return uploadedFiles;
}
```

#### 1.3 Section Parsing

```javascript
function parseSections(zip) {
  const sections = [];
  const entries = zip.getEntries();
  
  for (const entry of entries) {
    if (entry.entryName.includes('/sections/') && entry.entryName.endsWith('section.xml')) {
      const xmlContent = entry.getData().toString('utf8');
      
      const numberMatch = xmlContent.match(/<number>(\d+)<\/number>/);
      const nameMatch = xmlContent.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
      const summaryMatch = xmlContent.match(/<summary><!\[CDATA\[(.*?)\]\]><\/summary>/);
      
      sections.push({
        number: numberMatch ? parseInt(numberMatch[1]) : 0,
        name: nameMatch ? nameMatch[1] : 'Unnamed Section',
        summary: summaryMatch ? summaryMatch[1] : ''
      });
    }
  }
  
  return sections.sort((a, b) => a.number - b.number);
}
```

---

### Phase 2: Frontend Upload Interface

#### 2.1 Create Restore Page (`app/courses/restore/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { apiService } from '@/app/services/api';

export default function CourseRestorePage() {
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('backupFile', file);
    formData.append('category_id', categoryId?.toString() || '');
    formData.append('sub_category_id', subCategoryId?.toString() || '');
    
    try {
      const response = await fetch('/api/admin/courses/restore', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Course imported successfully!');
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Import Moodle Course</h1>
      
      {/* File Upload */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block mb-4">
          <span className="text-gray-700 font-medium">Select .mbz File</span>
          <input
            type="file"
            accept=".mbz"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full"
          />
        </label>
        
        {/* Category Selection */}
        {/* Add dropdown for categories */}
        
        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? `Importing... ${progress}%` : 'Import Course'}
        </button>
      </div>
    </div>
  );
}
```

---

## 📝 Implementation Steps

### Step 1: Enhance Backend Parser

1. Open `lms-app/backend/routes/admin.js`
2. Find `handleMoodleBackup` function (line ~1739)
3. Add helper functions:
   - `parseSections()` - Extract unit structure
   - `extractAndUploadFiles()` - Upload PDFs to Cloudinary
   - `parseResources()` - Link files to resources
4. Update main restore route to accept `category_id` and `sub_category_id`

### Step 2: Create Frontend

1. Create `lms-app/app/courses/restore/page.tsx`
2. Add file upload form
3. Add category/subcategory dropdowns
4. Add progress indicator
5. Add preview before import

### Step 3: Add API Methods

1. Add to `lms-app/app/services/api.ts`:
```typescript
async restoreMoodleCourse(file: File, categoryId?: number, subCategoryId?: number) {
  const formData = new FormData();
  formData.append('backupFile', file);
  if (categoryId) formData.append('category_id', categoryId.toString());
  if (subCategoryId) formData.append('sub_category_id', subCategoryId.toString());
  
  const response = await fetch(`${this.baseUrl}/admin/courses/restore`, {
    method: 'POST',
    body: formData
  });
  
  return response.json();
}
```

### Step 4: Add Menu Link

Add to Admin Dashboard:
```tsx
<Link href="/courses/restore">
  📦 Import Moodle Course
</Link>
```

---

## 🎯 Expected Workflow

### User Perspective:

1. **Admin goes to "Import Moodle Course" page**
2. **Selects .mbz file** from computer
3. **Chooses Category & Subcategory** from dropdowns
4. **Clicks "Import"**
5. **System processes:**
   - Extracts .mbz file
   - Parses course structure
   - Uploads all PDFs to Cloudinary
   - Creates course in database
   - Creates units/topics
   - Links files to resources
6. **Shows success message** with link to course

### What Gets Created:

```
Course: "Unit 1 - HSC301 Health & Social Care"
├── Category: Health & Social Care
├── Subcategory: Level 1
├── Unit 1: Introduction
│   ├── 📄 syllabus.pdf (Cloudinary)
│   └── 📝 overview.docx (Cloudinary)
├── Unit 2: Basic Concepts
│   ├── 📄 chapter1.pdf (Cloudinary)
│   └── 🎥 lecture1.mp4 (Cloudinary)
├── Assignments
│   └── Assignment 1: Essay
└── Quizzes
    └── Quiz 1: Introduction Quiz
```

---

## 🔍 Testing with Your File

Your file: `backup-moodle2-course-3-1_an_introduction_to_health_and_social_care-20251112-0735-nu.mbz`

### Expected extraction:

1. **Course Name:** "An Introduction to Health and Social Care"
2. **Course Code:** Course 3
3. **Sections:** Multiple units/topics
4. **Files:** All PDFs and documents
5. **Activities:** Assignments and quizzes

---

## 📊 Database Changes Needed

No new tables required! Existing structure supports it:

- ✅ `courses` - Course info
- ✅ `units` - Sections/Topics
- ✅ `resources` - Files (PDFs, videos)
- ✅ `assignments` - Assignments
- ✅ `quizzes` - Quizzes with questions

---

## 🚀 Quick Implementation (Simplified Version)

Want to get started quickly? Here's a minimal implementation:

### Backend Enhancement:

```javascript
// Add to admin.js after line 1602
router.post('/courses/restore-enhanced', upload.single('backupFile'), async (req, res) => {
  try {
    const { category_id, sub_category_id } = req.body;
    const tempPath = path.join(__dirname, '../temp', `${Date.now()}.mbz`);
    
    // Save uploaded file temporarily
    fs.writeFileSync(tempPath, req.file.buffer);
    
    // Extract and process
    const zip = new AdmZip(tempPath);
    const courseXml = findFileInZip(zip, 'course.xml');
    
    // Parse course info
    const title = extractFromXml(courseXml, 'fullname');
    const description = extractFromXml(courseXml, 'summary');
    
    // Create course
    const [result] = await pool.execute(
      'INSERT INTO courses (title, description, category_id, sub_category_id, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, description, category_id || null, sub_category_id || null, 1]
    );
    
    const courseId = result.insertId;
    
    // Extract and upload files
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.entryName.includes('/files/') && entry.entryName.endsWith('.pdf')) {
        const fileBuffer = entry.getData();
        const cloudinaryResult = await uploadToCloudinary(fileBuffer);
        
        // Save to resources
        await pool.execute(
          'INSERT INTO resources (course_id, title, file_path) VALUES (?, ?, ?)',
          [courseId, path.basename(entry.entryName), cloudinaryResult.secure_url]
        );
      }
    }
    
    // Cleanup
    fs.unlinkSync(tempPath);
    
    res.json({ success: true, courseId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## 💡 Recommendations

### Priority 1 (Essential):
1. ✅ Enhance file extraction from .mbz
2. ✅ Upload extracted files to Cloudinary
3. ✅ Create units from sections
4. ✅ Add category/subcategory selection

### Priority 2 (Nice to have):
1. Progress indicator during upload
2. Preview course structure before import
3. Select which activities to import
4. Bulk import multiple courses

### Priority 3 (Future):
1. Export to .mbz format
2. Course cloning
3. Incremental updates
4. Backup scheduling

---

## 🎬 Next Steps

Would you like me to:

1. **Implement the enhanced backend parser** (with file extraction & Cloudinary upload)?
2. **Create the frontend upload interface**?
3. **Create a simplified single-file solution** to get started quickly?
4. **Test with your actual .mbz file** to see what data we can extract?

Let me know which approach you'd prefer, and I'll implement it for you! 🚀

