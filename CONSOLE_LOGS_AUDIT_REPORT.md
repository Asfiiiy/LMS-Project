# Console Logs Audit Report
## Student Dashboard & Login — Full Scan

**Scan date:** 2026-03-18  
**Scope:** app/dashboard/student/, login, components, api.ts, utils, hooks, layout, middleware

---

─────────────────────────
FILE: app/dashboard/student/page.tsx
─────────────────────────
1. LINE 220 | console.error | 🟡 CAUTION
   CODE: console.error('Unable to parse stored user:', err);
   CONTAINS: Error object when parsing user from localStorage (may include user data in stack)

2. LINE 263 | console.error | 🟡 CAUTION
   CODE: if (coursesResponse.status === 'rejected') console.error('[Student Dashboard] Failed to load courses:', coursesResponse.reason);
   CONTAINS: API rejection reason (may include endpoint, error message)

3. LINE 264 | console.error | 🟡 CAUTION
   CODE: if (assignmentsResponse.status === 'rejected') console.error('[Student Dashboard] Failed to load assignments:', assignmentsResponse.reason);
   CONTAINS: API rejection reason

4. LINE 265 | console.error | 🟡 CAUTION
   CODE: if (cpdCoursesResponse.status === 'rejected') console.error('[Student Dashboard] Failed to load CPD courses:', cpdCoursesResponse.reason);
   CONTAINS: API rejection reason

5. LINE 267 | console.error | 🟡 CAUTION
   CODE: console.error('[Student Dashboard] Failed to load qualification courses:', qualificationCoursesResponse.reason);
   CONTAINS: API rejection reason

6. LINE 269 | console.log | 🔴 DANGEROUS
   CODE: console.log('[Student Dashboard] Qualification API response:', qualificationCoursesResponse.value);
   CONTAINS: Full API response object (course data, IDs, titles, student data)

7. LINE 270 | console.log | 🔴 DANGEROUS
   CODE: console.log('[Student Dashboard] Qualification courses data:', qualificationCoursesData);
   CONTAINS: Full qualification courses data (course IDs, titles, enrollment info)

8. LINE 291 | console.log | 🟡 CAUTION
   CODE: console.log('[Student Dashboard] CPD courses loaded:', cpdCoursesList.length);
   CONTAINS: Count of CPD courses

9. LINE 292 | console.log | 🟡 CAUTION
   CODE: console.log('[Student Dashboard] CPD courses with deadlines:', cpdCoursesList.filter(c => c.upcoming_deadlines && c.upcoming_deadlines.length > 0).length);
   CONTAINS: Count

10. LINE 295 | console.log | 🟡 CAUTION
    CODE: console.log(`[Student Dashboard] CPD Course "${c.course_title}" has ${c.upcoming_deadlines.length} deadlines`);
    CONTAINS: Course title, deadline count

11. LINE 302 | console.log | 🟡 CAUTION
    CODE: console.log('[Student Dashboard] Qualification courses loaded:', rawQualificationCourses.length);
    CONTAINS: Count

12. LINE 303 | console.log | 🟡 CAUTION
    CODE: console.log('[Student Dashboard] Qualification courses with deadlines:', rawQualificationCourses.filter(c => c.upcoming_deadlines && c.upcoming_deadlines.length > 0).length);
    CONTAINS: Count

13. LINE 324 | console.log | 🟡 CAUTION
    CODE: console.log(`[Student Dashboard] Qualification Course "${c.course_title}" has ${c.upcoming_deadlines.length} deadlines`);
    CONTAINS: Course title, deadline count

14. LINE 329 | console.error | 🟡 CAUTION
    CODE: console.error('Error loading student dashboard data:', err);
    CONTAINS: Error object (may include API details)

15. LINE 600 | console.log | 🟡 CAUTION
    CODE: console.log('[Deadlines] Processing CPD courses:', cpdCourses.length);
    CONTAINS: Count

16. LINE 601 | console.log | 🟡 CAUTION
    CODE: console.log('[Deadlines] Processing Qualification courses:', qualificationCourses.length);
    CONTAINS: Count

17. LINE 602 | console.log | 🟡 CAUTION
    CODE: console.log('[Deadlines] Processing Assignments:', assignments.length);
    CONTAINS: Count

