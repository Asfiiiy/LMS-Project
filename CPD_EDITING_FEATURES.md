# 📝 CPD Course Editing Features

## Overview

Comprehensive editing capabilities for Admin/Tutor CPD course views, allowing full management of:
- **Topics** (modules/units)
- **Course Materials** (files)
- **Quizzes** (practice & final)
- **Questions** within quizzes
- **Passing Scores**

---

## Features Implemented

### 1. **Topic Management** 📂

#### Edit Topic Name & Description
- Click "✏️ Edit" button on any topic card
- Inline form appears with title and description fields
- Save changes or cancel

#### Delete Topic
- Click "🗑️ Delete" button
- Confirmation dialog appears
- Deletes topic and all associated files/quizzes

#### Extend Deadline
- Click "✏️ Extend" on deadline badge
- Select new date
- Save to update

---

### 2. **File Management** 📄

#### Delete Files
- Each file has a "🗑️ Delete" button
- Confirmation before deletion
- Removes file from database and (optionally) from Cloudinary

---

### 3. **Quiz Viewing & Editing** 🧪🏁

#### View Quiz
- Click "👁️ View/Edit" on any quiz card
- Opens modal with full quiz details
- Shows all questions with options
- Correct answers highlighted in green

#### Edit Passing Score
- Update passing score percentage
- Click "Update Score" button
- Changes apply immediately

#### Add New Question
- Click "➕ Add Question" button
- Fill in question text
- Select question type (Multiple Choice / True-False)
- Add 4 options
- Mark correct answer with radio button
- Set point value
- Save to add to quiz

#### Delete Question
- Each question has a "🗑️ Delete" button
- Confirmation before deletion
- Removes question from quiz

---

## User Interface

### Topic Card (Collapsed)
```
┌────────────────────────────────────────────────────┐
│ 📂 Unit 1 - Introduction                          │
│    Deadline: 11/20/2025 [📆 15 days left]         │
│    [✏️ Extend]                                    │
│                         [✏️ Edit] [🗑️ Delete] ›  │
└────────────────────────────────────────────────────┘
```

