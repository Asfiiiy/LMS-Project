# Student-Specific Topic Deadlines Implementation

## Overview
This feature allows tutors to set individual deadlines for each student per topic when enrolling them into CPD courses. Each student can have their own customized deadlines, which override the course default deadlines.

## Database Schema

### New Table: `student_topic_deadlines`
```sql
CREATE TABLE student_topic_deadlines (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  topic_id BIGINT NOT NULL,
  deadline DATETIME NOT NULL,
  set_by BIGINT NULL COMMENT 'User ID of tutor/admin who set this deadline',
  notes TEXT NULL COMMENT 'Optional notes about this deadline',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_student_topic (student_id, topic_id),
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES cpd_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (set_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_student_course (student_id, course_id),
  INDEX idx_topic (topic_id),
  INDEX idx_deadline (deadline),
  INDEX idx_course_topic (course_id, topic_id)
);
```

**Migration File:** `backend/migrations/create_student_topic_deadlines.sql`

## Backend Changes

### 1. Enrollment Endpoint (`/api/admin/enrollments`)
**File:** `backend/routes/admin.js`

**Changes:**
- Checks if the course is a CPD course
- Queries for topics with deadlines
- Returns `requiresDeadlineSetup: true` and topics array if deadlines exist
- Response format:
  ```json
  {
    "success": true,
    "message": "Students enrolled successfully",
    "requiresDeadlineSetup": true,
    "topics": [
      {
        "id": 1,
        "topic_number": 1,
        "title": "Topic 1",
        "deadline": "2025-12-31T23:59:59.000Z"
      }
    ],
    "studentIds": [1, 2, 3]
  }
  ```

### 2. Set Student Deadlines Endpoint
**File:** `backend/routes/admin.js`
**Route:** `POST /api/admin/enrollments/:courseId/:studentId/deadlines`

**Request Body:**
```json
{
  "deadlines": [
    {
      "topicId": 1,
      "deadline": "2025-12-31T23:59:59.000Z",
      "notes": "Optional notes"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deadlines set successfully"
}
```

### 3. Get Student Deadlines Endpoint
**File:** `backend/routes/admin.js`
**Route:** `GET /api/admin/enrollments/:courseId/:studentId/deadlines`

**Response:**
```json
{
  "success": true,
  "deadlines": [
    {
      "id": 1,
      "topic_id": 1,
      "deadline": "2025-12-31T23:59:59.000Z",
      "notes": "Custom deadline",
      "set_by": 5,
      "topic_number": 1,
      "topic_title": "Topic 1"
    }
  ]
}
```

### 4. Student CPD Course Query Update
**File:** `backend/routes/student.js`
**Route:** `GET /api/student/:studentId/cpd-courses`

**Changes:**
- Modified SQL query to use `COALESCE(std.deadline, t.deadline)` to prioritize student-specific deadlines
- Added `LEFT JOIN student_topic_deadlines` to fetch custom deadlines
- Returns `has_custom_deadline` flag to indicate if deadline is customized

**SQL Logic:**
```sql
COALESCE(std.deadline, t.deadline) as deadline,
CASE WHEN std.deadline IS NOT NULL THEN 1 ELSE 0 END as has_custom_deadline
```

## Frontend Changes

### 1. API Service Updates
**File:** `app/services/api.ts`

**New Methods:**
- `setStudentDeadlines(courseId, studentId, deadlines)` - Save student-specific deadlines
- `getStudentDeadlines(courseId, studentId)` - Fetch student-specific deadlines

### 2. Deadline Setup Modal Component
**File:** `app/components/DeadlineSetupModal.tsx`

**Features:**
- Multi-student support (shows one student at a time with progress bar)
- Pre-fills deadlines with course defaults
- Allows customization per topic
- Optional notes field for each deadline
- "Skip" option to use course defaults
- "Previous/Next" navigation between students
- Progress indicator showing current student

**Props:**
```typescript
interface DeadlineSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  studentIds: number[];
  topics: Topic[];
  onSuccess: () => void;
}
```

### 3. Student Enrollment Component Integration
**File:** `app/components/StudentEnrollment.tsx`

**Changes:**
- Added state for deadline modal (`showDeadlineModal`, `deadlineModalData`)
- Modified `handleEnrollStudent` to check for `requiresDeadlineSetup` flag
- Shows deadline modal automatically when course has topics with deadlines
- Handles modal success callback to refresh enrollments

**Flow:**
1. Tutor clicks "Enroll" button
2. Enrollment API is called
3. If response includes `requiresDeadlineSetup: true`, modal opens
4. Tutor sets deadlines for each student (one at a time)
5. On "Save All Deadlines", all deadlines are saved
6. Modal closes and success message is shown

## User Experience Flow

1. **Tutor enrolls student(s) into CPD course**
   - Clicks "Enroll" button in Student Enrollment component
   - Enrollment API is called

2. **System checks for topics with deadlines**
   - If course is CPD and has topics with deadlines
   - Enrollment response includes topics array

3. **Deadline Setup Modal appears**
   - Shows first student with progress bar
   - Lists all topics with deadlines
   - Pre-fills with course default deadlines
   - Tutor can customize each deadline

4. **Tutor sets deadlines**
   - For each student (one at a time)
   - Can modify deadline date/time
   - Can add optional notes
   - Can skip to use defaults

5. **Deadlines are saved**
   - On "Save All Deadlines", all deadlines saved via API
   - Student-specific deadlines stored in database
   - Student will see their custom deadlines in course view

6. **Student views course**
   - Student CPD course query uses custom deadlines
   - Falls back to course default if no custom deadline set
   - `has_custom_deadline` flag indicates customization

## Database Setup

Run the migration SQL file:
```bash
mysql -u your_user -p your_database < backend/migrations/create_student_topic_deadlines.sql
```

Or execute the SQL directly in your MySQL client.

## Testing Checklist

- [ ] Run database migration
- [ ] Enroll student in CPD course with topics that have deadlines
- [ ] Verify deadline modal appears
- [ ] Set custom deadlines for student
- [ ] Verify deadlines are saved in database
- [ ] Check student course view shows custom deadlines
- [ ] Test with multiple students (modal navigation)
- [ ] Test "Skip" option (uses course defaults)
- [ ] Verify fallback to course default when no custom deadline set
- [ ] Test enrollment in non-CPD course (no modal should appear)
- [ ] Test enrollment in CPD course without topic deadlines (no modal)

## Notes

- Deadlines are stored as `DATETIME` in UTC
- Frontend converts to local timezone for display
- Course default deadlines are preserved in `cpd_topics.deadline`
- Student-specific deadlines override course defaults
- If student-specific deadline is deleted, course default is used
- `set_by` field tracks which tutor/admin set the deadline
- Optional `notes` field allows additional context

## Future Enhancements

- Bulk deadline setting (set same deadline for multiple students)
- Deadline templates (save deadline patterns for reuse)
- Deadline notifications/reminders
- Deadline history/audit log
- Deadline extension requests from students
- Visual deadline calendar view