18. LINE 635 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] Processing Qualification course: ${qualCourse.course_title}`);
    CONTAINS: Course title

19. LINE 636 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] Has upcoming_deadlines:`, qualCourse.upcoming_deadlines);
    CONTAINS: Course deadline data

20. LINE 637 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] upcoming_deadlines length:`, qualCourse.upcoming_deadlines?.length || 0);
    CONTAINS: Count

21. LINE 643 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] Processing deadline ${index}:`, deadline);
    CONTAINS: Deadline object (dates, IDs)

22. LINE 645 | console.log | 🟢 SAFE
    CODE: console.log(`[Deadlines] Deadline ${index} skipped: no deadline property`);
    CONTAINS: Static message + index

23. LINE 650 | console.log | 🟢 SAFE
    CODE: console.log(`[Deadlines] Deadline ${index} skipped: invalid date`);
    CONTAINS: Static message + index

24. LINE 666 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] Qualification course "${qualCourse.course_title}" processed ${deadlines.length} valid deadlines`);
    CONTAINS: Course title, count

25. LINE 676 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] Added qualification course group: ${qualCourse.course_title}`);
    CONTAINS: Course title

26. LINE 678 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] Skipped qualification course group (no valid deadlines): ${qualCourse.course_title}`);
    CONTAINS: Course title

27. LINE 681 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] Qualification course "${qualCourse.course_title}" has no upcoming_deadlines array`);
    CONTAINS: Course title

28. LINE 734 | console.log | 🟡 CAUTION
    CODE: console.log('[Deadlines] Total deadline groups:', sorted.length);
    CONTAINS: Count

29. LINE 736 | console.log | 🟡 CAUTION
    CODE: console.log(`[Deadlines] Group ${i + 1}: ${g.courseTitle} (${g.deadlines.length} deadlines)`);
    CONTAINS: Course title, count

30. LINE 783 | console.log | 🟡 CAUTION
    CODE: console.log('[Student Dashboard] Navigating to course:', courseId, 'Type:', courseType, 'Title:', courseTitle);
    CONTAINS: Course ID, type, title

31. LINE 791 | console.log | 🟢 SAFE
    CODE: console.log('[Student Dashboard] Routing to qualification course');
    CONTAINS: Static string

32. LINE 794 | console.log | 🟢 SAFE
    CODE: console.log('[Student Dashboard] Routing to CPD course');
    CONTAINS: Static string

33. LINE 797 | console.log | 🟢 SAFE
    CODE: console.log('[Student Dashboard] Routing to regular course');
    CONTAINS: Static string

34. LINE 801 | console.error | 🟡 CAUTION
    CODE: console.error('Error navigating to course:', error);
    CONTAINS: Error object

35. LINE 812 | console.error | 🟡 CAUTION
    CODE: console.error('Error navigating to CPD course:', error);
    CONTAINS: Error object

36. LINE 823 | console.error | 🟡 CAUTION
    CODE: console.error('Error navigating to qualification course:', error);
    CONTAINS: Error object

37. LINE 841 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching tutors:', err);
    CONTAINS: Error object

38. LINE 886 | console.error | 🟡 CAUTION
    CODE: console.error('Error starting chat:', err);
    CONTAINS: Error object

─────────────────────────
FILE: app/dashboard/student/cpd/[courseId]/quiz/[quizId]/page.tsx
─────────────────────────
39. LINE 97 | console.error | 🟡 CAUTION
    CODE: console.error('Error loading quiz:', error);
    CONTAINS: Error object

40. LINE 148 | console.error | 🟡 CAUTION
    CODE: console.error('Error submitting quiz:', error);
    CONTAINS: Error object

41. LINE 182 | console.error | 🟡 CAUTION
    CODE: console.error('Error loading attempt details:', error);
    CONTAINS: Error object

─────────────────────────
FILE: app/dashboard/student/certificates/page.tsx
─────────────────────────
42. LINE 73 | console.error | 🟡 CAUTION
    CODE: console.error('Unable to parse stored user:', err);
    CONTAINS: Error when parsing user (may expose user data in stack)

43. LINE 131 | console.error | 🟡 CAUTION
    CODE: console.error('Failed to load certificate claims:', claimsRes.reason);
    CONTAINS: API rejection reason

