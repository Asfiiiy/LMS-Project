# LMS Project - Complete File & Folder Structure

## 📁 Project Root (`D:\Lms\`)

```
D:\Lms\
│
├── 📄 db schema.txt                    # Database schema documentation
├── 📄 info.txt                         # General project information
├── 📄 lms.txt                          # LMS-specific notes
├── 📄 logins.txt                       # Login credentials reference
├── 📄 performance.txt                  # Performance notes
├── 📄 restore.txt                      # Database restore instructions
│
└── 📂 lms-app/                         # Main application directory
    │
    ├── 📄 package.json                 # Frontend dependencies (Next.js 16)
    ├── 📄 package-lock.json
    ├── 📄 tsconfig.json                # TypeScript configuration
    ├── 📄 next.config.ts               # Next.js configuration
    ├── 📄 next-env.d.ts                # Next.js TypeScript declarations
    ├── 📄 eslint.config.mjs            # ESLint configuration
    ├── 📄 postcss.config.mjs           # PostCSS configuration (Tailwind)
    ├── 📄 README.md                    # Project README
    ├── 📄 COURSE_INTRODUCTION_SETUP.md # Course intro feature documentation
    ├── 📄 QUIZ_TYPES_SETUP.md          # Quiz types feature documentation
    ├── 📄 app.zip                      # Backup archive
    ├── 📄 backend.zip                  # Backend backup archive
    │
    ├── 📂 node_modules/                # Frontend dependencies
    │
    ├── 📂 public/                      # Static assets
    │   ├── 📂 assets/
    │   │   └── 📄 logo.png
    │   ├── 📄 file.svg
    │   ├── 📄 globe.svg
    │   ├── 📄 next.svg
    │   ├── 📄 vercel.svg
    │   └── 📄 window.svg
    │
    ├── 📂 database/                    # Database-related files
    │
    ├── 📂 app/                         # Next.js 16 App Router
    │   │
    │   ├── 📄 layout.tsx               # Root layout (wraps all pages)
    │   ├── 📄 page.tsx                 # Home page (/)
    │   ├── 📄 globals.css              # Global styles (Tailwind)
    │   ├── 📄 favicon.ico              # Site favicon
    │   │
    │   ├── 📂 components/              # Reusable React components
    │   │   ├── 📄 types.ts             # TypeScript interfaces (User, Course, etc.)
    │   │   ├── 📄 Navbar.tsx           # Navigation bar component
    │   │   ├── 📄 Footer.tsx           # Footer component
    │   │   ├── 📄 Footer.module.css    # Footer styles
    │   │   ├── 📄 ProtectedRoute.tsx   # Role-based route protection
    │   │   ├── 📄 UserManagement.tsx   # Admin user management component
    │   │   ├── 📄 CourseManagement.tsx # Admin/Tutor course management
    │   │   └── 📄 StudentEnrollment.tsx # Student enrollment component
    │   │
    │   ├── 📂 services/                # API service layer
    │   │   └── 📄 api.ts               # ApiService class (all API calls)
    │   │
    │   ├── 📂 login/                   # Login page route
    │   │   └── 📄 page.tsx             # Login UI (/login)
    │   │
    │   ├── 📂 logout/                  # Logout route
    │   │   └── 📄 page.tsx             # Logout handler (/logout)
    │   │
    │   ├── 📂 dashboard/               # Dashboard routes
    │   │   ├── 📂 admin/
    │   │   │   └── 📄 page.tsx         # Admin dashboard (/dashboard/admin)
    │   │   ├── 📂 tutor/
    │   │   │   └── 📄 page.tsx         # Tutor dashboard (/dashboard/tutor)
    │   │   ├── 📂 student/
    │   │   │   └── 📄 page.tsx         # Student dashboard (/dashboard/student)
    │   │   ├── 📂 manager/
    │   │   │   └── 📄 page.tsx         # Manager dashboard (/dashboard/manager)
    │   │   ├── 📂 managerStudent/
    │   │   │   └── 📄 page.tsx         # Manager Student dashboard
    │   │   └── 📂 moderator/
    │   │       └── 📄 page.tsx         # Moderator dashboard (/dashboard/moderator)
    │   │
    │   ├── 📂 courses/                 # Course-related routes
    │   │   └── 📂 [id]/                # Dynamic course ID route
    │   │       ├── 📄 page.tsx         # Course detail page (/courses/[id])
    │   │       └── 📂 files/
    │   │           └── 📄 page.tsx     # Course content manager (/courses/[id]/files)
    │   │
    │   └── 📂 quizzes/                 # Quiz-related routes
    │       └── 📂 [id]/                # Dynamic quiz ID route
    │           └── 📄 page.tsx         # Quiz attempt page (/quizzes/[id])
    │
    └── 📂 backend/                     # Backend API (Node.js + Express)
        │
        ├── 📄 server.js                # Express server entry point
        ├── 📄 package.json             # Backend dependencies
        ├── 📄 package-lock.json
        ├── 📄 testConnection.js        # Database connection test script
        ├── 📄 SETUP_INSTRUCTIONS.md    # Backend setup guide
        ├── 📄 FILE_STORAGE_INFO.md     # File storage documentation
        │
        ├── 📂 node_modules/            # Backend dependencies
        │
        ├── 📂 config/                  # Configuration files
        │   ├── 📄 db.js                # MySQL database connection (pool)
        │   └── 📄 cloudinary.js        # Cloudinary configuration
        │
        ├── 📂 middleware/              # Express middleware
        │   ├── 📄 auth.js              # JWT authentication middleware
        │   └── 📄 roles.js             # Role-based authorization middleware
        │
        ├── 📂 models/                  # Data models
        │   └── 📄 userModel.js         # User model
        │
        ├── 📂 controllers/             # Business logic controllers
        │   └── 📄 authController.js    # Authentication controller
        │
        ├── 📂 routes/                  # API route handlers
        │   ├── 📄 auth.js              # Auth routes (JWT)
        │   ├── 📄 authRoutes.js        # Alternative auth routes
        │   ├── 📄 login.js             # Login routes
        │   ├── 📄 users.js             # User CRUD routes
        │   ├── 📄 admin.js             # Admin routes (courses, quizzes, assignments)
        │   ├── 📄 student.js           # Student routes (courses, assignments, progress)
        │   └── 📄 courses.js           # Course routes
        │
        ├── 📂 migrations/              # Database migration scripts
        │   ├── 📄 20251110_create_unit_progress.sql       # Unit lock/unlock system
        │   ├── 📄 20251110_add_course_introduction.sql    # Course intro feature
        │   └── 📄 20251110_add_quiz_type.sql              # Quiz types (practice/final)
        │
        ├── 📂 uploads/                 # File upload storage (local)
        │   └── 📂 courses/             # Course-related files
        │       ├── 📄 backupFile-*.mbz # Moodle backup files
        │       ├── 📄 courseFile-*.pdf # Course PDF files
        │       └── 📄 file-*.pdf       # General uploaded files
        │
        ├── 📄 alter-course-fields.sql  # SQL script for course table updates
        ├── 📄 fix-database.sql         # Database fix script
        └── 📄 setup-course-tables.sql  # Course tables setup script
```

