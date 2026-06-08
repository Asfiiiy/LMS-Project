TAB 1: "Pending Installments" Tab
Who can see this tab: Only Accounts Manager and their Team Members (no other roles)
Purpose: Show only students who have pending/overdue installments so the accounts team can track and send reminders.
1.1 Statistics Cards at Top:

Total Pending Students – count of students with pending installments
Total Pending Amount – sum of all pending installment amounts
Overdue Students – students with overdue installments
Overdue Amount – total overdue amount
Reminders Sent Today – count of reminders sent today
Reminders Sent This Month – count of reminders sent this month

1.2 Filters:

Quick Time Filters – Buttons: "Overdue", "Due in 1 Month", "Due in 3 Months", "All Pending"
Search – by student name, email, or course
Course filter – dropdown
Date range – from and to date
Reminder Status filter – dropdown: "All", "Not Notified", "Reminder Sent", "Already Reminded (Multiple)"
Export CSV – download filtered data
Clear Filters – reset all

1.3 Main Table Columns:
ColumnDescriptionStudentName and emailCourseCourse titleInstallmentWhich installment is pending (e.g. 3/5)Amount DueAmount of pending installmentDue DateWhen it's dueDays OverdueNumber of days past due (show "Due in X days" if not yet due)Total Plan AmountTotal course payment amountTotal PaidAmount paid so farTotal RemainingRemaining amount across all installmentsReminder Status"Not Notified" / "Reminder Sent" / "Reminded X times"Last Reminder SentDate/time of last reminderActions"Send Reminder" button, "View Details" button
1.4 Send Reminder Functionality:
Manual Reminder (clicking "Send Reminder" button):

When clicked, show a confirmation modal: "Send payment reminder to [Student Name] for [Course Name] - Installment [X] of [Amount]?"
Options in modal: "Send to Dashboard Only", "Send Email Only", "Send Both" (default: Send Both)
On confirm:

Dashboard Notification: Create a notification on the student's dashboard. Student sees it in a notifications panel/bell icon. Notification should say something like: "Payment Reminder: Your installment of [Amount] for [Course Name] was due on [Date]. Please make your payment at the earliest."
Email Notification: Send an email to the student using the SMTP settings below and the selected email template


After sending, update the reminder status to "Reminder Sent" and log the date/time
If reminder was already sent before, update status to "Reminded X times" (increment count)

Bulk Reminder:

Add checkboxes to each row
Add a "Send Bulk Reminder" button at the top
Admin can select multiple students and send reminders to all at once
Show a summary modal before sending: "You are about to send reminders to X students. Continue?"

1.5 Auto Reminder (After 24 Hours):

Set up a cron job / scheduled task that runs every 24 hours
It checks all overdue installments
If an installment is overdue and no reminder has been sent in the last 24 hours, automatically send a reminder (both dashboard + email)
If a reminder was already sent in the last 24 hours, skip that student
Log every auto-reminder in the reminder logs
Accounts Manager should be able to toggle ON/OFF the auto-reminder feature from the dashboard settings
Accounts Manager should be able to set the auto-reminder interval (default 24 hours, but they can change to 48 hours, 72 hours, weekly, etc.)

