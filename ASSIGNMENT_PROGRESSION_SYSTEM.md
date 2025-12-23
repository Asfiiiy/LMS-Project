# 🔒 Assignment-Based Progression System

## Overview

This system allows tutors/admins to require students to complete and pass assignments before unlocking the next course topic. When enabled for a unit, students must submit an assignment and achieve at least 70% to proceed.

---

## 📋 Features

### 1. **Assignment Lock Toggle** 🔓/🔒
- Enable/disable assignment requirement per unit
- Visual indicator showing lock status
- Automatic next-unit unlocking on passing grade

### 2. **Assignment Management**
- Create assignments linked to specific units
- Set title, description, and due dates
- Delete assignments with confirmation

### 3. **Automatic Progression**
- Students unlock units automatically when they pass assignments
- First unit always unlocked
- Subsequent units locked behind previous unit's assignment

### 4. **Grading System**
- Tutors/Admins can grade submissions
- Numeric score (0-100)
- Feedback text
- Pass/Fail status (70% threshold)

---

## 🗄️ Database Schema

### New Tables

#### `unit_progress`
```sql
CREATE TABLE unit_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    unit_id INT NOT NULL,
    is_unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP NULL,
    assignment_submitted BOOLEAN DEFAULT FALSE,
    assignment_passed BOOLEAN DEFAULT FALSE,
    assignment_score INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_unit (student_id, unit_id)
);
```

### Modified Tables

#### `units`
```sql
ALTER TABLE units 
ADD COLUMN requires_assignment BOOLEAN DEFAULT FALSE,
ADD COLUMN assignment_passing_score INT DEFAULT 70;
```

#### `assignments`
```sql
ALTER TABLE assignments 
ADD COLUMN unit_id INT NULL,
ADD FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;
```

#### `assignment_submissions`
```sql
ALTER TABLE assignment_submissions
ADD COLUMN status VARCHAR(50) DEFAULT 'Submitted',
ADD COLUMN score INT NULL;
```

---

## 🔧 Setup Instructions

### 1. **Run Database Migration**

Execute the migration script in your MySQL database:

```bash
# In phpMyAdmin or MySQL client:
SOURCE lms-app/backend/migrations/20251112_add_unit_progression.sql;
```

Or manually run the SQL commands from the migration file.

### 2. **Verify Tables Created**

```sql
SHOW TABLES LIKE 'unit_progress';
DESCRIBE units;
DESCRIBE assignments;
DESCRIBE assignment_submissions;
```

### 3. **Restart Backend Server**

```bash
cd lms-app/backend
npm start
```

---

## 📖 How to Use

### For Tutors/Admins

#### 1. **Enable Assignment Lock**

1. Go to **Course Content Manager** (`/courses/[id]/files`)
2. Scroll to any topic/unit
3. Find the **"Assignment Lock"** section
4. Click the **🔓 Open** button to enable it
5. It changes to **🔒 Locked** (Green background)
6. When locked, students must pass an assignment to unlock the next topic

#### 2. **Create Assignment**

1. In the same unit, find **"Assignments"** section
2. Click **"+ Add Assignment"**
3. Fill in:
   - **Title** (required)
   - **Description** (optional)
   - **Due Date** (optional, defaults to 7 days)
4. Click **"Create Assignment"**

#### 3. **Grade Submissions**

Tutors can grade assignments through the dashboard:

1. Go to **Tutor Dashboard > Assignments**
2. View all submissions
3. Click on a submission to grade
4. Enter score (0-100) and feedback
5. System automatically:
   - Sets status to "Passed" (≥70%) or "Failed" (<70%)
   - Unlocks next unit if passed

### For Students

#### 1. **View Unlocked Units**

- **First unit** is always unlocked
- **Subsequent units** show lock icon if previous unit requires assignment
- Green checkmark appears when assignment is passed

#### 2. **Submit Assignment**

1. Navigate to the locked unit
2. See message: _"Complete assignment in '[Previous Unit]' to unlock"_
3. Go back to previous unit
4. Complete and submit the assignment
5. Wait for tutor to grade

#### 3. **Track Progress**

- View assignment status: Submitted / Graded / Passed / Failed
- See score and feedback from tutor
- Automatically unlock next unit upon passing

---

## 🎯 API Endpoints

### Unit Progression

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/courses/:courseId/progression/:studentId` | Get unlock status for all units |
| `PUT` | `/api/courses/units/:unitId/assignment-requirement` | Toggle assignment requirement |

### Assignment Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/assignments` | Create assignment (with `unit_id`) |
| `PUT` | `/api/admin/assignments/:id` | Update assignment |
| `DELETE` | `/api/admin/assignments/:id` | Delete assignment |