44. LINE 137 | console.error | 🟡 CAUTION
    CODE: console.error('Failed to load delivered certificates:', deliveredRes.reason);
    CONTAINS: API rejection reason

45. LINE 151 | console.error | 🟡 CAUTION
    CODE: console.error('Failed to load CPD courses:', cpdRes.reason);
    CONTAINS: API rejection reason

46. LINE 166 | console.error | 🟡 CAUTION
    CODE: console.error('Failed to load qualification courses:', qualRes.reason);
    CONTAINS: API rejection reason

47. LINE 174 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching data:', error);
    CONTAINS: Error object

─────────────────────────
FILE: app/dashboard/student/consultations/page.tsx
─────────────────────────
48. LINE 68 | console.error | 🟡 CAUTION
    CODE: console.error(e);
    CONTAINS: Error object (generic)

─────────────────────────
FILE: app/dashboard/student/cpd/[courseId]/page.tsx
─────────────────────────
49. LINE 142 | console.error | 🟡 CAUTION
    CODE: console.error('Error checking certificate claims:', error);
    CONTAINS: Error object

50. LINE 148 | console.error | 🟡 CAUTION
    CODE: console.error('Error loading CPD course:', error);
    CONTAINS: Error object

51. LINE 177 | console.error | 🟡 CAUTION
    CODE: console.error('Error starting quiz:', error);
    CONTAINS: Error object

52. LINE 572 | console.log | 🟢 SAFE
    CODE: onLoad={() => console.log('[CPD] PDF loaded successfully')}
    CONTAINS: Static string

53. LINE 573 | console.error | 🟡 CAUTION
    CODE: onError={(e) => console.error('[CPD] PDF load error:', e)}
    CONTAINS: Error object (may include URL)

─────────────────────────
FILE: app/dashboard/student/cpd/[courseId]/view/page.tsx
─────────────────────────
54. LINE 131 | console.error | 🟡 CAUTION
    CODE: console.error('Error loading CPD course:', error);
    CONTAINS: Error object

55. LINE 445 | console.log | 🟢 SAFE
    CODE: onLoad={() => console.log('[CPD] PDF loaded successfully')}
    CONTAINS: Static string

56. LINE 446 | console.error | 🟡 CAUTION
    CODE: onError={(e) => console.error('[CPD] PDF load error:', e)}
    CONTAINS: Error object

─────────────────────────
FILE: app/dashboard/student/cpd/[courseId]/claim-certificate/page.tsx
─────────────────────────
57. LINE 121 | console.error | 🟡 CAUTION
    CODE: console.error('Payment error:', err);
    CONTAINS: Payment error (may include Stripe/payment details)

58. LINE 283 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching data:', error);
    CONTAINS: Error object

59. LINE 303 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching level courses:', error);
    CONTAINS: Error object

60. LINE 326 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching pricing:', error);
    CONTAINS: Error object

61. LINE 453 | console.error | 🟡 CAUTION
    CODE: console.error('Error submitting claim:', error);
    CONTAINS: Error object

─────────────────────────
FILE: app/dashboard/student/grades/page.tsx
─────────────────────────
62. LINE 428 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching grades:', err);
    CONTAINS: Error object

─────────────────────────
FILE: app/dashboard/student/courses/[id]/page.tsx
─────────────────────────
63. LINE 47 | console.error | 🟡 CAUTION
    CODE: console.error('Error checking course type:', error);
    CONTAINS: Error object

─────────────────────────
FILE: app/dashboard/student/qualification/[courseId]/claim-certificate/page.tsx
─────────────────────────
64. LINE 74 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching data:', error);
    CONTAINS: Error object

65. LINE 116 | console.error | 🟡 CAUTION
    CODE: console.error('Error claiming certificate:', error);
    CONTAINS: Error object

─────────────────────────
FILE: app/page.tsx (Landing/Login flow)
─────────────────────────
66. LINE 329 | console.error | 🟡 CAUTION
    CODE: console.error('Error checking onboarding status:', err);
    CONTAINS: Error object

67. LINE 359 | console.error | 🟡 CAUTION
    CODE: console.error(err);
    CONTAINS: Error object (generic)

─────────────────────────
FILE: app/components/Navbar.tsx
─────────────────────────
68. LINE 89 | console.error | 🟡 CAUTION
    CODE: console.error('Error parsing user data:', error);
    CONTAINS: Error when parsing user (may expose user data)

