/**
 * Tutor CPD Manage Page
 * 
 * This file simply re-exports the admin manage page component.
 * The admin manage page already supports both admin and tutor roles via ProtectedRoute.
 * This allows the URL to be /dashboard/tutor/cpd/[courseId]/manage for tutors
 * while using the same underlying component.
 */
export { default } from '@/app/dashboard/admin/cpd/[courseId]/manage/page';

