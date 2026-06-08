# Qualification Course Student Features

## 🎯 Overview

This document explains the student-specific features added to qualification courses, including assignment submission, grading, deadlines, and unit lock/unlock system.

---

## ✨ Features Implemented

### 1. **Deadline Display** ⏰

**Location:** Unit header (top-right)

- Shows submission deadline for each unit
- Only visible when unit is unlocked
- Format: "Due: MM/DD/YYYY"
- Color-coded: Blue badge

**UI Element:**
```typescript
{!selectedUnitData.progress?.is_locked && selectedUnitData.unit?.deadline && (
  <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg">
    ⏰ Due: {new Date(selectedUnitData.unit.deadline).toLocaleDateString()}
  </span>
)}
```

---

### 2. **Unit Lock/Unlock System** 🔒

**Location:** Unit header (top-right)

**Lock States:**
- 🔒 **Locked** - Unit cannot be accessed until previous requirements are met
- 🔓 **Unlocked** - Student can view content and submit assignments

**Unlock Conditions** (set by admin):
- `none` - Always unlocked
- `previous_assignment` - Unlocked after previous unit's assignment is graded as "Pass"
- `previous_presentation` - Unlocked after previous unit's presentation is graded as "Pass"
- `previous_both` - Unlocked after both assignment AND presentation are graded as "Pass"

**UI Element:**
```typescript
{selectedUnitData.progress?.is_locked && (
  <span className="bg-red-100 text-red-700 px-4 py-2 rounded-lg">
    🔒 Locked
  </span>
)}
```

**Backend Logic:**
- When tutor grades a submission as "Pass", the system automatically unlocks the next unit
- Lock status stored in `qual_unit_progress` table
- Checked on every unit load

---

### 3. **Assignment Submission Form** 📝

**Location:** Below Assignment Brief section (students only)

**Features:**
- File upload input (PDF, DOC, DOCX, PPT, PPTX)
- File size limit: 100MB
- Submit button (disabled until file selected)
- Only shown if `enable_assignment_submission` is true for the unit

**Submission Status Display:**

#### **Not Submitted:**
- Shows file upload form
- "Submit Assignment" button

#### **Submitted - Awaiting Grade:**
- Blue status card
- Shows: ⏳ "Submitted - Awaiting Grade"
- Displays submission date
- Shows submitted filename

#### **Graded - Pass:**
- Green status card
- Shows: ✅ "Graded"
- Displays grade: **Pass** (in green)
- Shows tutor feedback (if provided)
- Shows submitted filename

#### **Graded - Fail:**
- Red status card
- Shows: ✅ "Graded"
- Displays grade: **Fail** (in red)
- Shows tutor feedback (if provided)
- Shows submitted filename

---

### 4. **Presentation Submission Form** 🎤

**Location:** Below Presentation Brief section (students only)

**Features:**
- File upload input (PDF, PPT, PPTX only)
- File size limit: 100MB
- Submit button (disabled until file selected)
- Only shown if `enable_presentation_submission` is true for the unit

**Submission Status Display:**
- Same structure as assignment submissions
- Color-coded: Pink theme instead of orange

---

## 🔧 Technical Implementation

### **Frontend Changes**

**File:** `lms-app/app/dashboard/admin/qualification/[courseId]/view/page.tsx`

**New State Variables:**
```typescript
const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
const [presentationFile, setPresentationFile] = useState<File | null>(null);
const [submitting, setSubmitting] = useState(false);
const [submissions, setSubmissions] = useState<any>(null);
```

**New Functions:**
- `loadSubmissions(unitId, studentId)` - Fetches student's submissions for a unit
- `handleSubmitAssignment()` - Submits assignment file
- `handleSubmitPresentation()` - Submits presentation file

**API Calls:**
```typescript
// Load submissions
GET /api/qualification/units/:unitId/submissions?studentId=X

// Submit assignment
POST /api/qualification/units/:unitId/submit
Body: FormData { file, submission_type: 'assignment' }

// Submit presentation
POST /api/qualification/units/:unitId/submit
Body: FormData { file, submission_type: 'presentation' }
```

---

### **Backend Changes**

**File:** `lms-app/backend/routes/qualification.js`

**New Endpoints:**

#### 1. **Get Student Submissions**
```javascript
GET /api/qualification/units/:unitId/submissions?studentId=X

Response:
{
  success: true,
  submissions: {
    assignment: {
      id, file_name, file_path, status, grade, feedback, submitted_at
    },
    presentation: {
      id, file_name, file_path, status, grade, feedback, submitted_at
    }
  }
}
```

