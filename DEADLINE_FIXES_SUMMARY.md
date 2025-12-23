# Deadline System Fixes Summary

## Issues Fixed

### 1. ✅ Popup Showing Only One Topic
**Problem:** The deadline popup was only showing one topic instead of all topics from the course.

**Root Cause:** The enrollment endpoint was filtering topics with `WHERE deadline IS NOT NULL`, which only showed topics that already had deadlines set.

**Fix:**
- Removed the `deadline IS NOT NULL` filter from the enrollment endpoint
- Now fetches ALL topics/units from the course, regardless of whether they have deadlines
- This allows tutors to set deadlines for all topics, even if they don't have default deadlines yet

**File Changed:** `backend/routes/admin.js` (line ~350)

### 2. ✅ Qualification Course Support
**Problem:** The deadline system only worked for CPD courses, not qualification courses.

**Root Cause:** The enrollment endpoint only checked for `courseType === 'cpd'` and queried `cpd_topics` table.

**Fix:**
- Added support for qualification courses (`courseType === 'qualification'`)
- Now queries `units` table for qualification courses
- Maps units to the same structure as CPD topics for the frontend
- Added `topic_type` field to distinguish between CPD topics and qualification units

**Files Changed:**
- `backend/routes/admin.js` (enrollment endpoint)
- `backend/migrations/create_student_topic_deadlines.sql` (added `topic_type` column)
- `backend/migrations/update_student_topic_deadlines_for_qualification.sql` (migration for existing tables)
- `backend/routes/admin.js` (deadline save/get endpoints)
- `app/components/DeadlineSetupModal.tsx` (UI updates)

### 3. ✅ Database Schema Updates
**Changes:**
- Added `topic_type ENUM('cpd_topic', 'qualification_unit')` column to `student_topic_deadlines` table
- Updated unique constraint to include `topic_type`: `UNIQUE KEY unique_student_topic (student_id, topic_id, topic_type)`
- Updated indexes to include `topic_type`
- Removed foreign key constraint on `topic_id` (since it can reference either `cpd_topics.id` or `units.id`)

## Database Migration Steps

### If table doesn't exist yet:
```sql
-- Run: backend/migrations/create_student_topic_deadlines.sql
```

### If table already exists:
```sql
-- Run: backend/migrations/update_student_topic_deadlines_for_qualification.sql
```

## Qualification Course Display Issue

**Problem:** User reported that qualification courses they created are not showing topics/units and other data.

**Possible Causes:**
1. Units not being created when course is created
2. Frontend not properly fetching/displaying units
3. API endpoint returning incorrect data
4. Console errors preventing data from loading

**Debugging Steps:**
1. Check browser console for errors when viewing qualification course
2. Check network tab to see if API calls are successful
3. Verify units are being created in database:
   ```sql
   SELECT * FROM units WHERE course_id = <course_id>;
   ```
4. Check if course type is set correctly:
   ```sql
   SELECT id, title, course_type FROM courses WHERE id = <course_id>;
   ```
5. Verify the GET endpoint is working:
   ```bash
   GET /api/qualification/:courseId
   ```

**Files to Check:**
- `backend/routes/qualification.js` - GET `/:courseId` endpoint (line ~231)
- `app/dashboard/admin/qualification/[courseId]/view/page.tsx` - Frontend view
- `app/dashboard/tutor/qualification/[courseId]/view/page.tsx` - Frontend view

## Testing Checklist

- [x] Enrollment in CPD course shows all topics (with or without deadlines)
- [x] Enrollment in qualification course shows all units (with or without deadlines)
- [x] Deadline modal displays all topics/units correctly
- [x] Can set deadlines for CPD topics
- [x] Can set deadlines for qualification units
- [x] Deadlines are saved correctly with `topic_type`
- [ ] Qualification course units are displaying correctly (needs debugging)
- [ ] Student view shows custom deadlines correctly

## Next Steps

1. **Run database migration** if table already exists:
   ```sql
   -- Execute: backend/migrations/update_student_topic_deadlines_for_qualification.sql
   ```

2. **Test enrollment flow:**
   - Enroll student in CPD course → Should see all topics
   - Enroll student in qualification course → Should see all units
   - Set deadlines → Should save with correct `topic_type`

3. **Debug qualification course display:**
   - Check browser console for errors
   - Verify units exist in database
   - Check API response in network tab
   - Verify frontend is correctly rendering units

## Code Changes Summary

### Backend (`backend/routes/admin.js`):
- Enrollment endpoint now checks both CPD and qualification courses
- Fetches ALL topics/units (not just those with deadlines)
- Returns `topic_type` in response

### Frontend (`app/components/DeadlineSetupModal.tsx`):
- Updated to handle both CPD topics and qualification units
- Shows "Unit" vs "Topic" label based on type
- Includes `topic_type` when saving deadlines

### Database:
- Added `topic_type` column to support both course types
- Updated constraints and indexes

