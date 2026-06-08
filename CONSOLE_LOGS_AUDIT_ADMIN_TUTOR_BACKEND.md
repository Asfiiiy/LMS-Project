# Console Logs Audit Report — Admin, Tutor, Assessor, Moderator & Backend

**Scan Date:** 2026-02-27  
**Scope:** Admin dashboard, Tutor/Assessor dashboard, Moderator, Manager, Tickets, Forum, Certificate Manager, Backend (routes, middleware, services, cron, config), Shared components  
**Note:** Student dashboard was audited separately (see CONSOLE_LOGS_AUDIT_REPORT.md)

---

## Role Folders That Exist

| Folder | Exists | Notes |
|--------|--------|-------|
| `app/dashboard/admin/` | ✅ | Full admin dashboard |
| `app/dashboard/tutor/` | ✅ | Tutor/Assessor dashboard (same folder) |
| `app/dashboard/assessor/` | ❌ | Does not exist — assessors use tutor routes |
| `app/dashboard/moderator/` | ✅ | Forum moderator |
| `app/dashboard/manager/` | ✅ | Manager dashboard |
| `app/dashboard/staff/` | ❌ | Does not exist |
| `app/dashboard/tickets/` | ✅ | Operation/Accounts/Admission managers |
| `app/dashboard/forum/` | ✅ | Forum (shared) |
| `app/dashboard/certificate-manager/` | ✅ | Certificate Manager role |

---

# ADMIN DASHBOARD — app/dashboard/admin/

## app/dashboard/admin/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 147 | console.error | 🟡 | `console.error('Error fetching course count:', error);` | Error object, may include stack |
| 2 | 410 | console.error | 🟡 | `console.error('Error fetching filter data:', error);` | Error object |
| 3 | 447 | console.warn | 🟡 | `console.warn('[Admin Dashboard] Filename appears to be missing...');` | File path/URL |
| 4 | 452 | console.log | 🟡 | `console.log('[Admin Dashboard] Extracted filename from URL:', finalFileName);` | File path |
| 5 | 458 | console.log | 🟡 | `console.log('[Admin Dashboard] Using fallback filename:', finalFileName);` | File path |
| 6 | 479 | console.error | 🟡 | `console.error('Error marking file as viewed:', e);` | Error |
| 7 | 499 | console.error | 🟡 | `console.error('Error logging file download:', e);` | Error |
| 8 | 520 | console.error | 🟡 | `console.error('Error fetching stats:', error);` | Error |
| 9 | 583 | console.error | 🟡 | `console.error('Error loading logs:', err);` | Error |
| 10 | 739 | console.error | 🟡 | `console.error('Error loading active users:', err);` | Error |
| 11 | 781 | console.error | 🟡 | `console.error('Error loading assessments:', err);` | Error |
| 12 | 855 | console.error | 🟡 | `console.error('Error parsing date:', row.submitted_at, e);` | Date, error |
| 13 | 962 | console.error | 🟡 | `console.error('Error parsing date:', completedAt, e);` | Date, error |
| 14 | 988 | console.error | 🟡 | `console.error('Error fetching health status:', err);` | Error |
| 15 | 2999 | console.error | 🟡 | `console.error('Export error:', error);` | Error |
| 16 | 3051 | console.error | 🟡 | `console.error('Export error:', error);` | Error |
| 17 | 3097 | console.error | 🟡 | `console.error('Download all error:', error);` | Error |
| 18 | 3137 | console.error | 🟡 | `console.error('Delete logs error:', error);` | Error |
| 19 | 3800 | console.log | 🟢 | `console.log('[Admin Dashboard] PDF loaded successfully');` | Static message |
| 20 | 3804 | console.error | 🟡 | `console.error('[Admin Dashboard] PDF load error');` | Error |

## app/dashboard/admin/qualification/[courseId]/view/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 207 | console.error | 🟡 | `console.error('[Qualification View] Error finding unit for submission:', error);` | Error, submission ID |
| 2 | 220 | console.log | 🔴 | `console.log('[Course View] Loaded data:', response);` | **Full API response — course data, enrollments** |
| 3 | 221 | console.log | 🔴 | `console.log('[Course View] Course files:', response.files);` | **File URLs, Cloudinary paths** |
| 4 | 257 | console.log | 🟡 | `console.log('[Course View] Unit', unit.id, 'progress:', ...);` | Unit ID, progress data |
| 5 | 263 | console.error | 🟡 | `console.error('[Course View] Error loading progress for unit:', unit.id, error);` | Unit ID, error |
| 6 | 300 | console.error | 🟡 | `console.error('[Course View] Error checking selected units:', error);` | Error |
| 7 | 314 | console.error | 🟡 | `console.error('[Course View] Error checking certificate claims:', error);` | Error |
| 8 | 323 | console.error | 🟡 | `console.error('Error loading course:', error);` | Error |
| 9 | 343 | console.log | 🔴 | `console.log('[Qualification View] Unit data loaded:', response);` | **Full unit response** |
| 10 | 361 | console.error | 🟡 | `console.error('Error loading unit:', error);` | Error |
| 11 | 371 | console.log | 🟡 | `console.log('[Qualification View] Loading submissions for unit:', unitId, 'student:', studentId);` | Unit ID, student ID |
| 12 | 381 | console.error | 🟡 | `console.error('[Qualification View] Submissions fetch failed:', response.status, response.statusText);` | HTTP status |
| 13 | 386 | console.log | 🔴 | `console.log('[Qualification View] Submissions data:', data);` | **Full submissions data** |
| 14 | 395 | console.error | 🟡 | `console.error('[Qualification View] Error loading submissions:', error);` | Error |
| 15 | 413 | console.log | 🟡 | `console.log('[Qualification View] File clicked - fileName:', fileName, 'filePath:', filePath);` | File path |
| 16 | 420 | console.warn | 🟡 | `console.warn('[Qualification View] Filename appears to be missing...');` | URL |
| 17 | 425 | console.log | 🟡 | `console.log('[Qualification View] Extracted filename from URL:', finalFileName);` | File path |
| 18 | 431 | console.log | 🟡 | `console.log('[Qualification View] Using fallback filename:', finalFileName);` | File path |
| 19 | 447 | console.log | 🟡 | `console.log('[Qualification View] Mobile device - opening PDF in new window');` | Device info |
| 20 | 465 | console.log | 🟡 | `console.log('[Qualification View] Opening PDF in viewer');` | Static |
| 21 | 484 | console.log | 🟡 | `console.log('[Qualification View] Downloading file with name:', finalFileName);` | File path |
| 22 | 596 | console.error | 🟡 | `console.error('Error submitting assignment:', error);` | Error |
| 23 | 646 | console.error | 🟡 | `console.error('Error submitting presentation:', error);` | Error |
| 24 | 700 | console.error | 🟡 | `console.error('Error resubmitting file:', error);` | Error |
| 25 | 1518 | console.log | 🟢 | `video.play().catch(err => console.log('Video play error:', err));` | Error in catch |
| 26 | 2253 | console.log | 🟢 | `console.log('[Qualification View] PDF loaded successfully');` | Static |
| 27 | 2257 | console.error | 🟡 | `console.error('[Qualification View] PDF load error');` | Error |
| 28 | 2472 | console.error | 🟡 | `console.error('Error submitting quiz:', error);` | Error |

