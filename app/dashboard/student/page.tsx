'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { useEffect, useMemo, useState } from 'react';
import { UserRole, User } from '@/app/components/types';
import { apiService } from '@/app/services/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PaymentNotification from '@/app/components/PaymentNotification';
import LoadingButton from '@/app/components/LoadingButton';

interface Course {
  id: number;
  title: string;
  description: string;
  status: 'In Progress' | 'Completed';
  progress: number;
  instructor: string;
  duration: string;
  modules: number;
  image: string;
  category: string;
  startDate: string;
  rating: number;
  type?: 'regular' | 'cpd';
  course_type?: 'regular' | 'cpd' | 'qualification';
}

interface Assignment {
  id: number;
  course_id: number;
  course_title: string;
  assignment_title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  submission_id: number | null;
  file_path: string | null;
  submitted_at: string | null;
  grade: number | null;
  feedback: string | null;
}

interface CPDCourse {
  course_id: number;
  course_title: string;
  description: string;
  course_status: string;
  category_name: string | null;
  sub_category_name: string | null;
  instructor_name: string | null;
  progress: number;
  total_topics: number;
  completed_topics: number;
  enrolled_at: string;
  upcoming_deadlines: {
    topic_id: number;
    topic_title: string;
    deadline: string;
  }[];
}

interface CPDDeadline {
  topic_id: number;
  topic_title: string;
  course_title: string;
  deadline: string;
}

interface QualificationCourse {
  course_id: number;
  course_title: string;
  description: string;
  course_status: string;
  category_name: string | null;
  sub_category_name: string | null;
  instructor_name: string | null;
  progress: number;
  total_units: number;
  completed_units: number;
  enrolled_at: string;
  upcoming_deadlines: {
    unit_id: number;
    unit_title: string;
    deadline: string;
  }[];
}

interface DeadlineGroup {
  courseId: number;
  courseTitle: string;
  courseType: 'cpd' | 'qualification' | 'assignment';
  deadlines: {
    id: string;
    title: string;
    deadline: string;
    dueLabel: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

const StudentDashboard = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [cpdCourses, setCpdCourses] = useState<CPDCourse[]>([]);
  const [qualificationCourses, setQualificationCourses] = useState<QualificationCourse[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'progress' | 'completed'>('all');
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTutorModal, setShowTutorModal] = useState<boolean>(false);
  const [tutors, setTutors] = useState<{ id: number; name: string; email: string }[]>([]);
  const [profileCompletion, setProfileCompletion] = useState<{ is_complete: boolean; completion_percentage: number; missing_fields: Array<{ label: string }> } | null>(null);
  
  // Loading states for buttons
  const [loadingContinueCourse, setLoadingContinueCourse] = useState<number | null>(null);
  const [loadingChatWithTutor, setLoadingChatWithTutor] = useState(false);
  const [loadingQuickAction, setLoadingQuickAction] = useState<string | null>(null);
  
  // Pagination for deadlines - show 2 individual deadlines at a time
  const [deadlineIndex, setDeadlineIndex] = useState(0);
  const deadlinesPerPage = 2; // Show 2 individual deadlines at a time

  const mapCourseStatus = (status?: string | null): Course['status'] => {
    const normalized = (status || '').trim().toLowerCase();
    if (!normalized) return 'In Progress';
    if (normalized.includes('complete') || normalized === 'completed' || normalized === 'finished') {
      return 'Completed';
    }
    return 'In Progress';
  };

  const clampProgress = (value?: number | null) => {
    if (value === null || value === undefined) return 0;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(100, Math.max(0, Math.round(numeric)));
  };

  const toNumber = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const normalizeRating = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 4.8;
    const clamped = Math.min(5, Math.max(0, numeric));
    return Math.round(clamped * 10) / 10;
  };

