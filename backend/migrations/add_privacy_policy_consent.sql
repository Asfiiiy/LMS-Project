-- Add privacy_policy_consent to student_initial_assessments (GDPR/Privacy Policy consent)
ALTER TABLE student_initial_assessments 
ADD COLUMN privacy_policy_consent BOOLEAN NOT NULL DEFAULT FALSE 
AFTER apl_understanding;
