-- Add terms_conditions_consent to student_initial_assessments (Terms & Conditions consent)
ALTER TABLE student_initial_assessments 
ADD COLUMN terms_conditions_consent BOOLEAN NOT NULL DEFAULT FALSE 
AFTER privacy_policy_consent;
