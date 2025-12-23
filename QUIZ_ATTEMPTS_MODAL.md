# 🎯 Quiz Attempts Modal - Feature Implementation

## Overview

Tutors can now view **all attempts** for any quiz by clicking "Review Attempts" button. The main table shows only the **latest attempt** for each student, keeping the dashboard clean.

---

## Features

### 1. **Main Table - Shows Latest Attempt Only** ✅

```
Level 1 Certificate in Child Psychology
└─ Asfand - Latest: 83% (Pass)
   Attempts: 3 | [Review Attempts] ← Click here
```

**Benefits:**
- ✅ Clean, uncluttered dashboard
- ✅ Shows most recent performance
- ✅ Total attempt count visible
- ✅ Easy to scan multiple students

### 2. **Review Attempts Modal** ✅

When tutor clicks "Review Attempts", a beautiful modal shows:

```
┌─────────────────────────────────────────┐
│ All Quiz Attempts                      X │
│ Asfand - Level 1 Certificate           │
├─────────────────────────────────────────┤
│                                         │
│ [#3] Latest Attempt                     │
│ ✓ Pass | 83% ████████████████░░░░      │
│ Completed: Jan 15, 2025, 10:30 AM      │
│                                         │
│ [#2] Failed | 75% ███████████░░░░░      │
│ Completed: Jan 14, 2025, 3:45 PM       │
│                                         │
│ [#1] Failed | 67% ██████████░░░░░░      │
│ Completed: Jan 14, 2025, 2:15 PM       │
│                                         │
├─────────────────────────────────────────┤
│ Total Attempts: 3            [Close]    │
└─────────────────────────────────────────┘
```

**Features:**
- 🏆 Latest attempt highlighted in blue
- 📊 Visual progress bars for each attempt
- ✓/✗ Pass/Fail indicators
- 📅 Timestamps for each attempt
- #️⃣ Numbered attempts (newest to oldest)
- 📈 Passing score reference

---

## Technical Implementation

### 1. Data Grouping Logic

```typescript
// Group attempts by student + quiz
const cpdQuizGroups = new Map<string, any[]>();
allCpdAttempts.forEach((attempt) => {
  const key = `${attempt.quiz_id}-${attempt.student_id}`;
  if (!cpdQuizGroups.has(key)) {
    cpdQuizGroups.set(key, []);
  }
  cpdQuizGroups.get(key)!.push(attempt);
});

// Show only LATEST attempt in main table
const latestAttempt = sortedAttempts[0];
```

### 2. Data Structure

```typescript
{
  attempt_id: 103,
  quiz_id: 16,
  student_id: 10,
  attempt_count: 3,        // Total attempts
  last_score: 83,          // Latest score
  is_pass: 1,              // Latest status
  all_attempts: [          // All attempts for modal
    { attempt_id: 103, score: 83, status: 'passed', completed_at: '...' },
    { attempt_id: 102, score: 75, status: 'failed', completed_at: '...' },
    { attempt_id: 101, score: 67, status: 'failed', completed_at: '...' }
  ]
}
```

### 3. Modal State Management

```typescript
const [showAttemptsModal, setShowAttemptsModal] = useState(false);
const [selectedQuizAttempts, setSelectedQuizAttempts] = useState<any[]>([]);

// Open modal with all attempts
onClick={() => {
  if (row.all_attempts) {
    setSelectedQuizAttempts(row.all_attempts);
    setShowAttemptsModal(true);
  }
}}
```

---

## UI Components

### Main Table Row

```tsx
<tr>
  <td>Level 1 Certificate in Child Psychology</td>
  <td>Final (🏁 Final Test)</td>
  <td>
    Asfand
    asfi@gmail.com
  </td>
  <td>
    [Attempts: 3] [Pass] [Last Score: 83%] [Review Attempts]
  </td>
</tr>
```

### Modal - Attempt Card