  const deriveCourseDuration = (startDate?: string | null, endDate?: string | null) => {
    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) {
        if (endDate) {
          const end = new Date(endDate);
          if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
            const diffWeeks = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)));
            return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'}`;
          }
        }
        return `Started ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
    return 'Self-paced';
  };

  const deriveCourseProgress = (course: any, assignmentsByCourse: Map<number, Assignment[]>) => {
    const grade = toNumber(course?.enrollment_grade);
    if (grade !== null) {
      return clampProgress(grade);
    }
    const courseAssignments = assignmentsByCourse.get(course?.id) || [];
    if (courseAssignments.length > 0) {
      const completedCount = courseAssignments.filter(item => !!item.submission_id).length;
      const progress = (completedCount / courseAssignments.length) * 100;
      return clampProgress(progress);
    }
    if (typeof course?.status === 'string' && course.status.toLowerCase().includes('complete')) {
      return 100;
    }
    return 0;
  };

  const mapCourseFromApi = (course: any, assignmentsByCourse: Map<number, Assignment[]>): Course => {
    return {
      id: course.id,
      title: course.title || 'Untitled Course',
      description: course.description || 'No description provided yet.',
      status: mapCourseStatus(course.enrollment_status || course.status),
      progress: deriveCourseProgress(course, assignmentsByCourse),
      instructor: course.instructor_name || 'Instructor',
      duration: deriveCourseDuration(course.start_date, course.end_date),
      modules: assignmentsByCourse.get(course.id)?.length ?? 0,
      image: '/api/placeholder/400/200',
      category: course.sub_category_name || course.category_name || 'General',
      startDate: course.start_date || '',
      rating: normalizeRating(course.rating)
    };
  };

  useEffect(() => {
    const storedUserRaw = (() => {
      try {
        return JSON.parse(localStorage.getItem('lms-user') || 'null');
      } catch (err) {
        console.error('Unable to parse stored user:', err);
        return null;
      }
    })();

    if (storedUserRaw) {
      const normalizedId = Number((storedUserRaw as { id?: number | string }).id);
      const normalizedUser = {
        ...storedUserRaw,
        id: Number.isFinite(normalizedId) ? normalizedId : undefined,
        name: storedUserRaw.name || 'Student',
        role: storedUserRaw.role || null
      } as User;

      setUser(normalizedUser);
      setUserRole(normalizedUser.role || null);

      if (normalizedUser.id) {
        const fetchStudentData = async (studentId: number) => {
          setIsLoading(true);
          setError(null);

          try {
            const [coursesResponse, assignmentsResponse, cpdCoursesResponse, qualificationCoursesResponse] = await Promise.allSettled([
              apiService.getStudentCourses(studentId),
              apiService.getStudentAssignments(studentId),
              apiService.getStudentCPDCourses(studentId),
              apiService.getStudentQualificationCourses(studentId)
            ]);

            // Handle responses (Promise.allSettled returns {status, value/reason})
            const coursesData = coursesResponse.status === 'fulfilled' ? coursesResponse.value : null;
            const assignmentsData = assignmentsResponse.status === 'fulfilled' ? assignmentsResponse.value : null;
            const cpdCoursesData = cpdCoursesResponse.status === 'fulfilled' ? cpdCoursesResponse.value : null;
            const qualificationCoursesData = qualificationCoursesResponse.status === 'fulfilled' ? qualificationCoursesResponse.value : null;

            // Log any failures
            if (coursesResponse.status === 'rejected') console.error('[Student Dashboard] Failed to load courses:', coursesResponse.reason);
            if (assignmentsResponse.status === 'rejected') console.error('[Student Dashboard] Failed to load assignments:', assignmentsResponse.reason);
            if (cpdCoursesResponse.status === 'rejected') console.error('[Student Dashboard] Failed to load CPD courses:', cpdCoursesResponse.reason);
            if (qualificationCoursesResponse.status === 'rejected') {
              console.error('[Student Dashboard] Failed to load qualification courses:', qualificationCoursesResponse.reason);
            } else if (qualificationCoursesResponse.status === 'fulfilled') {
              console.log('[Student Dashboard] Qualification API response:', qualificationCoursesResponse.value);
              console.log('[Student Dashboard] Qualification courses data:', qualificationCoursesData);
            }

            const assignmentsList: Assignment[] = assignmentsData?.assignments ?? [];
            setAssignments(assignmentsList);

            const assignmentsByCourse = new Map<number, Assignment[]>();
            assignmentsList.forEach(assignment => {
              if (!assignmentsByCourse.has(assignment.course_id)) {
                assignmentsByCourse.set(assignment.course_id, []);
              }
              assignmentsByCourse.get(assignment.course_id)!.push(assignment);
            });

            const mappedCourses: Course[] = (coursesData?.courses ?? []).map((course: any) =>
              mapCourseFromApi(course, assignmentsByCourse)
            );
            setCourses(mappedCourses);

            // Set CPD courses
            const cpdCoursesList: CPDCourse[] = cpdCoursesData?.cpdCourses ?? [];
            console.log('[Student Dashboard] CPD courses loaded:', cpdCoursesList.length);
            console.log('[Student Dashboard] CPD courses with deadlines:', cpdCoursesList.filter(c => c.upcoming_deadlines && c.upcoming_deadlines.length > 0).length);
            cpdCoursesList.forEach(c => {
              if (c.upcoming_deadlines && c.upcoming_deadlines.length > 0) {
                console.log(`[Student Dashboard] CPD Course "${c.course_title}" has ${c.upcoming_deadlines.length} deadlines`);
              }
            });
            setCpdCourses(cpdCoursesList);
            
            // Set Qualification courses
            const qualificationCoursesList: QualificationCourse[] = qualificationCoursesData?.qualificationCourses ?? [];
            console.log('[Student Dashboard] Qualification courses loaded:', qualificationCoursesList.length);
            console.log('[Student Dashboard] Qualification courses with deadlines:', qualificationCoursesList.filter(c => c.upcoming_deadlines && c.upcoming_deadlines.length > 0).length);
            qualificationCoursesList.forEach(c => {
              if (c.upcoming_deadlines && c.upcoming_deadlines.length > 0) {
                console.log(`[Student Dashboard] Qualification Course "${c.course_title}" has ${c.upcoming_deadlines.length} deadlines`);
              }
            });
            setQualificationCourses(qualificationCoursesList);
          } catch (err) {
            console.error('Error loading student dashboard data:', err);
            setError('Unable to load your dashboard data right now.');
            setCourses([]);
            setCpdCourses([]);
            setAssignments([]);
          } finally {
            setIsLoading(false);
          }
        };

        fetchStudentData(normalizedUser.id);
        
        // Fetch profile completion status
        const fetchProfileCompletion = async () => {
          try {
            const completionRes = await apiService.getProfileCompletion();
            if (completionRes?.success) {
              setProfileCompletion(completionRes);
            }
          } catch (err) {
            console.error('Error fetching profile completion:', err);
          }
        };
        fetchProfileCompletion();
      }
    } else {
      setUser(null);
      setUserRole(null);
    }
  }, []);

  const stats = useMemo(() => {
    // Combine regular courses, CPD courses, and qualification courses
    const totalRegularCourses = courses.length;
    const totalCPDCourses = cpdCourses.length;
    const totalQualificationCourses = qualificationCourses.length;
    const totalCourses = totalRegularCourses + totalCPDCourses + totalQualificationCourses;
    
    const inProgressRegular = courses.filter(course => course.status === 'In Progress').length;
    const inProgressCPD = cpdCourses.filter(cpd => cpd.progress < 100).length;
    const inProgressQualification = qualificationCourses.filter(qual => qual.progress < 100).length;
    const inProgress = inProgressRegular + inProgressCPD + inProgressQualification;
    
    const completedRegular = courses.filter(course => course.status === 'Completed').length;
    const completedCPD = cpdCourses.filter(cpd => cpd.progress === 100).length;
    const completedQualification = qualificationCourses.filter(qual => qual.progress === 100).length;
    const completed = completedRegular + completedCPD + completedQualification;
    
    // Calculate average progress including regular, CPD, and qualification courses
    const regularProgress = courses.reduce((acc, course) => acc + (course.progress ?? 0), 0);
    const cpdProgress = cpdCourses.reduce((acc, cpd) => acc + (cpd.progress ?? 0), 0);
    const qualificationProgress = qualificationCourses.reduce((acc, qual) => acc + (qual.progress ?? 0), 0);
    const averageProgress =
      totalCourses > 0
        ? clampProgress((regularProgress + cpdProgress + qualificationProgress) / totalCourses)
        : 0;

    const distinctSubmissionDays = new Set<string>();
    assignments.forEach(assignment => {
      if (!assignment.submitted_at) return;
      const date = new Date(assignment.submitted_at);
      if (!Number.isNaN(date.getTime())) {
        distinctSubmissionDays.add(date.toDateString());
      }
    });

    const learningStreak = distinctSubmissionDays.size > 0 ? distinctSubmissionDays.size : totalCourses > 0 ? 1 : 0;

    return {
      totalCourses,
      inProgress,
      completed,
      averageProgress,
      learningStreak
    };
  }, [courses, cpdCourses, qualificationCourses, assignments]);

  const featuredCourse = useMemo(() => {
    // Check regular courses, CPD courses, and qualification courses for featured course
    const inProgressRegular = courses.find(course => course.status === 'In Progress');
    const inProgressCPD = cpdCourses.find(cpd => cpd.progress < 100);
    const inProgressQualification = qualificationCourses.find(qual => qual.progress < 100);
    
    // Prioritize in-progress courses, then fall back to any course
    if (inProgressRegular) {
      return { ...inProgressRegular, type: 'regular' as const };
    }
    if (inProgressCPD) {
      return {
        id: inProgressCPD.course_id,
        title: inProgressCPD.course_title,
        description: inProgressCPD.description,
        status: 'In Progress' as const,
        progress: inProgressCPD.progress,
        instructor: inProgressCPD.instructor_name || 'Instructor',
        duration: 'Self-paced',
        modules: inProgressCPD.total_topics,
        image: '/api/placeholder/400/200',
        category: inProgressCPD.category_name || inProgressCPD.sub_category_name || 'CPD',
        startDate: inProgressCPD.enrolled_at || '',
        rating: 4.8,
        type: 'cpd' as const,
        course_type: 'cpd' as const
      };
    }
    if (inProgressQualification) {
      return {
        id: inProgressQualification.course_id,
        title: inProgressQualification.course_title,
        description: inProgressQualification.description,
        status: 'In Progress' as const,
        progress: inProgressQualification.progress,
        instructor: inProgressQualification.instructor_name || 'Instructor',
        duration: 'Self-paced',
        modules: inProgressQualification.total_units,
        image: '/api/placeholder/400/200',
        category: inProgressQualification.category_name || inProgressQualification.sub_category_name || 'Qualification',
        startDate: inProgressQualification.enrolled_at || '',
        rating: 4.8,
        type: 'qualification' as const,
        course_type: 'qualification' as const
      };
    }
    
    // Fall back to first available course (check qualification courses too)
    if (qualificationCourses.length > 0) {
      const qual = qualificationCourses[0];
      return {
        id: qual.course_id,
        title: qual.course_title,
        description: qual.description,
        status: qual.progress === 100 ? 'Completed' as const : 'In Progress' as const,
        progress: qual.progress,
        instructor: qual.instructor_name || 'Instructor',
        duration: 'Self-paced',
        modules: qual.total_units,
        image: '/api/placeholder/400/200',
        category: qual.category_name || qual.sub_category_name || 'Qualification',
        startDate: qual.enrolled_at || '',
        rating: 4.8,
        type: 'qualification' as const,
        course_type: 'qualification' as const
      };
    }
    if (courses.length > 0) {
      return { ...courses[0], type: 'regular' as const };
    }
    if (cpdCourses.length > 0) {
      const firstCPD = cpdCourses[0];
      return {
        id: firstCPD.course_id,
        title: firstCPD.course_title,
        description: firstCPD.description,
        status: firstCPD.progress === 100 ? 'Completed' as const : 'In Progress' as const,
        progress: firstCPD.progress,
        instructor: firstCPD.instructor_name || 'Instructor',
        duration: 'Self-paced',
        modules: firstCPD.total_topics,
        image: '/api/placeholder/400/200',
        category: firstCPD.category_name || firstCPD.sub_category_name || 'CPD',
        startDate: firstCPD.enrolled_at || '',
        rating: 4.8,
        type: 'cpd' as const
      };
    }
    
    return null;
  }, [courses, cpdCourses, qualificationCourses]);

  const filteredCourses = useMemo(() => {
    if (activeTab === 'all') return courses;
    if (activeTab === 'progress') return courses.filter(course => course.status === 'In Progress');
    return courses.filter(course => course.status === 'Completed');
  }, [courses, activeTab]);

  const filteredCPDCourses = useMemo(() => {
    if (activeTab === 'all') return cpdCourses;
    if (activeTab === 'progress') return cpdCourses.filter(cpd => cpd.progress < 100);
    return cpdCourses.filter(cpd => cpd.progress === 100);
  }, [cpdCourses, activeTab]);

  const filteredQualificationCourses = useMemo(() => {
    if (activeTab === 'all') return qualificationCourses;
    if (activeTab === 'progress') return qualificationCourses.filter(qual => qual.progress < 100);
    return qualificationCourses.filter(qual => qual.progress === 100);
  }, [qualificationCourses, activeTab]);

  // Helper function to format deadline label
  const formatDeadlineLabel = (dueDate: Date, now: Date) => {
    // Normalize dates to start of day for comparison (handles DATE vs DATETIME)
    const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffMs = dueDateStart.getTime() - nowStart.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Overdue since ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        priority: 'high' as const
      };
    } else if (diffDays === 0) {
      // Check if deadline has time component
      const hasTime = dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0 || dueDate.getSeconds() !== 0;
      if (hasTime) {
        return {
          label: `Today, ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          priority: 'high' as const
        };
      } else {
        return {
          label: 'Today',
          priority: 'high' as const
        };
      }
    } else if (diffDays === 1) {
      const hasTime = dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0 || dueDate.getSeconds() !== 0;
      if (hasTime) {
        return {
          label: `Tomorrow, ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          priority: 'high' as const
        };
      } else {
        return {
          label: 'Tomorrow',
          priority: 'high' as const
        };
      }
    } else if (diffDays <= 3) {
      return {
        label: `${diffDays} days left`,
        priority: 'medium' as const
      };
    } else {
      return {
        label: dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        priority: 'low' as const
      };
    }
  };

  // Group deadlines by course
  const deadlineGroups = useMemo(() => {
    const now = new Date();
    const groups: DeadlineGroup[] = [];

    console.log('[Deadlines] Processing CPD courses:', cpdCourses.length);
    console.log('[Deadlines] Processing Qualification courses:', qualificationCourses.length);
    console.log('[Deadlines] Processing Assignments:', assignments.length);

    // Process CPD course deadlines
    cpdCourses.forEach(cpdCourse => {
      if (cpdCourse.upcoming_deadlines && cpdCourse.upcoming_deadlines.length > 0) {
        const deadlines = cpdCourse.upcoming_deadlines.map(deadline => {
          const dueDate = new Date(deadline.deadline);
          if (Number.isNaN(dueDate.getTime())) return null;
          
          const { label, priority } = formatDeadlineLabel(dueDate, now);
          
          return {
            id: `cpd-${deadline.topic_id}`,
            title: deadline.topic_title,
            deadline: deadline.deadline,
            dueLabel: label,
            priority
          };
        }).filter(Boolean) as any[];

        if (deadlines.length > 0) {
          groups.push({
            courseId: cpdCourse.course_id,
            courseTitle: cpdCourse.course_title,
            courseType: 'cpd',
            deadlines: deadlines.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
          });
        }
      }
    });

    // Process Qualification course deadlines
    qualificationCourses.forEach(qualCourse => {
      console.log(`[Deadlines] Processing Qualification course: ${qualCourse.course_title}`);
      console.log(`[Deadlines] Has upcoming_deadlines:`, qualCourse.upcoming_deadlines);
      console.log(`[Deadlines] upcoming_deadlines length:`, qualCourse.upcoming_deadlines?.length || 0);
      
      // Include course even if it has no deadlines, but only if it has upcoming_deadlines array
      if (qualCourse.upcoming_deadlines && Array.isArray(qualCourse.upcoming_deadlines)) {
        const deadlines = qualCourse.upcoming_deadlines
          .map((deadline, index) => {
            console.log(`[Deadlines] Processing deadline ${index}:`, deadline);
            if (!deadline || !deadline.deadline) {
              console.log(`[Deadlines] Deadline ${index} skipped: no deadline property`);
              return null;
            }
            const dueDate = new Date(deadline.deadline);
            if (Number.isNaN(dueDate.getTime())) {
              console.log(`[Deadlines] Deadline ${index} skipped: invalid date`);
              return null;
            }
            
            const { label, priority } = formatDeadlineLabel(dueDate, now);
            
            return {
              id: `qual-${deadline.unit_id}`,
              title: deadline.unit_title || 'Untitled Unit',
              deadline: deadline.deadline,
              dueLabel: label,
              priority
            };
          })
          .filter(Boolean) as any[];

        console.log(`[Deadlines] Qualification course "${qualCourse.course_title}" processed ${deadlines.length} valid deadlines`);
        
        // Only add group if it has deadlines
        if (deadlines.length > 0) {
          groups.push({
            courseId: qualCourse.course_id,
            courseTitle: qualCourse.course_title,
            courseType: 'qualification',
            deadlines: deadlines.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
          });
          console.log(`[Deadlines] Added qualification course group: ${qualCourse.course_title}`);
        } else {
          console.log(`[Deadlines] Skipped qualification course group (no valid deadlines): ${qualCourse.course_title}`);
        }
      } else {
        console.log(`[Deadlines] Qualification course "${qualCourse.course_title}" has no upcoming_deadlines array`);
      }
    });

    // Process assignment deadlines (group by course)
    const assignmentGroups = new Map<number, {
      courseId: number;
      courseTitle: string;
      deadlines: any[];
    }>();

    assignments
      .filter(assignment => assignment.due_date && !assignment.submission_id)
      .forEach(assignment => {
        const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
        if (!dueDate || Number.isNaN(dueDate.getTime())) return;

        const { label, priority } = formatDeadlineLabel(dueDate, now);
        
        if (!assignmentGroups.has(assignment.course_id)) {
          assignmentGroups.set(assignment.course_id, {
            courseId: assignment.course_id,
            courseTitle: assignment.course_title || 'Course',
            deadlines: []
          });
        }

        assignmentGroups.get(assignment.course_id)!.deadlines.push({
          id: `assignment-${assignment.id}`,
          title: assignment.assignment_title || 'Untitled Assignment',
          deadline: assignment.due_date,
          dueLabel: label,
          priority
        });
      });

    // Add assignment groups
    assignmentGroups.forEach(group => {
      groups.push({
        courseId: group.courseId,
        courseTitle: group.courseTitle,
        courseType: 'assignment',
        deadlines: group.deadlines.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      });
    });

    // Sort groups by earliest deadline in each group
    const sorted = groups.sort((a, b) => {
      const aEarliest = a.deadlines[0] ? new Date(a.deadlines[0].deadline).getTime() : Infinity;
      const bEarliest = b.deadlines[0] ? new Date(b.deadlines[0].deadline).getTime() : Infinity;
      return aEarliest - bEarliest;
    });
    
    console.log('[Deadlines] Total deadline groups:', sorted.length);
    sorted.forEach((g, i) => {
      console.log(`[Deadlines] Group ${i + 1}: ${g.courseTitle} (${g.deadlines.length} deadlines)`);
    });
    
    return sorted;
  }, [assignments, cpdCourses, qualificationCourses]);

  // Flatten all deadlines from all groups into a single array with course info
  const allDeadlines = useMemo(() => {
    const flattened: Array<{
      id: string;
      title: string;
      deadline: string;
      dueLabel: string;
      priority: 'high' | 'medium' | 'low';
      courseTitle: string;
      courseId: number;
    }> = [];
    
    deadlineGroups.forEach(group => {
      group.deadlines.forEach(deadline => {
        flattened.push({
          ...deadline,
          courseTitle: group.courseTitle,
          courseId: group.courseId
        });
      });
    });
    
    return flattened;
  }, [deadlineGroups]);

  // Get current page of deadlines (2 at a time)
  const displayedDeadlines = useMemo(() => {
    const start = deadlineIndex;
    const end = start + deadlinesPerPage;
    return allDeadlines.slice(start, end);
  }, [allDeadlines, deadlineIndex]);

  const canGoPrevious = deadlineIndex > 0;
  const canGoNext = deadlineIndex + deadlinesPerPage < allDeadlines.length;

  const handleContinueCourse = async (courseId: number, courseType?: string, courseTitle?: string) => {
    if (!courseId || loadingContinueCourse === courseId) return;
    
    setLoadingContinueCourse(courseId);
    
    try {
      console.log('[Student Dashboard] Navigating to course:', courseId, 'Type:', courseType, 'Title:', courseTitle);
      
      // Detect qualification courses by title if course_type is not set
      const isQualification = courseType === 'qualification' || 
                             (courseTitle && (courseTitle.includes('Qualifi') || courseTitle.includes('Level 6 Diploma')));
      
      // Route based on course type
      if (isQualification) {
        console.log('[Student Dashboard] Routing to qualification course');
        router.push(`/dashboard/student/qualification/${courseId}/view`);
      } else if (courseType === 'cpd') {
        console.log('[Student Dashboard] Routing to CPD course');
        router.push(`/dashboard/student/cpd/${courseId}`);
      } else {
        console.log('[Student Dashboard] Routing to regular course');
        router.push(`/dashboard/student/courses/${courseId}`);
      }
    } catch (error) {
      console.error('Error navigating to course:', error);
      setLoadingContinueCourse(null);
    }
  };

  const handleContinueCPDCourse = async (courseId: number) => {
    if (!courseId || loadingContinueCourse === courseId) return;
    setLoadingContinueCourse(courseId);
    try {
      router.push(`/dashboard/student/cpd/${courseId}`);
    } catch (error) {
      console.error('Error navigating to CPD course:', error);
      setLoadingContinueCourse(null);
    }
  };
  
  const handleContinueQualificationCourse = async (courseId: number) => {
    if (!courseId || loadingContinueCourse === courseId) return;
    setLoadingContinueCourse(courseId);
    try {
      router.push(`/dashboard/student/qualification/${courseId}/view`);
    } catch (error) {
      console.error('Error navigating to qualification course:', error);
      setLoadingContinueCourse(null);
    }
  };

  const handleChatWithTutor = async () => {
    if (!user?.id || loadingChatWithTutor) return;
    
    setLoadingChatWithTutor(true);
    try {
      const response = await apiService.getStudentTutors(user.id);
      if (response.success && response.tutors && response.tutors.length > 0) {
        setTutors(response.tutors);
        setShowTutorModal(true);
      } else {
        alert('No tutors found. You may not be enrolled in any courses yet.');
      }
    } catch (err) {
      console.error('Error fetching tutors:', err);
      alert('Unable to load tutors. Please try again later.');
    } finally {
      setLoadingChatWithTutor(false);
    }
  };

  const startChatWithTutor = async (tutorId: number) => {
    if (!user?.id || loadingChatWithTutor) return;

    setLoadingChatWithTutor(true);
    try {
      // Use dynamic API URL helper
      const { getApiUrl } = await import('@/app/utils/apiUrl');
      const apiUrl = getApiUrl();
      
      // Start a conversation with the tutor
      const response = await fetch(`${apiUrl}/api/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user.id,
          tutor_id: tutorId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      if (data.success && data.conversation) {
        // Redirect to chat page with the conversation
        router.push(`/chat?conversation=${data.conversation.id}`);
      } else {
        alert('Unable to start chat. Please try again.');
        setLoadingChatWithTutor(false);
      }
    } catch (err) {
      console.error('Error starting chat:', err);
      alert('Unable to start chat. Please try again.');
      setLoadingChatWithTutor(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['Student', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
      {user && typeof user.id === 'number' && <PaymentNotification userId={user.id} />}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] rounded-full blur-3xl opacity-10 animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-[#E51791] to-[#c3147f] rounded-full blur-3xl opacity-10 animate-float-delayed"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-5 animate-pulse"></div>
        </div>

        <div className="relative max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 md:space-y-8">
          {/* Profile Completion Banner */}
          {profileCompletion && !profileCompletion.is_complete && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">📝</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Complete Your Profile</h3>
                      <p className="text-sm text-gray-600">
                        Your profile is {profileCompletion.completion_percentage}% complete
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                    <div
                      className="bg-yellow-500 h-2 rounded-full transition-all"
                      style={{ width: `${profileCompletion.completion_percentage}%` }}
                    />
                  </div>
                  {profileCompletion.missing_fields.length > 0 && (
                    <p className="text-xs text-gray-600 mt-2">
                      Missing: {profileCompletion.missing_fields.slice(0, 3).map(f => f.label).join(', ')}
                      {profileCompletion.missing_fields.length > 3 && ` +${profileCompletion.missing_fields.length - 3} more`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => router.push('/dashboard/student/profile')}
                  className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors font-semibold whitespace-nowrap"
                >
                  Complete Profile
                </button>
              </div>
            </div>
          )}

          {/* Header Section */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-4 md:gap-6 w-full sm:w-auto">
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#11CCEF] via-[#E51791] to-purple-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute -inset-2 sm:-inset-3 md:-inset-4 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-xl sm:rounded-2xl blur-xl opacity-30 -z-10"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-purple-500 bg-clip-text text-transparent break-words">
                    Welcome back, {user?.name || 'Student'}!
                  </h1>
                  <p className="text-gray-600 text-sm sm:text-base md:text-lg mt-1 sm:mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></span>
                    <span className="truncate">Ready to continue your learning journey</span>
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto flex items-center justify-between sm:block">
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full text-xs sm:text-sm font-semibold shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="whitespace-nowrap">Active Student</span>
                </div>
                <div className="text-xs text-gray-500 mt-0 sm:mt-2 hidden sm:block">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div className="text-xs text-gray-500 sm:hidden">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50/80 backdrop-blur-xl border border-red-200/70 text-red-600 rounded-2xl shadow-lg px-6 py-4">
              {error}
            </div>
          )}

          {/* Stats Overview with Glass Morphism */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 p-4 sm:p-5 md:p-6 transform hover:scale-105 transition-all duration-300 group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 group-hover:text-[#11CCEF] transition-colors truncate">{stats.totalCourses}</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">Total Courses</div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 p-4 sm:p-5 md:p-6 transform hover:scale-105 transition-all duration-300 group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 group-hover:text-[#E51791] transition-colors truncate">{stats.inProgress}</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">In Progress</div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 p-4 sm:p-5 md:p-6 transform hover:scale-105 transition-all duration-300 group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 group-hover:text-green-500 transition-colors truncate">{stats.completed}</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">Completed</div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 p-4 sm:p-5 md:p-6 transform hover:scale-105 transition-all duration-300 group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 group-hover:text-purple-500 transition-colors truncate">{stats.averageProgress}%</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">Avg. Progress</div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {/* Featured Course & Main Content */}
            <div className="xl:col-span-2 space-y-4 sm:space-y-6 md:space-y-8">
              {/* Featured Course */}
              {isLoading && !featuredCourse ? (
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 flex items-center justify-center text-[#11CCEF] font-semibold h-40 sm:h-60 text-sm sm:text-base">
                  Finding your next course...
                </div>
              ) : featuredCourse ? (
                <div className="bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transform hover:scale-[1.01] sm:hover:scale-[1.02] transition-all duration-500">
                  <div className="p-4 sm:p-6 md:p-8 text-white">
                    <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between mb-4 sm:mb-6 gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="inline-flex items-center gap-2 px-2 sm:px-3 py-1 bg-white/20 rounded-full text-xs sm:text-sm backdrop-blur-sm mb-3 sm:mb-4">
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                          Featured Course
                        </div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-2 sm:mb-3 break-words">{featuredCourse.title}</h2>
                        <p className="text-blue-100 text-sm sm:text-base md:text-lg mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3">{featuredCourse.description}</p>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 text-blue-100 mb-4 sm:mb-6 text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="truncate">{featuredCourse.instructor}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="truncate">{featuredCourse.duration}</span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="mb-4 sm:mb-6">
                          <div className="flex justify-between text-blue-100 mb-2 sm:mb-3 text-xs sm:text-sm">
                            <span className="font-semibold">Your Progress</span>
                            <span className="font-black">{featuredCourse.progress}%</span>
                          </div>
                          <div className="w-full bg-white/30 rounded-full h-2 sm:h-3">
                            <div 
                              className="h-2 sm:h-3 bg-white rounded-full shadow-lg transition-all duration-1000"
                              style={{ width: `${featuredCourse.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="self-center sm:self-start sm:ml-4 md:ml-8 flex-shrink-0">
                        <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                          <div className="text-center">
                            <div className="text-xl sm:text-2xl font-black">{featuredCourse.progress}%</div>
                            <div className="text-xs opacity-90">Complete</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <LoadingButton
                        type="button"
                        isLoading={loadingContinueCourse === featuredCourse.id}
                        onClick={() => {
                          if (featuredCourse.type === 'cpd') {
                            handleContinueCPDCourse(featuredCourse.id);
                          } else if (featuredCourse.type === 'qualification') {
                            handleContinueQualificationCourse(featuredCourse.id);
                          } else {
                            handleContinueCourse(featuredCourse.id, featuredCourse.course_type, featuredCourse.title);
                          }
                        }}
                        className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-white text-[#11CCEF] rounded-xl font-bold hover:bg-gray-100 transform hover:scale-105 transition-all duration-300 shadow-lg text-sm sm:text-base"
                      >
                        Continue Learning
                      </LoadingButton>
                      <LoadingButton
                        type="button"
                        isLoading={loadingContinueCourse === featuredCourse.id}
                        onClick={() => {
                          if (featuredCourse.type === 'cpd') {
                            handleContinueCPDCourse(featuredCourse.id);
                          } else if (featuredCourse.type === 'qualification') {
                            handleContinueQualificationCourse(featuredCourse.id);
                          } else {
                            handleContinueCourse(featuredCourse.id, featuredCourse.course_type, featuredCourse.title);
                          }
                        }}
                        className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 bg-white/20 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-white/30 transform hover:scale-105 transition-all duration-300 border border-white/30 text-sm sm:text-base"
                      >
                        View Details
                      </LoadingButton>
                    </div>
                  </div>
                </div>
              ) : (
                !isLoading && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 flex items-center justify-center text-gray-500 font-semibold h-40 sm:h-60 text-sm sm:text-base text-center px-4">
                    You are not enrolled in any courses yet. Explore available courses to get started!
                  </div>
                )
              )}

              {/* All Courses */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-6 md:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 md:mb-8 gap-4">
                  <div className="w-full sm:w-auto">
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-1 sm:mb-2">My Learning Journey</h2>
                    <p className="text-gray-600 text-sm sm:text-base">Continue where you left off</p>
                  </div>
                  <div className="flex gap-1 sm:gap-2 bg-gray-100 rounded-lg sm:rounded-xl p-1 w-full sm:w-auto overflow-x-auto">
                    {(['all', 'progress', 'completed'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                          activeTab === tab 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {tab === 'all' ? 'All' : tab === 'progress' ? 'In Progress' : 'Completed'}
                      </button>
                    ))}
                  </div>
                </div>

                {isLoading && courses.length === 0 && cpdCourses.length === 0 && qualificationCourses.length === 0 ? (
                  <div className="flex items-center justify-center h-24 sm:h-32 rounded-xl sm:rounded-2xl bg-white/60 border border-dashed border-[#11CCEF]/40 text-[#11CCEF] font-semibold text-sm sm:text-base px-4">
                    Loading your courses...
                  </div>
                ) : filteredCourses.length === 0 && filteredCPDCourses.length === 0 && filteredQualificationCourses.length === 0 ? (
                  <div className="flex items-center justify-center h-24 sm:h-32 rounded-xl sm:rounded-2xl bg-white/60 border border-dashed border-gray-300 text-gray-500 font-medium text-sm sm:text-base px-4 text-center">
                    No courses found for this filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Regular Courses */}
                    {filteredCourses.map(course => (
                      <div key={course.id} className="group">
                        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg border border-gray-200 hover:shadow-2xl transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-500 hover:border-[#11CCEF]/30">
                          <div className="flex items-start justify-between mb-3 sm:mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold ${
                                  course.status === 'Completed' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {course.status}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium truncate">
                                  {course.category}
                                </span>
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 group-hover:text-[#11CCEF] transition-colors break-words line-clamp-2">
                                {course.title}
                              </h3>
                              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{course.description}</p>
                              
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs text-gray-500 mb-3">
                                <span className="flex items-center gap-1 truncate">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="truncate">{course.instructor}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  {course.rating.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-3 sm:mb-4">
                            <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
                              <span>Progress</span>
                              <span className="font-semibold">{course.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                              <div 
                                className={`h-1.5 sm:h-2 rounded-full transition-all duration-1000 ${
                                  course.status === 'Completed' 
                                    ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                    : 'bg-gradient-to-r from-[#11CCEF] to-[#0daed9]'
                                }`}
                                style={{ width: `${course.progress}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="flex gap-2 sm:gap-3">
                          <LoadingButton
                            type="button"
                            isLoading={loadingContinueCourse === course.id}
                            onClick={() => handleContinueCourse(course.id, course.course_type, course.title)}
                            className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#11CCEF] text-white rounded-lg sm:rounded-xl font-semibold hover:bg-[#0daed9] transform hover:scale-105 transition-all duration-300 text-xs sm:text-sm shadow-lg"
                          >
                              Continue
                            </LoadingButton>
                          <LoadingButton
                            type="button"
                            isLoading={loadingContinueCourse === course.id}
                            onClick={() => handleContinueCourse(course.id, course.course_type, course.title)}
                            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 text-gray-700 rounded-lg sm:rounded-xl font-semibold hover:bg-gray-200 transform hover:scale-105 transition-all duration-300 text-xs sm:text-sm"
                          >
                              View
                            </LoadingButton>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* CPD Courses */}
                    {filteredCPDCourses.map(cpdCourse => (
                      <div key={`cpd-${cpdCourse.course_id}`} className="group">
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg border border-purple-200 hover:shadow-2xl transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-500 hover:border-purple-400">
                          <div className="flex items-start justify-between mb-3 sm:mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold ${
                                  cpdCourse.progress === 100
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {cpdCourse.progress === 100 ? 'Completed' : 'In Progress'}
                                </span>
                                <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded-full text-xs font-medium">
                                  📘 CPD
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium truncate">
                                  {cpdCourse.category_name || cpdCourse.sub_category_name || 'CPD'}
                                </span>
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors break-words line-clamp-2">
                                {cpdCourse.course_title}
                              </h3>
                              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{cpdCourse.description}</p>
                              
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs text-gray-500 mb-3">
                                <span className="flex items-center gap-1 truncate">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="truncate">{cpdCourse.instructor_name || 'Instructor'}</span>
                                </span>
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                  📚 {cpdCourse.completed_topics}/{cpdCourse.total_topics} Topics
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-3 sm:mb-4">
                            <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
                              <span>Progress</span>
                              <span className="font-semibold">{cpdCourse.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                              <div 
                                className={`h-1.5 sm:h-2 rounded-full transition-all duration-1000 ${
                                  cpdCourse.progress === 100
                                    ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                    : 'bg-gradient-to-r from-purple-400 to-indigo-500'
                                }`}
                                style={{ width: `${cpdCourse.progress}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="flex gap-2 sm:gap-3">
                            <LoadingButton
                              type="button"
                              isLoading={loadingContinueCourse === cpdCourse.course_id}
                              onClick={() => handleContinueCPDCourse(cpdCourse.course_id)}
                              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-500 text-white rounded-lg sm:rounded-xl font-semibold hover:bg-purple-600 transform hover:scale-105 transition-all duration-300 text-xs sm:text-sm shadow-lg"
                            >
                              Continue
                            </LoadingButton>
                            <LoadingButton
                              type="button"
                              isLoading={loadingContinueCourse === cpdCourse.course_id}
                              onClick={() => handleContinueCPDCourse(cpdCourse.course_id)}
                              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-100 text-purple-700 rounded-lg sm:rounded-xl font-semibold hover:bg-purple-200 transform hover:scale-105 transition-all duration-300 text-xs sm:text-sm"
                            >
                              View
                            </LoadingButton>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Qualification Courses */}
                    {filteredQualificationCourses.map(qualCourse => (
                      <div key={`qual-${qualCourse.course_id}`} className="group">
                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg border border-blue-200 hover:shadow-2xl transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-500 hover:border-blue-400">
                          <div className="flex items-start justify-between mb-3 sm:mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold ${
                                  qualCourse.progress === 100
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {qualCourse.progress === 100 ? 'Completed' : 'In Progress'}
                                </span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                                  🎓 Qualification
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium truncate">
                                  {qualCourse.category_name || qualCourse.sub_category_name || 'Qualification'}
                                </span>
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors break-words line-clamp-2">
                                {qualCourse.course_title}
                              </h3>
                              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{qualCourse.description}</p>
                              
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs text-gray-500 mb-3">
                                <span className="flex items-center gap-1 truncate">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="truncate">{qualCourse.instructor_name || 'Instructor'}</span>
                                </span>
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                  📚 {qualCourse.completed_units}/{qualCourse.total_units} Units
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-3 sm:mb-4">
                            <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
                              <span>Progress</span>
                              <span className="font-semibold">{qualCourse.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                              <div 
                                className={`h-1.5 sm:h-2 rounded-full transition-all duration-1000 ${
                                  qualCourse.progress === 100
                                    ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                    : 'bg-gradient-to-r from-blue-400 to-cyan-500'
                                }`}
                                style={{ width: `${qualCourse.progress}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="flex gap-2 sm:gap-3">
                            <LoadingButton
                              type="button"
                              isLoading={loadingContinueCourse === qualCourse.course_id}
                              onClick={() => handleContinueQualificationCourse(qualCourse.course_id)}
                              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-500 text-white rounded-lg sm:rounded-xl font-semibold hover:bg-blue-600 transform hover:scale-105 transition-all duration-300 text-xs sm:text-sm shadow-lg"
                            >
                              Continue
                            </LoadingButton>
                            <LoadingButton
                              type="button"
                              isLoading={loadingContinueCourse === qualCourse.course_id}
                              onClick={() => handleContinueQualificationCourse(qualCourse.course_id)}
                              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-100 text-blue-700 rounded-lg sm:rounded-xl font-semibold hover:bg-blue-200 transform hover:scale-105 transition-all duration-300 text-xs sm:text-sm"
                            >
                              View
                            </LoadingButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              {/* Quick Actions */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-5 md:p-6">
                <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#11CCEF] rounded-full"></span>
                  Quick Actions
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  <button
                    onClick={handleChatWithTutor}
                    disabled={loadingChatWithTutor}
                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left bg-gradient-to-r hover:from-white hover:to-gray-50 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#11CCEF]/30 transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-300 group cursor-pointer relative disabled:opacity-75"
                  >
                    {loadingChatWithTutor && (
                      <span className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                        <svg
                          className="animate-spin h-5 w-5 text-[#11CCEF]"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </span>
                    )}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-base sm:text-lg shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                      💬
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 group-hover:text-[#11CCEF] transition-colors text-sm sm:text-base">
                        Chat with Tutor
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">Get instant help</div>
                    </div>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#11CCEF] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  <Link
                    href="/dashboard/forum"
                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left bg-gradient-to-r hover:from-white hover:to-gray-50 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#11CCEF]/30 transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-300 group cursor-pointer"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-base sm:text-lg shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                      💬
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 group-hover:text-[#11CCEF] transition-colors text-sm sm:text-base">
                        Forum
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">Discuss & share</div>
                    </div>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#11CCEF] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  
                  {[
                    { icon: '📊', title: 'View Grades', desc: 'Check your progress', color: 'from-[#E51791] to-pink-500', link: '/dashboard/student/grades', key: 'grades' },
                    { icon: '🏆', title: 'Certificates', desc: 'View achievements', color: 'from-yellow-400 to-orange-500', link: '/dashboard/student/certificates', key: 'certificates' },
                  ].map((action, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (action.link) {
                          setLoadingQuickAction(action.key);
                          router.push(action.link);
                        }
                      }}
                      disabled={!action.link || loadingQuickAction === action.key}
                      className={`w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left bg-gradient-to-r hover:from-white hover:to-gray-50 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#11CCEF]/30 transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-300 group relative ${!action.link ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${loadingQuickAction === action.key ? 'opacity-75' : ''}`}
                    >
                      {loadingQuickAction === action.key && (
                        <span className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                          <svg
                            className="animate-spin h-5 w-5 text-[#11CCEF]"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </span>
                      )}
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r ${action.color} rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-base sm:text-lg shadow-lg group-hover:scale-110 transition-transform flex-shrink-0`}>
                        {action.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 group-hover:text-[#11CCEF] transition-colors text-sm sm:text-base">
                          {action.title}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">{action.desc}</div>
                      </div>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#11CCEF] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upcoming Deadlines */}
              <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 md:p-6 text-white">
                <h3 className="text-lg sm:text-xl font-black mb-4 sm:mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  Upcoming Deadlines
                </h3>
                <div className="space-y-4 sm:space-y-5">
                  {allDeadlines.length === 0 ? (
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/30 text-white/80 text-xs sm:text-sm">
                      No upcoming deadlines right now. Keep exploring your courses!
                    </div>
                  ) : (
                    <>
                      {/* Display 2 deadlines at a time */}
                      <div className="space-y-3 sm:space-y-4">
                        {displayedDeadlines.map((deadline) => (
                          <div key={deadline.id} className="bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/30">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mt-1 flex-shrink-0 ${
                                deadline.priority === 'high' ? 'bg-red-300' : 
                                deadline.priority === 'medium' ? 'bg-yellow-300' : 'bg-green-300'
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-white text-xs sm:text-sm mb-1 break-words">{deadline.courseTitle}</div>
                                <div className="font-semibold text-white text-xs sm:text-sm break-words mb-2">{deadline.title}</div>
                                <div className="text-white/80 text-xs flex items-center gap-1">
                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="truncate">{deadline.dueLabel}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Arrow Navigation */}
                      {allDeadlines.length > deadlinesPerPage && (
                        <div className="flex items-center justify-between mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-white/30">
                          <button
                            onClick={() => setDeadlineIndex(prev => Math.max(0, prev - deadlinesPerPage))}
                            disabled={!canGoPrevious}
                            className="px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/30 transition-colors border border-white/30 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous
                          </button>
                          <div className="text-white/80 text-xs sm:text-sm">
                            {Math.floor(deadlineIndex / deadlinesPerPage) + 1} / {Math.ceil(allDeadlines.length / deadlinesPerPage)}
                          </div>
                          <button
                            onClick={() => setDeadlineIndex(prev => Math.min(allDeadlines.length - deadlinesPerPage, prev + deadlinesPerPage))}
                            disabled={!canGoNext}
                            className="px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/30 transition-colors border border-white/30 flex items-center gap-2"
                          >
                            Next
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Learning Streak */}
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 md:p-6 text-white">
                <div className="text-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 backdrop-blur-sm border border-white/30">
                    <span className="text-xl sm:text-2xl">🔥</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black mb-1 sm:mb-2">{stats.learningStreak} days</div>
                  <div className="text-purple-100 font-semibold text-sm sm:text-base">Learning Streak</div>
                  <div className="text-purple-200 text-xs sm:text-sm mt-1 sm:mt-2">Keep going! You're doing great</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tutor Selection Modal */}
        {showTutorModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-4 sm:p-6 md:p-8 transform transition-all max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-gray-900">Select a Tutor</h3>
                <button
                  onClick={() => setShowTutorModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">Choose a tutor from your enrolled courses to start chatting:</p>
              
              <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-96 overflow-y-auto">
                {tutors.map((tutor) => (
                  <button
                    key={tutor.id}
                    onClick={() => {
                      startChatWithTutor(tutor.id);
                      setShowTutorModal(false);
                    }}
                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left bg-gradient-to-r hover:from-[#11CCEF]/10 hover:to-blue-50 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#11CCEF] transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg flex-shrink-0">
                      {tutor.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 group-hover:text-[#11CCEF] transition-colors text-sm sm:text-base break-words">
                        {tutor.name}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate">{tutor.email}</div>
                    </div>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#11CCEF] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          @keyframes float-delayed {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(20px) rotate(180deg); }
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          .animate-float-delayed {
            animation: float-delayed 8s ease-in-out infinite;
          }
          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
};

export default StudentDashboard;