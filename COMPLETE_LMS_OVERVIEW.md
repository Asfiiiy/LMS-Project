# 🎓 Inspire LMS - Complete System Overview

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Core Features](#core-features)
5. [Course Management](#course-management)
6. [Assessment Systems](#assessment-systems)
7. [Payment System](#payment-system)
8. [Certificate System](#certificate-system)
9. [Communication Features](#communication-features)
10. [AI Automation System](#ai-automation-system)
11. [Admin Dashboard Features](#admin-dashboard-features)
12. [Security Features](#security-features)
13. [Database Structure](#database-structure)
14. [API Endpoints](#api-endpoints)
15. [Frontend Architecture](#frontend-architecture)
16. [Deployment & Infrastructure](#deployment--infrastructure)

---

## 🎯 System Overview

**Inspire LMS** is a comprehensive Learning Management System designed for Inspire London College. It supports multiple course types, role-based access control, real-time communication, automated certificate generation, payment processing, and AI-powered automation.

### Key Highlights:
- ✅ **Multi-role system** (Admin, Tutor, Student, Manager, Moderator)
- ✅ **Dual course types** (CPD & Qualification courses)
- ✅ **Real-time chat** with Socket.IO
- ✅ **Automated certificates** with DOCX templates
- ✅ **Stripe payment integration**
- ✅ **AI automation** with token-based access
- ✅ **Comprehensive admin dashboard**
- ✅ **Mobile-responsive design**

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** Next.js 16.1.4 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI Libraries:**
  - React 19.0.3
  - Framer Motion (animations)
  - SweetAlert2 (alerts)
  - TinyMCE (rich text editor)
  - Recharts (data visualization)
- **Real-time:** Socket.IO Client 4.8.1
- **Payment:** Stripe React SDK 5.4.1

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js 5.1.0
- **Database:** MySQL (mysql2 3.15.3)
- **Authentication:** JWT (jsonwebtoken 9.0.2)
- **File Storage:** Cloudinary 2.8.0
- **Real-time:** Socket.IO 4.8.1
- **Payment:** Stripe 20.0.0
- **Document Processing:**
  - LibreOffice (DOCX to PDF conversion)
  - docxtemplater (template processing)
  - mammoth (DOCX parsing)
- **Queue System:** Bull 4.16.5 (Redis-based)
- **Logging:** Pino 10.1.0
- **Rate Limiting:** express-rate-limit 8.2.1

### Infrastructure
- **Process Manager:** PM2 (cluster mode)
- **Web Server:** Nginx (reverse proxy)
- **Cache/Queue:** Redis (ioredis 5.8.2)
- **Monitoring:** PM2 monitoring + custom metrics

---

## 👥 User Roles & Permissions

### Role Hierarchy

| Role ID | Role Name | Description | Permissions |
|---------|-----------|-------------|-------------|
| 1 | **Admin** | Full system access | All permissions, user management, system configuration |
| 2 | **Tutor** | Course instructor | Manage assigned courses, grade assignments, chat with students |
| 3 | **Manager** | Department manager | View reports, manage students, access manager dashboard |
| 4 | **Student** | Course learner | Access enrolled courses, submit assignments, view grades |
| 5 | **Moderator** | Content moderator | Moderate forum, review content |
| - | **ManagerStudent** | Manager with student access | Combined manager + student permissions |
| - | **InstituteStudent** | Institute student | Special student type with institute access |

### Role-Based Access Control
- ✅ JWT-based authentication
- ✅ Route-level protection
- ✅ Component-level permissions
- ✅ API endpoint restrictions
- ✅ Auto-logout on inactivity
- ✅ Token refresh mechanism
- ✅ Cross-tab synchronization

---

## 🚀 Core Features

### 1. User Management
- ✅ Create/Edit/Delete users
- ✅ Role assignment
- ✅ Password management (bcrypt hashing)
- ✅ Profile management
- ✅ Student profile completion system
- ✅ Tutor assignment to students
- ✅ Manager-student relationships

### 2. Course Management
- ✅ Create courses (CPD & Qualification)
- ✅ Course categories & subcategories
- ✅ Course status management
- ✅ Unit/Topic organization
- ✅ Resource upload (PDFs, videos, documents)
- ✅ Course introduction sections
- ✅ Course file management
- ✅ Moodle import capability (.mbz files)

### 3. Enrollment System
- ✅ Student enrollment in courses
- ✅ Bulk enrollment
- ✅ Enrollment status tracking
- ✅ Deadline management per topic/unit
- ✅ Payment installment setup
- ✅ Enrollment setup wizard
- ✅ Progress tracking

### 4. Progress Tracking
- ✅ Unit lock/unlock system (sequential progression)
- ✅ Topic completion tracking
- ✅ Assignment submission tracking
- ✅ Quiz attempt tracking
- ✅ Course completion status
- ✅ Progress visualization

---

## 📚 Course Management

### Course Types

#### 1. **CPD Courses** (Continuing Professional Development)
- ✅ Short-term professional development courses
- ✅ Practice & Final quizzes
- ✅ Certificate generation upon completion
- ✅ Topic-based structure
- ✅ File attachments per topic
- ✅ Lock/unlock progression system

**CPD Features:**
- Practice quizzes (unlimited attempts)
- Final quizzes (limited attempts, passing score required)
- Certificate claiming system
- Registration number generation (ILC50001+)
- Template-based certificate generation

#### 2. **Qualification Courses** (Full Qualifications)
- ✅ Long-term qualification programs
- ✅ Unit-based structure
- ✅ Assignment-based assessment
- ✅ Deadline management
- ✅ Tutor grading system
- ✅ Payment installment plans

**Qualification Features:**
- Unit announcements
- Topic deadlines
- Assignment briefs with files
- Submission system
- Tutor feedback & grading
- Numeric & pass/fail grading
- Additional reading materials

### Course Structure

```
Course
├── Introduction Section
│   ├── Heading
│   ├── Content (rich text)
│   └── Files (PDFs, videos)
├── Units/Topics
│   ├── Topic 1
│   │   ├── Files
│   │   ├── Deadlines
│   │   └── Assignments
│   └── Topic 2...
└── Resources
    ├── PDFs
    ├── Videos
    └── Documents
```

---

## 📝 Assessment Systems

### 1. Quiz System

**Quiz Types:**
- **Practice Quizzes:** Unlimited attempts, no passing requirement
- **Final Quizzes:** Limited attempts, passing score required

**Features:**
- ✅ Multiple choice questions
- ✅ Single & multiple correct answers
- ✅ Automatic grading
- ✅ Score calculation
- ✅ Attempt tracking
- ✅ Quiz analytics (admin/tutor view)
- ✅ Question randomization (optional)

**Quiz Management:**
- Create/edit/delete quizzes
- Question bank management
- Option management
- Passing score configuration
- Time limits (optional)
- Quiz attempts history

### 2. Assignment System

**Assignment Features:**
- ✅ Assignment briefs with files
- ✅ File submission (PDF, DOCX, etc.)
- ✅ Deadline management
- ✅ Submission tracking
- ✅ Tutor grading system
- ✅ Feedback system
- ✅ Grade types:
  - Numeric grades (0-100)
  - Pass/Fail
  - Custom grading types

**Grading System:**
- ✅ Tutor assignment to students
- ✅ Grade entry interface
- ✅ Feedback comments
- ✅ Grading history
- ✅ Grade notifications
- ✅ Student grade view

---

## 💳 Payment System

### Payment Features

1. **Stripe Integration**
   - ✅ Payment intent creation
   - ✅ Secure payment processing
   - ✅ Payment confirmation
   - ✅ Webhook handling
   - ✅ Test mode support

2. **Payment Types**
   - **All Paid:** One-time full payment
   - **Installment:** Multiple payment schedule

3. **Installment Management**
   - ✅ Create installment plans
   - ✅ Set due dates
   - ✅ Track payment status (Paid/Due/Overdue)
   - ✅ Payment reference tracking
   - ✅ Payment history
   - ✅ Auto-overdue detection

4. **Payment Notifications**
   - ✅ Due date reminders
   - ✅ Overdue alerts
   - ✅ Payment confirmation
   - ✅ Student dashboard notifications

5. **Admin/Tutor Features**
   - ✅ View all student payments
   - ✅ Update payment status
   - ✅ Add payment references
   - ✅ Filter by status
   - ✅ Search by student name
   - ✅ Payment reports

---

## 🏆 Certificate System

### Certificate Generation

**Features:**
- ✅ Automated certificate generation
- ✅ DOCX template system
- ✅ PDF conversion (LibreOffice)
- ✅ Registration number auto-generation (ILC50001+)
- ✅ Template placeholders:
  - `{{STUDENT_NAME}}`
  - `{{COURSE_NAME}}`
  - `{{REGISTRATION_NO}}`
  - `{{UNIT_1_NAME}}`, `{{UNIT_1_CREDITS}}` (up to 25 units)
  - `{{DATE}}`, `{{YEAR}}`

**Certificate Types:**
- **Certificate:** Main certificate document
- **Transcript:** Detailed transcript with units

**Template Management:**
- ✅ Upload DOCX templates
- ✅ Template activation/deactivation
- ✅ Template preview
- ✅ Template editing
- ✅ Course type-specific templates (CPD/Qualification)

**Certificate Workflow:**
1. Student completes course
2. Student claims certificate
3. Admin reviews claim
4. Admin adds registration number
5. System generates certificate (DOCX → PDF)
6. Student downloads certificate

**Certificate Features:**
- ✅ Bulk certificate generation
- ✅ Certificate download portal
- ✅ Certificate claims management
- ✅ Payment integration (optional certificate fees)
- ✅ Certificate history
- ✅ Certificate verification

---

## 💬 Communication Features

### 1. Real-Time Chat System

**Features:**
- ✅ Real-time messaging (Socket.IO)
- ✅ File sharing (images, PDFs, documents, max 10MB)
- ✅ Online/Offline status indicators
- ✅ Typing indicators
- ✅ Read receipts (✓ = delivered, ✓✓ = read)
- ✅ Last seen timestamps
- ✅ Conversation management
- ✅ Role-based access control
- ✅ Cloudinary file storage

**Chat Permissions:**
- **Students:** Can chat with assigned tutors
- **Tutors:** Can chat with students & admins
- **Admins:** Can chat with everyone

**Chat UI:**
- Modern, WhatsApp-like interface
- Color-coded messages
- Avatar with initials
- Message timestamps
- File previews
- Smooth animations

### 2. Forum System

**Features:**
- ✅ Course-specific forums
- ✅ Post creation & editing
- ✅ Comment system
- ✅ Like/Reaction system
- ✅ Post moderation
- ✅ Search functionality
- ✅ Category organization

### 3. Notification System

**Features:**
- ✅ Real-time notifications (Socket.IO)
- ✅ Notification types:
  - Assignment submissions
  - Grade updates
  - Payment due/overdue
  - Certificate claims
  - Chat messages
  - Forum replies
- ✅ Notification center
- ✅ Mark as read/unread
- ✅ Notification history
- ✅ Email notifications (optional)

---

## 🤖 AI Automation System

### Overview

The AI Automation System allows AI agents to perform automated tasks within the LMS using token-based authentication.

### AI Token System

**Token Features:**
- ✅ Secure token generation (128 hex characters)
- ✅ Token encryption
- ✅ Permission-based access
- ✅ Token expiration
- ✅ Token revocation
- ✅ Usage tracking
- ✅ IP tracking
- ✅ Rate limiting
- ✅ Security monitoring

**Permissions:**
- `users.create` - Create new users (students)
- `users.assign_tutor` - Assign tutors to students
- `enrollments.read` - View courses and students
- `enrollments.create` - Enroll students in courses
- `enrollments.setup` - Set deadlines and payment installments

### AI Endpoints

**User Management:**
- `POST /api/ai/users/create` - Create student
- `POST /api/ai/users/assign-tutor` - Assign tutor

**Enrollment:**
- `GET /api/ai/enrollments/courses` - List courses
- `GET /api/ai/enrollments/students` - List students
- `POST /api/ai/enrollments/enroll` - Enroll student

**Enrollment Setup:**
- `POST /api/ai/enrollments/setup/deadlines` - Set topic deadlines
- `POST /api/ai/enrollments/setup/payments` - Configure payment installments

### AI Security Features

**Security Measures:**
- ✅ SQL injection prevention (parameterized queries)
- ✅ Input validation middleware
- ✅ Permission whitelist system
- ✅ Token encryption
- ✅ Token rotation
- ✅ IP tracking & anomaly detection
- ✅ Auto-revocation on security alerts
- ✅ Rate limiting per token
- ✅ Comprehensive action logging

**Security Monitoring:**
- `GET /api/admin/ai-security/monitor` - Monitor token usage
- `GET /api/admin/ai-security/report` - Security report
- `POST /api/admin/ai-security/run-patch` - Run security patches

**AI Action Logging:**
- ✅ All AI actions logged
- ✅ Log filtering & search
- ✅ Statistics & analytics
- ✅ Token-specific logs
- ✅ Action type tracking

---

## 🎛️ Admin Dashboard Features

### Admin Dashboard Tabs

1. **👥 User Management**
   - Create/Edit/Delete users
   - Role assignment
   - Bulk operations
   - User search & filters

2. **📚 Course Management**
   - Create/Edit courses
   - Course categories
   - Course status
   - Course files

3. **📊 Student Insights**
   - Student list
   - Course enrollment
   - Enrollment setup (deadlines + payments)
   - Student profiles

4. **📝 Assignments**
   - View all assignments
   - Submission tracking
   - Grading interface
   - Assignment analytics

5. **📋 Quizzes**
   - Quiz management
   - Quiz attempts view
   - Quiz analytics
   - Question bank

6. **💬 Chat**
   - Direct redirect to chat system

7. **🔑 AI Tokens**
   - Token generation
   - Token management
   - Token revocation
   - Security alerts
   - Usage statistics
   - AI action logs

8. **🏆 Certificates**
   - Certificate claims management
   - Certificate generation
   - Registration number assignment
   - Certificate templates

9. **📈 Reports**
   - System logs
   - Activity logs
   - User activity
   - System metrics

10. **💳 Payments**
    - Payment management
    - Installment tracking
    - Payment history
    - Payment reports

11. **📢 Notifications**
    - Notification management
    - Notification history
    - Notification settings

12. **💬 Forum**
    - Forum moderation
    - Post management
    - Comment moderation

13. **🏥 Health**
    - System health monitoring
    - Performance metrics
    - Database status

---

## 🔒 Security Features

### Authentication & Authorization
- ✅ JWT-based authentication
- ✅ Password hashing (bcrypt)
- ✅ Token refresh mechanism
- ✅ Auto-logout on inactivity
- ✅ Role-based access control
- ✅ Route protection
- ✅ API endpoint security

### Security Measures
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ Input validation
- ✅ File upload validation
- ✅ Secure file storage (Cloudinary)
- ✅ HTTPS enforcement

### AI Security
- ✅ Token encryption
- ✅ Permission whitelist
- ✅ IP tracking
- ✅ Anomaly detection
- ✅ Auto-revocation
- ✅ Security monitoring
- ✅ Action logging

### Logging & Monitoring
- ✅ Comprehensive activity logging
- ✅ Error logging (Pino)
- ✅ Security event logging
- ✅ System metrics
- ✅ PM2 monitoring
- ✅ Health checks

---

## 🗄️ Database Structure

### Core Tables

**Users & Authentication:**
- `users` - User accounts
- `student_profiles` - Student profile data
- `staff_profiles` - Staff profile data

**Courses:**
- `courses` - Course information
- `course_categories` - Main categories
- `sub_categories` - Sub-categories
- `course_assignments` - Student enrollments
- `course_intro_files` - Course introduction files

**CPD System:**
- `cpd_courses` - CPD course data
- `cpd_topics` - CPD topics
- `cpd_topic_files` - Topic files
- `cpd_progress` - Student progress
- `cpd_quiz_attempts` - Quiz attempts

**Qualification System:**
- `qual_course_files` - Course files
- `qual_course_content` - Course content
- `qual_unit_announcements` - Unit announcements
- `qual_unit_content` - Unit content
- `qual_topics` - Topics with deadlines
- `qual_topic_files` - Topic files
- `qual_additional_readings` - Reading materials
- `qual_assignment_briefs` - Assignment briefs
- `qual_assignment_brief_files` - Brief files
- `qual_submissions` - Student submissions
- `qual_unit_progress` - Progress tracking
- `qual_deadlines` - Deadline management

**Content:**
- `units` - Course units
- `course_units` - Unit-course relationships
- `resources` - Learning materials
- `quizzes` - Quiz definitions
- `quiz_questions` - Quiz questions
- `quiz_submissions` - Quiz attempts
- `assignments` - Assignment definitions
- `assignment_submissions` - Student submissions

**Certificates:**
- `certificate_claims` - Certificate claims
- `certificate_templates` - DOCX templates
- `generated_certificates` - Generated certificates

**Payments:**
- `student_payment_installments` - Payment installments
- `payment_transactions` - Payment history

**Communication:**
- `chat_messages` - Chat messages
- `chat_conversations` - Conversations
- `forum_posts` - Forum posts
- `forum_comments` - Post comments
- `notifications` - System notifications

**AI System:**
- `ai_tokens` - AI tokens
- `ai_action_logs` - AI action logs
- `ai_token_ip_tracking` - IP tracking

**System:**
- `system_logs` - System activity logs
- `event_logs` - Event logs

---

## 🔌 API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/login/logout` - User logout
- `POST /api/login/refresh` - Refresh token

### Users
- `POST /api/users/create` - Create user
- `GET /api/users` - Get users
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Courses
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course
- `GET /api/courses/:id` - Get course
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Admin Endpoints
- `GET /api/admin/*` - Admin operations
- `POST /api/admin/*` - Admin operations
- `GET /api/admin/ai-tokens` - AI token management
- `POST /api/admin/ai-tokens` - Create AI token
- `GET /api/admin/ai-security/monitor` - Security monitoring

### Student Endpoints
- `GET /api/student/:id/courses` - Student courses
- `GET /api/student/:id/assignments` - Student assignments
- `POST /api/student/:id/submit-assignment` - Submit assignment

### CPD Endpoints
- `GET /api/cpd/courses` - CPD courses
- `GET /api/cpd/:courseId/topics` - Course topics
- `POST /api/cpd/:courseId/claim-certificate` - Claim certificate

### Qualification Endpoints
- `GET /api/qualification/:courseId` - Qualification course
- `POST /api/qualification/:courseId/units` - Create unit
- `POST /api/qualification/units/:unitId/topics` - Add topic

### Chat Endpoints
- `GET /api/chat/conversations` - Get conversations
- `POST /api/chat/messages` - Send message
- `GET /api/chat/messages/:conversationId` - Get messages

### Certificate Endpoints
- `GET /api/certificates/claims` - Get claims
- `POST /api/certificates/claim` - Submit claim
- `POST /api/certificates/generate` - Generate certificate
- `GET /api/certificates/download/:id` - Download certificate

### Payment Endpoints
- `GET /api/payment/installments` - Get installments
- `POST /api/payment/installments` - Create installments
- `PUT /api/payment/installments/:id` - Update installment
- `POST /api/certificates/payment/create-intent` - Create payment intent

### AI Endpoints (Token Auth Required)
- `POST /api/ai/users/create` - Create user
- `POST /api/ai/users/assign-tutor` - Assign tutor
- `GET /api/ai/enrollments/courses` - List courses
- `POST /api/ai/enrollments/enroll` - Enroll student
- `POST /api/ai/enrollments/setup/deadlines` - Set deadlines
- `POST /api/ai/enrollments/setup/payments` - Setup payments

---

## 🎨 Frontend Architecture

### Directory Structure

```
app/
├── components/          # Reusable components
│   ├── AITokenManagement.tsx
│   ├── CertificateEditor.tsx
│   ├── CertificateTemplateManager.tsx
│   ├── ChatBox.tsx
│   ├── CourseManagement.tsx
│   ├── UserManagement.tsx
│   └── ...
├── dashboard/          # Role-based dashboards
│   ├── admin/
│   ├── tutor/
│   ├── student/
│   ├── manager/
│   └── moderator/
├── courses/           # Course pages
│   └── [id]/
├── quizzes/          # Quiz pages
│   └── [id]/
├── chat/             # Chat pages
├── profile/          # Profile pages
├── services/         # API service
│   └── api.ts
└── utils/            # Utilities
```

### Key Components

**Management Components:**
- `UserManagement.tsx` - User CRUD
- `CourseManagement.tsx` - Course management
- `AITokenManagement.tsx` - AI token management
- `CertificateTemplateManager.tsx` - Template management
- `CertificateClaimsManagement.tsx` - Claims management

**Communication:**
- `ChatBox.tsx` - Chat interface
- `CommentsSection.tsx` - Forum comments

**Profile:**
- `StudentProfileDetail.tsx` - Student profile
- `StudentsProfileView.tsx` - Student list view
- `PaymentManagementView.tsx` - Payment management

**Utilities:**
- `ProtectedRoute.tsx` - Route protection
- `AutoLogoutProvider.tsx` - Auto-logout
- `UniversalFileViewer.tsx` - File viewer
- `SweetAlert.tsx` - Alert dialogs

### State Management
- React hooks (useState, useEffect)
- Context API (for auth state)
- Local storage (for tokens)
- Socket.IO (for real-time updates)

---

## 🚀 Deployment & Infrastructure

### Production Setup

**Process Management:**
- PM2 cluster mode (5 instances, 2 workers)
- Auto-restart on failure
- Log rotation
- Health monitoring

**Web Server:**
- Nginx reverse proxy
- SSL/TLS certificates
- WebSocket support
- File upload limits (200MB)

**Database:**
- MySQL (production)
- Connection pooling
- Query optimization
- Backup system

**File Storage:**
- Cloudinary CDN
- Automatic image optimization
- Secure file access
- CDN delivery

**Monitoring:**
- PM2 monitoring
- System health checks
- Error logging (Pino)
- Activity logging
- Performance metrics

### Environment Variables

**Backend (.env):**
- `JWT_SECRET` - JWT signing secret
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Database config
- `CLOUDINARY_URL` - Cloudinary config
- `STRIPE_SECRET_KEY` - Stripe API key
- `REDIS_URL` - Redis connection
- `NODE_ENV` - Environment (production/development)

**Frontend:**
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` - Stripe public key

---

## 📊 System Statistics

### Current Implementation Status

✅ **Fully Implemented:**
- User management system
- CPD course system
- Qualification course system
- Quiz system (practice & final)
- Assignment system
- Certificate generation
- Payment system (Stripe)
- Chat system (real-time)
- Forum system
- Notification system
- AI automation system
- Admin dashboard
- Tutor dashboard
- Student dashboard
- Security features
- Logging system

### Database Tables: **41+ tables**
### API Routes: **23 route files**
### Frontend Components: **25+ components**
### User Roles: **7 roles**

---

## 🔮 Future Enhancements

### Planned Features:
- 📱 Mobile app (React Native)
- 📧 Email notifications
- 📊 Advanced analytics dashboard
- 🌐 Multi-language support
- 📹 Video conferencing integration
- 🤖 Enhanced AI features
- 📈 Advanced reporting
- 🔔 Push notifications
- 📱 SMS notifications
- 🎓 Learning paths
- 🏆 Badge system
- 📚 Course marketplace

---

## 📞 Support & Documentation

### Documentation Files:
- `CHAT_SYSTEM_DOCUMENTATION.md` - Chat system guide
- `SECURITY_FIXES_SUMMARY.md` - Security features
- `QUALIFICATION_IMPLEMENTATION_STATUS.md` - Qualification system
- `CPD_EDITING_FEATURES.md` - CPD features
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `PROJECT_STRUCTURE.md` - Project structure

### Support:
- **Developer:** Asfand Yar
- **LinkedIn:** https://www.linkedin.com/in/asfand-yar-b937a9231/
- **Email:** info@inspirelondoncollege.co.uk

---

## 📝 License & Copyright

**Copyright © 2025 Inspire London College. All rights reserved.**

**Version:** 1.0.0  
**Status:** ✅ Production Ready

---

*Last Updated: January 2026*
