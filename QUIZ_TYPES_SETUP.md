# Quiz Types Feature - Setup Instructions

## Overview
The LMS now supports two types of quizzes:
1. **Practice Quizzes** (📝) - For practice only, not tracked, no unit unlocking
2. **Final Quizzes** (🎯) - Tracked in tutor dashboard, auto-unlocks next unit when passed

## 🗄️ Step 1: Database Setup

Run the following migration in your MySQL database:

```sql
-- Migration: Add quiz_type to quizzes table
-- Run this script against the LMS MySQL database

-- Add quiz_type column to quizzes table
ALTER TABLE quizzes 
ADD COLUMN IF NOT EXISTS quiz_type ENUM('practice', 'final') NOT NULL DEFAULT 'practice';

-- Add passing_score column for final quizzes
ALTER TABLE quizzes 
ADD COLUMN IF NOT EXISTS passing_score INT DEFAULT 70;

-- Add index for better query performance
ALTER TABLE quizzes 
ADD INDEX idx_quiz_type (quiz_type);
```

**Migration file location:** `lms-app/backend/migrations/20251110_add_quiz_type.sql`

## 🔧 Step 2: Restart Backend Server

After running the migration, restart your backend server:

```bash
cd lms-app/backend
# Stop the current server (Ctrl+C)
node server.js
```

## 🎯 Features Implemented

### 1. Practice Quiz (Default)
- **Purpose**: For student practice and learning
- **Tracking**: NOT tracked in tutor dashboard
- **Progress**: Does NOT count toward course completion
- **Unit Unlocking**: Does NOT unlock next unit
- **Use Case**: Practice exercises, self-assessment, learning reinforcement

### 2. Final Quiz
- **Purpose**: Official assessment/examination
- **Tracking**: ✅ Tracked in "Quiz Performance" section of tutor dashboard
- **Progress**: ✅ Counts toward course completion
- **Unit Unlocking**: ✅ Automatically unlocks next unit when student passes
- **Passing Score**: Configurable (default 70%)
- **Use Case**: Unit exams, module tests, final assessments

## 📝 How to Create Quizzes

### On Course Content Manager Page (`/courses/[id]/files`)

1. Look for the **"Import Quiz"** section on the right side

2. **Select Quiz Type:**
   - 📝 **Practice Quiz (Not tracked)**
   - 🎯 **Final Quiz (Tracked & unlocks next unit)**

3. **If Final Quiz:**
   - Set **Passing Score (%)** (default: 70%)
   - Students must achieve this score to unlock the next unit

4. **Select Topic** (optional):
   - Choose which unit/topic this quiz belongs to

5. **Paste GIFT Format:**
   ```gift
   What is the capital of France? {
   =Paris
   ~London
   ~Berlin
   ~Madrid
   }
   ```

6. Click **"Import Quiz"**

## 🔓 Unit Unlocking Logic

### How Final Quiz Unlocking Works:

1. **Student takes final quiz** in a unit
2. **System calculates score**
3. **If score >= passing_score:**
   - ✅ Current unit marked as completed
   - ✅ Next unit automatically unlocked
   - ✅ Unlock method: `'automatic'`
   - ✅ Progress tracked in `unit_progress` table

4. **If score < passing_score:**
   - ❌ Current unit remains incomplete
   - ❌ Next unit stays locked
   - ℹ️ Student can retake the quiz

### Example Flow:
```
Unit 1 (Unlocked) → Final Quiz → Score 75% ✅
→ Unit 2 Auto-unlocked 🔓

Unit 2 (Unlocked) → Final Quiz → Score 50% ❌
→ Unit 3 Stays Locked 🔒
→ Student can retake Unit 2 Final Quiz
```

## 👨‍🏫 Tutor Dashboard - Quiz Performance

### What Tutors See:

The "Quiz Performance" section now shows **ONLY FINAL QUIZZES**:

| Course | Quiz | Student | Attempts | Last Score | Status |
|--------|------|---------|----------|------------|--------|
| Level 4 | Final Test Unit 1 | Asiand | 3 | 40% | ❌ Needs Review |
| Level 4 | Final Test Unit 1 | John | 2 | 60% | 🎯 Pass |
| Level 4 | Mock Test Unit 1 | Asiand | 2 | 80% | ✅ Pass |

**Columns:**
- **Quiz Title**: Final quiz name
- **Quiz Type**: Always 'final' (practice quizzes are filtered out)
- **Passing Score**: Configured threshold (e.g., 70%)
- **Attempt Count**: Number of times student attempted
- **Last Score**: Most recent score
- **Status**: 
  - ✅ **Pass** - Score >= passing_score
  - ❌ **Fail** - Score < passing_score

### Search & Filter:
- Search by course name, quiz title, or student name
- Sortable by score, attempts, date
- Real-time updates

## 🎓 Student Experience

### Taking a Quiz:

1. **Practice Quiz:**
   - Click "Take Quiz"
   - Answer questions
   - See score immediately
   - ℹ️ No effect on progress
   - Can retake anytime

2. **Final Quiz:**
   - Click "Take Quiz"
   - Answer questions
   - Submit
   - See score + Pass/Fail status
   - If **Passed**: 🎉 Next unit unlocks automatically!
   - If **Failed**: ⚠️ Can retake the quiz
   - Progress tracked

### Quiz Results Display:
```
Score: 75%
Correct 15 / 20
Status: ✅ PASSED

🎉 Great job! You've unlocked the next unit.
```

## 🔍 Database Schema

### `quizzes` Table (Updated):
```sql
quiz_id | title | course_id | unit_id | quiz_type | passing_score
--------|-------|-----------|---------|-----------|---------------
1       | Practice 1 | 7 | 1 | practice | 70
2       | Final Unit 1 | 7 | 1 | final | 75
3       | Mock Test | 7 | 2 | final | 70
```

### `quiz_submissions` Table:
```sql
submission_id | quiz_id | student_id | score | submitted_at
--------------|---------|------------|-------|-------------
1             | 2       | 5          | 80    | 2025-11-10
2             | 2       | 5          | 65    | 2025-11-09
3             | 1       | 5          | 90    | 2025-11-08
```

### `unit_progress` Table (Updated on Pass):
```sql
student_id | unit_id | is_completed | last_quiz_score | is_unlocked
-----------|---------|--------------|-----------------|-------------
5          | 1       | 1            | 80              | 1
5          | 2       | 0            | NULL            | 1  ← Auto-unlocked
```

## 🎯 Best Practices

### When to Use Practice Quizzes:
- ✅ Warm-up exercises
- ✅ Knowledge checks
- ✅ Self-assessment
- ✅ Optional extra practice
- ✅ Formative assessment

### When to Use Final Quizzes:
- ✅ Unit exams
- ✅ Module tests
- ✅ Chapter assessments
- ✅ Prerequisites for next topics
- ✅ Summative assessment

### Recommended Structure Per Unit:
```
Unit 1: Introduction
├── 📚 Resources (PDFs, videos)
├── 📝 Practice Quiz 1 (optional)
├── 📝 Practice Quiz 2 (optional)
└── 🎯 Final Quiz Unit 1 (required to unlock Unit 2)

Unit 2: Advanced Topics (🔒 Locked until Unit 1 Final Quiz passed)
├── 📚 Resources
├── 📝 Practice Quiz 3
└── 🎯 Final Quiz Unit 2
```

## 🐛 Troubleshooting

### Issue: Final quiz not unlocking next unit
**Solution:**
1. Verify quiz_type is 'final' in database
2. Check passing_score is set correctly
3. Ensure student's score >= passing_score
4. Check backend console for unlock logs:
   ```
   ✓ Auto-unlocked next unit 5 for student 3 after passing final quiz
   ```

### Issue: Practice quizzes appearing in tutor dashboard
**Solution:**
- This should not happen. Check the query in `/tutor/:tutorId/quiz-attempts` has:
  ```sql
  WHERE COALESCE(q.quiz_type, 'practice') = 'final'
  ```

### Issue: Old quizzes don't have quiz_type
**Solution:**
- Default is 'practice'
- Update old final quizzes manually:
  ```sql
  UPDATE quizzes SET quiz_type = 'final' WHERE title LIKE '%Final%';
  ```

## 📊 API Endpoints

### Create Quiz (GIFT Import):
```javascript
POST /admin/courses/:id/quizzes/import-gift
Body: {
  gift: "Question? { =Correct ~Wrong }",
  title: "Final Quiz Unit 1",
  unit_id: 5,
  quiz_type: "final",    // 'practice' or 'final'
  passing_score: 75
}
```

### Submit Quiz Attempt:
```javascript
POST /quizzes/:id/attempt
Body: {
  student_id: 3,
  answers: [{question_id: 1, answer: "Paris"}]
}
Response: {
  success: true,
  score: 80,
  passed: true,          // Based on passing_score
  quizType: "final"      // 'practice' or 'final'
}
```

### Get Quiz Performance (Tutor):
```javascript
GET /admin/tutor/:tutorId/quiz-attempts
Response: {
  attempts: [
    {
      quiz_id: 2,
      quiz_title: "Final Test Unit 1",
      quiz_type: "final",
      passing_score: 70,
      student_name: "John",
      attempt_count: 3,
      last_score: 80,
      is_pass: 1
    }
  ]
}
```

## ✅ Summary

- ✅ Two quiz types: Practice & Final
- ✅ Final quizzes tracked in tutor dashboard
- ✅ Auto-unlock next unit on passing final quiz
- ✅ Configurable passing score per quiz
- ✅ Practice quizzes for learning, final for assessment
- ✅ Full backward compatibility (defaults to 'practice')

---

**Status**: ✅ Fully Implemented and Ready to Use!