1.6 SMTP Configuration for Emails:
Host: mail.inspirelondoncollege.co.uk
Port (Outgoing): 25
Port (Incoming): 143
Username: onlinetutor@inspirelondoncollege.co.uk
Password: R(N,*LX,--v(
Encryption: None
From Name: Inspire London College
From Email: onlinetutor@inspirelondoncollege.co.uk
Set this up using Nodemailer (if Node.js) or the appropriate SMTP library for our stack. Store these credentials in environment variables, not hardcoded.
1.7 Email Templates (Manageable from Frontend):

Create an "Email Templates" section inside the Accounts Manager dashboard
Default template should be pre-filled (a professional payment reminder email)
Accounts Manager can create, edit, delete email templates from the UI
Templates support these dynamic variables:

{{studentName}} – Student's full name
{{courseName}} – Course title
{{installmentNumber}} – Which installment (e.g. 3 of 5)
{{amountDue}} – Amount due
{{dueDate}} – Due date
{{totalRemaining}} – Total remaining balance
{{daysOverdue}} – Number of days overdue
{{collegeName}} – Inspire London College


Provide a rich text editor (like TinyMCE or React Quill) for editing templates
When sending a reminder email, the Accounts Manager can choose which template to use from a dropdown before sending
Store templates in a email_templates collection/table with fields: id, name, subject, body, created_by, created_at, updated_at

Default Template Example:
Subject: Payment Reminder – {{courseName}}

Dear {{studentName}},

This is a friendly reminder that your installment {{installmentNumber}} of {{amountDue}} for {{courseName}} was due on {{dueDate}}.

Your total remaining balance is {{totalRemaining}}.

Please make your payment at the earliest to avoid any disruption to your studies.

If you have already made this payment, please disregard this email.

Best regards,
Accounts Team
Inspire London College



TAB 2: "Received Installments" Tab
Who can see this tab: Accounts Manager and their Team Members
Purpose: Track all installments that have been received/paid — a clear record of money collected.
2.1 Statistics Cards at Top:

Total Installments Received – count of paid installments
Total Amount Received – sum of all paid installment amounts
Received This Month – amount received in current month
Received This Week – amount received in current week
Average Installment Amount – average of paid installments
Students Fully Paid – count of students with all installments paid
Students with Remaining Balance – count of students still owing

2.2 Filters:

Search – by student name, email, or course
Course filter – dropdown
Date range – filter by paid date range
Month/Year – filter by month and/or year
Payment Plan filter – "All Paid (upfront)" or "Installment"
Export CSV – download filtered data
Clear Filters – reset all

2.3 Main Table Columns:
ColumnDescriptionStudentName and emailCourseCourse titleInstallmentWhich installment was paid (e.g. "2 of 5" or "Full Payment")Amount PaidAmount of this installmentPaid DateWhen it was paidPayment ReferenceReference/transaction IDTotal Plan AmountTotal course payment amountTotal Paid So FarCumulative amount paidRemaining BalanceHow much is still left to payRemaining InstallmentsHow many installments are left (e.g. "3 remaining")Status"Fully Settled" or "X installments remaining"NotesAny notes added during payment update
2.4 Expandable Row Detail:

Clicking a row expands to show ALL installments for that student-course combination
Shows a timeline/list of all installments: paid ones with dates and pending ones with due dates
Visual progress bar showing payment completion percentage




TAB 3: "Reminder Logs" Tab
Who can see this tab: Accounts Manager only
Purpose: Full audit trail of all reminders sent (manual + auto)
3.1 Table Columns:
ColumnDescriptionDate/TimeWhen reminder was sentStudentStudent name and emailCourseCourse titleInstallmentWhich installment the reminder was forAmount DueAmount of the installmentSent By"System (Auto)" or the staff member's nameMethod"Dashboard", "Email", or "Both"Email Template UsedName of the template usedEmail Status"Delivered", "Failed", "Pending"
3.2 Filters:

Date range filter
Sent by filter (Auto vs Manual)
Method filter (Dashboard / Email / Both)
Search by student name




Student Dashboard Side:
On the student's dashboard, add a Notifications section (bell icon with badge count):

Show all payment reminders sent to them
Each notification shows: message, date, amount due, course name
Student can mark notifications as "read"
Unread notifications show a red badge count on the bell icon
Notification panel can be a dropdown from the bell icon or a dedicated page




Backend Requirements:
New Database Tables/Collections:

payment_reminders – id, student_id, course_id, installment_id, sent_by (user_id or "system"), method ("dashboard" / "email" / "both"), email_template_id, email_status ("delivered" / "failed" / "pending"), created_at
email_templates – id, name, subject, body (HTML), created_by, created_at, updated_at, is_default (boolean)
student_notifications – id, student_id, type ("payment_reminder"), title, message, related_installment_id, is_read (boolean), created_at
auto_reminder_settings – id, is_enabled (boolean), interval_hours (default 24), last_run_at, updated_by, updated_at

New API Endpoints:

POST /api/admin/reminders/send – Send manual reminder (single)
POST /api/admin/reminders/send-bulk – Send bulk reminders
GET /api/admin/reminders/logs – Get reminder logs
GET /api/admin/payments/pending – Get pending installments with filters
GET /api/admin/payments/received – Get received installments with filters
GET /api/admin/payments/received/stats – Stats for received tab
CRUD /api/admin/email-templates – Create, read, update, delete email templates
GET /api/admin/auto-reminder/settings – Get auto reminder settings
PATCH /api/admin/auto-reminder/settings – Update auto reminder settings
GET /api/student/notifications – Get student's notifications
PATCH /api/student/notifications/:id/read – Mark notification as read

Cron Job:

Create a scheduled job that runs based on the interval set in auto_reminder_settings
Default: every 24 hours
Checks all overdue installments, sends reminders if not sent within the interval period
Logs all auto-reminders in payment_reminders table with sent_by = "system"