# Tutor → Assessor Migration Plan

## Overview
Rename the **Tutor** role to **Assessor** across the application. Where hierarchy exists: **Main Tutor** → **Main Assessor**, **Sub-tutor** → **Assessor**.

---

## 1. DATABASE

### 1.1 Roles Table
- **File**: Direct SQL on `roles` table
- **Change**: `UPDATE roles SET name = 'Assessor' WHERE id = 2;` (role_id 2 = Tutor)
- **Note**: Keep `parent_tutor_id`, `assigned_tutor_id` column names unchanged (requires complex migration)

### 1.2 Migration Script
- Create `backend/migrations/rename_tutor_to_assessor.sql`

---

## 2. BACKEND – Role Mapping (role_id 2 → 'Assessor')

### 2.1 Auth & Login
| File | Change |
|------|--------|
| `backend/controllers/authController.js` | `2: 'Tutor'` → `2: 'Assessor'` |
| `backend/middleware/auth.js` | `2: 'Tutor'` → `2: 'Assessor'` |
| `backend/routes/login.js` | `2: 'Tutor'` → `2: 'Assessor'` |
| `backend/routes/users.js` | `2: 'Tutor'` → `2: 'Assessor'` |

### 2.2 Staff Profile & Access
| File | Change |
|------|--------|
| `backend/routes/staffProfile.js` | `'Tutor'` → `'Assessor'` in allowedRoles (3 places) |

### 2.3 Payments
| File | Change |
|------|--------|
| `backend/routes/paymentInstallments.js` | `'Tutor'` → `'Assessor'` in allowed array; `req.user?.role !== 'Tutor'` → `'Assessor'`; cache key `/api/tutor/` → `/api/assessor/` (optional) |

### 2.4 Tickets
| File | Change |
|------|--------|
| `backend/controllers/ticketController.js` | `TICKET_ROLE_NAMES`, all `'Tutor'` → `'Assessor'`; `r.name = 'Tutor'` → `r.name = 'Assessor'`; staffRoles array |

### 2.5 Admin Routes
| File | Change |
|------|--------|
| `backend/routes/admin.js` | Role checks `r.name = 'Tutor'`, staffRoles `'Tutor'` → `'Assessor'`; API route labels/comments (tutors → assessors for display); keep route path `/tutor/` for now or rename to `/assessor/` |

### 2.6 Other Backend
| File | Change |
|------|--------|
| `backend/routes/certificates.js` | Comments/labels `Admin/Tutor` → `Admin/Assessor`; `role === 'tutor'` → `role === 'assessor'` |
| `backend/routes/qualification.js` | `'Tutor'` → `'Assessor'` |
| `backend/routes/student.js` | `'Tutor'` → `'Assessor'` |
| `backend/routes/courses.js` | `'Tutor'` → `'Assessor'` |
| `backend/routes/cpd.js` | `'Tutor'` → `'Assessor'` |
| `backend/routes/forum.js` | `'Tutor'` → `'Assessor'` |
| `backend/routes/ai.js` | `'Tutor'` → `'Assessor'` |
| `backend/routes/manager.js` | `'Tutor'` → `'Assessor'` |
| `backend/routes/logs.js` | `'Tutor'` → `'Assessor'` |
| `backend/middleware/roles.js` | `'Tutor'` → `'Assessor'` |
| `backend/middleware/rateLimiter.js` | `'Tutor'` → `'Assessor'` |
| `backend/middleware/activityLogger.js` | `'Tutor'` → `'Assessor'` |
| `backend/middleware/validateAIInput.js` | `'Tutor'` → `'Assessor'` |
| `backend/utils/eventLogger.js` | `'tutor'` → `'assessor'`; `Tutor` → `Assessor` in replace |
| `backend/config/aiPermissions.js` | `'Tutor'` → `'Assessor'` |
| `backend/services/aiLogger.js` | `'Tutor'` → `'Assessor'` |

---

## 3. FRONTEND – Types & Constants

### 3.1 Types
| File | Change |
|------|--------|
| `app/components/types.ts` | `'Tutor'` → `'Assessor'` in UserRole type |

---

## 4. FRONTEND – Admin & User Management

### 4.1 Admin Dashboard
| File | Change |
|------|--------|
| `app/dashboard/admin/page.tsx` | Tab labels "Tutor" → "Assessor"; role checks `'Tutor'` → `'Assessor'`; "Main Tutor" → "Main Assessor"; "Sub-tutor" → "Assessor" |