69. LINE 109 | console.error | 🟡 CAUTION
    CODE: console.error('Error parsing user data:', error);
    CONTAINS: Error when parsing user

70. LINE 132 | console.error | 🟡 CAUTION
    CODE: console.error('Error parsing user data:', error);
    CONTAINS: Error when parsing user

71. LINE 193 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching profile picture:', err);
    CONTAINS: Error object

72. LINE 255 | console.error | 🟡 CAUTION
    CODE: console.error('❌ [Navbar] Socket connection error:', error);
    CONTAINS: Socket error

73. LINE 260 | console.warn | 🟡 CAUTION
    CODE: console.warn('⚠️ [Navbar] Socket disconnected:', reason);
    CONTAINS: Disconnect reason

74. LINE 375 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching notifications:', error);
    CONTAINS: Error object

75. LINE 399 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching unread count:', error);
    CONTAINS: Error object

76. LINE 419 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching unread conversation count:', error);
    CONTAINS: Error object

77. LINE 464 | console.error | 🟡 CAUTION
    CODE: console.error('Error marking notification as read:', error);
    CONTAINS: Error object

78. LINE 476 | console.error | 🟡 CAUTION
    CODE: console.error('Error marking all as read:', error);
    CONTAINS: Error object

79. LINE 481 | console.log | 🔴 DANGEROUS
    CODE: console.log('[Notification Click] ===== NOTIFICATION CLICKED =====');
    CONTAINS: Trigger marker (harmless alone but paired with next)

80. LINE 482 | console.log | 🔴 DANGEROUS
    CODE: console.log('[Notification Click] Full notification data:', JSON.stringify(notification, null, 2));
    CONTAINS: Full notification object (user IDs, course IDs, message content, conversation IDs, post IDs)

81. LINE 512 | console.error | 🟡 CAUTION
    CODE: console.error('Error opening chat from notification:', error);
    CONTAINS: Error object

82. LINE 526 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🎯 Direct navigation to forum:', url);
    CONTAINS: Internal URL with post/comment IDs

83. LINE 539 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🎯 Direct navigation to qualification:', url);
    CONTAINS: Internal URL with course ID

84. LINE 547 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🔍 No course_id, fetching course from message...');
    CONTAINS: Debug message

85. LINE 556 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] Extracted course name:', courseName);
    CONTAINS: Course name from notification message

86. LINE 582 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🎯 Found course ID:', courseId, 'navigating to:', url);
    CONTAINS: Course ID, internal URL

87. LINE 587 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] ⚠️ Course not found in student courses. Available courses:', data.qualificationCourses.map((c: any) => c.course_title || c.title));
    CONTAINS: List of course titles (student's enrolled courses)

88. LINE 593 | console.error | 🟡 CAUTION
    CODE: console.error('[Notification Click] Error fetching course:', error);
    CONTAINS: Error object

89. LINE 598 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] ⚠️ Could not find course, navigating to dashboard');
    CONTAINS: Debug message

90. LINE 600 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🎯 Fallback URL:', fallbackUrl);
    CONTAINS: Dashboard URL

91. LINE 618 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🎯 Direct navigation to qualification course:', url);
    CONTAINS: Internal URL

92. LINE 626 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🎯 Direct navigation to course:', url);
    CONTAINS: Internal URL

93. LINE 635 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🎯 Direct navigation to certificates:', url);
    CONTAINS: Internal URL

94. LINE 661 | console.log | 🟢 SAFE
    CODE: console.log('[Notification Click] ✅ Navigation successful via utility');
    CONTAINS: Static success message

95. LINE 665 | console.error | 🟡 CAUTION
    CODE: console.error('[Notification Click] ❌ Navigation error:', error);
    CONTAINS: Error object

96. LINE 674 | console.log | 🟡 CAUTION
    CODE: console.log('[Notification Click] 🎯 Final fallback to dashboard:', dashboardLink);
    CONTAINS: Dashboard path

─────────────────────────
FILE: app/components/FloatingChatWindow.tsx
─────────────────────────
97. LINE 197 | console.error | 🟡 CAUTION
    CODE: console.error('Error fetching profile:', error);
    CONTAINS: Error object