## app/dashboard/admin/consultations/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 110 | console.error | 🟡 | `console.error(e);` | Error object |

## app/dashboard/admin/cpd/[courseId]/manage/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 87,166,241,282,334,437,982 | console.error | 🟡 | Various error handlers | Error objects |

## app/dashboard/admin/cpd/[courseId]/view/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 106,122,174,222,251,279,321,347,378,420,453,482,510,555 | console.error | 🟡 | Various error handlers | Error objects |
| 8 | 1209 | console.log | 🟢 | `onLoad={() => console.log('[CPD] PDF loaded successfully')}` | Static |
| 9 | 1211 | console.error | 🟡 | `console.error('[CPD] PDF load error:', e);` | Error |
| 10 | 1212 | console.log | 🟡 | `console.log('[CPD] Failed URL:', viewingFile.url);` | **Cloudinary/file URL** |

## app/dashboard/admin/students/[studentId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-8 | 100,127,147,164,231,260,287,321 | console.error | 🟡 | Various error handlers | Error objects |

## app/dashboard/admin/qualification/units/[unitId]/edit/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 75 | console.log | 🔴 | `console.log('[Unit Editor] Received data:', response);` | **Full unit response** |
| 2-9 | 90,173,205,235,263,283,313,333,353 | console.error | 🟡 | Various error handlers | Error objects |

## app/dashboard/admin/qualification/create/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 63 | console.error | 🟡 | `console.error('Error loading categories:', error);` | Error |
| 2 | 118 | console.log | 🟡 | `console.log('[Create Course] Preparing files...');` | Static |
| 3-12 | 119-149 | console.log | 🟡 | File details, FormData keys | **File names, sizes, FormData structure** |
| 13 | 153 | console.log | 🟡 | `console.log('[Create Course] Sending FormData to API...');` | Static |
| 14 | 166 | console.error | 🟡 | `console.error('Error creating Qualification course:', error);` | Error |

## app/dashboard/admin/qualification/units/[unitId]/view/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 69 | console.error | 🟡 | `console.error('Error loading unit:', error);` | Error |
| 2 | 91 | console.log | 🟡 | `console.log('[Unit View] File clicked - fileName:', fileName, 'filePath:', filePath);` | File path |
| 3 | 98 | console.warn | 🟡 | `console.warn('[Unit View] Filename appears to be missing...');` | URL |
| 4-10 | 103,109,125,132,140,449,453 | console.log/error | 🟡🟢 | Various | File paths, static messages |

## app/dashboard/admin/qualification/[courseId]/manage/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 115 | console.log | 🟡 | `console.log('[Manage] Loaded', sortedUnits.length, 'units for course', courseId);` | Course ID, count |
| 2 | 127 | console.error | 🟡 | `console.error('Error loading course:', error);` | Error |
| 3 | 268 | console.log | 🟡 | `console.log('[Add Unit] Lectures:', lectures.length, ...);` | Counts |
| 4 | 269 | console.log | 🟡 | `console.log('[Add Unit] FormData keys:', Array.from(formData.keys()));` | FormData keys |
| 5 | 270 | console.log | 🟡 | `console.log('[Add Unit] Calling API with courseId:', courseId);` | Course ID |
| 6-8 | 310,343,430 | console.error | 🟡 | Various error handlers | Error objects |

## app/dashboard/admin/enrollments/[courseId]/[studentId]/setup/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 116 | console.error | 🟡 | `console.error('Error fetching tutor student profile:', profileError);` | Error |
| 2 | 120 | console.error | 🟡 | `console.error('Error fetching tutor student:', error);` | Error |
| 3 | 130 | console.error | 🟡 | `console.error('Error fetching admin users:', error);` | Error |
| 4 | 147 | console.warn | 🔴 | `console.warn('Student not found. Using default info. StudentId:', studentId, 'CourseId:', courseId, 'Role:', role);` | **Student ID, Course ID, Role** |
| 5 | 197 | console.error | 🟡 | `console.error('Error fetching data:', error);` | Error |
| 6 | 350 | console.error | 🟡 | `console.error('Error saving enrollment setup:', error);` | Error |

## app/dashboard/admin/import-moodle/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 63 | console.error | 🟡 | `console.error('Error loading categories:', err);` | Error |
| 2 | 146 | console.error | 🟡 | `console.error('Upload error:', err);` | Error |

## app/dashboard/admin/courses/[id]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 16 | console.log | 🟡 | `console.log('Fetching course:', courseId);` | Course ID |
| 2 | 18 | console.log | 🟡 | `console.log('Response status:', response.status);` | HTTP status |
| 3 | 21 | console.log | 🔴 | `console.log('Course data:', data);` | **Full course data** |
| 4 | 26 | console.log | 🟡 | `console.log('Redirecting to CPD view');` | Static |
| 5 | 30 | console.log | 🟡 | `console.log('Redirecting to qualification view');` | Static |
| 6 | 37 | console.error | 🟡 | `console.error('Error checking course type:', error);` | Error |

## app/dashboard/admin/cpd/create/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 58 | console.error | 🟡 | `console.error('Error loading categories:', error);` | Error |
| 2 | 113 | console.error | 🟡 | `console.error('Error creating CPD course:', error);` | Error |

---

# TUTOR / ASSESSOR DASHBOARD — app/dashboard/tutor/