---

## 📊 Key Directory Breakdown

### 🎨 Frontend (Next.js 16 App Router)

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `app/` | Next.js App Router | `layout.tsx`, `page.tsx` |
| `app/components/` | Reusable UI components | `Navbar.tsx`, `ProtectedRoute.tsx`, `types.ts` |
| `app/services/` | API integration layer | `api.ts` (ApiService class) |
| `app/dashboard/` | Role-based dashboards | `admin/`, `tutor/`, `student/` |
| `app/courses/` | Course pages | `[id]/page.tsx`, `[id]/files/page.tsx` |
| `app/quizzes/` | Quiz pages | `[id]/page.tsx` |
| `public/` | Static assets | `logo.png`, SVG icons |

### 🔧 Backend (Node.js + Express)

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `backend/` | Express API server | `server.js` |
| `backend/config/` | Configuration | `db.js` (MySQL), `cloudinary.js` |
| `backend/routes/` | API endpoints | `admin.js`, `student.js`, `auth.js` |
| `backend/middleware/` | Express middleware | `auth.js` (JWT), `roles.js` |
| `backend/migrations/` | Database migrations | SQL files for schema updates |
| `backend/uploads/` | Local file storage | Course files (PDFs, .mbz) |

---

## 🗄️ Database Tables (MySQL)

Based on the schema, here are the main tables:

