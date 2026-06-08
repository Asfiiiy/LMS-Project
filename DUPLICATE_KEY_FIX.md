# 🔧 Fix: Duplicate React Keys Error

## Problem

```
Error: Encountered two children with the same key, `16-10`
Keys should be unique so that components maintain their identity
```

**Cause:** Students can retake final quizzes multiple times, creating multiple attempts with the same `quiz_id` and `student_id`, resulting in duplicate keys.

---

## Solution

Use the unique `attempt_id` from the backend for CPD quiz attempts.

### Before:
```tsx
<tr key={`${row.quiz_id}-${row.student_id}`}>
```
❌ **Problem:** Same student + same quiz = duplicate key on retakes

### After:
```tsx
<tr key={row.attempt_id ? `attempt-${row.attempt_id}` : `${row.quiz_id}-${row.student_id}`}>
```
✅ **Solution:** Each attempt has a unique ID

---

## Changes Made

### 1. Interface Update (`lms-app/app/dashboard/tutor/page.tsx`)

```typescript
interface TutorQuizRow {
  attempt_id?: number; // ✅ Added unique ID for CPD quiz attempts
  quiz_id: number;
  // ... rest of fields
}
```

### 2. Data Mapping

```typescript
const cpdQuizzes = (cpdQuizRes?.attempts ?? []).map((row: any) => ({
  attempt_id: row.attempt_id, // ✅ Map attempt_id from backend
  quiz_id: row.quiz_id,
  // ... rest of mapping
}));
```

### 3. Unique Key Generation

```tsx
{filteredQuizzes.map((row) => (
  <tr key={row.attempt_id ? `attempt-${row.attempt_id}` : `${row.quiz_id}-${row.student_id}`}>
    {/* ... */}
  </tr>
))}
```

**Logic:**
- If `attempt_id` exists (CPD quiz) → use `attempt-${attempt_id}`
- Otherwise (regular quiz) → use `${quiz_id}-${student_id}`

---

## Why This Works

### CPD Quiz Attempts (each retake gets unique ID):
```
Student retakes same quiz 3 times:
  attempt-101 ✅ Unique
  attempt-102 ✅ Unique
  attempt-103 ✅ Unique
```

### Regular Quizzes (aggregated data):
```
One row per student per quiz:
  16-10 ✅ Unique (quiz 16, student 10)
  16-11 ✅ Unique (quiz 16, student 11)
```

---

## Backend Data Structure

The backend returns `attempt_id` for each CPD quiz attempt:

```javascript
// cpd.js - GET /quiz-attempts/tutor/:tutorId
{
  attempt_id: 101,    // ✅ Unique for each attempt
  quiz_id: 16,        // Same for retakes
  student_id: 10,     // Same for retakes
  percentage: 83,
  status: 'passed',
  // ...
}
```

---

## Testing

### Before Fix:
- ❌ Console error: "Encountered two children with the same key"
- ❌ React warning about duplicate keys
- ❌ Potential rendering issues

### After Fix:
- ✅ No console errors
- ✅ Unique keys for all rows
- ✅ Proper rendering of multiple attempts

---

## Scenario Example

**Student "Asfand" takes Final Quiz 3 times:**

| Attempt | Score | Status | Key (Before) | Key (After) |
|---------|-------|--------|--------------|-------------|
| 1st     | 67%   | Failed | `16-10` ❌   | `attempt-101` ✅ |
| 2nd     | 75%   | Failed | `16-10` ❌   | `attempt-102` ✅ |
| 3rd     | 83%   | Passed | `16-10` ❌   | `attempt-103` ✅ |

**Before:** All 3 rows had the same key → React error  
**After:** Each row has unique key → No error

---

## Status

✅ **FIXED** - Duplicate key error resolved using unique `attempt_id`!

Each quiz attempt now has a guaranteed unique identifier, eliminating React key conflicts.