## app/dashboard/tutor/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 159 | console.error | 🟡 | `console.error('Error fetching course count:', error);` | Error |
| 2 | 303 | console.error | 🟡 | `console.error('Error parsing stored user:', err);` | Error |
| 3-7 | 319,338,351,387,421 | console.error | 🟡 | Assessor dashboard errors | Error objects |
| 8 | 496 | console.error | 🟡 | `console.error('Error rejecting file:', error);` | Error |
| 9 | 517 | console.error | 🟡 | `console.error('Error marking file as viewed:', error);` | Error |
| 10 | 525 | console.warn | 🟡 | `console.warn('[Assessor Dashboard] Filename appears to be missing...');` | File path |
| 11 | 530 | console.log | 🟡 | `console.log('[Assessor Dashboard] Extracted filename from URL:', finalFileName);` | File path |
| 12 | 536 | console.log | 🟡 | `console.log('[Assessor Dashboard] Using fallback filename:', finalFileName);` | File path |
| 13 | 557 | console.error | 🟡 | `console.error('Error logging file download:', error);` | Error |
| 14 | 578 | console.log | 🟡 | `console.log('[Assessor Dashboard] Loading assessments for assessor:', tutorId);` | **Assessor ID** |
| 15-17 | 591,593,598 | console.error | 🟡 | Qualification submissions API errors | Error, status, response |
| 18 | 603 | console.log | 🔴 | `console.log('[Assessor Dashboard] CPD Quiz attempts:', cpdQuizRes);` | **Full API response** |
| 19 | 604 | console.log | 🔴 | `console.log('[Assessor Dashboard] Qualification submissions response:', qualSubmissionsRes);` | **Full API response** |
| 20 | 605 | console.log | 🟡 | `console.log('[Assessor Dashboard] Qualification submissions count:', ...);` | Count |
| 21 | 617 | console.log | 🟡 | `console.log('[Assessor Dashboard] Setting qualification submissions:', submissions.length, submissions);` | **Submissions array** |
| 22 | 690-693 | console.log | 🟡 | Regular/CPD quizzes, combined data | **Quiz data, counts** |
| 23 | 697 | console.error | 🟡 | `console.error('Error loading assessor assessments:', err);` | Error |
| 24-26 | 724,729,737 | console.error | 🟡 | Qualification submissions errors | Error |
| 27-29 | 958,1008,1063 | console.error | 🟡 | Error parsing date | Date, error |
| 30 | 2008 | console.error | 🟡 | `console.error('Error deleting feedback:', error);` | Error |
| 31 | 3288 | console.log | 🟢 | `console.log('Pasting content, preserving all formatting');` | Static |
| 32 | 3387 | console.error | 🟡 | `console.error('Error grading submission:', error);` | Error |
| 33 | 3498 | console.log | 🟢 | `console.log('Pasting content, preserving all formatting');` | Static |
| 34 | 3596 | console.error | 🟡 | `console.error('Error updating feedback:', error);` | Error |
| 35 | 3663 | console.log | 🟢 | `console.log('[Assessor Dashboard] PDF loaded successfully');` | Static |
| 36 | 3667 | console.error | 🟡 | `console.error('[Assessor Dashboard] PDF load error');` | Error |

## app/dashboard/tutor/cpd/[courseId]/view/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 105,121,172,218,246,273,314,339,369,410,442,470,497,541 | console.error | 🟡 | Various error handlers | Error objects |
| 8 | 1130 | console.log | 🟢 | `onLoad={() => console.log('[CPD] PDF loaded successfully')}` | Static |
| 9 | 1132 | console.error | 🟡 | `console.error('[CPD] PDF load error:', e);` | Error |
| 10 | 1133 | console.log | 🟡 | `console.log('[CPD] Failed URL:', viewingFile.url);` | **File URL** |

## app/dashboard/tutor/courses/[id]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-30 | Multiple | console.log/error | 🟡🔴 | Similar to tutor/page.tsx | Assessor ID, submissions, quiz data, file paths |

## app/dashboard/tutor/team/all/[subTutorId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-5 | 146,165,184,200,235 | console.error | 🟡 | Various error handlers | Error objects |

## app/dashboard/tutor/team/today/[subTutorId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 59 | console.error | 🟡 | `console.error('[Today Submissions] Error fetching data:', error);` | Error |
| 2 | 507 | console.log | 🟢 | `console.log('Closing modal');` | Static |

## app/dashboard/tutor/team/pending/[subTutorId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 47 | console.error | 🟡 | `console.error('[Pending Submissions] Error fetching data:', error);` | Error |

## app/dashboard/tutor/team/feedback/[subTutorId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 48 | console.error | 🟡 | `console.error('[Feedback Given] Error fetching data:', error);` | Error |

## app/dashboard/tutor/cpd/create/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 57 | console.error | 🟡 | `console.error('Error loading categories:', error);` | Error |
| 2 | 105 | console.error | 🟡 | `console.error('Error creating CPD course:', error);` | Error |

## app/dashboard/tutor/students/[studentId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 92 | console.error | 🟡 | `console.error('Error fetching student data:', error);` | Error |

---

# MANAGER DASHBOARD — app/dashboard/manager/