### 4.2 User Management (Admin)
| File | Change |
|------|--------|
| `app/components/UserManagement.tsx` | Interface `Tutor` → `Assessor`; state `tutors` → `assessors`; labels "Tutor" → "Assessor"; "Main Tutor" → "Main Assessor"; `getTutors` → `getAssessors` (if API renamed) |

---

## 5. FRONTEND – Tutor Dashboard (→ Assessor Dashboard)

### 5.1 Main Dashboard
| File | Path | Change |
|------|------|--------|
| `app/dashboard/tutor/page.tsx` | `/dashboard/tutor` | All labels "Tutor" → "Assessor"; "Main Tutor" → "Main Assessor"; role checks |

### 5.2 Students
| File | Path | Change |
|------|------|--------|
| `app/dashboard/tutor/students/[studentId]/page.tsx` | `/dashboard/tutor/students/...` | Labels "Tutor" → "Assessor" |

### 5.3 Courses
| File | Path | Change |
|------|------|--------|
| `app/dashboard/tutor/courses/[id]/page.tsx` | `/dashboard/tutor/courses/...` | Labels "Tutor" → "Assessor" |

### 5.4 Qualifications
| File | Path | Change |
|------|------|--------|
| `app/dashboard/tutor/qualification/create/page.tsx` | | Labels |
| `app/dashboard/tutor/qualification/[courseId]/view/page.tsx` | | Labels |
| `app/dashboard/tutor/qualification/[courseId]/manage/page.tsx` | | Labels |
| `app/dashboard/tutor/qualification/units/[unitId]/edit/page.tsx` | | Labels |
| `app/dashboard/tutor/qualification/units/[unitId]/view/page.tsx` | | Labels |

### 5.5 CPD
| File | Path | Change |
|------|------|--------|
| `app/dashboard/tutor/cpd/create/page.tsx` | | Labels |
| `app/dashboard/tutor/cpd/[courseId]/view/page.tsx` | | Labels |
| `app/dashboard/tutor/cpd/[courseId]/manage/page.tsx` | | Labels |

### 5.6 Enrollments
| File | Path | Change |
|------|------|--------|
| `app/dashboard/tutor/enrollments/[courseId]/[studentId]/setup/page.tsx` | | Labels |

### 5.7 Team (Main Assessor / Sub-assessors)
| File | Path | Change |
|------|------|--------|
| `app/dashboard/tutor/team/all/[subTutorId]/page.tsx` | | "Tutor" → "Assessor"; "Sub-tutor" → "Assessor" |
| `app/dashboard/tutor/team/pending/[subTutorId]/page.tsx` | | Same |
| `app/dashboard/tutor/team/feedback/[subTutorId]/page.tsx` | | Same |
| `app/dashboard/tutor/team/today/[subTutorId]/page.tsx` | | Same |

---

## 6. FRONTEND – Shared Components

### 6.1 Navigation & Layout
| File | Change |
|------|--------|
| `app/components/Navbar.tsx` | `'Tutor'` → `'Assessor'` in staff roles; link `/dashboard/tutor` (or `/dashboard/assessor`) |
| `app/profile/page.tsx` | `'Tutor'` → `'Assessor'` in allowedRoles |
| `app/dashboard/page.tsx` | Role redirect for Tutor → Assessor |
| `app/page.tsx` | Login redirect "Tutor" → "Assessor" |

### 6.2 Tickets
| File | Change |
|------|--------|
| `app/dashboard/tickets/layout.tsx` | `'Tutor'` → `'Assessor'` in TICKET_ACCESS_ROLES |
| `app/dashboard/tickets/[id]/page.tsx` | `user?.role === 'Tutor'` → `'Assessor'`; student profile link `/dashboard/tutor/` → `/dashboard/assessor/` |
| `app/dashboard/tickets/team/page.tsx` | Labels |

### 6.3 Chat & Messages
| File | Change |
|------|--------|
| `app/components/FloatingChatWindow.tsx` | `tutor_name`, `tutor_profile_picture` display labels |
| `app/components/FloatingChatProvider.tsx` | `tutor_name` labels |
| `app/components/MessageDropdown.tsx` | `tutor_profile_picture` etc. |
| `app/components/ChatBox.tsx` | Labels |
| `app/chat/page.tsx` | Labels |

### 6.4 Other Components
| File | Change |
|------|--------|
| `app/components/FloatingTicketWindow.tsx` | Labels |
| `app/components/StudentEnrollment.tsx` | "Tutor" → "Assessor" |
| `app/components/StudentsProfileView.tsx` | "Tutor" → "Assessor" |
| `app/components/PaymentManagementView.tsx` | "Tutor" → "Assessor" |
| `app/components/Footer.tsx` | "Tutor" → "Assessor" |
| `app/components/AITokenManagement.tsx` | "Tutor" → "Assessor" |
| `app/components/AIActionLogs.tsx` | "Tutor" → "Assessor" |

