# 📅 CPD Deadline Management System

## Overview

Comprehensive deadline management system with:
- **Visual deadline indicators** for students
- **Deadline extension** capability for tutors/admins
- **Color-coded status badges** based on urgency

---

## Features

### For Students 🎓
- ✅ Clear deadline display on each topic
- ✅ Visual indicators showing urgency:
  - ⚠️ **Overdue** (Red)
  - 🔔 **Due Today** (Orange)
  - ⏰ **1-3 days left** (Orange)
  - 📅 **4-7 days left** (Yellow)
  - 📆 **7+ days left** (Blue)
- ✅ Prominent warnings for approaching deadlines

### For Tutors/Admins 👨‍🏫
- ✅ View all topic deadlines at a glance
- ✅ **Extend deadline** button for each topic
- ✅ Inline date picker for quick changes
- ✅ Same visual indicators as students
- ✅ Easy-to-use interface

---

## Visual Design

### Student View:
```
┌──────────────────────────────────────────────────┐
│ Course Modules                                   │
├──────────────────────────────────────────────────┤
│ 📂 Unit 1 - Introduction                       › │
│    Deadline: 11/20/2025                          │
│    [📆 15 days left]                             │
├──────────────────────────────────────────────────┤
│ 📂 Unit 2 - Advanced Topics                  🔒 │
│    Deadline: 11/12/2025                          │
│    [⚠️ Overdue]                                  │
└──────────────────────────────────────────────────┘
```

### Admin/Tutor View:
```
┌──────────────────────────────────────────────────┐
│ Course Modules                                   │
├──────────────────────────────────────────────────┤
│ 📂 Unit 1 - Introduction                       › │
│    Deadline: 11/20/2025                          │
│    [📆 15 days left] [✏️ Extend]                │
│                                                  │
│    ┌─ Extend Deadline ──────────────────┐      │
│    │ [Date Picker] [Save] [Cancel]      │      │
│    └────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘
```

---

## Deadline Status Colors

| Days Remaining | Status | Icon | Color | Badge Style |
|----------------|--------|------|-------|-------------|
| **Overdue** | Overdue | ⚠️ | Red | `bg-red-50 text-red-600 border-red-200` |
| **0 days** | Due Today | 🔔 | Orange | `bg-orange-50 text-orange-600 border-orange-200` |
| **1-3 days** | Urgent | ⏰ | Orange | `bg-orange-50 text-orange-600 border-orange-200` |
| **4-7 days** | Upcoming | 📅 | Yellow | `bg-yellow-50 text-yellow-600 border-yellow-200` |
| **7+ days** | Normal | 📆 | Blue | `bg-blue-50 text-blue-600 border-blue-200` |

---

## Implementation Details

### 1. Deadline Status Calculation

```typescript
const getDeadlineStatus = (deadline: string | null) => {
  if (!deadline) return null;
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil < 0) {
    return { status: 'overdue', text: 'Overdue', color: 'text-red-600 bg-red-50 border-red-200', icon: '⚠️' };
  } else if (daysUntil === 0) {
    return { status: 'today', text: 'Due Today', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '🔔' };
  } else if (daysUntil <= 3) {
    return { status: 'urgent', text: `${daysUntil} days left`, color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '⏰' };
  } else if (daysUntil <= 7) {
    return { status: 'upcoming', text: `${daysUntil} days left`, color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '📅' };
  } else {
    return { status: 'normal', text: `${daysUntil} days left`, color: 'text-blue-600 bg-blue-50 border-blue-200', icon: '📆' };
  }
};
```

### 2. Deadline Extension (Admin/Tutor)

```typescript
const handleExtendDeadline = async (topicId: number) => {
  const response = await fetch(`http://localhost:5000/api/cpd/topics/${topicId}/deadline`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ deadline: newDeadline })
  });

  if (data.success) {
    alert('Deadline updated successfully!');
    loadCourseData(userId); // Reload to show new deadline
  }
};
```

### 3. Backend API Endpoint

**File:** `lms-app/backend/routes/cpd.js`

```javascript
// PUT /api/cpd/topics/:topicId/deadline
router.put('/topics/:topicId/deadline', async (req, res) => {
  const { topicId } = req.params;
  const { deadline } = req.body;

  await pool.query(
    `UPDATE cpd_topics SET deadline = ? WHERE id = ?`,
    [deadline, topicId]
  );

  res.json({
    success: true,
    message: 'Deadline updated successfully'
  });
});
```

---

## User Workflows

### Student Workflow:
```
1. Login as Student
2. Go to CPD Course
3. View Course Modules
4. See deadlines with visual indicators:
   - Green/Blue → Comfortable time
   - Yellow → Need to start soon
   - Orange → Urgent
   - Red → Overdue!