## app/dashboard/manager/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 95 | console.log | 🔴 | `console.log('Fetching manager data...');` | Static |
| 2 | 96 | console.log | 🔴 | `console.log('User:', user);` | **Full user object** |
| 3 | 103 | console.log | 🔴 | `console.log('Students response:', studentsRes);` | **API response** |
| 4 | 104 | console.log | 🔴 | `console.log('Staff response:', staffRes);` | **API response** |
| 5 | 107 | console.log | 🔴 | `console.log('Students API response:', studentsRes.value);` | **Full students data** |
| 6 | 110 | console.log | 🔴 | `console.log('Fetched students:', fetchedStudents);` | **Student list** |
| 7 | 113 | console.error | 🟡 | `console.error('API returned unsuccessful:', studentsRes.value);` | API response |
| 8 | 117 | console.error | 🟡 | `console.error('Failed to fetch students:', studentsRes.reason);` | Error |
| 9 | 118 | console.error | 🟡 | `console.error('Error details:', studentsRes.reason?.message);` | Error message |
| 10 | 123 | console.log | 🔴 | `console.log('Staff API response:', staffRes.value);` | **Full staff data** |
| 11 | 129 | console.log | 🔴 | `console.log('Fetched staff:', staffWithColors);` | **Staff list** |
| 12 | 132 | console.error | 🟡 | `console.error('Staff API returned unsuccessful:', staffRes.value);` | API response |
| 13 | 136 | console.error | 🟡 | `console.error('Failed to fetch staff:', staffRes.reason);` | Error |
| 14 | 140 | console.error | 🟡 | `console.error('Error fetching data:', error);` | Error |
| 15 | 167 | console.error | 🟡 | `console.error('Failed to fetch staff students:', res);` | Response |
| 16 | 171 | console.error | 🟡 | `console.error('Error fetching staff students:', error);` | Error |
| 17 | 192 | console.log | 🟡 | `console.log('Fetching progress for student:', studentId);` | **Student ID** |
| 18 | 194 | console.log | 🔴 | `console.log('Student progress response:', res);` | **Full progress data** |
| 19 | 197 | console.log | 🔴 | `console.log('Progress data received:', res);` | **Full progress data** |
| 20 | 198 | console.log | 🟡 | `console.log('Courses count:', res.courses?.length);` | Count |
| 21 | 210 | console.log | 🟡 | `console.log('Updated student progress:', avgProgress);` | Progress |
| 22 | 212 | console.log | 🟢 | `console.log('No courses found for student');` | Static |
| 23 | 217 | console.error | 🟡 | `console.error('Failed to fetch student progress:', res);` | Response |
| 24 | 222 | console.error | 🟡 | `console.error('Error fetching student progress:', error);` | Error |
| 25 | 223 | console.error | 🟡 | `console.error('Error message:', error?.message);` | Error message |

---

# MODERATOR DASHBOARD — app/dashboard/moderator/

## app/dashboard/moderator/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 80 | console.error | 🟡 | `console.error('Error fetching forum data:', error);` | Error |
| 2 | 108 | console.error | 🟡 | `console.error('Error fetching forum stats:', error);` | Error |
| 3 | 134 | console.error | 🟡 | `console.error('Error creating post:', error);` | Error |

---

# TICKETS DASHBOARD — app/dashboard/tickets/

## app/dashboard/tickets/layout.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 62 | console.error | 🟡 | `console.error(e);` | Error |

## app/dashboard/tickets/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-3 | 92,121,143 | console.error | 🟡 | `console.error(e);` | Error |

## app/dashboard/tickets/new/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 53 | console.error | 🟡 | `console.error(e);` | Error |

## app/dashboard/tickets/students/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 44 | console.error | 🟡 | `console.error(e);` | Error |
| 2 | 80 | console.error | 🟡 | `console.error(e);` | Error |

## app/dashboard/tickets/student/[studentId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 56 | console.error | 🟡 | `console.error('Error fetching student profile:', err);` | Error |

## app/dashboard/tickets/courses/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 24 | console.error | 🟡 | `console.error('Error fetching course count:', error);` | Error |

## app/dashboard/tickets/team/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-5 | 43,57,77,99,135 | console.error | 🟡 | `console.error(e);` | Error |

---

# FORUM — app/dashboard/forum/

## app/dashboard/forum/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 206 | console.error | 🟡 | `console.error('Error fetching forum data:', error);` | Error |
| 2 | 248 | console.error | 🟡 | `console.error('Error fetching sidebar data:', error);` | Error |
| 3 | 282 | console.log | 🟡 | `console.log('[Frontend fetchPosts] Post ${post.id}:', {...});` | **Post ID, post data** |
| 4 | 299 | console.log | 🟡 | `console.log('[Frontend fetchPosts] Post ${post.id}: Set reaction to "${post.my_reaction}"');` | Post ID, reaction |
| 5 | 302 | console.log | 🟡 | `console.log('[Frontend fetchPosts] Post ${post.id}: Set reaction to null');` | Post ID |
| 6 | 360 | console.error | 🟡 | `console.error('Error fetching posts:', error);` | Error |
| 7 | 389 | console.error | 🟡 | `console.error('Error creating post:', error);` | Error |
| 8 | 493 | console.error | 🟡 | `console.error('Error reacting to post:', error);` | Error |
| 9 | 539 | console.error | 🟡 | `console.error('Error performing moderator action:', error);` | Error |
| 10 | 809 | console.log | 🟡 | `console.log('[Frontend Render] Post ${post.id}: Using state reaction: "${userReaction}"');` | Post ID, reaction |
| 11 | 816 | console.log | 🟡 | `console.log('[Frontend Render] Post ${post.id}: Using post.my_reaction: "${userReaction}"');` | Post ID, reaction |
| 12 | 819 | console.log | 🟡 | `console.log('[Frontend Render] Post ${post.id}: post.my_reaction is null or invalid');` | Post ID |

## app/dashboard/forum/[postId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 90,105,121,144,170,192,210 | console.error | 🟡 | Various error handlers | Error objects |

---

# CERTIFICATE MANAGER — app/dashboard/certificate-manager/

## app/dashboard/certificate-manager/students/[studentId]/page.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 160 | console.error | 🟡 | `console.error('Error fetching student data:', err);` | Error |

---

# SHARED COMPONENTS — app/components/

## app/components/UserManagement.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 152,175,193,227,269,287 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/Navbar.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 628 | console.log | 🟢 | `console.log('[Notification Click] ✅ Navigation successful via utility');` | Static (wrapped in dev check) |

## app/components/CertificateClaimsManagement.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 154,173,189,460,481,522,555 | console.error/log | 🟡🟢 | Various | Claim ID, errors (173 wrapped in dev) |

## app/components/PaymentNotification.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 88,95,127,210,216,224,231 | console.log | 🟡 | Processing counts, notifications | Installment counts, notification data (wrapped in dev) |

## app/components/FloatingChatProvider.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 61 | console.warn | 🟢 | `console.warn('FloatingChatProvider not initialized');` | Static (wrapped in dev) |

## app/components/ChatBox.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 146 | console.log | 🟢 | `console.log('✅ Updating status for conversation participant');` | Static (wrapped in dev) |
| 2 | 152 | console.log | 🟢 | `console.log('⏭️ Ignoring - not the other user in this conversation');` | Static (wrapped in dev) |

## app/components/PaymentManagementView.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-4 | 136,184,242,533 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/ImpersonationBanner.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 46 | console.error | 🟡 | `console.error('Failed to restore admin session');` | Error |
| 2 | 51 | console.error | 🟡 | `console.error('Stop impersonation error:', err);` | Error |