### Topic Card (Edit Mode)
```
┌────────────────────────────────────────────────────┐
│ 📂 Unit 1 - Introduction                          │
│                                                    │
│ ┌─ Edit Topic ───────────────────────────────┐   │
│ │ Title:       [Introduction to Psychology  ]│   │
│ │ Description: [In this unit, you will...   ]│   │
│ │              [                             ]│   │
│ │ [Save Changes] [Cancel]                    │   │
│ └────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

### File with Delete Button
```
┌────────────────────────────────────────────────────┐
│ Course Materials                                   │
├────────────────────────────────────────────────────┤
│ 📄 Lecture Notes.pdf                    [🗑️ Delete]│
│ 📝 Assignment Brief.docx                [🗑️ Delete]│
│ 🎥 Tutorial Video.mp4                   [🗑️ Delete]│
└────────────────────────────────────────────────────┘
```

### Quiz Card
```
┌────────────────────────────────────────────────────┐
│ 🧪 Practice Quiz                                   │
│ Introduction Quiz                                  │
│ Pass: 70% • Unlimited attempts                     │
│                                                    │
│ [👁️ View/Edit]                                     │
└────────────────────────────────────────────────────┘
```

### Quiz Editor Modal
```
┌──────────────────────────────────────────────────────────┐
│ Introduction Quiz                    🧪 Practice Quiz  ✕│
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─ Passing Score (%) ─────────────────────────────┐    │
│ │ [70] [Update Score]                             │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ Questions (5)                          [➕ Add Question] │
│                                                          │
│ ┌─ Q1. ──────────────────────────────────────────┐     │
│ │ What is psychology?                    [🗑️ Delete]│   │
│ │                                                │     │
│ │ ☑ The study of mind and behavior              │     │
│ │ ☐ The study of the brain                      │     │
│ │ ☐ The study of emotions                       │     │
│ │ ☐ The study of behavior only                  │     │
│ └────────────────────────────────────────────────┘     │
│                                                          │
│ ┌─ Q2. ──────────────────────────────────────────┐     │
│ │ ...                                   [🗑️ Delete]│   │
│ └────────────────────────────────────────────────┘     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Add Question Form
```
┌─ New Question ─────────────────────────────────────────┐
│ Question Text:                                         │
│ [What is the main focus of cognitive psychology?     ]│
│ [                                                     ]│
│                                                        │
│ Type: [Multiple Choice ▼]    Points: [1]              │
│                                                        │
│ Options:                                               │
│ ⦿ [Memory, perception, and thinking           ]       │
│ ○ [Emotions and feelings                      ]       │
│ ○ [Social interactions                        ]       │
│ ○ [Brain structure                            ]       │
│                                                        │
│ [Add Question] [Cancel]                                │
└────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Topic Management

#### Update Topic
```
PUT /api/cpd/topics/:topicId
Body: { title, description }
```

#### Delete Topic
```
DELETE /api/cpd/topics/:topicId
```

#### Update Deadline
```
PUT /api/cpd/topics/:topicId/deadline
Body: { deadline }
```

### File Management

#### Delete File
```
DELETE /api/cpd/files/:fileId
```

### Quiz Management

#### Get Quiz with Questions
```
GET /api/cpd/quizzes/:quizId
Response: { success, questions: [{id, question_text, options: [...]}] }
```

#### Update Passing Score
```
PUT /api/cpd/quizzes/:quizId/passing-score
Body: { passing_score }
```

#### Add Question
```
POST /api/cpd/quizzes/:quizId/questions
Body: {
  question_text,
  question_type,
  points,
  options: ['opt1', 'opt2', 'opt3', 'opt4'],
  correct_answer: 0  // index of correct option
}
```

#### Delete Question
```
DELETE /api/cpd/questions/:questionId
```

---

## Technical Implementation

### Frontend (React)

**File:** `lms-app/app/dashboard/admin/cpd/[courseId]/view/page.tsx`

**State Management:**
```typescript
const [editingTopic, setEditingTopic] = useState<number | null>(null);
const [editTopicTitle, setEditTopicTitle] = useState('');
const [editTopicDescription, setEditTopicDescription] = useState('');
const [viewingQuiz, setViewingQuiz] = useState<{quiz: any; questions: any[]} | null>(null);
const [addingQuestion, setAddingQuestion] = useState<number | null>(null);
const [newQuestion, setNewQuestion] = useState({
  question_text: '',
  question_type: 'multiple_choice',
  points: 1,
  options: ['', '', '', ''],
  correct_answer: 0
});
```

**Key Functions:**
- `handleUpdateTopic(topicId)` - Updates topic name/description
- `handleDeleteTopic(topicId)` - Deletes topic with confirmation
- `handleDeleteFile(fileId)` - Deletes file
- `handleViewQuiz(quiz)` - Loads quiz with questions in modal
- `handleUpdateQuizScore(quizId, passingScore)` - Updates passing score
- `handleAddQuestion(quizId)` - Adds new question to quiz
- `handleDeleteQuestion(questionId)` - Deletes question

### Backend (Node.js/Express)

**File:** `lms-app/backend/routes/cpd.js`

**Database Operations:**
- Update operations use `UPDATE` queries
- Delete operations cascade to related tables
- Transaction support for complex operations
- Proper error handling and logging

---

## Workflows

### Edit Topic Name

1. **User clicks "✏️ Edit"** on topic card
2. **Form appears** with current title and description
3. **User edits** the fields
4. **User clicks "Save Changes"**
5. **Frontend** sends PUT request to `/api/cpd/topics/:topicId`
6. **Backend** updates database
7. **Success message** appears
8. **Course reloads** with updated data

### Delete Topic

1. **User clicks "🗑️ Delete"** on topic card
2. **Confirmation dialog** appears
3. **User confirms**
4. **Frontend** sends DELETE request to `/api/cpd/topics/:topicId`
5. **Backend** cascades delete:
   - Deletes files
   - Deletes quiz questions
   - Deletes quiz options
   - Deletes quiz attempts
   - Deletes quizzes
   - Deletes topic
6. **Success message** appears
7. **Course reloads** without deleted topic

### Add Question to Quiz

1. **User clicks "👁️ View/Edit"** on quiz
2. **Quiz modal** opens with existing questions
3. **User clicks "➕ Add Question"**
4. **Question form** appears
5. **User fills in:**
   - Question text
   - Question type
   - Point value
   - 4 options
   - Marks correct answer
6. **User clicks "Add Question"**
7. **Frontend** sends POST to `/api/cpd/quizzes/:quizId/questions`
8. **Backend** inserts question and options
9. **Success message** appears
10. **Quiz reloads** with new question

### Edit Passing Score

1. **User opens quiz** in modal
2. **User changes** passing score input
3. **User clicks "Update Score"**
4. **Frontend** sends PUT to `/api/cpd/quizzes/:quizId/passing-score`
5. **Backend** updates quiz
6. **Success message** appears
7. **Course reloads** with new score

---

## Benefits

### 1. **Comprehensive Control** 🎛️
- Edit everything in one place
- No need for separate admin panels
- Real-time updates

### 2. **User-Friendly** 👍
- Inline editing
- Clear visual feedback
- Confirmation dialogs prevent mistakes

### 3. **Flexible Quiz Management** 🧠
- Add questions anytime
- Delete outdated questions
- Adjust difficulty with passing scores

### 4. **File Management** 📁
- Remove outdated materials
- Keep course content fresh
- Easy cleanup

### 5. **Topic Organization** 📚
- Rename units as needed
- Update descriptions
- Delete obsolete content

---

## Security Considerations

### Authorization
- Only Admin and Tutor roles can access editing features
- `ProtectedRoute` enforces role-based access
- Backend validates user permissions

### Data Validation
- Frontend validates required fields
- Backend validates all inputs
- SQL injection protection via parameterized queries

### Cascade Deletes
- Properly handles related data
- Prevents orphaned records
- Maintains data integrity

---

## Testing

### Test Edit Topic
1. Login as Admin
2. Go to: `http://localhost:3000/dashboard/admin/cpd/34/view`
3. Click "✏️ Edit" on any topic
4. Change title and description
5. Click "Save Changes"
6. **Expected:** Topic updates, success message appears