98. LINE 352 | console.error | 🟡 CAUTION
    CODE: console.error("Error fetching messages:", error);
    CONTAINS: Error object

99. LINE 372 | console.error | 🟡 CAUTION
    CODE: console.error("Error marking conversation as read:", error);
    CONTAINS: Error object

100. LINE 448 | console.error | 🟡 CAUTION
     CODE: console.error("Error sending message:", error);
     CONTAINS: Error object

101. LINE 509 | console.error | 🟡 CAUTION
     CODE: console.error("Error uploading file:", error);
     CONTAINS: Error object

102. LINE 585 | console.error | 🟡 CAUTION
     CODE: console.error("Error editing message:", error);
     CONTAINS: Error object

103. LINE 609 | console.error | 🟡 CAUTION
     CODE: console.error(e);
     CONTAINS: Error object

104. LINE 646 | console.error | 🟡 CAUTION
     CODE: console.error("Error deleting message:", error);
     CONTAINS: Error object

─────────────────────────
FILE: app/components/ChatBox.tsx
─────────────────────────
105. LINE 144 | console.log | 🟡 CAUTION
     CODE: console.log(`🔄 Status change: User ${statusUserId} is now ${status}`);
     CONTAINS: User ID, status

106. LINE 145 | console.log | 🟡 CAUTION
     CODE: console.log(`🎯 Current otherUserId: ${otherUserId}`);
     CONTAINS: User ID

107. LINE 147 | console.log | 🟢 SAFE
     CODE: console.log(`✅ Updating status for conversation participant`);
     CONTAINS: Static string

108. LINE 151 | console.log | 🟢 SAFE
     CODE: console.log(`⏭️ Ignoring - not the other user in this conversation`);
     CONTAINS: Static string

109. LINE 186 | console.log | 🔴 DANGEROUS
     CODE: console.log('📋 [ChatBox] Online users list:', users);
     CONTAINS: Array of users (userId, userName, status) — exposes user IDs and names

110. LINE 187 | console.log | 🟡 CAUTION
     CODE: console.log('🎯 [ChatBox] Looking for otherUserId:', otherUserId);
     CONTAINS: User ID

111. LINE 190 | console.log | 🔴 DANGEROUS
     CODE: console.log('👤 [ChatBox] Found other user:', otherUser);
     CONTAINS: User object (userId, userName, status)

112. LINE 196 | console.warn | 🟡 CAUTION
     CODE: console.warn('⚠️ [ChatBox] otherUserId is not set!');
     CONTAINS: Debug warning

113. LINE 251 | console.error | 🟡 CAUTION
     CODE: console.error("Error fetching messages:", error);
     CONTAINS: Error object

114. LINE 271 | console.error | 🟡 CAUTION
     CODE: console.error("Error marking message as read:", error);
     CONTAINS: Error object

115. LINE 323 | console.error | 🟡 CAUTION
     CODE: console.error("Error sending message:", error);
     CONTAINS: Error object

116. LINE 387 | console.error | 🟡 CAUTION
     CODE: console.error("Error uploading file:", error);
     CONTAINS: Error object

─────────────────────────
FILE: app/components/PaymentNotification.tsx
─────────────────────────
117. LINE 77 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Fetching notifications on mount:', { userId, hasShownInitialNotifications });
     CONTAINS: User ID, boolean

118. LINE 85 | console.log | 🟢 SAFE
     CODE: console.log('[PaymentNotification] Fetching payment installments...');
     CONTAINS: Static string

119. LINE 87 | console.log | 🔴 DANGEROUS
     CODE: console.log('[PaymentNotification] API Response:', response);
     CONTAINS: Full API response (installments, course data, amounts, due dates, student payment info)

120. LINE 90 | console.log | 🟢 SAFE
     CODE: console.log('[PaymentNotification] API call failed or no success flag');
     CONTAINS: Static string

121. LINE 95 | console.log | 🟢 SAFE
     CODE: console.log('[PaymentNotification] No installments found');
     CONTAINS: Static string

122. LINE 125 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Processing installments:', allInstallments.length);
     CONTAINS: Count

123. LINE 136 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Processing installment:', { id: inst.id, status: inst.status, due_date: inst.due_date, notificationCount });
     CONTAINS: Installment ID, status, due date