## app/components/ImpersonationLogs.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 40 | console.error | 🟡 | `console.error('Error fetching impersonation logs:', err);` | Error |

## app/components/StudentEnrollment.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-4 | 115,140,353,402 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/StudentsProfileView.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 75 | console.error | 🟡 | `console.error('Error fetching student profiles:', error);` | Error |

## app/components/GeneratedCertificatesManagement.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-4 | 73,87,112,196 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/AssessorStudentReports.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-4 | 49,60,76,92 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/CourseManagement.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 116 | console.log | 🟢 | `console.log('✅ Categories refreshed:', categoriesData.categories.length);` | Count (wrapped) |
| 2-17 | 119,140,158,182,200,217,246,285,332,373,397,409,422,437 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/CertificateTemplateManager.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 50,106,135,154,192,222 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/AITokenManagement.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 160,240,263,311,376,398,425 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/Navbar.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 628 | console.log | 🟢 | `console.log('[Notification Click] ✅ Navigation successful via utility');` | Static (wrapped in dev) |

## app/components/accounts/* (PendingInstallmentsTab, PaymentSettingsTab, ReminderLogsTab, ReceivedInstallmentsTab)
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-4 | Various | console.error | 🟡 | `console.error(e);` | Error objects |

## app/components/UniversalFileViewer.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 30 | console.error | 🟡 | `console.error('Error logging file close:', e);` | Error |

## app/components/CertificateQueriesView.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-2 | 61,81 | console.error | 🟡 | `console.error(e);` | Error |

## app/components/StudentAcademicProgressModal.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 55 | console.error | 🟡 | `console.error(e);` | Error |

## app/components/StudentFinancePaymentsModal.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-2 | 115,178 | console.error | 🟡 | `console.error(e);` | Error |

## app/components/DeadlineSetupModal.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 110 | console.error | 🟡 | `console.error('Error saving deadlines:', error);` | Error |

## app/components/CertificateEditor.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 84 | console.error | 🟡 | `console.error('Error loading certificate:', error);` | Error |

## app/components/CommentsSection.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1-7 | 139,162,188,210,229,305 | console.error | 🟡 | Various error handlers | Error objects |

## app/components/AIActionLogs.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 76 | console.error | 🟡 | `console.error('Error fetching AI logs:', error);` | Error |

## app/components/PaymentStatusUpdate.tsx
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 68 | console.error | 🟡 | `console.error('Error updating payment status:', error);` | Error |

---

# BACKEND ROUTES — backend/routes/

## CRITICAL BACKEND WARNING

Backend console logs are **MORE dangerous** than frontend because:
- They appear in server logs (PM2, nginx logs)
- They can be accessed by anyone with server access
- They persist in log files
- If log files are breached, all data is exposed
- GDPR requires protection of this data

## backend/routes/certificates.js — 🔴 CRITICAL
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 453 | console.log | 🔴 | `console.log('[Certificate Claim] ===== REQUEST RECEIVED =====');` | Static |
| 2 | 454 | console.log | 🔴 | `console.log('[Certificate Claim] Request body:', JSON.stringify(req.body, null, 2));` | **req.body — may contain personal data** |
| 3 | 455 | console.log | 🔴 | `console.log('[Certificate Claim] User ID from token:', req.user?.id);` | **User ID** |
| 4 | 460 | console.log | 🔴 | `console.log('[Certificate Claim] Parsed values:', { studentId, courseId, fullName, email });` | **Student ID, Course ID, Full Name, Email** |
| 5 | 1782 | console.log | 🔴 | `console.log('Test Auth - Token from header:', authHeader ? 'Present' : 'None');` | Auth header presence |
| 6 | 1783 | console.log | 🔴 | `console.log('Test Auth - Token from query:', tokenFromQuery ? 'Present' : 'None');` | Token presence |
| 7 | 1784 | console.log | 🔴 | `console.log('Test Auth - Final token:', token ? token.substring(0, 20) + '...' : 'None');` | **JWT token prefix** |
| 8 | 1799 | console.log | 🔴 | `console.log('Test Auth - Token verified for user:', decoded.id);` | **User ID from JWT** |
| 9 | 1811 | console.log | 🟡 | `console.log('Test Auth - Token verification failed:', err.message);` | Error message |
| 10 | 2340 | console.log | 🔴 | `console.log('New data:', { STUDENT_NAME, COURSE_NAME, REGISTRATION_NO, DATE_OF_ISSUANCE });` | **Student name, course, registration** |

## backend/routes/paymentInstallments.js — 🔴 CRITICAL
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 830 | console.error | 🔴 | `console.error('Error stack:', error.stack);` | **Full stack trace** |
| 2 | 831 | console.error | 🔴 | `console.error('Assessor ID:', req.user?.id);` | **User ID** |
| 3 | 832 | console.error | 🔴 | `console.error('Assessor Role:', req.user?.role);` | **User role** |
| 4 | 850 | console.log | 🟡 | `console.log('🔔 Webhook received:', new Date().toISOString());` | Timestamp |
| 5 | 854 | console.log | 🟡 | `console.log('❌ No stripe-signature header');` | Static |
| 6 | 858 | console.error | 🔴 | `console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set in .env');` | **Exposes env var name** |
| 7 | 869 | console.log | 🟡 | `console.log('✅ Webhook verified! Event type:', event.type);` | Stripe event type |
| 8 | 871 | console.log | 🟡 | `console.log('❌ Webhook verification failed:', err.message);` | Error message |
| 9 | 895 | console.log | 🟡 | `console.log('[Stripe Webhook] Certificate claim updated for payment ${paymentIntentId}');` | Payment intent ID |
| 10 | 940 | console.log | 🟡 | `console.log('[Stripe Webhook] Installment updated for payment ${paymentIntentId}');` | Payment intent ID |
| 11 | 1040 | console.error | 🟡 | `console.error('[Stripe Webhook] Handler error:', err.message);` | Error |
| 12 | 1041 | console.error | 🔴 | `console.error(err.stack);` | **Full stack trace** |