#### 2. **Submit Assignment/Presentation** (existing, already implemented)
```javascript
POST /api/qualification/units/:unitId/submit
Headers: { Authorization: 'Bearer TOKEN' }
Body: FormData { file, submission_type: 'assignment|presentation' }

Response:
{
  success: true,
  message: 'Assignment submitted successfully',
  submissionId: X
}
```

**Database Tables Used:**
- `qual_submissions` - Stores all submissions
  - Columns: `id`, `unit_id`, `student_id`, `submission_type`, `file_name`, `file_path`, `file_size`, `status`, `grade`, `feedback`, `submitted_at`
- `qual_unit_progress` - Tracks student progress and lock status
  - Columns: `student_id`, `unit_id`, `is_locked`, `assignment_submitted`, `presentation_submitted`

---

## 🎓 Student User Flow

### **Step 1: Access Qualification Course**
1. Student logs in
2. Goes to dashboard
3. Clicks "Continue Learning" on qualification course
4. Routed to: `/dashboard/student/qualification/:courseId/view`

### **Step 2: View Course Introduction**
1. Sees course title, description
2. Reads welcome message
3. Reviews disclaimer and general information
4. Downloads handbook/descriptor files

### **Step 3: Select a Unit**
1. Left sidebar shows all units
2. Clicks on a unit to view content
3. Unit loads with:
   - Lock status indicator (if locked, content is hidden)
   - Deadline display (if set)
   - Optional badge (if unit is optional)

### **Step 4: Study Unit Content**
1. Reads unit information (disclaimer, general info)
2. Views lectures with inline PDF viewing
3. Studies topics with attached files
4. Downloads additional readings
5. Reviews assignment brief
6. Reviews presentation brief (if applicable)

### **Step 5: Submit Assignment**
1. Scrolls to "Submit Your Assignment" section
2. Clicks "Choose File" and selects PDF/DOC/PPT
3. Sees selected filename displayed
4. Clicks "Submit Assignment" button
5. Receives success message
6. Submission status changes to "⏳ Submitted - Awaiting Grade"

### **Step 6: Wait for Grading**
1. Tutor reviews submission
2. Tutor assigns grade (Pass/Fail) and feedback
3. Student refreshes page or re-enters unit

### **Step 7: View Grade**
1. Submission status updates to "✅ Graded"
2. Grade displayed: **Pass** (green) or **Fail** (red)
3. Tutor feedback shown (if provided)
4. If graded "Pass", next unit automatically unlocks

### **Step 8: Proceed to Next Unit**
1. Next unit unlock indicator removed (🔒 → no badge)
2. Student can now access next unit
3. Repeat steps 3-7 for each unit

---

## 🔐 Admin/Tutor Unit Creation

### **Enable Submissions**

When creating/editing a unit, admins can:

1. **Enable Assignment Submission:**
   - Checkbox: `enable_assignment_submission`
   - Adds assignment brief section
   - Students see submission form

2. **Enable Presentation Submission:**
   - Checkbox: `enable_presentation_submission`
   - Adds presentation brief section
   - Students see submission form

3. **Set Deadline:**
   - Date picker: `deadline`
   - Displayed on unit header for students

4. **Set Unlock Condition:**
   - Dropdown: `unlock_condition`
   - Options: none, previous_assignment, previous_presentation, previous_both
   - Controls when unit becomes accessible

---

## 📊 Database Schema

### **qual_submissions**
```sql
CREATE TABLE qual_submissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT,
  student_id INT,
  submission_type ENUM('assignment', 'presentation'),
  file_name VARCHAR(255),
  file_path TEXT,
  file_size BIGINT,
  status ENUM('submitted', 'graded'),
  grade VARCHAR(50),
  feedback TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  graded_at TIMESTAMP NULL,
  graded_by INT,
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (graded_by) REFERENCES users(id)
);
```

### **qual_unit_progress**
```sql
CREATE TABLE qual_unit_progress (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT,
  course_id INT,
  unit_id INT,
  is_locked BOOLEAN DEFAULT TRUE,
  assignment_submitted BOOLEAN DEFAULT FALSE,
  presentation_submitted BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  UNIQUE KEY (student_id, unit_id)
);
```