124. LINE 145 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Skipping - already shown 3 times:', paymentId);
     CONTAINS: Payment ID string

125. LINE 153 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Adding overdue notification (status=overdue):', inst.id);
     CONTAINS: Installment ID

126. LINE 173 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Adding overdue notification (past due date):', inst.id);
     CONTAINS: Installment ID

127. LINE 190 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Adding upcoming notification:', inst.id, diffDays);
     CONTAINS: Installment ID, days

128. LINE 206 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Adding due notification (no due date):', inst.id);
     CONTAINS: Installment ID

129. LINE 218 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] New notifications to show:', newNotifications.length);
     CONTAINS: Count

130. LINE 222 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Setting notifications:', newNotifications);
     CONTAINS: Notification objects (course titles, amounts, messages)

131. LINE 228 | console.log | 🟡 CAUTION
     CODE: console.log('[PaymentNotification] Final notifications:', finalNotifications);
     CONTAINS: Notification objects

132. LINE 233 | console.log | 🟢 SAFE
     CODE: console.log('[PaymentNotification] No new notifications to show');
     CONTAINS: Static string

133. LINE 236 | console.error | 🟡 CAUTION
     CODE: console.error('Error fetching payment notifications:', error);
     CONTAINS: Error object

─────────────────────────
FILE: app/components/ConditionalLayout.tsx
─────────────────────────
134. LINE 37 | console.error | 🟡 CAUTION
     CODE: console.error('Error loading user:', e);
     CONTAINS: Error object

─────────────────────────
FILE: app/components/OnboardingGuard.tsx
─────────────────────────
135. LINE 66 | console.error | 🟡 CAUTION
     CODE: console.error('Error checking onboarding status:', error);
     CONTAINS: Error object

─────────────────────────
FILE: app/components/MessageDropdown.tsx
─────────────────────────
136. LINE 73 | console.error | 🟡 CAUTION
     CODE: console.error('Error fetching conversations:', error);
     CONTAINS: Error object

137. LINE 249 | console.error | 🟡 CAUTION
     CODE: console.error('Error marking as read:', error);
     CONTAINS: Error object

─────────────────────────
FILE: app/components/FloatingChatProvider.tsx
─────────────────────────
138. LINE 60 | console.warn | 🟢 SAFE
     CODE: console.warn('FloatingChatProvider not initialized');
     CONTAINS: Static warning

139. LINE 78 | console.error | 🟡 CAUTION
     CODE: console.error('Error loading saved chats:', e);
     CONTAINS: Error object

140. LINE 214 | console.error | 🟡 CAUTION
     CODE: console.error('Error auto-opening chat:', error);
     CONTAINS: Error object

141. LINE 255 | console.error | 🟡 CAUTION
     CODE: console.error('Error checking unread counts:', error);
     CONTAINS: Error object

─────────────────────────
FILE: app/components/CertificateClaimsManagement.tsx
─────────────────────────
142. LINE 220 | console.log | 🔴 DANGEROUS
     CODE: console.log('Token found:', token ? 'Yes' : 'No');
     CONTAINS: JWT token presence (security signal)

143. LINE 221 | console.log | 🔴 DANGEROUS
     CODE: console.log('Token length:', token ? token.length : 0);
     CONTAINS: Token length (can help attackers infer token format)

144. LINE 233 | console.log | 🔴 DANGEROUS
     CODE: console.log('Opening URL:', fileUrl);
     CONTAINS: Full URL with token in query string (JWT exposed in URL)

─────────────────────────
FILE: app/services/api.ts
─────────────────────────
145. LINE 55 | console.log | 🔴 DANGEROUS
     CODE: console.log(`[API Request] ${options.method || 'GET'} ${endpoint}`);
     CONTAINS: Every API endpoint URL (internal API structure)

146. LINE 56 | console.log | 🔴 DANGEROUS
     CODE: console.log(`[API Request] Token present:`, !!token);
     CONTAINS: Whether auth token exists (security signal)

147. LINE 92 | console.warn | 🟡 CAUTION
     CODE: console.warn(`[API Warning] ${response.status}:`, errorData.message);
     CONTAINS: HTTP status, error message from API

148. LINE 94 | console.error | 🟡 CAUTION
     CODE: console.error(`[API Error] ${response.status}:`, errorData.message);
     CONTAINS: HTTP status, error message