### Submissions & Grading

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/courses/assignments/:assignmentId/submit` | Submit assignment |
| `PUT` | `/api/courses/submissions/:submissionId/grade` | Grade submission (unlocks next unit) |

---

## 🔍 Example Workflow

### Scenario: 3-Unit Course with Assignment Lock

```
Unit 1: Introduction
└─ 🔓 Always Unlocked

Unit 2: Basics
├─ 🔒 Assignment Lock: ON
├─ Assignment: "Complete Basics Quiz"
└─ ⚠️ Locked until Unit 1 assignment passed

Unit 3: Advanced
├─ 🔒 Assignment Lock: ON
├─ Assignment: "Final Project"
└─ ⚠️ Locked until Unit 2 assignment passed
```

### Student Journey

1. **Day 1**: Student starts course → Unit 1 unlocked → completes materials
2. **Day 2**: Student sees Unit 1 assignment → submits assignment
3. **Day 3**: Tutor grades → Student gets 85% ✅ → **Unit 2 automatically unlocks**
4. **Day 4**: Student completes Unit 2 → submits assignment
5. **Day 5**: Tutor grades → Student gets 65% ❌ → Unit 3 remains locked
6. **Day 6**: Student resubmits → gets 75% ✅ → **Unit 3 automatically unlocks**

---

## 🛡️ Security & Validation

### Backend Validation

- ✅ Verifies assignment belongs to unit
- ✅ Checks student enrollment in course
- ✅ Prevents double-submission
- ✅ Validates score range (0-100)
- ✅ Uses database transactions for atomic unlock operations

### Frontend Validation

- ✅ Checks user role (Admin/Tutor/Student)
- ✅ Validates assignment title required
- ✅ Prevents submission without login
- ✅ Shows real-time lock/unlock status

---

## 🐛 Troubleshooting

### Issue: "unit_progress table not found"

**Solution:**
```sql
-- Run migration manually
SOURCE lms-app/backend/migrations/20251112_add_unit_progression.sql;
```

### Issue: Units not unlocking after passing

**Solution:**
1. Check `unit_progress` table:
```sql
SELECT * FROM unit_progress WHERE student_id = YOUR_STUDENT_ID;
```
2. Verify assignment is linked to unit:
```sql
SELECT id, unit_id, title FROM assignments WHERE course_id = YOUR_COURSE_ID;
```

### Issue: "Cannot add assignment"

**Solution:**
- Ensure `unit_id` column exists in `assignments` table
- Check user has permission (Admin/Tutor)

---

## 📊 Database Queries for Testing

### Check Unit Progression for Student

```sql
SELECT 
    u.title AS unit_title,
    u.requires_assignment,
    up.is_unlocked,
    up.assignment_submitted,
    up.assignment_passed,
    up.assignment_score
FROM units u
LEFT JOIN unit_progress up ON u.id = up.unit_id AND up.student_id = ?
WHERE u.course_id = ?
ORDER BY u.order_index;
```

### View All Assignment Submissions

```sql
SELECT 
    u.name AS student_name,
    a.title AS assignment_title,
    s.score,
    s.status,
    s.submitted_at
FROM assignment_submissions s
JOIN users u ON s.student_id = u.id
JOIN assignments a ON s.assignment_id = a.id
WHERE a.course_id = ?
ORDER BY s.submitted_at DESC;
```

### Reset Student Progress (Testing)

```sql
DELETE FROM unit_progress WHERE student_id = ?;
```

---

## 🚀 Future Enhancements

- [ ] Configurable passing score per unit (not just 70%)
- [ ] Multiple assignment attempts with best score
- [ ] Assignment rubrics for detailed grading
- [ ] Email notifications on grade release
- [ ] Bulk unlock for all students (Admin override)
- [ ] Progress analytics dashboard
- [ ] Assignment templates library
- [ ] Peer review system

---

## 📝 Notes

- **Default Behavior**: Without assignment lock, all units are accessible
- **First Unit**: Always unlocked, regardless of settings
- **Passing Score**: Fixed at 70% (can be customized in code)
- **Grading**: Only Tutors and Admins can grade submissions
- **Re-submission**: Currently not supported (one attempt only)

---

## 📞 Support

For issues or questions:
1. Check database migration completed
2. Verify API endpoints are accessible
3. Check browser console for errors
4. Review backend logs for SQL errors

---

**Last Updated**: November 12, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready

