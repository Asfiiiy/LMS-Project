# Course Introduction Feature - Setup Instructions

## Overview
This feature adds a **Course Introduction** section that appears at the top of every course, above all topics. The introduction:
- Includes a custom heading and descriptive content
- Supports PDF/document attachments
- Is **always unlocked** for all students (not affected by the unit lock system)
- Appears prominently on both the course management page and student course view

## 🗄️ Step 1: Database Setup

Run the following migration in your MySQL database:

```sql
-- Migration: Add course introduction fields
-- Run this script against the LMS MySQL database

-- Add introduction fields to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS intro_heading VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS intro_subheading VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS intro_content TEXT NULL;

-- Create course_intro_files table for introduction PDFs/documents
CREATE TABLE IF NOT EXISTS course_intro_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT DEFAULT 0,
    file_type VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    INDEX idx_course_intro_files_course (course_id)
);
```

**Migration file location:** `lms-app/backend/migrations/20251110_add_course_introduction.sql`

## 🔧 Step 2: Restart Backend Server

After running the migration, restart your backend server:

```bash
cd lms-app/backend
# Stop the current server (Ctrl+C)
node server.js
```

## 🎨 Step 3: How to Use

### For Admins/Tutors - Adding Introduction Content

1. Navigate to **Course Content Manager** page: `http://localhost:3000/courses/[id]/files`

2. You'll see a new **Course Introduction** section at the top with a purple icon

3. Click **"Add Introduction"** (or "Edit Introduction" if one exists)

4. Fill in:
   - **Introduction Heading** (required): e.g., "Welcome to the Course", "Course Overview", "Getting Started"
   - **Sub-heading** (optional): e.g., "Learn the fundamentals in 6 weeks", "Master the basics"
   - **Introduction Content** (optional): Detailed text about the course, learning objectives, prerequisites, etc.
   - **Attach Files**: Upload PDFs, documents, or other course materials

5. Click **"Save Introduction"** to save

6. The introduction will now appear:
   - At the top of the course management page (with purple background)
   - At the top of the student course view (always unlocked)

### For Students - Viewing Introduction

1. Navigate to any course: `http://localhost:3000/courses/[id]`

2. If the course has an introduction, it will appear in a **purple-themed section** right below the course header

3. The introduction displays:
   - "Always Available" badge (indicating it's never locked)
   - Heading and content text
   - Downloadable files (click to view/download)

## 📋 Features

### Course Management Page (`/courses/[id]/files`)
- ✅ Add/edit course introduction heading and content
- ✅ Upload PDF/document files to introduction
- ✅ View all uploaded introduction files
- ✅ Delete introduction files
- ✅ Beautiful purple-themed UI to distinguish from regular topics
- ✅ Collapsible interface (expand/collapse)

### Student Course View (`/courses/[id]`)
- ✅ Introduction appears prominently at the top
- ✅ Heading, sub-heading, and content displayed
- ✅ Clear visual distinction from locked topics
- ✅ "Always Available" badge
- ✅ Clickable file links to view/download materials
- ✅ Responsive design for mobile/desktop

### Backend API Endpoints
- `PUT /admin/courses/:id` - Update course introduction heading/content
- `POST /admin/courses/:courseId/intro-files` - Upload introduction file
- `GET /admin/courses/:courseId/intro-files` - Get all introduction files
- `DELETE /admin/courses/intro-files/:fileId` - Delete introduction file
- `GET /admin/courses/:id/outline` - Enhanced to include introduction files

## 🎯 Design Decisions

### Why Introduction is Always Unlocked
- Provides essential course context to all students
- Contains prerequisites, learning objectives, syllabus information
- Not tied to course progress or completion
- Distinct from regular course topics (which follow lock/unlock rules)

### Purple Color Theme
- Visually distinct from blue course topics
- Indicates "informational" content
- Consistent branding across admin and student views

### Positioning
- Appears **above** all course topics
- Students see it immediately when entering a course
- Admins/tutors manage it separately from topics

## 🔄 Integration with Unit Lock System

The course introduction **bypasses** the unit lock system entirely:

- **Regular Topics**: Follow lock/unlock rules based on completion
- **Course Introduction**: Always accessible, regardless of student progress

In the code:
- Introduction is rendered separately from the unit list
- Uses different data structure (`course.intro_heading`, `course.intro_files`)
- Not tracked in `unit_progress` table

## 📁 Modified Files

### Backend
- `lms-app/backend/routes/admin.js` - Added introduction endpoints
- `lms-app/backend/migrations/20251110_add_course_introduction.sql` - Database migration

### Frontend
- `lms-app/app/services/api.ts` - Added introduction API methods
- `lms-app/app/courses/[id]/files/page.tsx` - Added introduction management UI
- `lms-app/app/courses/[id]/page.tsx` - Added introduction display for students

## 🐛 Troubleshooting

### Issue: Introduction section not showing
**Solution**: 
1. Verify database migration ran successfully
2. Restart backend server
3. Clear browser cache and refresh

### Issue: File upload fails
**Solution**: 
1. Check Cloudinary credentials in `backend/config/cloudinary.js`
2. Ensure file size is under 10MB (Cloudinary free tier limit)
3. Verify file type is supported (.pdf, .doc, .docx, .ppt, .pptx)

### Issue: Introduction files not appearing in student view
**Solution**: 
1. Ensure `course_intro_files` table exists
2. Check that files were uploaded successfully (check database)
3. Verify backend is fetching introduction files in `/courses/:id/outline` endpoint

## 🎉 Example Use Cases

1. **Course Syllabus**: Upload a PDF syllabus that's always available
2. **Welcome Video**: Link to introductory video or welcome message
3. **Prerequisites**: List required knowledge before starting course topics
4. **Learning Objectives**: Outline what students will learn
5. **Course Structure**: Explain how the course is organized

## 📊 Future Enhancements (Optional)

- Rich text editor for introduction content
- Video embed support
- Multiple file uploads at once
- Reorder introduction files
- Analytics: track how many students viewed introduction

---

**Status**: ✅ Fully Implemented and Ready to Use!