### Core Tables:
- `users` - User accounts (Admin, Tutor, Student, etc.)
- `courses` - Course information
- `units` - Course units/topics
- `course_categories` - Main course categories
- `sub_categories` - Sub-categories for courses

### Content Tables:
- `resources` - Learning materials (PDFs, videos)
- `quizzes` - Quiz definitions
- `quiz_questions` - Quiz questions and options
- `quiz_submissions` - Student quiz attempts
- `assignments` - Assignment definitions
- `assignment_submissions` - Student assignment submissions

### Enrollment & Progress:
- `course_assignments` - Student enrollment to courses
- `unit_progress` - Student progress tracking (lock/unlock)
- `course_intro_files` - Course introduction files

---

## 🔑 Key Features by File

### 📱 Frontend Components

| File | Purpose | Key Features |
|------|---------|--------------|
| `app/components/ProtectedRoute.tsx` | Route protection | Role-based access control |
| `app/components/UserManagement.tsx` | User CRUD | Create, edit, delete users |
| `app/components/CourseManagement.tsx` | Course CRUD | Manage courses, categories |
| `app/components/StudentEnrollment.tsx` | Enrollment | Enroll/unenroll students |
| `app/services/api.ts` | API client | All backend API calls |

### 🎯 Dashboard Pages

| File | Role | Key Features |
|------|------|--------------|
| `app/dashboard/admin/page.tsx` | Admin | User management, courses, assignments, quizzes |
| `app/dashboard/tutor/page.tsx` | Tutor | Course management, student enrollment, assessments |
| `app/dashboard/student/page.tsx` | Student | Enrolled courses, assignments, progress |

### 📚 Course Pages

| File | Purpose | Key Features |
|------|---------|--------------|
| `app/courses/[id]/page.tsx` | Course view | Units, resources, quizzes, intro section, lock/unlock |
| `app/courses/[id]/files/page.tsx` | Content manager | Upload files, create units, import quizzes |
| `app/quizzes/[id]/page.tsx` | Quiz attempt | Take quiz, submit answers, view score |

### 🛠️ Backend Routes

| File | Purpose | Key Endpoints |
|------|---------|---------------|
| `backend/routes/admin.js` | Admin API | `/admin/courses`, `/admin/users`, `/admin/quizzes` |
| `backend/routes/student.js` | Student API | `/student/:id/courses`, `/student/:id/assignments` |
| `backend/routes/auth.js` | Authentication | `/auth/login`, `/auth/register` |

---

## 📦 Dependencies

### Frontend (`lms-app/package.json`)
- **Framework**: Next.js 16.0.0 (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

### Backend (`lms-app/backend/package.json`)
- **Framework**: Express.js
- **Database**: MySQL (`mysql2`)
- **Authentication**: `jsonwebtoken`, `bcryptjs`
- **File Upload**: `multer`
- **Cloud Storage**: `cloudinary`
- **CORS**: `cors`

---

## 🚀 Running the Project

### 1. Backend
```bash
cd lms-app/backend
npm install
node server.js
# Runs on: http://localhost:5000
```

### 2. Frontend
```bash
cd lms-app
npm install
npm run dev
# Runs on: http://localhost:3000
```

### 3. Database
- **Host**: sql207.infinityfree.com
- **Database**: if0_37954881_db_lms
- Run migrations from `backend/migrations/`

---

## 📝 Recent Features Implemented

1. ✅ **Unit Lock/Unlock System** - Sequential unit access
2. ✅ **Course Introduction Section** - Heading, content, files
3. ✅ **Quiz Types** - Practice vs Final quizzes
4. ✅ **Student Enrollment** - Multi-student enrollment
5. ✅ **Assignment Tracking** - Submission & grading
6. ✅ **Tutor Dashboard** - Course-specific data
7. ✅ **Admin Dashboard** - System-wide visibility

---

## 📚 Documentation Files

- `COURSE_INTRODUCTION_SETUP.md` - Course intro feature guide
- `QUIZ_TYPES_SETUP.md` - Quiz types feature guide
- `backend/SETUP_INSTRUCTIONS.md` - Backend setup
- `backend/FILE_STORAGE_INFO.md` - File storage guide
- `PROJECT_STRUCTURE.md` - This file!

---

**Last Updated**: November 12, 2025
**Version**: 1.0
**Status**: ✅ Production Ready

