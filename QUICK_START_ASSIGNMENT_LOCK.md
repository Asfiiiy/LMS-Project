# 🚀 Quick Start: Assignment Lock System

## ⚡ 60-Second Setup

### 1️⃣ Run Database Migration

**Open phpMyAdmin** → Select your database → Click "SQL" tab → Paste and execute:

```sql
SOURCE D:/Lms/lms-app/backend/migrations/20251112_add_unit_progression.sql;
```

Or copy-paste the entire content of that file into the SQL window.

---

### 2️⃣ Restart Backend

```bash
cd lms-app/backend
npm start
```

---

### 3️⃣ Test It!

1. **Go to**: `http://localhost:3000/courses/18/files`
2. **Find a unit** and scroll to the bottom
3. **Click** the `🔓 Open` button → It changes to `🔒 Locked`
4. **Click** `+ Add Assignment` → Fill form → Create
5. **Done!** Students now need to pass this assignment to unlock the next unit

---

## 📖 What It Does

```
Unit 1 (Open)  →  Student completes  →  Unlocks Unit 2
Unit 2 (🔒 Locked)  →  Must score 70%+  →  Unlocks Unit 3
Unit 3 (🔒 Locked)  →  Must pass assignment  →  Course complete!
```

---

## 🎯 Key Features

| Feature | What It Does |
|---------|--------------|
| **Assignment Lock Toggle** | Click to require/unrequire assignment for progression |
| **Add Assignment** | Create assignment linked to specific unit |
| **Auto-Unlock** | Next unit unlocks automatically when student scores ≥70% |
| **Visual Indicators** | 🔓 Open / 🔒 Locked / ✅ Passed / ❌ Failed |

---

## 🔍 Where to Find It

**Path**: `/courses/[course-id]/files`

**In Each Unit, You'll See:**
```
┌─────────────────────────────────────┐
│ Unit 1: Introduction          ✏️ 🗑️ │
│                                      │
│ 📄 Learning Materials               │
│ 📝 Quizzes                          │
│ ╔═══════════════════════════════╗  │
│ ║ 🔒 ASSIGNMENT LOCK (NEW!)     ║  │
│ ╚═══════════════════════════════╝  │
│   [🔓 Open / 🔒 Locked] Toggle     │
│   [+ Add Assignment] Button         │
│   Assignment list                   │
└─────────────────────────────────────┘
```

---

## 📝 Usage Scenarios

### Scenario 1: Linear Course Progression
```
Unit 1: Basics       → Assignment required ✅
Unit 2: Intermediate → Assignment required ✅
Unit 3: Advanced     → Assignment required ✅
```
**Students must complete each unit before moving forward.**

---

### Scenario 2: Mixed Mode
```
Unit 1: Introduction → No assignment (Always open)
Unit 2: Core Topics  → Assignment required ✅
Unit 3: Practice     → No assignment (Open after Unit 2)
Unit 4: Final Test   → Assignment required ✅
```
**Flexibility: Lock only critical checkpoints.**

---

### Scenario 3: Fully Open
```
Unit 1: Overview     → No assignment
Unit 2: Content      → No assignment
Unit 3: Review       → No assignment
```
**All units accessible immediately (default behavior).**

---

## 🛠️ Troubleshooting

### Issue: Can't find Assignment Lock section

**Solution**: 
- Make sure you're on `/courses/[id]/files` (not `/courses/[id]`)
- Scroll down below Quizzes section
- Refresh page after database migration

---

### Issue: Lock toggle doesn't work

**Solution**:
1. Check browser console for errors (F12)
2. Verify backend is running (`npm start`)
3. Confirm migration ran successfully:
```sql
SELECT * FROM information_schema.COLUMNS 
WHERE TABLE_NAME = 'units' 
AND COLUMN_NAME = 'requires_assignment';
```

---

### Issue: Assignment creation fails

**Solution**:
- Ensure you're logged in as Admin or Tutor
- Check `unit_id` column exists in `assignments` table:
```sql
DESCRIBE assignments;
```

---

## 📚 Full Documentation

For detailed information, see:
- **Full Guide**: `ASSIGNMENT_PROGRESSION_SYSTEM.md`
- **Visual Guide**: `ASSIGNMENT_PROGRESSION_VISUAL_GUIDE.md`
- **Verify Setup**: `VERIFY_PROGRESSION_SYSTEM.sql`

---

## 🎓 Example Workflow

### As Tutor:
1. Create course with 3 units
2. Enable lock on Unit 1
3. Add assignment "Complete Quiz"
4. Student submits assignment
5. Grade it → 80% ✅
6. Unit 2 unlocks automatically!

### As Student:
1. Access Unit 1 (always unlocked)
2. Complete materials
3. Submit assignment
4. Wait for grading
5. Once passed → Unit 2 accessible!

---

## ⚙️ Default Settings

| Setting | Default Value |
|---------|---------------|
| **Passing Score** | 70% |
| **First Unit** | Always unlocked |
| **Lock Status** | Off (🔓 Open) |
| **Assignment Requirement** | Disabled by default |

---

## 🚦 Status Meanings

| Icon | Meaning |
|------|---------|
| 🔓 | Open - No restrictions |
| 🔒 | Locked - Assignment required |
| ✅ | Passed - Score ≥ 70% |
| ❌ | Failed - Score < 70% |
| ⚠️ | Pending - Awaiting grade |

---

**Quick Start Version**: 1.0.0  
**Updated**: November 12, 2025  
**Status**: ✅ Ready to Use