## backend/routes/studentProfile.js — 🔴 CRITICAL
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 85 | console.log | 🔴 | `console.log('[isProfileComplete] Missing field: ${field}, value:', value, ...);` | **Profile field values** |
| 2 | 299 | console.log | 🔴 | `console.log('[Update Profile] === COMPLETE REQUEST ANALYSIS ===');` | Static |
| 3 | 300 | console.log | 🔴 | `console.log('[Update Profile] Full req.body:', JSON.stringify(req.body, null, 2));` | **Full req.body — personal data** |
| 4 | 321 | console.log | 🔴 | `console.log('[Update Profile] === EXTRACTED VALUES ===');` | Static |
| 5 | 322 | console.log | 🔴 | `console.log('[Update Profile] english_literacy:', english_literacy, ...);` | Profile values |
| 6 | 323 | console.log | 🔴 | `console.log('[Update Profile] ict_skills:', ict_skills, ...);` | Profile values |
| 7 | 331 | console.log | 🔴 | `console.log('[Update Profile] === NORMALIZED VALUES ===');` | Static |
| 8 | 332 | console.log | 🔴 | `console.log('[Update Profile] normalizedEnglishLiteracy:', normalizedEnglishLiteracy);` | Profile values |
| 9 | 333 | console.log | 🔴 | `console.log('[Update Profile] normalizedIctSkills:', normalizedIctSkills);` | Profile values |
| 10 | 394 | console.log | 🔴 | `console.log('[Update Profile] INSERT executed with english_literacy:', ...);` | Profile values |
| 11 | 397 | console.log | 🔴 | `console.log('[Update Profile] Executing UPDATE with english_literacy:', ...);` | Profile values |
| 12 | 414 | console.log | 🔴 | `console.log('[Update Profile] UPDATE executed successfully');` | Static |
| 13 | 426 | console.log | 🔴 | `console.log('[Update Profile] Saved english_literacy:', updatedProfile?.english_literacy);` | Profile data |
| 14 | 427 | console.log | 🔴 | `console.log('[Update Profile] Saved ict_skills:', updatedProfile?.ict_skills);` | Profile data |
| 15 | 431 | console.log | 🔴 | `console.log('[Update Profile] Profile complete check result:', profileComplete);` | Profile status |

## backend/routes/qualification.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 280 | console.log | 🟡 | `console.log('[Qualification] Creating course:', { title, userId });` | Course title, user ID |
| 2 | 281 | console.log | 🟡 | `console.log('[Qualification] Files received:', req.files ? Object.keys(req.files) : 'none');` | File keys |
| 3 | 316 | console.log | 🔴 | `console.log('  - Cloudinary URL:', fileUrl);` | **Cloudinary URL** |
| 4 | 350 | console.log | 🟡 | `console.log('[Qualification] Welcome file:', file.originalname, '- URL:', fileUrl);` | **File URL** |
| 5 | 468 | console.log | 🟡 | `console.log('  - URL:', url);` | URL |
| 6 | 584 | console.log | 🟡 | `console.log('[Qualification] Serving file:', {...});` | File serving info |
| 7 | 1119 | console.log | 🔴 | `console.log('[Qualification] Video uploaded:', file.originalname, 'URL:', file.path);` | **Full file path** |
| 8 | 717 | console.log | 🟡 | `console.log('[Qualification Courses] All enrollments for student ${studentId}:', ...);` | **Student ID, enrollments** |
| 9 | 943 | console.log | 🟡 | `console.log('[Qualification Courses] DEBUG - Units for course 110:', ...);` | **Course data** |
| 10 | 1153 | console.log | 🔴 | `console.log('[Qualification Courses] Courses data:', JSON.stringify(...));` | **Full courses data** |

## backend/routes/admin.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 1083 | console.log | 🟡 | `console.log('[Admin] Created initial profile for student user ID: ${result.insertId}');` | User ID |
| 2 | 1644 | console.log | 🟡 | `console.log('[Deadlines] Setting deadlines for student ${studentId}, course ${courseId}...');` | Student ID, course ID |
| 3 | 1794 | console.error | 🔴 | `console.error('[Deadlines] SQL error sql:', sqlErr.sql);` | **Raw SQL query** |
| 4 | 2058 | console.log | 🟡 | `console.log('[Tutor Submissions] Sub-tutor ${tutorId} - filtering...');` | Tutor ID |
| 5 | 4513 | console.log | 🟡 | `console.log('[Admin Proxy] Received URL:', url);` | **Internal URL** |
| 6 | 4518 | console.log | 🟡 | `console.log('[Admin Proxy] Will fetch URL directly:', fileUrl);` | **File URL** |
| 7 | 4649 | console.log | 🟡 | `console.log('[Admin] Fetching students profiles. Query:', query.substring(0, 200) + '...');` | **SQL query** |
| 8 | 4650 | console.log | 🟡 | `console.log('[Admin] Params:', params);` | **Query params** |
| 9 | 4654 | console.log | 🟡 | `console.log('[Admin] Found', rows.length, 'students');` | Count |
| 10 | 4788 | console.log | 🟡 | `console.log('[Tutor Students Profiles] Fetching all students profiles...');` | Static |
| 11 | 4789 | console.log | 🟡 | `console.log('[Tutor Students Profiles] Search:', search || 'none');` | Search term |
| 12 | 4790 | console.log | 🟡 | `console.log('[Tutor Students Profiles] Status filter:', status || 'none');` | Status |
| 13 | 4794 | console.log | 🟡 | `console.log('[Tutor Students Profiles] Found', rows.length, 'students');` | Count |
| 14 | 3950 | console.log | 🟡 | `console.log('📦 Starting Moodle backup extraction...');` | Static |
| 15 | 3951 | console.log | 🟡 | `console.log('📁 File path: ${filePath}');` | **File path** |
| 16 | 3109 | console.log | 🟡 | `console.log('Cloudinary deletion result:', result);` | Cloudinary result |

## backend/routes/student.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 387 | console.log | 🟡 | `console.log('[Student Tutors] Student ${studentId} has assigned tutor...');` | Student ID, tutor ID |
| 2 | 398 | console.log | 🟡 | `console.log('[Student Tutors] Student ${studentId} has no assigned tutor...');` | Student ID |
| 3 | 633 | console.log | 🟡 | `console.log('[Student Grades] Fetching grades for student ${studentId}');` | Student ID |
| 4 | 662 | console.log | 🟡 | `console.log('[Student Grades] Found ${grades.length} graded submissions');` | Count |
| 5 | 681 | console.log | 🟡 | `console.log('[Qualification Courses] Fetching courses for student ${studentId}');` | Student ID |
| 6 | 717 | console.log | 🔴 | `console.log('[Qualification Courses] All enrollments for student ${studentId}:', ...);` | **Student ID, enrollments** |
| 7 | 726 | console.log | 🔴 | `console.log('[Qualification Courses] Qualification enrollments (case-insensitive):', ...);` | **Enrollment data** |
| 8 | 735 | console.log | 🔴 | `console.log('[Qualification Courses] Course 64 details:', course64[0]);` | **Course data** |
| 9 | 897 | console.error | 🔴 | `console.error('[Qualification Courses] Query:', query);` | **Raw SQL query** |
| 10 | 898 | console.error | 🔴 | `console.error('[Qualification Courses] Params:', params);` | **Query params** |
| 11 | 943 | console.log | 🔴 | `console.log('[Qualification Courses] DEBUG - Units for course 110:', ...);` | **Course/unit data** |
| 12 | 1153 | console.log | 🔴 | `console.log('[Qualification Courses] Courses data:', JSON.stringify(...));` | **Full courses data** |