### **units** (relevant columns)
```sql
ALTER TABLE units ADD COLUMN enable_assignment_submission BOOLEAN DEFAULT FALSE;
ALTER TABLE units ADD COLUMN enable_presentation_submission BOOLEAN DEFAULT FALSE;
ALTER TABLE units ADD COLUMN deadline TIMESTAMP NULL;
ALTER TABLE units ADD COLUMN unlock_condition ENUM('none', 'previous_assignment', 'previous_presentation', 'previous_both') DEFAULT 'none';
```

---

## 🎨 UI Components Summary

### **Color Coding**

| Component | Color | Usage |
|-----------|-------|-------|
| Assignment Brief | Orange | Assignment-related sections |
| Presentation Brief | Pink | Presentation-related sections |
| Deadline Badge | Blue | Deadline display |
| Locked Badge | Red | Unit is locked |
| Submitted Status | Blue | Awaiting grade |
| Pass Grade | Green | Graded as Pass |
| Fail Grade | Red | Graded as Fail |

### **Icons Used**

| Icon | Meaning |
|------|---------|
| ⏰ | Deadline |
| 🔒 | Locked unit |
| 📝 | Assignment |
| 🎤 | Presentation |
| 📤 | Submit |
| ⏳ | Awaiting grade |
| ✅ | Graded |

---

## 🚀 Testing Checklist

### **As Student:**

- [ ] Can access qualification course from dashboard
- [ ] See course introduction with welcome message
- [ ] See all units in left sidebar
- [ ] Locked unit shows 🔒 badge
- [ ] Unlocked unit with deadline shows ⏰ badge
- [ ] Can view unit content (lectures, topics, readings)
- [ ] PDFs open inline in modal viewer
- [ ] Assignment brief displays correctly
- [ ] Presentation brief displays correctly
- [ ] Assignment submission form appears (if enabled)
- [ ] Can select and upload assignment file
- [ ] "Submit Assignment" button works
- [ ] Submission status shows "Awaiting Grade"
- [ ] After tutor grades, status updates to "Graded"
- [ ] Grade (Pass/Fail) displays correctly
- [ ] Tutor feedback shows (if provided)
- [ ] Next unit unlocks after receiving "Pass" grade
- [ ] Presentation submission works same as assignment

### **As Admin/Tutor:**

- [ ] Can create unit with assignment enabled
- [ ] Can create unit with presentation enabled
- [ ] Can set deadline for unit
- [ ] Can set unlock condition
- [ ] Can view pending submissions
- [ ] Can grade submissions (Pass/Fail)
- [ ] Can provide feedback
- [ ] Grading triggers unlock of next unit (if condition met)

---

## 📝 Notes

- **File Storage:** All submissions stored in Cloudinary (`lms/qualification` folder)
- **File Size Limit:** 100MB (enforced by multer)
- **Allowed Formats:** PDF, DOC, DOCX, PPT, PPTX
- **Resubmission:** Currently not supported - student can only submit once
- **Grading System:** Pass/Fail (or Score-based if admin configures)
- **Unlock Logic:** Automatic upon tutor grading as "Pass"
- **Progress Tracking:** Stored in `qual_unit_progress` table

---

## 🔮 Future Enhancements (Not Yet Implemented)

- [ ] Allow resubmission after "Fail" grade
- [ ] Email notifications when graded
- [ ] Progress bar showing % completion
- [ ] Certificate generation upon course completion
- [ ] Batch download of all unit materials
- [ ] Discussion forum per unit
- [ ] Peer review feature
- [ ] Assignment rubric display
- [ ] Draft save (submit later)
- [ ] Version history of submissions

---

## 🐛 Troubleshooting

### **Submission not showing:**
- Check if `enable_assignment_submission` or `enable_presentation_submission` is true for the unit
- Verify student is logged in and accessing as "Student" role
- Check browser console for errors

### **Unit stays locked:**
- Verify previous unit's assignment/presentation is graded as "Pass"
- Check `unlock_condition` is set correctly
- Verify `qual_unit_progress` table has correct `is_locked` value

### **Deadline not showing:**
- Check if `deadline` field is set for the unit in database
- Verify unit is not locked (deadline only shows when unlocked)

### **File upload fails:**
- Check file size (max 100MB)
- Verify file format is allowed
- Check Cloudinary quota and credentials
- Check browser console and backend logs for errors

---

**Last Updated:** November 18, 2025  
**Created By:** AI Assistant