149. LINE 100 | console.error | 🟡 CAUTION
     CODE: console.error(`[API Error] ${response.status}: Non-JSON error response`);
     CONTAINS: HTTP status

150. LINE 110 | console.error | 🟡 CAUTION
     CODE: console.error(`API Error for ${endpoint}:`, error);
     CONTAINS: Endpoint URL, error object

151. LINE 145 | console.error | 🟡 CAUTION
     CODE: console.error('Token refresh error:', error);
     CONTAINS: Error object (token refresh failure)

152. LINE 1305 | console.log | 🟡 CAUTION
     CODE: console.log('[API] Creating qualification course, token present:', !!token);
     CONTAINS: Token presence

153. LINE 1306 | console.log | 🟡 CAUTION
     CODE: console.log('[API] FormData entries:');
     CONTAINS: Static + FormData iteration below

154. LINE 1309 | console.log | 🟡 CAUTION
     CODE: console.log(`  ${key}: ${value.name} (${value.size} bytes)`);
     CONTAINS: FormData key, file name, size

155. LINE 1311 | console.log | 🟡 CAUTION
     CODE: console.log(`  ${key}: ${value}`);
     CONTAINS: FormData key-value (could include sensitive form data)

156. LINE 1326 | console.error | 🟡 CAUTION
     CODE: console.error('[API] Error response:', errorText);
     CONTAINS: API error response text

157. LINE 1419 | console.log | 🟡 CAUTION
     CODE: console.log('[API] Creating unit with files');
     CONTAINS: Static string

158. LINE 1420 | console.log | 🔴 DANGEROUS
     CODE: console.log('[API] URL:', url);
     CONTAINS: Full API URL (endpoint)

159. LINE 1421 | console.log | 🟡 CAUTION
     CODE: console.log('[API] Token present:', !!token);
     CONTAINS: Token presence

160. LINE 1422 | console.log | 🟡 CAUTION
     CODE: console.log('[API] FormData entries:', Array.from(unitData.keys()).length);
     CONTAINS: FormData key count

161. LINE 1433 | console.log | 🟡 CAUTION
     CODE: console.log('[API] Response status:', response.status);
     CONTAINS: HTTP status

162. LINE 1434 | console.log | 🟡 CAUTION
     CODE: console.log('[API] Response ok:', response.ok);
     CONTAINS: Boolean

163. LINE 1438 | console.error | 🟡 CAUTION
     CODE: console.error('[API] Error response:', errorText);
     CONTAINS: Error text

164. LINE 1444 | console.error | 🟡 CAUTION
     CODE: console.error('[API] Fetch error:', fetchError);
     CONTAINS: Fetch error object

165. LINE 1445 | console.error | 🟡 CAUTION
     CODE: console.error('[API] Error details:', { ... });
     CONTAINS: Error details object

─────────────────────────
FILE: app/utils/notificationNavigation.ts
─────────────────────────
166. LINE 221 | console.log | 🟡 CAUTION
     CODE: console.log('[Notification Navigation] Using default fallback to dashboard');
     CONTAINS: Static string

167. LINE 236 | console.log | 🟡 CAUTION
     CODE: console.log('[Notification Navigation] Starting navigation:', { type, related_post_id, related_course_id, ... });
     CONTAINS: Notification type, IDs (post, course, submission, conversation, user), role, message preview

168. LINE 251 | console.log | 🟢 SAFE
     CODE: console.log('[Notification Navigation] Chat notification, skipping navigation');
     CONTAINS: Static string

169. LINE 259 | console.log | 🟡 CAUTION
     CODE: console.log('[Notification Navigation] ✅ Navigating to:', target, 'for notification type:', notification.type);
     CONTAINS: Target URL, notification type

170. LINE 269 | console.log | 🟡 CAUTION
     CODE: console.log('[Notification Navigation] ❌ No navigation target found for notification type:', notification.type);
     CONTAINS: Notification type

─────────────────────────
FILE: app/hooks/useAutoLogout.ts
─────────────────────────
171. LINE 36 | console.error | 🟡 CAUTION
     CODE: console.error('Error logging auto-logout:', error);
     CONTAINS: Error object