## backend/routes/manager.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 50 | console.log | 🟡 | `console.log('[Manager] Found ${students.length} students for manager ${managerId}');` | Manager ID, count |
| 2 | 52 | console.log | 🔴 | `console.log('[Manager] Sample student:', students[0]);` | **Full student object** |
| 3 | 157 | console.log | 🟡 | `console.log('[Manager] Found ${students.length} students for staff ${staffId}');` | Staff ID, count |
| 4 | 159 | console.log | 🔴 | `console.log('[Manager] Sample student:', students[0]);` | **Full student object** |
| 5 | 194 | console.log | 🟡 | `console.log('[Manager] Student check for student ${studentId} under manager ${managerId}:', ...);` | Student ID, manager ID |
| 6 | 204 | console.log | 🔴 | `console.log('[Manager] Student verified: ${studentCheck[0].name} (ID: ${studentCheck[0].id})');` | **Student name, ID** |
| 7 | 221 | console.log | 🟡 | `console.log('[Manager] Found ${courses.length} courses for student ${studentId}');` | Student ID, count |
| 8 | 223 | console.log | 🔴 | `console.log('[Manager] Sample course:', courses[0]);` | **Full course object** |
| 9 | 360 | console.log | 🔴 | `console.log('[Manager] Returning progress for student ${studentId}:', {...});` | **Student ID, progress data** |

## backend/routes/forum.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 204 | console.log | 🟡 | `console.log('[Auth] Token verified for user:', decoded.id, 'Role:', decoded.role);` | User ID, role |
| 2 | 209 | console.log | 🟡 | `console.log('[Auth] Optional token verification failed:', err.message);` | Error |
| 3 | 593 | console.log | 🟡 | `console.log('[Forum GET] Querying reactions for user ${userIdInt}...');` | User ID |
| 4 | 601 | console.log | 🔴 | `console.log('[Forum GET] Found ${userReacts.length} reactions for user ${userIdInt}:', userReacts);` | **User ID, reactions** |
| 5 | 635 | console.log | 🔴 | `console.log('[Forum GET] Post ${post.id}: User ${req.user.id}, my_reaction: ...');` | **Post ID, user ID** |
| 6 | 951 | console.log | 🟡 | `console.log('[Forum] Post created by user ${authorId}, role: ${userRole}...');` | Author ID, role |
| 7 | 973 | console.log | 🟡 | `console.log('[Forum] Found ${students.length} students to notify about post ${postId}');` | Student count, post ID |
| 8 | 993 | console.error | 🟡 | `console.error('[Forum] createNotification returned null for student ${student.id}');` | Student ID |
| 9 | 997 | console.error | 🟡 | `console.error('[Forum] Error creating notification for student ${student.id}:', err);` | Student ID, error |
| 10 | 1486 | console.log | 🟡 | `console.log('[Forum REACT] Received: postId=${postId}, userId=${req.user.id}...');` | Post ID, user ID |
| 11 | 1535 | console.log | 🔴 | `console.log('[Forum REACT] Found existing reactions:', currentReaction);` | **Reaction data** |
| 12 | 1600 | console.log | 🟡 | `console.log('[Forum REACT] Query result:', myReaction);` | Reaction data |

## backend/routes/cpd.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 31 | console.log | 🟡 | `console.log('[CPD] Multer fileFilter - File:', file.originalname, 'MIME:', file.mimetype);` | File name, MIME |
| 2 | 187 | console.log | 🔴 | `console.log('=== CPD Course Creation Started ===');` | Static |
| 3 | 188 | console.log | 🔴 | `console.log('Request body:', req.body);` | **Full req.body** |
| 4 | 189 | console.log | 🔴 | `console.log('Files:', req.files ? Object.keys(req.files) : 'No files');` | File keys |
| 5 | 321 | console.error | 🔴 | `console.error('Request body:', req.body);` | **Full req.body** |
| 6 | 562 | console.log | 🟡 | `console.log('[CPD] Adding topic to course:', courseId);` | Course ID |
| 7 | 563 | console.log | 🟡 | `console.log('[CPD] Topic data:', { topic_number, title, description, deadline });` | Topic data |
| 8 | 775 | console.log | 🟡 | `console.log('=== CPD GIFT Import Started ===');` | Static |
| 9 | 776 | console.log | 🟡 | `console.log('Topic ID:', topicId);` | Topic ID |
| 10 | 777 | console.log | 🟡 | `console.log('Quiz Type:', quiz_type);` | Quiz type |
| 11 | 778 | console.log | 🟡 | `console.log('Passing Score:', passing_score);` | Passing score |
| 12 | 809 | console.log | 🟡 | `console.log('Parsed questions:', questions.length);` | Count |
| 13 | 1066 | console.log | 🟡 | `console.log('[CPD] Proxying PDF:', url);` | **URL** |

## backend/routes/notifications.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 94 | console.log | 🔴 | `console.log('[Notifications] Query:', queryWithLimit);` | **SQL query** |
| 2 | 95 | console.log | 🔴 | `console.log('[Notifications] Params:', params);` | **Query params** |
| 3 | 96 | console.log | 🟡 | `console.log('[Notifications] Limit:', finalLimit, 'Offset:', finalOffset);` | Pagination |

## backend/routes/auth.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 167 | console.log | 🟡 | `console.log('✅ Token refreshed for user: ${user.name} (${rolesMap[user.role_id]})');` | **User name, role** |
| 2 | 211 | console.warn | 🟡 | `console.warn('[Logout] Redis blacklist failed:', redisErr.message);` | Redis error |