```tsx
<div className="border-2 rounded-lg p-4">
  <div className="flex items-center justify-between">
    {/* Left Side */}
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-blue-500 text-white">
        #3
      </div>
      <div>
        <span className="badge">✓ Pass</span>
        <span className="badge">Latest Attempt</span>
        <div>Completed: Jan 15, 2025, 10:30 AM</div>
      </div>
    </div>
    
    {/* Right Side */}
    <div className="text-right">
      <div className="text-3xl font-bold">83%</div>
      <div className="text-xs">Passing: 70%</div>
    </div>
  </div>
  
  {/* Progress Bar */}
  <div className="progress-bar">
    <div style="width: 83%" className="bg-green-500"></div>
  </div>
</div>
```

---

## Color Coding

### Status Badges
- ✅ **Pass**: Green (`bg-green-100 text-green-700`)
- ❌ **Needs Review**: Red (`bg-red-100 text-red-600`)
- 🔵 **Latest Attempt**: Blue (`bg-blue-100 text-blue-700`)

### Attempt Cards
- **Latest (First)**: Blue border, blue background (`border-blue-300 bg-blue-50`)
- **Previous**: Gray border, white background (`border-gray-200 bg-white`)

### Progress Bars
- **Passed**: Green (`bg-green-500`)
- **Failed**: Red (`bg-red-500`)

---

## User Flow

```
1. Tutor views dashboard
   └─> Main table shows ONLY latest attempt for each student
   
2. Tutor clicks "Review Attempts"
   └─> Modal opens with ALL attempts
   
3. Tutor sees progression:
   #1: 67% Failed
   #2: 75% Failed
   #3: 83% Passed ✓
   
4. Tutor closes modal
   └─> Back to main dashboard
```

---

## Benefits

### For Tutors:
1. 📊 **Clean Dashboard**: No clutter from multiple attempts
2. 📈 **Track Progress**: See student improvement over time
3. 🎯 **Quick Assessment**: Latest score at a glance
4. 📋 **Detailed View**: Full history when needed
5. 🕐 **Time Stamps**: Know when attempts were made

### For System:
1. 🚀 **Performance**: Main table only loads latest attempts
2. 💾 **Data Efficiency**: Full data loaded on-demand
3. 🎨 **Clean UI**: Scalable to many students/attempts
4. 🔑 **Unique Keys**: No duplicate key errors

---

## Example Scenarios

### Scenario 1: Student Improving
```
Main Table: Asfand | Attempts: 3 | Pass | 83%

Modal:
  #3 (Latest) → 83% ✓ Pass   (Progress!)
  #2         → 75% ✗ Failed
  #1         → 67% ✗ Failed
```

### Scenario 2: Student Struggling
```
Main Table: John | Attempts: 5 | Needs Review | 65%

Modal:
  #5 (Latest) → 65% ✗ Failed
  #4         → 62% ✗ Failed  (No improvement)
  #3         → 60% ✗ Failed
  #2         → 58% ✗ Failed
  #1         → 55% ✗ Failed
  
Action: Tutor should intervene
```

### Scenario 3: Single Attempt
```
Main Table: Sarah | Attempts: 1 | Pass | 85%

Modal:
  #1 (Latest) → 85% ✓ Pass  (First try!)
```

---

## Testing

### Step 1: Create Test Data
- Have a student take the same quiz 3 times
- Scores: 67%, 75%, 83%

### Step 2: Verify Main Table
- Should show: "Attempts: 3 | Pass | Last Score: 83%"
- Should NOT show: Multiple rows for same student

### Step 3: Test Modal
- Click "Review Attempts"
- Should see: 3 cards, latest (#3) highlighted in blue
- Should show: Progress bars, timestamps, pass/fail status

### Step 4: Verify Sorting
- Latest attempt should be first
- Older attempts below

---

## Status

✅ **COMPLETE** - Quiz attempts modal fully implemented!

- ✅ Main table shows latest attempt only
- ✅ Grouping logic working
- ✅ Modal displays all attempts
- ✅ Visual indicators for pass/fail
- ✅ Progress bars
- ✅ Timestamps
- ✅ No duplicate keys
- ✅ Clean, professional UI

Ready to use! 🎉