172. LINE 109 | console.log | 🟢 SAFE
     CODE: console.log('✅ Token refreshed successfully');
     CONTAINS: Static string

173. LINE 113 | console.error | 🟡 CAUTION
     CODE: console.error('❌ Token refresh failed');
     CONTAINS: Static string (failure indicator)

174. LINE 117 | console.error | 🟡 CAUTION
     CODE: console.error('Error refreshing token:', error);
     CONTAINS: Error object

─────────────────────────
FILE: app/onboarding/documents/page.tsx (student onboarding flow)
─────────────────────────
175. LINE 58 | console.log | 🟡 CAUTION
     CODE: console.log('Qualification API response:', qualData);
     CONTAINS: API response (qualification level data)

176. LINE 62 | console.log | 🟡 CAUTION
     CODE: console.log('Found qualification level:', level);
     CONTAINS: Level number

177. LINE 98 | console.log | 🟡 CAUTION
     CODE: console.log('Setting qualification level state:', QUALIFICATION_LEVELS[level]);
     CONTAINS: Qualification level object

178. LINE 107 | console.log | 🟢 SAFE
     CODE: console.log('No qualification selection found or invalid data');
     CONTAINS: Static string

179. LINE 110 | console.error | 🟡 CAUTION
     CODE: console.error('Error fetching qualification level:', qualError);
     CONTAINS: Error object

180. LINE 114 | console.error | 🟡 CAUTION
     CODE: console.error('Error fetching data:', err);
     CONTAINS: Error object

─────────────────────────
FILE: app/onboarding/verification-pending/page.tsx
─────────────────────────
181. LINE 54 | console.log | 🟡 CAUTION
     CODE: console.log('Rejected documents found, redirecting to resubmit page');
     CONTAINS: Static string (flow indicator)

182. LINE 62 | console.error | 🟡 CAUTION
     CODE: console.error('Error checking documents:', docError);
     CONTAINS: Error object

183. LINE 69 | console.error | 🟡 CAUTION
     CODE: console.error('Error fetching onboarding status:', error);
     CONTAINS: Error object

─────────────────────────
FILES WITH NO CONSOLE LOGS
─────────────────────────
- app/layout.tsx
- middleware.ts (no middleware.ts found in project root; no console logs in middleware)
- app/dashboard/student/profile/page.tsx
- app/dashboard/student/layout.tsx

---

## SUMMARY

### Totals
| Category | Count |
|----------|-------|
| **Total console logs found** | **183** |
| 🔴 **Dangerous** | **13** |
| 🟡 **Caution** | **148** |
| 🟢 **Safe** | **21** |

### Top 5 Most Dangerous Logs
1. **app/components/CertificateClaimsManagement.tsx:233** — `console.log('Opening URL:', fileUrl)` — Exposes full URL with JWT token in query string
2. **app/components/Navbar.tsx:482** — `console.log('[Notification Click] Full notification data:', JSON.stringify(notification, null, 2))` — Full notification object with user IDs, course IDs, message content
3. **app/components/PaymentNotification.tsx:87** — `console.log('[PaymentNotification] API Response:', response)` — Full payment/installment API response
4. **app/components/ChatBox.tsx:186** — `console.log('📋 [ChatBox] Online users list:', users)` — User IDs and names
5. **app/services/api.ts:55** — `console.log(\`[API Request] ${options.method || 'GET'} ${endpoint}\`)` — Every API endpoint URL on every request

### Top 5 Files by Console Log Count
1. **app/dashboard/student/page.tsx** — 38 logs
2. **app/components/Navbar.tsx** — 29 logs
3. **app/components/PaymentNotification.tsx** — 17 logs
4. **app/services/api.ts** — 21 logs (across file)
5. **app/components/ChatBox.tsx** — 12 logs

### Files Scanned
- app/dashboard/student/ (all pages)
- app/page.tsx (landing/login flow)
- app/components/ (Navbar, ChatBox, FloatingChatWindow, PaymentNotification, ConditionalLayout, OnboardingGuard, MessageDropdown, FloatingChatProvider, CertificateClaimsManagement)
- app/services/api.ts
- app/utils/notificationNavigation.ts
- app/hooks/useAutoLogout.ts
- app/onboarding/ (documents, verification-pending)
- app/layout.tsx
- middleware (none found)
