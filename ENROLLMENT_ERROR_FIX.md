# Enrollment Error Fix

## Issue
When enrolling students in qualification courses, the system was throwing a 500 error:
```
[API Error] 500: "Error enrolling students"
```

## Root Cause
The enrollment endpoint was trying to query `unit_number` from the `units` table, but this column doesn't exist. The `units` table uses `order_index` instead.

**Error in code:**
```sql
SELECT id, unit_number, title, deadline 
FROM units 
WHERE course_id = ?
```

**Problem:** `unit_number` column doesn't exist in `units` table.

## Fix Applied

### 1. Updated SQL Query
Changed from:
```sql
SELECT id, unit_number, title, deadline 
FROM units 
WHERE course_id = ?
```

To:
```sql
SELECT id, order_index, title, deadline 
FROM units 
WHERE course_id = ?
ORDER BY order_index
```

### 2. Updated Mapping Logic
Changed from:
```javascript
topicsWithDeadlines = unitRows.map(u => ({
  id: u.id,
  topic_number: u.unit_number,  // ❌ This column doesn't exist
  title: u.title,
  deadline: u.deadline,
  type: 'qualification_unit'
}));
```

To:
```javascript
topicsWithDeadlines = unitRows.map((u, index) => ({
  id: u.id,
  topic_number: u.order_index !== null && u.order_index !== undefined 
    ? u.order_index + 1  // Use order_index + 1 as unit number (1-based)
    : index + 1,          // Fallback to array index + 1
  title: u.title,
  deadline: u.deadline || null,
  type: 'qualification_unit'
}));
```

### 3. Added Error Handling
Wrapped the qualification units query in a try-catch block to handle cases where:
- The `units` table might not exist
- The table structure might be different
- There might be other SQL errors

```javascript
try {
  const [unitRows] = await connection.execute(/* ... */);
  // ... mapping logic
} catch (unitErr) {
  console.error('[Enrollment] Error fetching qualification units:', unitErr);
  topicsWithDeadlines = []; // Continue without topics
}
```

### 4. Improved Error Messages
Enhanced error logging to include stack traces in development mode:
```javascript
catch (err) {
  await connection.rollback();
  console.error('[Enrollment] Error:', err);
  console.error('[Enrollment] Error stack:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Error enrolling students',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}
```

## Database Schema Reference

### `units` Table Structure
- `id` - Primary key
- `course_id` - Foreign key to courses
- `title` - Unit title
- `order_index` - Order/sequence number (0-based)
- `deadline` - Optional deadline (DATE type, can be NULL)
- `created_at`, `updated_at` - Timestamps

**Note:** There is NO `unit_number` column in the `units` table.

## Testing

After this fix, enrollment in qualification courses should:
1. ✅ Successfully enroll students
2. ✅ Fetch all units from the course
3. ✅ Show deadline setup modal if units exist
4. ✅ Display units with correct numbering (order_index + 1)

## Files Changed
- `backend/routes/admin.js` - Enrollment endpoint (lines ~363-380)

