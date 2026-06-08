# Payment Reminders Setup

## 1. Run the migration

From the project root, run the SQL migration to create the required tables:

```bash
cd backend
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < migrations/create_payment_reminders_tables.sql
```

Or use your preferred method to execute `backend/migrations/create_payment_reminders_tables.sql`.

## 2. SMTP configuration

Add these variables to your `backend/.env` file for email sending:

```
SMTP_HOST=mail.inspirelondoncollege.co.uk
SMTP_PORT=25
SMTP_USER=onlinetutor@inspirelondoncollege.co.uk
SMTP_PASS=your_password_here
SMTP_FROM_NAME=Inspire London College
SMTP_FROM_EMAIL=onlinetutor@inspirelondoncollege.co.uk
```

## 3. Dashboard access

- **Pending Installments** & **Received Installments**: Accounts Manager, Team Member
- **Reminder Logs** & **Settings** (Email Templates, Auto-reminder): Accounts Manager only

Navigate to **Dashboard → Tickets → Payments** to access these tabs.