5. Plan study schedule accordingly
```

### Tutor/Admin Workflow:
```
1. Login as Tutor/Admin
2. Go to CPD Course View
3. Review all topic deadlines
4. See student-facing deadline warnings
5. Click "✏️ Extend" on any topic
6. Select new deadline date
7. Click "Save"
8. Confirmation message appears
9. Students see updated deadline immediately
```

---

## Files Modified

### 1. **Student View Page**
**File:** `lms-app/app/dashboard/student/cpd/[courseId]/page.tsx`

**Changes:**
- Added `getDeadlineStatus()` helper function
- Updated topics list to show deadline badges
- Color-coded warnings based on urgency

### 2. **Admin View Page**
**File:** `lms-app/app/dashboard/admin/cpd/[courseId]/view/page.tsx`

**Changes:**
- Added `getDeadlineStatus()` helper function
- Added deadline extension state management
- Added `handleExtendDeadline()` function
- Added inline deadline extension form
- Visual indicators for deadline status

### 3. **Tutor View Page**
**File:** `lms-app/app/dashboard/tutor/cpd/[courseId]/view/page.tsx`

**Changes:**
- Same as admin view (copied functionality)

### 4. **Backend API**
**File:** `lms-app/backend/routes/cpd.js`

**Changes:**
- Added `PUT /topics/:topicId/deadline` endpoint
- Updates `cpd_topics.deadline` field

---

## Testing

### Test as Student:
1. Login as Student
2. Go to CPD course with deadlines
3. **Expected:**
   - ✅ Deadlines visible on each topic
   - ✅ Color-coded badges show urgency
   - ✅ Icons match deadline status

### Test as Tutor:
1. Login as Tutor
2. Go to: `http://localhost:3000/dashboard/tutor/cpd/[id]/view`
3. Find topic with deadline
4. Click "✏️ Extend" button
5. Select new date
6. Click "Save"
7. **Expected:**
   - ✅ Success message appears
   - ✅ Deadline updates immediately
   - ✅ Badge color updates if status changed

### Test as Admin:
1. Login as Admin
2. Go to: `http://localhost:3000/dashboard/admin/cpd/[id]/view`
3. Same steps as tutor test
4. **Expected:** Same results

---

## Benefits

### 1. **Better Time Management** ⏰
- Students see at-a-glance which topics need attention
- Clear visual hierarchy of priorities
- No surprises with overdue work

### 2. **Flexibility** 🔄
- Tutors can extend deadlines when needed
- Quick inline editing (no page navigation)
- Immediate updates for students

### 3. **Transparency** 👁️
- Everyone sees the same information
- Deadline status calculated consistently
- No confusion about due dates

### 4. **User Experience** 🎨
- Color-coded for quick scanning
- Intuitive icons
- Clean, professional interface

---

## Example Scenarios

### Scenario 1: Student with Upcoming Deadline
```
Unit 2 - Advanced Topics
Deadline: 11/16/2025
[⏰ 2 days left]
```
**Action:** Student sees orange badge and prioritizes this unit

### Scenario 2: Tutor Extends Deadline
```
Before: Deadline: 11/12/2025 [⚠️ Overdue]
Tutor clicks "✏️ Extend"
Selects: 11/25/2025
After: Deadline: 11/25/2025 [📆 13 days left]
```
**Result:** Students get more time, badge turns blue

### Scenario 3: Multiple Topics
```
Unit 1: [📆 20 days left]  ← No rush
Unit 2: [📅 5 days left]   ← Start soon
Unit 3: [⏰ 1 day left]    ← Urgent!
Unit 4: [⚠️ Overdue]       ← Critical!
```
**Benefit:** Clear priority order for students

---

## API Documentation

### Extend Deadline

**Endpoint:** `PUT /api/cpd/topics/:topicId/deadline`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "deadline": "2025-11-25"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deadline updated successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Failed to update deadline",
  "error": "Error details..."
}
```

---

## Status

✅ **COMPLETE** - Deadline management system fully implemented!

### Summary:
- ✅ Student view: Visual deadline indicators
- ✅ Tutor/Admin view: Deadline extension capability
- ✅ Backend API: Update endpoint working
- ✅ Color-coded status badges
- ✅ Inline editing interface
- ✅ Real-time updates

Ready to use! 🎉