### Test Delete File
1. Open a topic with files
2. Click "🗑️ Delete" next to a file
3. Confirm deletion
4. **Expected:** File removed, course reloads

### Test View Quiz
1. Click "👁️ View/Edit" on a quiz
2. **Expected:** Modal opens with all questions

### Test Add Question
1. Open quiz modal
2. Click "➕ Add Question"
3. Fill in all fields
4. Click "Add Question"
5. **Expected:** Question added, appears in list

### Test Delete Question
1. Open quiz modal
2. Click "🗑️ Delete" on a question
3. Confirm deletion
4. **Expected:** Question removed

### Test Update Passing Score
1. Open quiz modal
2. Change passing score
3. Click "Update Score"
4. **Expected:** Score updated, success message

---

## Files Modified

### Frontend
- **`lms-app/app/dashboard/admin/cpd/[courseId]/view/page.tsx`**
  - Added edit/delete buttons to topics
  - Added delete buttons to files
  - Added View/Edit buttons to quizzes
  - Implemented quiz viewer/editor modal
  - Added question management UI

### Backend
- **`lms-app/backend/routes/cpd.js`**
  - `PUT /topics/:topicId` - Update topic
  - `DELETE /topics/:topicId` - Delete topic
  - `PUT /quizzes/:quizId/passing-score` - Update passing score
  - `POST /quizzes/:quizId/questions` - Add question
  - `DELETE /questions/:questionId` - Delete question

---

## Future Enhancements

### Potential Additions
1. **Edit Questions** - Inline editing of existing questions
2. **Reorder Questions** - Drag and drop question ordering
3. **Reorder Topics** - Change unit sequence
4. **Bulk Operations** - Delete multiple files/questions at once
5. **Question Bank** - Reuse questions across quizzes
6. **Quiz Preview** - Take quiz as student to test
7. **Import Questions** - CSV/Excel import
8. **Export Quiz** - Download quiz as PDF

---

## Status

✅ **COMPLETE** - Full editing capabilities implemented!

### Summary:
- ✅ Edit topic names and descriptions
- ✅ Delete topics with cascade
- ✅ Delete files
- ✅ View quiz questions
- ✅ Edit passing scores
- ✅ Add new questions
- ✅ Delete questions
- ✅ User-friendly modals and forms
- ✅ All backend API endpoints working
- ✅ Proper error handling and validation

**Ready for production use!** 🎉

---

## Quick Reference

| Action | Button | Location |
|--------|--------|----------|
| Edit Topic | ✏️ Edit | Topic card |
| Delete Topic | 🗑️ Delete | Topic card |
| Extend Deadline | ✏️ Extend | Deadline badge |
| Delete File | 🗑️ Delete | File row |
| View Quiz | 👁️ View/Edit | Quiz card |
| Edit Passing Score | Update Score | Quiz modal |
| Add Question | ➕ Add Question | Quiz modal |
| Delete Question | 🗑️ Delete | Question row |

---

**All editing features are now available at:**
- Admin: `http://localhost:3000/dashboard/admin/cpd/[courseId]/view`
- Tutor: `http://localhost:3000/dashboard/tutor/cpd/[courseId]/view`

🚀 **Full course management at your fingertips!**

