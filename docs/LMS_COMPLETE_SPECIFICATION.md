# LMS Complete Specification

This document is the single authoritative reference for the Learning Management System (LMS). It covers the system architecture, every database table, the authentication model, and a role-by-role specification of every capability, API endpoint, frontend page, and database interaction.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Directory Structure](#2-directory-structure)
3. [External Services and Integrations](#3-external-services-and-integrations)
4. [Database Tables](#4-database-tables)
5. [Authentication and Authorization](#5-authentication-and-authorization)
6. [Role Definitions](#6-role-definitions)
7. [Role 1 -- Admin](#7-role-1----admin)
8. [Role 2 -- Assessor](#8-role-2----assessor)
9. [Role 3 -- Manager](#9-role-3----manager)
10. [Role 4 -- Student](#10-role-4----student)
11. [Role 5 -- Moderator](#11-role-5----moderator)
12. [Role 6 -- Operation Manager](#12-role-6----operation-manager)
13. [Role 7 -- Accounts Manager](#13-role-7----accounts-manager)
14. [Role 8 -- Administrative Manager](#14-role-8----administrative-manager)
15. [Role 9 -- Admission Manager](#15-role-9----admission-manager)
16. [Role 10 -- Team Member](#16-role-10----team-member)
17. [Role 11 -- Certificate Manager](#17-role-11----certificate-manager)
18. [Role 12 -- Claim Manager](#18-role-12----claim-manager)
19. [Role 13 -- ManagerStudent](#19-role-13----managerstudent)
20. [Role 14 -- InstituteStudent](#20-role-14----institutestudent)
21. [Role 15 -- Consultation Manager](#21-role-15----consultation-manager)
22. [Student Onboarding Flow](#22-student-onboarding-flow)
23. [Payment and Installment System](#23-payment-and-installment-system)
24. [Certificate Claim and Generation Pipeline](#24-certificate-claim-and-generation-pipeline)
25. [Ticket and Support System](#25-ticket-and-support-system)
26. [Forum System](#26-forum-system)
27. [Chat System](#27-chat-system)
28. [Consultation Booking System](#28-consultation-booking-system)

---

## 1. System Overview

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MySQL (via `mysql2` -- raw SQL, no ORM) |
| File Storage | Cloudinary (images, documents, course files, certificates) |
| Payments | Stripe (PaymentIntents, webhooks) |
| Real-time | Socket.IO (chat, notifications, consultation slot updates) |
| Caching | Redis (JWT blacklist, response cache via custom middleware) |
| Task Queue | Bull (certificate PDF generation) |
| Video | Zoom API (consultation meetings) |
| Auth | JWT (JSON Web Tokens) with role-based access control |

---

## 2. Directory Structure

```
/var/www/lms-app/
  app/                          # Next.js frontend
    components/                 # Shared React components
    dashboard/                  # Role-specific dashboard pages
      admin/                    # Admin dashboard
      tutor/                    # Assessor dashboard (URL uses "tutor")
      student/                  # Student dashboard
      manager/                  # Manager dashboard
      moderator/                # Moderator dashboard
      tickets/                  # Shared ticket dashboard (Ops/Accounts/Admin/Admission Mgr, Team Member)
      certificate-manager/      # Certificate Manager dashboard
      claim-manager/            # Claim Manager dashboard
      consultation-manager/     # Consultation Manager dashboard
      managerStudent/           # ManagerStudent dashboard (placeholder)
      forum/                    # Shared forum area
    onboarding/                 # Student onboarding wizard pages
    services/                   # Frontend API service layer
      api.ts                    # Main HTTP client for all API calls
      onboardingService.ts      # Onboarding-specific API client
    types/                      # TypeScript type definitions
  backend/
    routes/                     # Express route files (30 files)
    middleware/                  # Auth, roles, cache, pagination, validation
    controllers/                # ticketController.js, authController.js
    services/                   # Business logic services
    migrations/                 # SQL migration files
    scripts/                    # Migration runners, utilities
    utils/                      # Helpers (learnerId, eventLogger, gift_parser)
    cron/                       # Scheduled tasks
  docs/                         # This documentation
```

---

## 3. External Services and Integrations

| Service | Purpose | Where Used |
|---------|---------|------------|
| Cloudinary | Upload and serve images, PDFs, DOCX files for profiles, documents, course materials, certificates | `backend/routes/admin.js`, `studentProfile.js`, `onboarding.js`, `cpd.js`, `qualification.js`, `certificates.js`, `certificateTemplates.js`, `chat.js` |
| Stripe | Payment processing for installments and certificate claims | `backend/routes/paymentInstallments.js` (PaymentIntent + webhook), `backend/routes/certificates.js` |
| Socket.IO | Real-time messaging for chat, ticket updates, consultation slot changes, notifications | `backend/server.js`, referenced in ticket, chat, consultation, and notification controllers |
| Zoom | Create/delete meetings for consultation bookings | `backend/routes/consultations.js` |
| Redis | JWT blacklist, response caching, distributed locks for consultation booking | `backend/middleware/auth.js`, `backend/middleware/cache.js`, `backend/routes/consultations.js` |
| Bull | Job queue for certificate PDF generation | `backend/routes/certificates.js` |
| GeoIP | Test endpoint for IP geolocation | `backend/routes/test-geoip.js` (non-production) |

---

## 4. Database Tables

All tables live in the MySQL database `db_lms`. Schema is defined across migration files in `backend/migrations/` and runtime `CREATE TABLE IF NOT EXISTS` statements. There is no ORM; all queries use raw SQL via `pool.execute` / `pool.query`.

### 4.1 Core / Auth

| Table | Purpose |
|-------|---------|
| `roles` | Role definitions (id, name). 15 rows. |
| `users` | All system users. Key columns: `id`, `name`, `email`, `password`, `learner_id`, `role_id` (FK to `roles`), `manager_id` (FK to `users`), `assigned_tutor_id` (FK to `users`), `parent_tutor_id` (FK to `users`), `department_id` (FK to `departments`), `profile_picture`, `onboarding_profile_status`. |
| `student_profiles` | Extended student profile data: VARK scores, ethnicity, nationality, date of birth, contact, address, ICT/literacy levels, `is_profile_complete`, `profile_completed_at`. |
| `staff_profiles` | Staff profile data: department, phone, qualifications, specialization, bio, profile picture. |

### 4.2 Onboarding

| Table | Purpose |
|-------|---------|
| `student_onboarding_status` | Tracks each student's onboarding progress: `current_step`, boolean flags for each completed step (`welcome_completed`, `course_selection_completed`, `qualification_selection_completed`, `documents_uploaded`, `initial_assessment_completed`, `vark_assessment_completed`), `admin_verified`, `dashboard_access_granted`, `verification_requested_at`, `admin_verified_at`, `admin_verified_by`, `admin_notes`. |
| `student_course_selections` | Whether a student selected CPD, qualifications, or both. |
| `student_qualification_selections` | Chosen qualification level. |
| `student_documents` | Uploaded onboarding documents (type, file URL, Cloudinary public ID, status). Types: `identification`, `cv`, `qualification`, `address`. |
| `student_initial_assessments` | Initial assessment form data: personal info, motivation, skills, career goals, consents, e-signature. |

### 4.3 Courses / Catalog

| Table | Purpose |
|-------|---------|
| `courses` | All courses. Key columns: `id`, `title`, `description`, `status`, `course_type` (`cpd` or `qualification`), `created_by`, `category_id`, `sub_category_id`, `start_date`, `end_date`. |
| `course_categories` | Top-level course categories. |
| `sub_categories` | Sub-categories within a parent category. |
| `course_assignments` | Student-to-course enrollment records: `student_id`, `course_id`, `assigned_tutor_id`, `enrolled_at`. |
| `units` | Course units/modules (for regular courses). |
| `unit_progress` | Per-student unit completion: `is_completed`, `is_locked`, `unlock_reason`, `completed_at`. |
| `resources` | Unit resource files (title, URL, type). |
| `course_files` | Uploaded course package files. |
| `course_intro_files` | Introductory files attached to a course. |

### 4.4 Assignments / Quizzes (Regular Courses)

| Table | Purpose |
|-------|---------|
| `assignments` | Assignment definitions within units. |
| `assignment_submissions` | Student submissions with file URL, grade, feedback. |
| `quizzes` | Quiz definitions within units. |
| `quiz_questions` | Multiple-choice questions for quizzes. |
| `quiz_submissions` | Student quiz attempts with score and pass/fail. |

### 4.5 CPD (Continuing Professional Development)

| Table | Purpose |
|-------|---------|
| `cpd_topics` | Topics within a CPD course, ordered by `topic_number`. |
| `cpd_topic_sections` | Sections within a topic. |
| `cpd_topic_files` | Files attached to topics. |
| `cpd_announcements` | Course-level announcements. |
| `cpd_announcement_files` | Files attached to announcements. |
| `cpd_faq` | FAQ entries for a course. |
| `cpd_faq_files` | Files attached to FAQ entries. |
| `cpd_progress` | Per-student topic completion tracking. |
| `cpd_quizzes` | Practice and final quizzes for topics. |
| `cpd_quiz_questions` | Quiz questions. |
| `cpd_quiz_options` | Answer options for questions. |
| `cpd_quiz_attempts` | Student quiz attempts with score. |
| `cpd_certificates` | Issued CPD certificates. |

### 4.6 Qualification Courses

| Table | Purpose |
|-------|---------|
| `qual_course_content` | Qualification course metadata: handbook, descriptor, welcome message, Rule Level 3 settings. |
| `qual_course_files` | Course-level files (welcome docs, general files). |
| `qual_unit_content` | Unit-level content (guided learning hours, credit value, level). |
| `qual_unit_announcements` | Lectures/announcements per unit. |
| `qual_additional_readings` | Supplementary reading materials per unit. |
| `qual_assignment_briefs` | Assignment brief metadata per unit. |
| `qual_assignment_brief_files` | Files for assignment briefs. |
| `qual_presentation_briefs` | Presentation brief metadata per unit. |
| `qual_unit_quizzes` | Unit-level quizzes. |
| `qual_quiz_questions` | Questions for unit quizzes. |
| `qual_unit_videos` | Video resources per unit. |
| `qual_topics` | Topics within units. |
| `qual_topic_files` | Files for topics. |
| `qual_submissions` | Student assignment/presentation submissions with status, grade, feedback. |
| `assignment_submission_files` | Individual files within a submission. |
| `qual_unit_progress` | Per-student unit progress: `status` (not_started/in_progress/completed), `is_locked`, `unlock_reason`. |
| `qual_student_selected_units` | Rule Level 3 unit selections per student. |

### 4.7 Certificates

| Table | Purpose |
|-------|---------|
| `certificates` | Legacy certificate records (student, course, title). |
| `certificate_claims` | Student claims for CPD/qualification certificates: `claim_type`, `level`, `payment_status`, `delivery_status`, `tracking_number`, `photo_id_url`. |
| `certificate_pricing` | Pricing per level and certificate type. |
| `certificate_templates` | DOCX templates for certificate/transcript generation. |
| `generated_certificates` | Generated certificate records: registration number, PDF/DOCX URLs, `generated_data` JSON, status. |
| `certificate_generation_log` | Audit log for generation events. |

### 4.8 Payments

| Table | Purpose |
|-------|---------|
| `student_payment_installments` | Installment records: `course_id`, `student_id`, `amount`, `due_date`, `status` (pending/paid/overdue/cancelled), `stripe_payment_intent_id`, `paid_at`. |
| `payment_audit_log` | Audit trail for payment actions. |
| `payment_reminders` | Sent reminder records: channel (email/dashboard/both), template used. |
| `email_templates` | Configurable email templates for reminders. |
| `student_notifications` | Payment-related notifications for students. |
| `auto_reminder_settings` | Automated reminder configuration (intervals, channels). |

### 4.9 Consultations

| Table | Purpose |
|-------|---------|
| `consultation_slots` | Available consultation time slots: date, start/end time, duration, `is_active`, `is_booked`. |
| `consultation_bookings` | Student bookings: `slot_id`, `student_id`, `status` (pending/confirmed/completed/cancelled), `zoom_meeting_id`, `zoom_join_url`. |
| `consultation_manager_settings` | Portal settings: `is_enabled`, `disabled_message`, `updated_by`. |

### 4.10 Support / Tickets

| Table | Purpose |
|-------|---------|
| `departments` | Support departments (Academic, Finance, Support/Admission). |
| `tickets` | Support tickets: `subject`, `description`, `status`, `priority`, `department_id`, `category`, `created_by`, `assigned_to`, `escalated_to`, `escalated_by`, `conversation_id`. |
| `ticket_messages` | Messages within tickets. |
| `internal_notes` | Staff-only internal notes on tickets. |
| `conversations` | Chat conversations (may be linked to tickets). |
| `messages` | Chat messages within conversations. |

### 4.11 Forum

| Table | Purpose |
|-------|---------|
| `forums` | Forum instances (may be course-linked). |
| `forum_categories` | Forum categories. |
| `forum_posts` | Posts: title, content, `is_pinned`, `is_locked`, `comments_disabled`, `view_count`, `category_id`. |
| `forum_comments` | Comments and replies on posts. |
| `forum_post_likes` | Reactions on posts (type: like, love, insightful, etc.). |
| `forum_comment_likes` | Reactions on comments. |

### 4.12 Admin / Logging / AI

| Table | Purpose |
|-------|---------|
| `notifications` | System notifications for all users. |
| `impersonation_logs` | Admin impersonation audit trail. |
| `system_logs` | Event logs (user actions, API calls, errors). |
| `log_exports` | Exported log files (CSV/PDF). |
| `log_filter_presets` | Saved log filter configurations per admin. |
| `ai_tokens` | AI API tokens: name, hashed token, permissions, rate limits, expiry. |
| `ai_action_logs` | AI action audit trail. |
| `ai_token_ip_tracking` | IP addresses used per AI token. |
| `api_tokens` | General API tokens. |
| `api_token_logs` | API token usage logs. |
| `assessor_student_activity_logs` | Assessor actions on student submissions (view, download, grade). |
| `student_topic_deadlines` | Per-student per-topic/unit deadlines set by admin/tutor. |

---

## 5. Authentication and Authorization

### 5.1 JWT Authentication

**File:** `backend/middleware/auth.js`

1. Every authenticated request must include `Authorization: Bearer <token>` header.
2. The middleware verifies the token against `JWT_SECRET`.
3. If the token is in the Redis blacklist (`jwt_blacklist:<token>`) it is rejected.
4. On success, `req.user` is set with the decoded payload including `id`, `role_id`, `role` (resolved from `rolesMap`), `email`, `name`.
5. The `role` string is derived from `role_id` using the `rolesMap` (see Role Definitions below).

### 5.2 Role-Based Access Control (Backend)

**File:** `backend/middleware/roles.js`

The `permit(...allowedRoles)` middleware factory:
- Accepts role names (strings) and/or role IDs (numbers).
- Resolves string names to IDs using an internal `roleMap`.
- Compares `req.user.role_id` against the allowed list.
- Returns **403 Forbidden** if the user's role is not in the allowed set.

Usage example: `router.get('/managers', auth, permit('Admin'), handler)`

### 5.3 Frontend Route Protection

**File:** `app/components/ProtectedRoute.tsx`

- Wraps dashboard pages with `allowedRoles` array check.
- Compares `userRole` (from localStorage) against allowed roles.
- Shows "Access Denied" if role does not match.
- Shows loading spinner while auth state is resolving.

### 5.4 Login Flow

**File:** `app/page.tsx`

1. User submits email/password to `POST /api/login`.
2. Backend verifies credentials, returns JWT + user object.
3. Token and user are saved to localStorage.
4. Frontend redirects based on role:

| Role | Redirect Target |
|------|----------------|
| Admin | `/dashboard/admin` |
| Assessor | `/dashboard/tutor` |
| Manager | `/dashboard/manager` |
| Student / ManagerStudent / InstituteStudent | Onboarding check, then `/dashboard/student` |
| Moderator | `/dashboard/moderator` |
| Certificate Manager | `/dashboard/certificate-manager` |
| Claim Manager | `/dashboard/claim-manager` |
| Consultation Manager | `/dashboard/consultation-manager` |
| Operation Manager / Accounts Manager / Administrative Manager / Admission Manager / Team Member | `/dashboard/tickets` |

### 5.5 Dashboard Redirect Hub

**File:** `app/dashboard/page.tsx`

If a user navigates to `/dashboard` directly, they are redirected based on the same role mapping above (read from localStorage).

---

## 6. Role Definitions

**Canonical source:** `backend/middleware/auth.js` `rolesMap`

| Role ID | Role Name | Dashboard URL | Description |
|---------|-----------|---------------|-------------|
| 1 | Admin | `/dashboard/admin` | Full system administrator |
| 2 | Assessor | `/dashboard/tutor` | Tutor/assessor who manages courses and grades students |
| 3 | Manager | `/dashboard/manager` | Oversees staff (assessors) and their students |
| 4 | Student | `/dashboard/student` | Learner enrolled in CPD and/or qualification courses |
| 5 | Moderator | `/dashboard/moderator` | Forum moderator |
| 6 | Operation Manager | `/dashboard/tickets` | Operations staff with full ticket/department access |
| 7 | Accounts Manager | `/dashboard/tickets` | Finance/payments staff |
| 8 | Administrative Manager | `/dashboard/tickets` | Administrative support staff |
| 9 | Admission Manager | `/dashboard/tickets` | Admissions staff |
| 10 | Team Member | `/dashboard/tickets` | General support team member |
| 11 | Certificate Manager | `/dashboard/certificate-manager` | Manages certificate claims, templates, and generation |
| 12 | Claim Manager | `/dashboard/claim-manager` | Manages qualification completion claims |
| 13 | ManagerStudent | `/dashboard/student` | Student linked to a Manager (same student experience) |
| 14 | InstituteStudent | `/dashboard/student` | Institute-linked student (same student experience) |
| 15 | Consultation Manager | `/dashboard/consultation-manager` | Manages consultation slots and bookings |

---

## 7. Role 1 -- Admin

**Role ID:** 1
**Dashboard:** `/dashboard/admin`
**Backend route files:** `backend/routes/admin.js`, `backend/routes/onboarding.js`, `backend/routes/logs.js`, `backend/routes/ai-security.js`, `backend/routes/paymentInstallments.js`, `backend/routes/paymentReminders.js` (partial), `backend/routes/certificates.js`, `backend/routes/certificateTemplates.js`, `backend/routes/consultations.js`, `backend/routes/consultationManager.js`, `backend/routes/claimManager.js`, `backend/routes/forum.js`, `backend/routes/tickets.js`, `backend/routes/documentVerification.js`
**Frontend pages:** `app/dashboard/admin/`

### 7.1 Capabilities

The Admin has unrestricted access to the entire system. Key capabilities:

- **User Management:** Create, update, delete users of any role. Assign managers, tutors, and learner IDs.
- **Impersonation:** Log in as any user to see their experience. Start/stop impersonation with full audit trail.
- **GDPR Erasure:** Anonymize user data (name, email, profile, assessment, documents) for compliance.
- **Course Management:** Create, update, delete both CPD and qualification courses. Upload Moodle `.mbz` packages. Backup/restore courses as JSON.
- **Content Management:** Manage units, resources, intro files, assignments, quizzes, topics, lectures, readings, assignment briefs for all course types.
- **Enrollment Management:** Enroll/unenroll students in courses. Set per-student topic and unit deadlines. Manually unlock units.
- **Student Verification:** View student onboarding profiles. Verify students and grant dashboard access. Review/approve/reject onboarding documents.
- **Payment Administration:** View all payment stats, installment lists, per-student installments. Update installment statuses.
- **Certificate Administration:** Manage certificate pricing, templates, claims. Generate certificates. Set registration numbers. Deliver certificates.
- **System Logs:** View, filter, export (CSV/PDF), and delete system event logs. Manage filter presets. View active online users.
- **AI Token Management:** Create, view, revoke, delete AI API tokens. View token usage logs and security reports.
- **AI Security:** Run security patches, view security reports, monitor token usage anomalies.
- **Forum Administration:** Create, edit, delete any post or comment. Pin/lock posts. Toggle comments.
- **Ticket System:** Access all tickets across all departments. Create, claim, reassign, transfer, escalate tickets.
- **Consultation Management:** Create/delete slots, view/cancel bookings, manage consultation settings, view team.
- **Assessor Reports:** View assessor-student activity reports, summaries, and unified logs.

### 7.2 API Endpoints

#### User Management (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | Paginated user list with roles |
| POST | `/api/admin/users` | Create user |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| DELETE | `/api/admin/gdpr/erasure/:userId` | GDPR anonymization |
| GET | `/api/admin/roles` | List all roles |
| GET | `/api/admin/managers` | List managers for dropdowns |
| GET | `/api/admin/tutors` | List assessors |

#### Impersonation (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/impersonate/:userId` | Start impersonation |
| POST | `/api/admin/stop-impersonate` | End impersonation |
| GET | `/api/admin/impersonation-logs` | Paginated impersonation history |

#### Course Management (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/courses` | List all courses |
| GET | `/api/admin/courses/:id/detail` | Course detail |
| GET | `/api/admin/courses/:id/outline` | Course outline with units and quizzes |
| POST | `/api/admin/courses` | Create course |
| PUT | `/api/admin/courses/:id` | Update course |
| DELETE | `/api/admin/courses/:id` | Delete course (cascade) |
| POST | `/api/admin/courses/upload` | Upload course file |
| GET | `/api/admin/courses/:id/files` | List course files |
| POST | `/api/admin/courses/backup` | Backup courses to JSON |
| POST | `/api/admin/courses/restore` | Restore from `.mbz` or JSON |
| GET | `/api/admin/course-categories` | List categories |
| POST | `/api/admin/course-categories` | Create category |
| DELETE | `/api/admin/course-categories/:id` | Delete category |
| GET | `/api/admin/sub-categories` | List all sub-categories |
| GET | `/api/admin/sub-categories/:categoryId` | Sub-categories for parent |
| POST | `/api/admin/sub-categories` | Create sub-category |
| DELETE | `/api/admin/sub-categories/:id` | Delete sub-category |

#### Units and Resources (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/courses/:id/units` | Create unit |
| PUT | `/api/admin/units/:id` | Update unit |
| DELETE | `/api/admin/units/:id` | Delete unit |
| POST | `/api/admin/units/:unitId/resources` | Upload resource |
| PUT | `/api/admin/resources/:id` | Update resource |
| DELETE | `/api/admin/resources/:id` | Delete resource |
| POST | `/api/admin/courses/:courseId/intro-files` | Upload intro file |
| GET | `/api/admin/courses/:courseId/intro-files` | List intro files |
| DELETE | `/api/admin/courses/intro-files/:fileId` | Delete intro file |
| POST | `/api/admin/students/:studentId/courses/:courseId/units/:unitId/unlock` | Manual unit unlock |

#### Enrollment (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/students` | List all students |
| GET | `/api/admin/courses/:courseId/enrollments` | Course enrollments |
| POST | `/api/admin/enrollments` | Enroll students |
| DELETE | `/api/admin/enrollments/:courseId/:studentId` | Unenroll student |
| POST | `/api/admin/enrollments/:courseId/:studentId/deadlines` | Set deadlines |
| GET | `/api/admin/enrollments/:courseId/:studentId/deadlines` | Get deadlines |

#### Assignments and Quizzes (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/assignments` | List assignments |
| POST | `/api/admin/assignments` | Create assignment |
| PUT | `/api/admin/assignments/:id` | Update assignment |
| DELETE | `/api/admin/assignments/:id` | Delete assignment |
| POST | `/api/admin/assignments/:id/submit` | Submit assignment |
| GET | `/api/admin/all-assignment-submissions` | All submissions (admin-only) |
| GET | `/api/admin/quizzes` | List quizzes |
| POST | `/api/admin/quizzes` | Create quiz |
| GET | `/api/admin/quizzes/:id` | Get quiz with questions |
| PUT | `/api/admin/quizzes/:id` | Update quiz |
| DELETE | `/api/admin/quizzes/:id` | Delete quiz |
| POST | `/api/admin/quizzes/:id/attempt` | Submit quiz attempt |
| POST | `/api/admin/courses/:id/quizzes/import-gift` | Import GIFT format quiz |
| GET | `/api/admin/all-quiz-attempts` | All quiz attempts (admin-only) |

#### Student Profiles and Onboarding (`/api/admin`, `/api/onboarding`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/students/profiles` | Student profiles with onboarding status |
| GET | `/api/admin/students/:studentId/profile` | Single student profile |
| GET | `/api/onboarding/admin/student/:id` | Full onboarding details for student |
| PUT | `/api/onboarding/admin/verify/:id` | Verify student and grant dashboard access |

#### Dashboard Stats (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics (user counts, course counts) |
| GET | `/api/admin/forums` | Forum summary |
| GET | `/api/admin/certificates` | Certificate records |
| POST | `/api/admin/certificates` | Issue certificate |
| GET | `/api/admin/proxy-pdf` | Stream PDF from Cloudinary URL |

#### AI Tokens (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/ai-tokens` | List AI tokens |
| POST | `/api/admin/ai-tokens` | Create AI token |
| GET | `/api/admin/ai-tokens/:id` | Token detail |
| PUT | `/api/admin/ai-tokens/:id/revoke` | Revoke token |
| GET | `/api/admin/ai-tokens/:id/logs` | Token usage logs |
| GET | `/api/admin/ai-tokens/:id/security` | Token security summary |
| DELETE | `/api/admin/ai-tokens/:id` | Delete token |

#### System Logs (`/api/admin/logs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/logs` | Paginated system logs with filters; supports `format=csv` and `format=pdf` |
| DELETE | `/api/admin/logs` | Delete logs (with optional filters) |
| POST | `/api/admin/logs/presets` | Save filter preset |
| GET | `/api/admin/logs/presets` | List filter presets |
| DELETE | `/api/admin/logs/presets/:id` | Delete preset |
| GET | `/api/admin/logs/exports` | Export history |
| GET | `/api/admin/logs/active-users` | Currently online users |

#### AI Security (`/api/admin/ai-security`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/ai-security/run-patch` | Run security patches |
| GET | `/api/admin/ai-security/report` | Security report |
| GET | `/api/admin/ai-security/monitor` | Token usage anomaly monitor |

#### Assessor Reports (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/assessor-student-reports` | Assessor activity logs |
| GET | `/api/admin/assessor-student-summary` | Activity summary for assessor+student |
| GET | `/api/admin/assessor-student-unified-logs` | Merged system + assessor logs |

#### Payments (Admin access via `/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/enrollments/:courseId/:studentId/installments` | Enrollment installments |
| POST | `/api/admin/enrollments/:courseId/:studentId/installments` | Save installment plan |
| PATCH | `/api/admin/installments/:installmentId/status` | Update installment status |
| GET | `/api/admin/payments/stats` | Payment statistics |
| GET | `/api/admin/payments` | All payments (paginated) |
| GET | `/api/admin/students/:studentId/installments` | Student's installments |

### 7.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Main Dashboard | `app/dashboard/admin/page.tsx` | Tabs: overview, users, courses, students, payments, assignments, quizzes, certificates, AI tokens |
| Student Profile | `app/dashboard/admin/students/[studentId]/page.tsx` | Student detail with onboarding verification |
| Course Detail | `app/dashboard/admin/courses/[id]/page.tsx` | Course management |
| Moodle Import | `app/dashboard/admin/import-moodle/page.tsx` | Import `.mbz` packages |
| Consultations | `app/dashboard/admin/consultations/page.tsx` | Consultation management |
| CPD Create | `app/dashboard/admin/cpd/create/page.tsx` | Create CPD course |
| CPD View | `app/dashboard/admin/cpd/[courseId]/view/page.tsx` | View CPD course |
| CPD Manage | `app/dashboard/admin/cpd/[courseId]/manage/page.tsx` | Manage CPD course content |
| Qualification Create | `app/dashboard/admin/qualification/create/page.tsx` | Create qualification course |
| Qualification View | `app/dashboard/admin/qualification/[courseId]/view/page.tsx` | View qualification course |
| Qualification Manage | `app/dashboard/admin/qualification/[courseId]/manage/page.tsx` | Manage qualification content |
| Unit View | `app/dashboard/admin/qualification/units/[unitId]/view/page.tsx` | View qualification unit |
| Unit Edit | `app/dashboard/admin/qualification/units/[unitId]/edit/page.tsx` | Edit qualification unit |
| Enrollment Setup | `app/dashboard/admin/enrollments/[courseId]/[studentId]/setup/page.tsx` | Post-enrollment deadline setup |

### 7.4 Database Tables Read/Written

`users`, `roles`, `student_profiles`, `staff_profiles`, `courses`, `course_categories`, `sub_categories`, `course_assignments`, `units`, `unit_progress`, `resources`, `course_files`, `course_intro_files`, `assignments`, `assignment_submissions`, `quizzes`, `quiz_questions`, `quiz_submissions`, `student_onboarding_status`, `student_course_selections`, `student_qualification_selections`, `student_documents`, `student_initial_assessments`, `student_payment_installments`, `payment_audit_log`, `impersonation_logs`, `system_logs`, `log_exports`, `log_filter_presets`, `ai_tokens`, `ai_action_logs`, `ai_token_ip_tracking`, `notifications`, `certificates`, `student_topic_deadlines`, `assessor_student_activity_logs`, `cpd_topics`, `cpd_topic_files`, `cpd_quizzes`, `qual_course_content`, `qual_unit_content`, `qual_submissions`, `assignment_submission_files`, `qual_unit_progress`, `consultation_slots`, `consultation_bookings`, `consultation_manager_settings`, `departments`, `tickets`, `ticket_messages`, `internal_notes`, `forums`, `forum_posts`, `forum_comments`

---

## 8. Role 2 -- Assessor

**Role ID:** 2
**Dashboard:** `/dashboard/tutor`
**Backend route files:** `backend/routes/admin.js` (tutor-prefixed routes + shared routes), `backend/routes/admin.js` (`tutorRouter`), `backend/routes/qualification.js`, `backend/routes/cpd.js`, `backend/routes/courses.js`, `backend/routes/paymentInstallments.js`, `backend/routes/staffProfile.js`, `backend/routes/tickets.js`, `backend/routes/forum.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`, `backend/routes/certificates.js`
**Frontend pages:** `app/dashboard/tutor/`

### 8.1 Capabilities

- **Course Creation and Management:** Create and manage both CPD and qualification courses. Full CRUD on topics, units, quizzes, assignments, lectures, readings, assignment briefs, files.
- **Student Enrollment:** Enroll and unenroll students. Set per-student deadlines. Manually unlock units.
- **Assignment Grading:** Grade regular and qualification assignment submissions. Provide feedback. Reject and request resubmission of files.
- **Submission Review:** View all submissions for assigned students. View pending submissions. Track file view/download/close times.
- **Sub-Tutor Team Management:** View sub-tutors under their hierarchy. Monitor team progress, grading stats, and feedback. Drill into sub-tutor student details.
- **Student Profiles:** View profiles of assigned students with onboarding and assessment data.
- **Payments (Tutor-scoped):** View installments for students in courses the assessor created. Update installment statuses.
- **Certificate Claims:** Process certificate claims via the claims management UI.
- **CPD Quiz Management:** Import GIFT quizzes, create/update/delete quizzes and questions, view attempt results.
- **Tickets:** Access tickets in the Academic department (department 1). Submit messages and internal notes.
- **Forum:** Create posts, comment, react. Cannot pin/lock/delete others' content (moderator-only).
- **Chat:** Full chat access.
- **Staff Profile:** Manage own staff profile and picture.

### 8.2 API Endpoints

#### Tutor-Specific (`/api/tutor`, `/api/admin/tutor/:tutorId`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tutor/students/profiles` | Student profiles for assessor's assigned students |
| GET | `/api/tutor/students/:studentId/profile` | Single student profile |
| GET | `/api/tutor/payments` | Installments for courses created by assessor |
| GET | `/api/admin/tutor/:tutorId/sub-tutors` | Sub-tutor list with stats |
| GET | `/api/admin/tutor/:tutorId/team-progress` | Team grading/feedback progress |
| GET | `/api/admin/tutor/:tutorId/students/:subTutorId` | Students under a sub-tutor |
| GET | `/api/admin/tutor/:tutorId/sub-tutor-details/:subTutorId/:statType` | Drill-down by stat type |
| GET | `/api/admin/tutor/:tutorId/sub-tutor-all-submissions/:subTutorId` | All submissions for sub-tutor |
| GET | `/api/admin/tutor/:tutorId/my-students-submissions` | All submissions for own students |
| GET | `/api/admin/tutor/:tutorId/courses` | Course list |
| GET | `/api/admin/tutor/:tutorId/courses/:courseId/enrollments` | Enrollments for course |
| GET | `/api/admin/tutor/:tutorId/assignments` | Assignments with stats |
| GET | `/api/admin/tutor/:tutorId/quizzes` | Quizzes with stats |
| GET | `/api/admin/tutor/:tutorId/assignment-submissions` | Assignment submissions (filtered to own students) |
| GET | `/api/admin/tutor/:tutorId/quiz-attempts` | Quiz attempts |

#### Qualification Content Management (`/api/qualification`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/qualification/create` | Create qualification course |
| POST | `/api/qualification/:courseId/units` | Create unit |
| PUT | `/api/qualification/units/reorder` | Reorder units |
| DELETE | `/api/qualification/units/:unitId` | Delete unit |
| POST | `/api/qualification/units/:unitId/topics` | Add topic |
| POST | `/api/qualification/units/:unitId/lectures` | Add lecture |
| DELETE | `/api/qualification/units/:unitId/lectures/:lectureId` | Delete lecture |
| PUT | `/api/qualification/units/:unitId/lectures/:lectureId/files` | Update lecture files |
| POST | `/api/qualification/units/:unitId/readings` | Add reading |
| DELETE | `/api/qualification/units/:unitId/readings/:readingId` | Delete reading |
| POST | `/api/qualification/units/:unitId/assignment-brief` | Create/update assignment brief |
| POST | `/api/qualification/units/:unitId/assignment-brief/files` | Add brief files |
| DELETE | `/api/qualification/units/:unitId/assignment-brief/files/:fileId` | Delete brief file |
| GET | `/api/qualification/submissions/all` | All submissions (filtered to assigned students for assessors) |
| GET | `/api/qualification/submissions/pending` | Pending submissions |
| POST | `/api/qualification/submissions/:submissionId/grade` | Grade submission |
| PUT | `/api/qualification/submissions/:submissionId/feedback` | Update feedback |
| POST | `/api/qualification/files/:fileId/reject` | Reject submission file |
| POST | `/api/qualification/files/:fileId/mark-viewed` | Mark file viewed |
| POST | `/api/qualification/files/:fileId/mark-downloaded` | Mark file downloaded |
| POST | `/api/qualification/files/:fileId/mark-closed` | Log view duration |
| PUT | `/api/qualification/:courseId/rule-level-3` | Update Rule Level 3 settings |

#### CPD Content Management (`/api/cpd`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cpd/create` | Create CPD course |
| POST | `/api/cpd/:courseId/topics` | Add topic |
| PUT | `/api/cpd/topics/:topicId` | Update topic |
| DELETE | `/api/cpd/topics/:topicId` | Delete topic |
| PUT | `/api/cpd/topics/reorder` | Reorder topics |
| PUT | `/api/cpd/topics/:topicId/deadline` | Set topic deadline |
| POST | `/api/cpd/topics/:topicId/upload-files` | Upload topic files |
| PUT | `/api/cpd/files/:fileId/replace` | Replace topic file |
| DELETE | `/api/cpd/files/:fileId` | Delete topic file |
| POST | `/api/cpd/topics/:topicId/quizzes/import-gift` | Import GIFT quiz |
| POST | `/api/cpd/topics/:topicId/quizzes` | Create quiz |
| PUT | `/api/cpd/quizzes/:quizId` | Update quiz |
| DELETE | `/api/cpd/quizzes/:quizId` | Delete quiz |
| PUT | `/api/cpd/quizzes/:quizId/passing-score` | Update passing score |
| PUT | `/api/cpd/quizzes/:quizId/update-gift` | Replace questions from GIFT |
| POST | `/api/cpd/quizzes/:quizId/questions` | Add question |
| DELETE | `/api/cpd/questions/:questionId` | Delete question |

#### Shared Admin Routes (enrollment, content, etc.)

The assessor also uses many `/api/admin/` routes that require only `auth` (no `permit('Admin')`), including enrollment CRUD, course management, unit/resource management, assignments, and quizzes.

### 8.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Main Dashboard | `app/dashboard/tutor/page.tsx` | Course management, enrollments, student profiles, grading, team views |
| Course Detail | `app/dashboard/tutor/courses/[id]/page.tsx` | Course management |
| CPD Create | `app/dashboard/tutor/cpd/create/page.tsx` | Create CPD course |
| CPD Manage | `app/dashboard/tutor/cpd/[courseId]/manage/page.tsx` | Manage CPD content |
| CPD View | `app/dashboard/tutor/cpd/[courseId]/view/page.tsx` | View CPD course |
| Qualification Create | `app/dashboard/tutor/qualification/create/page.tsx` | Create qualification |
| Qualification Manage | `app/dashboard/tutor/qualification/[courseId]/manage/page.tsx` | Manage qualification |
| Qualification View | `app/dashboard/tutor/qualification/[courseId]/view/page.tsx` | View qualification |
| Unit View | `app/dashboard/tutor/qualification/units/[unitId]/view/page.tsx` | View unit |
| Unit Edit | `app/dashboard/tutor/qualification/units/[unitId]/edit/page.tsx` | Edit unit |
| Enrollment Setup | `app/dashboard/tutor/enrollments/[courseId]/[studentId]/setup/page.tsx` | Deadline setup |
| Student Profile | `app/dashboard/tutor/students/[studentId]/page.tsx` | Student detail |
| Team Today | `app/dashboard/tutor/team/today/[subTutorId]/page.tsx` | Today's team activity |
| Team Pending | `app/dashboard/tutor/team/pending/[subTutorId]/page.tsx` | Pending submissions |
| Team All | `app/dashboard/tutor/team/all/[subTutorId]/page.tsx` | All submissions |
| Team Feedback | `app/dashboard/tutor/team/feedback/[subTutorId]/page.tsx` | Feedback history |

### 8.4 Database Tables Read/Written

`users`, `courses`, `course_categories`, `sub_categories`, `course_assignments`, `units`, `unit_progress`, `resources`, `course_files`, `assignments`, `assignment_submissions`, `quizzes`, `quiz_questions`, `quiz_submissions`, `student_profiles`, `student_initial_assessments`, `student_payment_installments`, `qual_course_content`, `qual_course_files`, `qual_unit_content`, `qual_unit_announcements`, `qual_additional_readings`, `qual_assignment_briefs`, `qual_assignment_brief_files`, `qual_presentation_briefs`, `qual_unit_quizzes`, `qual_quiz_questions`, `qual_unit_videos`, `qual_topics`, `qual_topic_files`, `qual_submissions`, `assignment_submission_files`, `qual_unit_progress`, `cpd_topics`, `cpd_topic_sections`, `cpd_topic_files`, `cpd_quizzes`, `cpd_quiz_questions`, `cpd_quiz_options`, `cpd_quiz_attempts`, `cpd_certificates`, `cpd_progress`, `student_topic_deadlines`, `assessor_student_activity_logs`, `notifications`, `certificate_claims`, `generated_certificates`, `staff_profiles`, `tickets`, `ticket_messages`, `internal_notes`

---

## 9. Role 3 -- Manager

**Role ID:** 3
**Dashboard:** `/dashboard/manager`
**Backend route files:** `backend/routes/manager.js`, `backend/routes/tickets.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/manager/`

### 9.1 Capabilities

- **Staff Overview:** View assessor staff members under this manager with student counts.
- **Student Oversight:** View students assigned directly via `manager_id` or indirectly via subordinate assessors.
- **Progress Tracking:** View per-student course and unit progress for any student in the manager's hierarchy.
- **Tickets:** Access tickets scoped to the manager's effective department.
- **Chat:** Full chat access.
- **Notifications:** Standard notification access.

### 9.2 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/manager/students` | Students with `manager_id` = current user |
| GET | `/api/manager/staff` | Assessor staff under this manager |
| GET | `/api/manager/staff/:staffId/students` | Students under a specific staff member |
| GET | `/api/manager/students/:studentId/progress` | Student course/unit progress |

### 9.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Main Dashboard | `app/dashboard/manager/page.tsx` | Staff tree, student lists, progress views |

### 9.4 Database Tables Read

`users`, `courses`, `course_assignments`, `units`, `unit_progress`, `qual_unit_progress`

---

## 10. Role 4 -- Student

**Role ID:** 4
**Dashboard:** `/dashboard/student`
**Backend route files:** `backend/routes/student.js`, `backend/routes/studentProfile.js`, `backend/routes/onboarding.js`, `backend/routes/courses.js`, `backend/routes/cpd.js`, `backend/routes/qualification.js`, `backend/routes/paymentInstallments.js`, `backend/routes/paymentReminders.js`, `backend/routes/consultations.js`, `backend/routes/certificates.js`, `backend/routes/documentVerification.js`, `backend/routes/forum.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/student/`, `app/onboarding/`

### 10.1 Capabilities

- **Onboarding:** Complete multi-step onboarding wizard (welcome, course selection, qualification level, documents, initial assessment, VARK assessment, verification pending).
- **Qualification Upgrade:** If initially CPD-only and later enrolled in qualification, complete additional onboarding steps.
- **Profile Management:** Update personal profile, upload profile picture, complete VARK learning style assessment, track profile completion percentage.
- **Data Export:** GDPR-compliant personal data export.
- **Regular Courses:** View enrolled courses, browse units, complete units, submit assignments, take quizzes.
- **CPD Courses:** View enrolled CPD courses, progress through topics, take practice and final quizzes, claim CPD certificates upon completion.
- **Qualification Courses:** View enrolled qualification courses, browse units and content, submit assignments and presentations, select Rule Level 3 units, resubmit rejected files, take unit quizzes, view grades and feedback.
- **Certificates:** Claim CPD and qualification certificates, pay for certificates via Stripe, view delivery status, download delivered certificates.
- **Consultations:** Browse available consultation slots, book consultations (max 2 future bookings), cancel bookings (24h+ before), view own bookings.
- **Payments:** View installment plans, make payments via Stripe, confirm payments.
- **Forum:** Create posts, comment, react. Cannot moderate.
- **Chat:** Full chat access with tutors and staff.
- **Notifications:** View, mark read, delete notifications.
- **Activity Logging:** Course/unit/file view actions are logged for compliance.
- **Document Resubmission:** Replace rejected onboarding documents.

### 10.2 API Endpoints

#### Onboarding (`/api/onboarding`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/onboarding/status` | Current onboarding status and enrollment type |
| PUT | `/api/onboarding/status` | Update onboarding step flags |
| POST | `/api/onboarding/course-selection` | Save CPD/qualification selection |
| GET | `/api/onboarding/course-selection` | Read selection |
| POST | `/api/onboarding/qualification-level` | Save qualification level |
| GET | `/api/onboarding/qualification-level` | Read qualification level |
| POST | `/api/onboarding/documents/upload` | Upload onboarding document |
| GET | `/api/onboarding/documents` | List own documents |
| DELETE | `/api/onboarding/documents/:id` | Delete own document |
| POST | `/api/onboarding/initial-assessment` | Submit initial assessment |
| GET | `/api/onboarding/initial-assessment` | Read assessment |
| GET | `/api/onboarding/me` | Aggregated onboarding data |
| POST | `/api/onboarding/auto-setup` | Auto-configure from enrollments |
| GET | `/api/onboarding/qualification-upgrade-needed` | Check if upgrade needed |
| POST | `/api/onboarding/start-qualification-upgrade` | Start upgrade process |

#### Profile (`/api/student`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/student/profile` | Full profile with assessment data |
| PUT | `/api/student/profile` | Update profile |
| POST | `/api/student/profile/picture` | Upload profile picture |
| GET | `/api/student/profile/status` | Profile completion status |
| GET | `/api/student/profile/completion` | Completion percentage and missing fields |
| GET | `/api/student/profile/export` | GDPR data export |
| GET | `/api/student/profile/vark-questions` | VARK question set |
| POST | `/api/student/profile/vark-assessment` | Submit VARK assessment |

#### Courses and Progress (`/api/student`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/student/:id/courses` | Enrolled regular courses |
| GET | `/api/student/:id/cpd-courses` | Enrolled CPD courses with progress |
| GET | `/api/student/:id/qualification-courses` | Enrolled qualification courses |
| GET | `/api/student/:id/courses/:courseId/units` | Units with progress for course |
| POST | `/api/student/:id/courses/:courseId/units/:unitId/complete` | Mark unit complete |
| GET | `/api/student/:id/assignments` | Assignments with submissions |
| GET | `/api/student/:id/grades` | Qualification submission grades |
| GET | `/api/student/:id/tutors` | Assigned tutors |
| POST | `/api/student/activity-log` | Log course/unit/file view |

#### CPD (`/api/cpd`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cpd/:courseId/student/:studentId` | Full CPD course for student |
| GET | `/api/cpd/quizzes/:quizId` | Quiz for taking |
| POST | `/api/cpd/quizzes/:quizId/submit` | Submit quiz answers |
| GET | `/api/cpd/quizzes/:quizId/latest-attempt/:studentId` | Latest attempt with feedback |
| POST | `/api/cpd/:courseId/claim-certificate/:studentId` | Claim CPD certificate |
| GET | `/api/cpd/download-file` | Download course file |
| GET | `/api/cpd/proxy-pdf` | View PDF inline |

#### Qualification (`/api/qualification`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/qualification/:courseId` | Course detail and content |
| GET | `/api/qualification/units/:unitId` | Unit detail with progress tracking |
| POST | `/api/qualification/units/:unitId/submit` | Submit assignment/presentation |
| GET | `/api/qualification/units/:unitId/submissions` | Own submissions for unit |
| GET | `/api/qualification/submissions/:submissionId/unit` | Unit for a submission |
| POST | `/api/qualification/units/:unitId/quiz/attempt` | Take unit quiz |
| GET | `/api/qualification/:courseId/progress/:studentId` | Progress for course |
| GET | `/api/qualification/:courseId/selected-units` | Rule Level 3 selections |
| POST | `/api/qualification/:courseId/select-units` | Save unit selections |
| POST | `/api/qualification/files/:fileId/resubmit` | Resubmit rejected file |
| GET | `/api/qualification/download-file` | Download file |
| GET | `/api/qualification/proxy-pdf` | View PDF |

#### Payments (`/api`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/student/installments` | Own installment plans |
| POST | `/api/installments/:installmentId/pay` | Create Stripe payment |
| POST | `/api/installments/:installmentId/confirm` | Confirm payment |
| GET | `/api/student/notifications` | Payment notifications |
| PATCH | `/api/student/notifications/:id/read` | Mark notification read |

#### Certificates (`/api/certificates`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/certificates/my-claims` | Own certificate claims |
| POST | `/api/certificates/claim/cpd` | Claim CPD certificate |
| POST | `/api/certificates/claim/qualification` | Claim qualification certificate |
| POST | `/api/certificates/payment/create-intent` | Stripe payment for certificate |
| POST | `/api/certificates/payment/confirm` | Confirm certificate payment |
| GET | `/api/certificates/my-delivered` | Delivered certificates |
| GET | `/api/certificates/download/:id/:type` | Download certificate PDF |

#### Consultations (`/api/consultations`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/consultations/slots/available` | Available slots |
| POST | `/api/consultations/book/:slotId` | Book consultation |
| GET | `/api/consultations/my-bookings` | Own bookings |
| DELETE | `/api/consultations/my-bookings/:bookingId` | Cancel booking (24h+ before) |

#### Documents (`/api/documents`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents/my-documents` | Own documents with approval status |
| POST | `/api/documents/replace/:documentId` | Replace rejected document |
| DELETE | `/api/documents/:documentId` | Delete rejected document |
| GET | `/api/documents/:documentId/history` | Document verification history |

### 10.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Main Dashboard | `app/dashboard/student/page.tsx` | Courses, assignments, deadlines, tutors, consultations, payments, verification status |
| Profile | `app/dashboard/student/profile/page.tsx` | Profile edit, VARK, completion, GDPR export, installments |
| Grades | `app/dashboard/student/grades/page.tsx` | Qualification grades and feedback |
| Certificates | `app/dashboard/student/certificates/page.tsx` | Certificate claims, delivery, downloads |
| Consultations | `app/dashboard/student/consultations/page.tsx` | Book/list/cancel consultations |
| Course Router | `app/dashboard/student/courses/[id]/page.tsx` | Resolves course type and redirects |
| CPD Course | `app/dashboard/student/cpd/[courseId]/page.tsx` | CPD topic list, quizzes, progress |
| CPD View | `app/dashboard/student/cpd/[courseId]/view/page.tsx` | CPD course view |
| CPD Quiz | `app/dashboard/student/cpd/[courseId]/quiz/[quizId]/page.tsx` | Take CPD quiz |
| CPD Certificate Claim | `app/dashboard/student/cpd/[courseId]/claim-certificate/page.tsx` | Claim CPD certificate |
| Qualification View | `app/dashboard/student/qualification/[courseId]/view/page.tsx` | Qualification unit browser |
| Qualification Certificate | `app/dashboard/student/qualification/[courseId]/claim-certificate/page.tsx` | Claim qualification certificate |

#### Onboarding Pages

| Page | Path | Purpose |
|------|------|---------|
| Welcome | `app/onboarding/welcome/page.tsx` | Welcome screen, auto-detect enrollment |
| Course Selection | `app/onboarding/course-selection/page.tsx` | CPD vs qualification selection |
| Qualification Level | `app/onboarding/qualification-level/page.tsx` | Choose qualification level |
| Documents | `app/onboarding/documents/page.tsx` | Upload identity/CV/qualification documents |
| Initial Assessment | `app/onboarding/initial-assessment/page.tsx` | Personal info, consents, e-signature |
| VARK Assessment | `app/onboarding/vark-assessment/page.tsx` | Learning style assessment |
| Verification Pending | `app/onboarding/verification-pending/page.tsx` | Wait for admin verification |
| Resubmit | `app/onboarding/resubmit/page.tsx` | Replace rejected documents |

### 10.4 Database Tables Read/Written

`users`, `student_profiles`, `student_onboarding_status`, `student_course_selections`, `student_qualification_selections`, `student_documents`, `student_initial_assessments`, `courses`, `course_assignments`, `units`, `unit_progress`, `resources`, `assignments`, `assignment_submissions`, `quizzes`, `quiz_questions`, `quiz_submissions`, `cpd_topics`, `cpd_topic_sections`, `cpd_topic_files`, `cpd_progress`, `cpd_quizzes`, `cpd_quiz_questions`, `cpd_quiz_options`, `cpd_quiz_attempts`, `cpd_certificates`, `qual_course_content`, `qual_course_files`, `qual_unit_content`, `qual_unit_announcements`, `qual_additional_readings`, `qual_assignment_briefs`, `qual_assignment_brief_files`, `qual_unit_quizzes`, `qual_quiz_questions`, `qual_topics`, `qual_topic_files`, `qual_submissions`, `assignment_submission_files`, `qual_unit_progress`, `qual_student_selected_units`, `student_payment_installments`, `student_notifications`, `certificate_claims`, `consultation_bookings`, `consultation_slots`, `notifications`, `forums`, `forum_posts`, `forum_comments`, `forum_post_likes`, `forum_comment_likes`, `conversations`, `messages`, `student_topic_deadlines`, `system_logs`

---

## 11. Role 5 -- Moderator

**Role ID:** 5
**Dashboard:** `/dashboard/moderator`
**Backend route files:** `backend/routes/forum.js`, `backend/routes/tickets.js`, `backend/routes/staffProfile.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/moderator/`

### 11.1 Capabilities

- **Forum Moderation:** Pin/unpin posts, lock/unlock posts, enable/disable comments on posts, delete any post or comment, edit any post or comment.
- **Forum Participation:** Create posts, comment, react.
- **Tickets:** Access tickets scoped to effective department.
- **Staff Profile:** Manage own staff profile.
- **Chat:** Full chat access.
- **Notifications:** Standard notification access.

### 11.2 API Endpoints

#### Forum Moderation (`/api/forum`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/forum/posts/:postId/pin` | Pin/unpin post (Moderator/Admin only) |
| POST | `/api/forum/posts/:postId/lock` | Lock/unlock post (Moderator/Admin only) |
| POST | `/api/forum/posts/:postId/toggle-comments` | Enable/disable comments (Moderator/Admin only) |
| DELETE | `/api/forum/posts/:postId` | Delete any post (Moderator/Admin/author) |
| DELETE | `/api/forum/comments/:commentId` | Delete any comment (Moderator/Admin/author) |
| PUT | `/api/forum/posts/:postId` | Edit any post (Moderator/Admin/author) |
| PUT | `/api/forum/comments/:commentId` | Edit any comment (Moderator/Admin/author) |

#### Forum Participation (`/api/forum`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/forum/categories` | List categories |
| GET | `/api/forum/stats` | Forum statistics |
| GET | `/api/forum/posts` | List posts |
| GET | `/api/forum/posts/:postId` | View post with comments |
| POST | `/api/forum/posts` | Create post |
| POST | `/api/forum/posts/:postId/comments` | Add comment |
| POST | `/api/forum/posts/:postId/react` | React to post |
| POST | `/api/forum/comments/:commentId/react` | React to comment |

### 11.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Main Dashboard | `app/dashboard/moderator/page.tsx` | Forum overview, categories, stats, create post |

### 11.4 Database Tables Read/Written

`forum_posts`, `forum_comments`, `forum_post_likes`, `forum_comment_likes`, `forum_categories`, `staff_profiles`, `notifications`, `tickets`, `ticket_messages`

---

## 12. Role 6 -- Operation Manager

**Role ID:** 6
**Dashboard:** `/dashboard/tickets`
**Backend route files:** `backend/routes/tickets.js`, `backend/routes/paymentInstallments.js`, `backend/routes/staffProfile.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`, `backend/routes/forum.js`
**Frontend pages:** `app/dashboard/tickets/`

### 12.1 Capabilities

- **Ticket Management (All Departments):** View, create, claim, reassign, transfer, escalate tickets across all departments.
- **Team Management:** Create team members, add/remove users from team, view team and available users.
- **Payment Full Access:** View all payment stats, all installments, per-student installments. Update installment statuses.
- **Course Views:** View total courses and course categories (ticket context).
- **Staff Profile:** Manage own staff profile.
- **Chat:** Full chat access.
- **Notifications:** Standard notification access.
- **Forum:** Participate in forum (create posts, comment, react).

### 12.2 API Endpoints

#### Tickets (`/api/tickets`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tickets/` | Create ticket |
| GET | `/api/tickets/` | List tickets (all departments) |
| GET | `/api/tickets/stats` | Ticket statistics |
| GET | `/api/tickets/:id` | View ticket detail |
| POST | `/api/tickets/:id/claim` | Claim ticket |
| PUT | `/api/tickets/:id/status` | Update status |
| PUT | `/api/tickets/:id/reassign` | Reassign ticket |
| PUT | `/api/tickets/:id/transfer` | Transfer department |
| GET | `/api/tickets/:id/escalate-agents` | Available escalation agents |
| POST | `/api/tickets/:id/escalate` | Escalate ticket |
| POST | `/api/tickets/:id/messages` | Add message |
| PUT | `/api/tickets/:id/messages/:messageId` | Edit message |
| DELETE | `/api/tickets/:id/messages/:messageId` | Delete message |
| POST | `/api/tickets/:id/mark-read` | Mark read |
| POST | `/api/tickets/:id/notes` | Add internal note |
| GET | `/api/tickets/departments` | List departments |
| GET | `/api/tickets/categories` | List categories |
| GET | `/api/tickets/agents` | List agents |
| POST | `/api/tickets/upload` | Upload attachment |
| GET | `/api/tickets/courses` | Total courses (OM + Team Member) |
| GET | `/api/tickets/course-categories` | Course categories |
| GET | `/api/tickets/student/:studentId/academic-progress` | Student progress |
| GET | `/api/tickets/student/:studentId/payment-installments` | Student payments |

#### Team Management (`/api/tickets`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets/team` | Get team |
| GET | `/api/tickets/team/available` | Available users to add |
| POST | `/api/tickets/team` | Add to team |
| POST | `/api/tickets/team/create` | Create team member |
| DELETE | `/api/tickets/team/:userId` | Remove from team |

#### Payments (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/enrollments/:courseId/:studentId/installments` | View installments |
| POST | `/api/admin/enrollments/:courseId/:studentId/installments` | Save installment plan |
| PATCH | `/api/admin/installments/:installmentId/status` | Update installment status |
| GET | `/api/admin/payments/stats` | Payment stats |
| GET | `/api/admin/payments` | All payments |
| GET | `/api/admin/students/:studentId/installments` | Student installments |

### 12.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Ticket Dashboard | `app/dashboard/tickets/page.tsx` | Ticket list, filters, stats |
| New Ticket | `app/dashboard/tickets/new/page.tsx` | Create ticket |
| Ticket Detail | `app/dashboard/tickets/[id]/page.tsx` | Ticket detail with messages |
| Chat | `app/dashboard/tickets/chat/page.tsx` | Chat interface |
| Courses | `app/dashboard/tickets/courses/page.tsx` | Course overview |
| Payments | `app/dashboard/tickets/payments/page.tsx` | Payment management |
| Team | `app/dashboard/tickets/team/page.tsx` | Team management |
| Student Detail | `app/dashboard/tickets/student/[studentId]/page.tsx` | Student info |
| Students List | `app/dashboard/tickets/students/page.tsx` | Student list |

### 12.4 Database Tables Read/Written

`tickets`, `ticket_messages`, `internal_notes`, `departments`, `users`, `student_payment_installments`, `payment_audit_log`, `courses`, `course_categories`, `staff_profiles`, `notifications`, `conversations`, `messages`

---

## 13. Role 7 -- Accounts Manager

**Role ID:** 7
**Dashboard:** `/dashboard/tickets`
**Backend route files:** `backend/routes/tickets.js`, `backend/routes/paymentInstallments.js`, `backend/routes/paymentReminders.js`, `backend/routes/staffProfile.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/tickets/`

### 13.1 Capabilities

- **Ticket Management (Finance Department):** View, create, claim, reassign, transfer, escalate tickets in Finance department (department 2). Access other tickets only if assigned/escalated.
- **Team Management:** Create team members, add/remove users, view team.
- **Payment Full Access:** View all payment stats, installments, per-student data. Update installment statuses.
- **Payment Reminders:** View pending/received payments. Send individual and bulk reminders. Manage email templates.
- **Auto-Reminder Settings:** Configure and view automatic reminder intervals and channels (Accounts Manager exclusive).
- **Reminder Logs:** View reminder sending history (Accounts Manager exclusive).
- **Student Credentials:** View student list and update student email/password (Accounts Manager exclusive in ticket context).
- **Staff Profile:** Manage own staff profile.
- **Chat:** Full chat access.
- **Notifications:** Standard access.

### 13.2 API Endpoints

#### Payment Reminders (`/api/admin`) -- Accounts Manager exclusive or shared with Team Member

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| GET | `/api/admin/payments/pending` | Pending payments with reminder data | Accounts Mgr + Team Member |
| GET | `/api/admin/payments/pending/stats` | Pending stats | Accounts Mgr + Team Member |
| GET | `/api/admin/payments/received` | Received payments | Accounts Mgr + Team Member |
| GET | `/api/admin/payments/received/stats` | Received stats | Accounts Mgr + Team Member |
| POST | `/api/admin/reminders/send` | Send single reminder | Accounts Mgr + Team Member |
| POST | `/api/admin/reminders/send-bulk` | Send bulk reminders | Accounts Mgr + Team Member |
| GET | `/api/admin/email-templates` | List email templates | Accounts Mgr + Team Member |
| POST | `/api/admin/email-templates` | Create template | Accounts Mgr + Team Member |
| PUT | `/api/admin/email-templates/:id` | Update template | Accounts Mgr + Team Member |
| DELETE | `/api/admin/email-templates/:id` | Delete template | Accounts Mgr + Team Member |
| GET | `/api/admin/reminders/logs` | Reminder logs | **Accounts Mgr only** |
| GET | `/api/admin/auto-reminder/settings` | Auto-reminder settings | **Accounts Mgr only** |
| PATCH | `/api/admin/auto-reminder/settings` | Update auto-reminder settings | **Accounts Mgr only** |

#### Student Credentials (`/api/tickets`) -- Accounts Manager exclusive

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets/students` | Student list for credential management |
| PATCH | `/api/tickets/students/:studentId` | Update student email/password |

All other ticket and payment endpoints are the same as Operation Manager (see Section 12.2).

### 13.3 Database Tables Read/Written

`tickets`, `ticket_messages`, `internal_notes`, `departments`, `users`, `student_payment_installments`, `payment_audit_log`, `payment_reminders`, `email_templates`, `student_notifications`, `auto_reminder_settings`, `staff_profiles`, `notifications`, `conversations`, `messages`

---

## 14. Role 8 -- Administrative Manager

**Role ID:** 8
**Dashboard:** `/dashboard/tickets`
**Backend route files:** `backend/routes/tickets.js`, `backend/routes/paymentInstallments.js`, `backend/routes/staffProfile.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/tickets/`

### 14.1 Capabilities

- **Ticket Management (Support Department):** View, create, claim, reassign, transfer, escalate tickets in Support department (department 3). Access other tickets if assigned/escalated.
- **Team Management:** Create team members, add/remove users, view team.
- **Payment Full Access:** View all payment stats, installments. Update installment statuses.
- **Staff Profile:** Manage own staff profile.
- **Chat:** Full chat access.
- **Notifications:** Standard access.

### 14.2 API Endpoints

Same ticket and payment endpoints as Operation Manager (Section 12.2), except:
- Default department scope is 3 (Support) instead of all departments.
- No access to payment reminder APIs (`/api/admin/payments/pending`, reminders, email templates, auto-reminder settings).
- No access to student credential management (`/api/tickets/students`).
- No access to total courses view (`/api/tickets/courses`).

### 14.3 Database Tables Read/Written

`tickets`, `ticket_messages`, `internal_notes`, `departments`, `users`, `student_payment_installments`, `payment_audit_log`, `staff_profiles`, `notifications`, `conversations`, `messages`

---

## 15. Role 9 -- Admission Manager

**Role ID:** 9
**Dashboard:** `/dashboard/tickets`
**Backend route files:** `backend/routes/tickets.js`, `backend/routes/paymentInstallments.js`, `backend/routes/documentVerification.js`, `backend/routes/staffProfile.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/tickets/`

### 15.1 Capabilities

- **Ticket Management (Admission Department):** View, create, claim, reassign, transfer, escalate tickets in Admission department (department 3). Access other tickets if assigned/escalated.
- **Team Management:** Create team members, add/remove users, view team.
- **Payment Full Access:** View all payment stats, installments. Update installment statuses.
- **Document Verification:** View student documents, approve/reject documents individually or in bulk.
- **Staff Profile:** Manage own staff profile.
- **Chat:** Full chat access.
- **Notifications:** Standard access.

### 15.2 API Endpoints

Same ticket and payment endpoints as Operation Manager (Section 12.2), plus:

#### Document Verification (`/api/documents`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents/student/:studentId` | View student documents |
| POST | `/api/documents/verify/:documentId` | Approve/reject document |
| POST | `/api/documents/verify-bulk` | Bulk approve/reject documents |

### 15.3 Database Tables Read/Written

`tickets`, `ticket_messages`, `internal_notes`, `departments`, `users`, `student_payment_installments`, `payment_audit_log`, `student_documents`, `staff_profiles`, `notifications`, `conversations`, `messages`

---

## 16. Role 10 -- Team Member

**Role ID:** 10
**Dashboard:** `/dashboard/tickets`
**Backend route files:** `backend/routes/tickets.js`, `backend/routes/paymentInstallments.js`, `backend/routes/paymentReminders.js`, `backend/routes/staffProfile.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/tickets/`

### 16.1 Capabilities

- **Ticket Access (All Departments):** View tickets across all departments (same breadth as Operation Manager). Cannot manage teams (team management requires manager roles).
- **Payment Full Access:** View all payment stats, installments. Update installment statuses.
- **Payment Reminders:** View pending/received payments. Send individual and bulk reminders. Manage email templates. (Cannot access reminder logs or auto-reminder settings -- those are Accounts Manager exclusive.)
- **Course Views:** View total courses and course categories (ticket context).
- **Staff Profile:** Manage own staff profile.
- **Chat:** Full chat access.
- **Notifications:** Standard access.

### 16.2 API Endpoints

Same ticket endpoints as Operation Manager (Section 12.2), except:
- **No team management** (`GET/POST/DELETE /api/tickets/team*` require manager roles).
- **No student credential management.**

Payment reminders: same as Accounts Manager shared endpoints (pending, received, send, email templates), but **not** reminder logs or auto-reminder settings.

### 16.3 Database Tables Read/Written

`tickets`, `ticket_messages`, `internal_notes`, `departments`, `users`, `student_payment_installments`, `payment_audit_log`, `payment_reminders`, `email_templates`, `student_notifications`, `courses`, `course_categories`, `staff_profiles`, `notifications`, `conversations`, `messages`

---

## 17. Role 11 -- Certificate Manager

**Role ID:** 11
**Dashboard:** `/dashboard/certificate-manager`
**Backend route files:** `backend/routes/certificates.js`, `backend/routes/certificateTemplates.js`, `backend/routes/paymentInstallments.js`, `backend/routes/tickets.js`, `backend/routes/onboarding.js`, `backend/routes/admin.js` (student profiles), `backend/routes/documentVerification.js`, `backend/routes/staffProfile.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/certificate-manager/`

### 17.1 Capabilities

- **Certificate Claims Management:** View all certificate claims. Update claim status, delivery status, tracking numbers. Process CPD and qualification claims.
- **Certificate Generation:** Trigger certificate generation. Set registration numbers. Deliver certificates (individual and bulk). Manage DOCX files (download, upload, reconvert).
- **Certificate Templates:** Upload, update, delete certificate DOCX templates. Manage active templates per course type.
- **Certificate Pricing:** View and update certificate pricing per level and type.
- **Student Profiles:** View student profiles with onboarding status (shared with Admin).
- **Student Onboarding:** View student onboarding details. Verify students and grant dashboard access.
- **Document Verification:** View student documents for verification.
- **Payment Full Access:** View all payment stats, installments. Update installment statuses.
- **Tickets (Certificate Category):** Access tickets where category is "Certificate".
- **Staff Profile:** Manage own staff profile.
- **Chat:** Full chat access.
- **Notifications:** Standard access.

### 17.2 API Endpoints

#### Certificate Claims (`/api/certificates`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/certificates/claims` | List all claims with filters |
| GET | `/api/certificates/claims/:id` | Single claim detail |
| PUT | `/api/certificates/claims/:id/status` | Update delivery/tracking/admin fields |
| DELETE | `/api/certificates/claims/:id` | Delete claim |
| GET | `/api/certificates/pricing/all` | All pricing |
| PUT | `/api/certificates/pricing/:id` | Update pricing |

#### Certificate Generation (`/api/certificates`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/certificates/generated` | List generated certificates |
| GET | `/api/certificates/generated/:id` | Single generated certificate |
| POST | `/api/certificates/generate/:claimId` | Generate certificate from claim |
| POST | `/api/certificates/generated/:id/registration` | Set registration number and generate PDFs |
| POST | `/api/certificates/generated/:id/deliver` | Mark as delivered |
| POST | `/api/certificates/deliver-all` | Bulk deliver |
| GET | `/api/certificates/generated/by-claim/:claimId` | Generated cert by claim |
| GET | `/api/certificates/next-registration-number` | Next registration number |
| GET | `/api/certificates/generated/:id/docx/:type` | Download DOCX |
| POST | `/api/certificates/generated/:id/upload-docx/:type` | Upload edited DOCX |
| POST | `/api/certificates/generated/:id/reconvert/:type` | Reconvert DOCX to PDF |
| GET | `/api/certificates/generated/:id/placeholders` | Placeholder data |
| POST | `/api/certificates/generated/:id/placeholders` | Save placeholders |
| GET | `/api/certificates/queue/status` | Generation queue status |
| POST | `/api/certificates/queue/retry/:jobId` | Retry failed job |

#### Certificate Templates (`/api/certificate-templates`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/certificate-templates/` | List templates |
| GET | `/api/certificate-templates/active/cpd` | Active CPD templates |
| GET | `/api/certificate-templates/:id` | Template detail |
| GET | `/api/certificate-templates/:id/download` | Download DOCX |
| POST | `/api/certificate-templates/upload` | Upload template |
| PUT | `/api/certificate-templates/:id` | Update template |
| DELETE | `/api/certificate-templates/:id` | Delete template |

#### Student Profiles (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/students/profiles` | Student profiles (Admin, Certificate Mgr, Claim Mgr) |
| GET | `/api/admin/students/:studentId/profile` | Single student profile |

#### Onboarding (`/api/onboarding`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/onboarding/admin/student/:id` | Student onboarding details |
| PUT | `/api/onboarding/admin/verify/:id` | Verify student |

### 17.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Main Dashboard | `app/dashboard/certificate-manager/page.tsx` | Tabs: certificate queries, certificates, payments, student profiles, templates, generated certificates |
| Student Detail | `app/dashboard/certificate-manager/students/[studentId]/page.tsx` | Student profile drill-down |

### 17.4 Database Tables Read/Written

`certificate_claims`, `certificate_pricing`, `certificate_templates`, `generated_certificates`, `certificate_generation_log`, `student_payment_installments`, `payment_audit_log`, `users`, `student_profiles`, `student_onboarding_status`, `student_initial_assessments`, `student_documents`, `staff_profiles`, `notifications`, `tickets`, `ticket_messages`

---

## 18. Role 12 -- Claim Manager

**Role ID:** 12
**Dashboard:** `/dashboard/claim-manager`
**Backend route files:** `backend/routes/claimManager.js`, `backend/routes/admin.js` (student profiles), `backend/routes/staffProfile.js`, `backend/routes/tickets.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/claim-manager/`

### 18.1 Capabilities

- **Qualification Completion Tracking:** View dashboard stats for qualification courses and completed students. Filter by course.
- **Student Submissions:** View full submission tree with files for any student across qualification courses.
- **Downloads:** Download individual unit bundles (ZIP with feedback and submission files) or all units for a student.
- **CSV Reports:** Generate per-student or global CSV reports of qualification completion data.
- **Student Profiles:** View student profiles with onboarding status (shared with Admin, Certificate Mgr).
- **Tickets:** Access tickets with department-scoped visibility.
- **Staff Profile:** Manage own staff profile.
- **Chat:** Full chat access.
- **Notifications:** Standard access.

### 18.2 API Endpoints

#### Claim Manager (`/api/claim-manager`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/claim-manager/stats` | Dashboard statistics |
| GET | `/api/claim-manager/courses` | Qualification course list |
| GET | `/api/claim-manager/completed-students` | Students with completion progress |
| GET | `/api/claim-manager/student/:studentId/submissions` | Student submission tree |
| GET | `/api/claim-manager/student/:studentId/download-unit/:unitId` | Download unit ZIP |
| GET | `/api/claim-manager/student/:studentId/download-all` | Download all units ZIP |
| GET | `/api/claim-manager/student/:studentId/report-csv` | Student CSV report |
| GET | `/api/claim-manager/report-csv` | Global CSV report |

#### Student Profiles (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/students/profiles` | Student profiles list |

### 18.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Main Dashboard | `app/dashboard/claim-manager/page.tsx` | Stats, course list, completed students |
| Student Detail | `app/dashboard/claim-manager/students/[studentId]/page.tsx` | Submission details with downloads |

### 18.4 Database Tables Read

`courses`, `qual_course_content`, `qual_unit_content`, `qual_submissions`, `assignment_submission_files`, `qual_unit_progress`, `course_assignments`, `users`, `student_profiles`, `student_onboarding_status`, `staff_profiles`, `notifications`, `tickets`

---

## 19. Role 13 -- ManagerStudent

**Role ID:** 13
**Dashboard:** `/dashboard/student`
**Backend route files:** Same as Student (Role 4)
**Frontend pages:** Same as Student (Role 4)

### 19.1 Capabilities

Identical to the Student role (ID 4). The ManagerStudent is a student linked to a Manager via `manager_id`. The key differences:

- Grouped under `STUDENT_ROLE_NAMES` alongside Student and InstituteStudent.
- Uses the same onboarding flow, dashboard, course access, and all student APIs.
- Has access to the student `/:studentId/` routes via the param middleware (role_id 13 is in the allowed set).
- Can book consultations (included in student permit list).
- Can access tickets as a student.

### 19.2 Database Tables

Same as Student (Section 10.4).

---

## 20. Role 14 -- InstituteStudent

**Role ID:** 14
**Dashboard:** `/dashboard/student`
**Backend route files:** Same as Student (Role 4)
**Frontend pages:** Same as Student (Role 4)

### 20.1 Capabilities

Identical to the Student role (ID 4). The InstituteStudent is a student linked to an institute. The key differences:

- Grouped under `STUDENT_ROLE_NAMES` alongside Student and ManagerStudent.
- Uses the same onboarding flow, dashboard, course access, and all student APIs.
- Has access to the student `/:studentId/` routes via the param middleware (role_id 14 is in the allowed set -- note: actual param check allows role_id 4, 12, 13; InstituteStudent (14) may need explicit addition if not covered).
- Can book consultations (included in student permit list).

### 20.2 Database Tables

Same as Student (Section 10.4).

---

## 21. Role 15 -- Consultation Manager

**Role ID:** 15
**Dashboard:** `/dashboard/consultation-manager`
**Backend route files:** `backend/routes/consultations.js`, `backend/routes/consultationManager.js`, `backend/routes/staffProfile.js`, `backend/routes/tickets.js`, `backend/routes/chat.js`, `backend/routes/notifications.js`
**Frontend pages:** `app/dashboard/consultation-manager/`

### 21.1 Capabilities

- **Slot Management:** Create individual, day, or bulk consultation slots. Toggle slot active status. Delete unbooked slots (individual or bulk).
- **Booking Management:** View all bookings (upcoming and historical). Cancel bookings (frees slot, deletes Zoom meeting, notifies student). Mark bookings as completed.
- **Today/Upcoming Views:** View today's confirmed/completed bookings and upcoming future bookings.
- **Student Enrollments:** View course enrollments for any student (consultation context).
- **Settings (Read-only):** View consultation portal settings (enabled/disabled status). Cannot modify settings (Admin only).
- **Staff Profile:** Manage own staff profile.
- **Tickets:** Access tickets with department-scoped visibility.
- **Chat:** Full chat access.
- **Notifications:** Standard access.

### 21.2 API Endpoints

#### Consultations (`/api/consultations`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/consultations/slots` | Create slots (legacy) |
| POST | `/api/consultations/slots/single` | Create single slot |
| POST | `/api/consultations/slots/day` | Create day slots (up to 8) |
| POST | `/api/consultations/slots/bulk` | Bulk create over date range |
| GET | `/api/consultations/slots/all` | All slots with booking data |
| DELETE | `/api/consultations/slots/bulk` | Bulk delete unbooked slots |
| DELETE | `/api/consultations/slots/:slotId` | Delete single unbooked slot |
| PATCH | `/api/consultations/slots/:slotId/toggle-active` | Toggle slot active |
| GET | `/api/consultations/bookings` | List bookings |
| PUT | `/api/consultations/bookings/:bookingId/cancel` | Cancel booking |

#### Consultation Manager (`/api/consultation-manager`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/consultation-manager/settings` | Portal settings (read-only for this role) |
| GET | `/api/consultation-manager/today` | Today's bookings |
| GET | `/api/consultation-manager/upcoming` | Upcoming bookings |
| PATCH | `/api/consultation-manager/bookings/:bookingId/complete` | Mark booking completed |
| GET | `/api/consultation-manager/students/:studentId/enrollments` | Student enrollments |

Note: `PUT /api/consultation-manager/settings` and `GET /api/consultation-manager/team` are Admin-only.

### 21.3 Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Main Dashboard | `app/dashboard/consultation-manager/page.tsx` | Overview with feature flag check |
| Today | `app/dashboard/consultation-manager/today/page.tsx` | Today's bookings |
| Bookings | `app/dashboard/consultation-manager/bookings/page.tsx` | All bookings |
| Slots | `app/dashboard/consultation-manager/slots/page.tsx` | Slot management |
| Student Detail | `app/dashboard/consultation-manager/students/[studentId]/page.tsx` | Student enrollment info |

### 21.4 Database Tables Read/Written

`consultation_slots`, `consultation_bookings`, `consultation_manager_settings`, `course_assignments`, `courses`, `users`, `staff_profiles`, `notifications`

---

## 22. Student Onboarding Flow

The onboarding flow is a multi-step wizard that new students must complete before accessing the dashboard. The flow adapts based on the student's enrollment type.

### 22.1 Enrollment Detection

When a student logs in, the system detects their enrollment type by querying `course_assignments` joined with `courses`:

| Enrollment Type | Condition |
|-----------------|-----------|
| `qualification` | Only qualification courses enrolled |
| `cpd` | Only CPD courses enrolled |
| `both` | Both types enrolled |
| `none` | No enrollments found |

**Code:** `detectEnrollmentType()` helper in `backend/routes/onboarding.js`

### 22.2 Onboarding Steps by Enrollment Type

#### Scenario A: Qualification Only (or Both)

```
Welcome → Course Selection (auto-set) → Qualification Level → Documents Upload → 
Initial Assessment (full form) → VARK Assessment → Verification Pending → Dashboard
```

#### Scenario B: CPD Only

```
Welcome → Course Selection (auto-set) → Initial Assessment (short form) → Dashboard
```

CPD-only students skip: qualification level, documents upload, VARK assessment, and verification pending. Dashboard access is granted immediately after initial assessment.

#### Scenario C: No Enrollment

```
Welcome → Course Selection (manual) → (follows qualification or CPD path)
```

### 22.3 Initial Assessment Form Fields

#### CPD-Only (Short Form)

- Profile picture upload
- Full name, gender, date of birth, nationality, primary language
- Contact number, email, ethnicity, postal address
- 3 consent checkboxes (data usage, privacy policy, terms)
- E-signature (full name + date)

#### Qualification (Full Form)

All CPD fields plus:
- Motivation and background
- Skills assessment (ICT level, literacy level, numeracy level)
- Why pursuing qualification, career goals
- 3 additional checkboxes (UCAS points, plagiarism, APL awareness)
- APL information box

### 22.4 Qualification Upgrade Flow

When a CPD-only student is later enrolled in a qualification course:

1. Student dashboard shows an upgrade banner: "You have been enrolled in a qualification course."
2. Student clicks "Complete Now" which calls `POST /api/onboarding/start-qualification-upgrade`.
3. Backend resets qualification-related onboarding steps, sets `current_step` to `qualification-level`, resets `admin_verified` and related fields, resets `users.onboarding_profile_status` to `pending`.
4. Student proceeds through: Qualification Level → Documents → Initial Assessment (pre-filled, full form) → VARK Assessment → Verification Pending.
5. Dashboard shows "Pending Verification" banner. Qualification courses are hidden until verified.
6. Admin verifies the student, which sets `admin_verified = true` and reveals qualification courses.

### 22.5 Admin Verification

- Admin views student profiles at `GET /api/admin/students/profiles` with status filters (new, review, verified, complete, incomplete).
- Admin reviews individual student at `GET /api/onboarding/admin/student/:id`.
- Admin verifies via `PUT /api/onboarding/admin/verify/:id`, which sets `admin_verified = true`, `dashboard_access_granted = true`, updates `admin_verified_at`, `admin_verified_by`, `admin_notes`, and populates `student_profiles` from assessment data.
- Student dashboard auto-detects verification and removes the pending banner.

### 22.6 Document Rejection and Resubmission

- Admin/Certificate Manager/Admission Manager can reject documents via `POST /api/documents/verify/:documentId`.
- Student sees "Documents Rejected" banner on dashboard.
- Student navigates to resubmit page to upload replacement documents.
- Replaced documents go through the verification queue again.

---

## 23. Payment and Installment System

### 23.1 Overview

The payment system supports course fee installment plans processed via Stripe.

### 23.2 Flow

1. **Admin sets up installment plan:** `POST /api/admin/enrollments/:courseId/:studentId/installments` with `payment_type` (`all_paid` or `installment`) and installment array (amounts, due dates).
2. **Student views installments:** `GET /api/student/installments` shows their payment schedule.
3. **Student initiates payment:** `POST /api/installments/:installmentId/pay` creates a Stripe PaymentIntent.
4. **Student confirms payment:** `POST /api/installments/:installmentId/confirm` after Stripe client-side confirmation. Marks installment as paid.
5. **Stripe webhook:** `POST /api/webhook` handles asynchronous payment events.
6. **Staff updates status:** `PATCH /api/admin/installments/:installmentId/status` for manual status changes.

### 23.3 Payment Reminders

- Accounts Manager / Team Member can send reminders via email, dashboard notification, or both.
- Email templates are configurable with variable substitution.
- Auto-reminder settings define intervals for automatic sending.

### 23.4 Access Matrix

| Capability | Admin | Cert Mgr | Op Mgr | Acct Mgr | Admin Mgr | Adm Mgr | Team Member | Assessor |
|------------|-------|----------|--------|----------|-----------|---------|-------------|----------|
| View installments | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Tutor-scoped |
| Save plans | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Update status | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Payment stats | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Pending/received | No | No | No | Yes | No | No | Yes | No |
| Send reminders | No | No | No | Yes | No | No | Yes | No |
| Email templates | No | No | No | Yes | No | No | Yes | No |
| Reminder logs | No | No | No | Yes | No | No | No | No |
| Auto-reminder settings | No | No | No | Yes | No | No | No | No |

---

## 24. Certificate Claim and Generation Pipeline

### 24.1 Flow

1. **Student claims certificate:**
   - CPD: `POST /api/certificates/claim/cpd` with photo ID upload.
   - Qualification: `POST /api/certificates/claim/qualification`.
2. **Payment (if required):** Student creates Stripe PaymentIntent and confirms payment.
3. **Staff processes claim:** Updates claim status, delivery information.
4. **Certificate generation:** Staff triggers `POST /api/certificates/generate/:claimId`. Bull queue processes PDF generation from DOCX templates.
5. **Registration number:** Staff sets registration number via `POST /api/certificates/generated/:id/registration`.
6. **Delivery:** Staff marks delivered via `POST /api/certificates/generated/:id/deliver`. Student can download.

### 24.2 Templates

- DOCX templates uploaded via `/api/certificate-templates/upload`.
- Templates are per course type (CPD/qualification) and per certificate type (certificate/transcript).
- Only one active template per type combination at a time.

### 24.3 Public Downloads

- `GET /api/certificates/public-download/:type/:regNumber` -- public access by registration number for delivered certificates.

---

## 25. Ticket and Support System

### 25.1 Overview

The ticket system provides structured support across departments with role-based access control.

### 25.2 Departments

| ID | Department | Default Roles |
|----|-----------|---------------|
| 1 | Academic | Assessor |
| 2 | Finance | Accounts Manager |
| 3 | Support/Admission | Administrative Manager, Admission Manager |

### 25.3 Access Rules

| Role | Department Access | Special Rules |
|------|-------------------|---------------|
| Admin | All departments | Full access |
| Operation Manager | All departments | Full access |
| Team Member | All departments | No team management |
| Accounts Manager | Finance (2) | Team management, student credentials |
| Administrative Manager | Support (3) | Team management |
| Admission Manager | Support/Admission (3) | Team management |
| Assessor | Academic (1) | |
| Certificate Manager | Certificate-category tickets only | |
| Student / ManagerStudent / InstituteStudent | Own tickets only | |

All staff can also access tickets where they are `assigned_to` or `escalated_to` regardless of department.

### 25.4 Ticket Lifecycle

```
Created → Claimed (assigned to agent) → In Progress → Resolved
                                      → Transferred (to another department)
                                      → Escalated (to tutor/assessor)
                                      → Reassigned (to another agent)
```

### 25.5 Features

- **Messages:** Public messages visible to student and staff. Internal notes visible only to staff.
- **File Attachments:** Upload via Cloudinary (max 10MB).
- **Chat Sync:** When a ticket is claimed, a linked conversation is created. Messages sync between ticket and chat.
- **Academic Progress:** Staff can view student's qualification progress from the ticket view.
- **Payment Info:** Staff can view student's payment installments from the ticket view.

---

## 26. Forum System

### 26.1 Overview

A community forum with categories, posts, comments, reactions, and moderation tools.

### 26.2 Access Matrix

| Action | Student | Assessor | Moderator | Admin |
|--------|---------|----------|-----------|-------|
| View posts/comments | Yes | Yes | Yes | Yes |
| Create post | Yes | Yes | Yes | Yes |
| Comment | Yes | Yes | Yes | Yes |
| React | Yes | Yes | Yes | Yes |
| Edit own post/comment | Yes | Yes | Yes | Yes |
| Delete own post/comment | Yes | Yes | Yes | Yes |
| Edit others' posts | No | No | Yes | Yes |
| Delete others' posts | No | No | Yes | Yes |
| Pin/unpin posts | No | No | Yes | Yes |
| Lock/unlock posts | No | No | Yes | Yes |
| Toggle comments | No | No | Yes | Yes |

### 26.3 Reactions

7 reaction types available on posts and comments (like, love, insightful, etc.).

### 26.4 Public Access

Forum list, stats, and individual post views support optional authentication -- unauthenticated users can browse but not interact.

---

## 27. Chat System

### 27.1 Overview

Real-time messaging between users powered by Socket.IO.

### 27.2 Features

- **Conversations:** One-to-one chat between any authenticated users.
- **Messages:** Text messages with read receipts. Edit and delete own messages.
- **File Uploads:** Images (JPEG, PNG, GIF, WebP), PDFs, DOCX files up to 10MB.
- **Ticket Integration:** Conversations can be linked to tickets; messages sync between chat and ticket.
- **Unread Counts:** Per-user unread message tracking.

### 27.3 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/start` | Start conversation |
| GET | `/api/chat/conversations/:userId` | User's conversations |
| GET | `/api/chat/conversation/:conversationId` | Single conversation |
| GET | `/api/chat/conversations/:userId/unread-count` | Unread count |
| GET | `/api/chat/users/all` | All users for chat picker |
| GET | `/api/chat/user/:userId/profile` | User profile for chat |
| GET | `/api/chat/merged-ticket-messages` | Merged ticket + chat messages |
| GET | `/api/chat/:conversationId` | Conversation messages |
| POST | `/api/chat/message` | Send message |
| PUT | `/api/chat/message/edit` | Edit message |
| DELETE | `/api/chat/message/delete` | Delete message |
| POST | `/api/chat/upload` | Upload chat attachment |
| POST | `/api/chat/mark-read` | Mark messages read |

---

## 28. Consultation Booking System

### 28.1 Overview

Enables students to book video consultation sessions with staff. Integrated with Zoom for meeting links.

### 28.2 Slot Management (Admin / Consultation Manager)

- **Single slot:** Create one slot with configurable duration (15/30/45/60 min).
- **Day slots:** Create up to 8 slots for one day.
- **Bulk slots:** Create slots over a date range with weekday selection and skip dates.
- **Toggle active:** Enable/disable individual slots.
- **Delete:** Remove unbooked slots.

### 28.3 Booking Flow (Student)

1. Student views available slots via `GET /api/consultations/slots/available`.
2. Student books a slot via `POST /api/consultations/book/:slotId`.
   - Max 2 future bookings per student.
   - Student must have at least one course enrollment.
   - Redis lock prevents double-booking race conditions.
   - Zoom meeting is automatically created.
3. Booking status: `pending` → `confirmed` → `completed`.
4. Student can cancel 24+ hours before the slot time.

### 28.4 Completion

Staff marks booking as completed via `PATCH /api/consultation-manager/bookings/:bookingId/complete`, which triggers Socket.IO events and admin notifications.

### 28.5 Portal Settings

- Admin can enable/disable the consultation portal via `PUT /api/consultation-manager/settings`.
- When disabled, a custom message is shown to students.
- Consultation Manager can only read settings, not modify them.

---

## API Route Mount Reference

Complete mapping of Express routers to URL prefixes (from `backend/server.js`):

| Mount Path | Route File |
|------------|-----------|
| `/api/login` | `backend/routes/auth.js` |
| `/api/users` | `backend/routes/users.js` |
| `/api/courses` | `backend/routes/courses.js` |
| `/api/admin` | `backend/routes/admin.js` |
| `/api/tutor` | `backend/routes/admin.js` (tutorRouter export) |
| `/api/student` | `backend/routes/student.js` |
| `/api/student` | `backend/routes/studentProfile.js` |
| `/api/onboarding` | `backend/routes/onboarding.js` |
| `/api/documents` | `backend/routes/documentVerification.js` |
| `/api/staff` | `backend/routes/staffProfile.js` |
| `/api` | `backend/routes/paymentInstallments.js` |
| `/api` | `backend/routes/paymentReminders.js` |
| `/api/chat` | `backend/routes/chat.js` |
| `/api/tickets` | `backend/routes/tickets.js` |
| `/api/cpd` | `backend/routes/cpd.js` |
| `/api/qualification` | `backend/routes/qualification.js` |
| `/api/manager` | `backend/routes/manager.js` |
| `/api/forum` | `backend/routes/forum.js` |
| `/api/notifications` | `backend/routes/notifications.js` |
| `/api` | `backend/routes/consultations.js` |
| `/api/admin/logs` | `backend/routes/logs.js` |
| `/api/claim-manager` | `backend/routes/claimManager.js` |
| `/api/consultation-manager` | `backend/routes/consultationManager.js` |
| `/api/certificates` | `backend/routes/certificates.js` |
| `/api/certificate-templates` | `backend/routes/certificateTemplates.js` |
| `/api/ai` | `backend/routes/ai.js` |
| `/api/admin/ai-security` | `backend/routes/ai-security.js` |
| `/api/health` | `backend/routes/health.js` |
| `/api/test-geoip` | `backend/routes/test-geoip.js` |
| `POST /api/webhook` | Stripe webhook handler from `paymentInstallments.js` |
| `GET /api/time` | Inline server time endpoint |

---

## Shared Services (All Authenticated Roles)

These features are available to all authenticated users regardless of role:

| Feature | Endpoints | Description |
|---------|-----------|-------------|
| Notifications | `GET /api/notifications`, `GET .../unread-count`, `PUT .../:id/read`, `PUT .../mark-all-read`, `DELETE .../:id` | View, read, delete notifications |
| Chat | `POST /api/chat/start`, `GET .../conversations/:userId`, `POST .../message`, etc. | Real-time messaging |
| Forum (read) | `GET /api/forum/posts`, `GET .../posts/:id`, `GET .../categories`, `GET .../stats` | Browse forum content |
| Staff Profile | `GET/PUT /api/staff/profile`, `POST .../profile/picture` | Manage own profile (staff roles in `STAFF_PROFILE_ALLOWED_ROLES`) |

`STAFF_PROFILE_ALLOWED_ROLES`: Admin, Assessor, Moderator, Operation Manager, Accounts Manager, Administrative Manager, Admission Manager, Team Member, Certificate Manager, Claim Manager, Consultation Manager.

Note: Manager (role 3) is **not** in `STAFF_PROFILE_ALLOWED_ROLES` and cannot access staff profile endpoints.