## backend/routes/documentVerification.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 55 | console.log | 🟡 | `console.log('Admin notification created:', { type, title });` | Notification type |
| 2 | 313 | console.log | 🟡 | `console.log('Document ${action}d:', {...});` | Document action |

## backend/routes/cpd.js — 🟡 CAUTION
| # | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | 31 | console.log | 🟡 | `console.log('[CPD] Multer fileFilter - File:', file.originalname, 'MIME:', file.mimetype);` | File name, MIME |
| 2 | 187-189 | console.log | 🔴 | Request body, Files | **req.body, req.files** |
| 3 | 321-323 | console.error | 🔴 | Error stack, Request body | **req.body, stack** |

---

# BACKEND MIDDLEWARE — backend/middleware/

| FILE | LINES | TYPE | RISK | CONTAINS |
|------|-------|------|------|----------|
| auth.js | Multiple | console.error | 🟡 | Auth errors |
| rateLimiter.js | Multiple | console.error | 🟡 | Rate limit errors |
| aiAuth.js | Multiple | console.error | 🟡 | AI auth errors |

---

# BACKEND SERVICES — backend/services/

| FILE | LINES | TYPE | RISK | CONTAINS |
|------|-------|------|------|----------|
| certificateGenerator.js | 63 | console.log/error | 🟡🟢 | Certificate generation |
| zoomService.js | 2 | console.error | 🟡 | Zoom API errors |
| assessorActivityLogger.js | 4 | console.error | 🟡 | Activity log errors |
| aiLogger.js | 3 | console.error | 🟡 | AI log errors |
| aiTokenService.js | 13 | console.error | 🟡 | Token service errors |
| backupService.js | 7 | console.error | 🟡 | Backup errors |

---

# BACKEND CRON — backend/cron/

| FILE | LINES | TYPE | RISK | CONTAINS |
|------|-------|------|------|----------|
| autoReminder.js | 1 | console.error | 🟡 | Reminder error |

---

# BACKEND CONFIG — backend/config/

| FILE | LINES | TYPE | RISK | CONTAINS |
|------|-------|------|------|----------|
| db.js | 7 | console.log/error | 🟢🟡 | DB connection (startup) |
| cloudinary.js | 1 | console.error | 🟡 | Cloudinary error |

---

# BACKEND CONFIG — backend/server.js

|  | LINE | TYPE | RISK | CODE | CONTAINS |
|---|------|------|------|------|----------|
| 1 | ~100 | console.log | 🟢 | Server startup message | Port, DB connected |

---

# SUMMARY

## TOTALS (estimated)

| Category | Count |
|----------|-------|
| **Total console logs found** | ~500+ (frontend) + ~800+ (backend) = **~1300+** |
| **🔴 Dangerous** | ~80+ |
| **🟡 Caution** | ~400+ |
| **🟢 Safe** | ~50+ |

## TOP 10 MOST DANGEROUS

| # | FILE | LINE | EXPOSES | WHY DANGEROUS |
|---|------|------|---------|---------------|
| 1 | backend/routes/certificates.js | 454 | `req.body` (full JSON) | **Personal data** — student name, email, DOB, address in certificate claim |
| 2 | backend/routes/studentProfile.js | 300 | `req.body` (full JSON) | **Personal data** — student profile update |
| 3 | backend/routes/paymentInstallments.js | 831-832 | `req.user?.id`, `req.user?.role` | **User ID, role** in server logs |
| 4 | backend/routes/certificates.js | 1784 | JWT token prefix | **Token exposure** |
| 5 | app/dashboard/manager/page.tsx | 96 | `user` object | **Full user object** |
| 6 | app/dashboard/manager/page.tsx | 110, 129 | `fetchedStudents`, `staffWithColors` | **Student/staff lists** |
| 7 | backend/routes/manager.js | 52, 159, 223 | `students[0]`, `courses[0]` | **Full student/course objects** |
| 8 | backend/routes/student.js | 897-898 | **Raw SQL query, params** | **Database structure, query params** |
| 9 | backend/routes/cpd.js | 188, 323 | `req.body` | **Full request body** |
| 10 | backend/routes/qualification.js | 316, 350, 1119 | Cloudinary URLs, file paths | **Internal file URLs** |

## BREAKDOWN BY AREA

| Area | Total Logs | Dangerous |
|------|-------------|-----------|
| Admin dashboard | ~120 | ~15 |
| Tutor/Assessor dashboard | ~100 | ~10 |
| Manager dashboard | 25 | 15 |
| Moderator dashboard | 3 | 0 |
| Tickets dashboard | 14 | 0 |
| Forum | 19 | 2 |
| Certificate Manager | 1 | 0 |
| Shared components | ~60 | 0 |
| Backend routes | ~800+ | ~60+ |
| Backend middleware | ~15 | 0 |
| Backend services | ~90 | 0 |
| Backend cron | 1 | 0 |
| Backend config | ~8 | 0 |

## FILES WITH MOST LOGS

| # | File | Count |
|---|------|-------|
| 1 | backend/routes/qualification.js | 213 |
| 2 | backend/routes/admin.js | 188 |
| 3 | backend/routes/certificates.js | 124 |
| 4 | backend/routes/cpd.js | 91 |
| 5 | backend/routes/forum.js | 49 |

## BACKEND vs FRONTEND

| | Count |
|---|-------|
| **Backend total** | ~800+ |
| **Frontend (admin/tutor/manager/etc)** | ~350+ |

---

# RECOMMENDATIONS

1. **Priority 1 (CRITICAL):** Remove all backend logs that expose:
   - `req.body`
   - `req.user`
   - JWT tokens
   - SQL queries
   - User IDs, student IDs
   - Cloudinary URLs
   - Full API responses

2. **Priority 2 (HIGH):** Remove all frontend logs that expose:
   - Full API responses
   - User objects
   - Student/staff lists
   - File URLs

3. **Priority 3 (MEDIUM):** Wrap remaining safe logs in `process.env.NODE_ENV === 'development'` or remove.

4. **Backend:** Replace `console.log`/`console.error` with a proper logger (e.g. Pino) that:
   - Does not log sensitive data in production
   - Logs to files only, not stdout in production
   - Sanitizes user data, tokens, etc.

5. **next.config.ts:** Already has `removeConsole` for production — ensures frontend logs are stripped in build.

---

*Report generated by console log audit. No changes were made to the codebase.*