---

## 7. FRONTEND – Student & Admin Views

### 7.1 Student Dashboard
| File | Change |
|------|--------|
| `app/dashboard/student/page.tsx` | "Tutor" → "Assessor" |
| `app/dashboard/student/grades/page.tsx` | Labels |
| `app/dashboard/student/certificates/page.tsx` | Labels |
| `app/dashboard/student/qualification/[courseId]/view/page.tsx` | Labels |
| `app/dashboard/student/cpd/[courseId]/page.tsx` | Labels |
| `app/dashboard/student/cpd/[courseId]/view/page.tsx` | Labels |
| `app/dashboard/student/cpd/[courseId]/quiz/[quizId]/page.tsx` | Labels |

### 7.2 Admin Sub-pages
| File | Change |
|------|--------|
| `app/dashboard/admin/qualification/[courseId]/view/page.tsx` | Labels |
| `app/dashboard/admin/qualification/[courseId]/manage/page.tsx` | Labels |
| `app/dashboard/admin/qualification/create/page.tsx` | Labels |
| `app/dashboard/admin/qualification/units/[unitId]/edit/page.tsx` | Labels |
| `app/dashboard/admin/qualification/units/[unitId]/view/page.tsx` | Labels |
| `app/dashboard/admin/cpd/[courseId]/view/page.tsx` | Labels |
| `app/dashboard/admin/cpd/[courseId]/manage/page.tsx` | Labels |
| `app/dashboard/admin/cpd/create/page.tsx` | Labels |
| `app/dashboard/admin/enrollments/[courseId]/[studentId]/setup/page.tsx` | Labels |

### 7.3 Courses & Forum
| File | Change |
|------|--------|
| `app/courses/[id]/page.tsx` | Labels |
| `app/courses/[id]/files/page.tsx` | Labels |
| `app/dashboard/forum/page.tsx` | Labels |
| `app/dashboard/forum/[postId]/page.tsx` | Labels |

---

## 8. API Service

| File | Change |
|------|--------|
| `app/services/api.ts` | `getTutors` response handling; `/tutor/` paths if API is renamed; role checks |

---

## 9. UTILITIES & OTHER

| File | Change |
|------|--------|
| `app/utils/notificationNavigation.ts` | `'Tutor'` → `'Assessor'` |
| `fix-typescript-errors.js` | If contains Tutor references |

---

## 10. ROUTE RENAME (Optional – Higher Impact)

- Rename folder: `app/dashboard/tutor/` → `app/dashboard/assessor/`
- Update all internal links from `/dashboard/tutor` to `/dashboard/assessor`
- Backend API paths: `/api/admin/tutors` → `/api/admin/assessors`; `/api/tutor/*` → `/api/assessor/*` (optional)

---

## TODO List (Order of Execution)

1. [ ] **DB**: Create migration `rename_tutor_to_assessor.sql` and run `UPDATE roles SET name = 'Assessor' WHERE id = 2;`
2. [ ] **Backend**: authController, auth.js, login.js, users.js – role mapping
3. [ ] **Backend**: staffProfile.js – allowedRoles
4. [ ] **Backend**: paymentInstallments.js
5. [ ] **Backend**: ticketController.js
6. [ ] **Backend**: admin.js – role checks and labels
7. [ ] **Backend**: certificates, qualification, student, courses, cpd, forum, ai, manager, logs, middleware, utils, config
8. [ ] **Frontend**: types.ts
9. [ ] **Frontend**: UserManagement.tsx
10. [ ] **Frontend**: admin/page.tsx
11. [ ] **Frontend**: tutor dashboard (page.tsx + all sub-pages)
12. [ ] **Frontend**: Navbar, profile, dashboard/page, page.tsx
13. [ ] **Frontend**: tickets layout and [id] page
14. [ ] **Frontend**: Chat/Messages components
15. [ ] **Frontend**: StudentEnrollment, StudentsProfileView, PaymentManagementView, Footer, AI components
16. [ ] **Frontend**: Student pages
17. [ ] **Frontend**: Admin sub-pages (qualification, cpd, enrollments)
18. [ ] **Frontend**: courses, forum
19. [ ] **Frontend**: api.ts
20. [ ] **Frontend**: notificationNavigation, fix-typescript-errors
21. [ ] **Optional**: Rename /dashboard/tutor → /dashboard/assessor and update all links
22. [ ] **Optional**: Rename API paths /tutor/ → /assessor/

---

*Generated for Inspire LMS – Tutor to Assessor migration*
