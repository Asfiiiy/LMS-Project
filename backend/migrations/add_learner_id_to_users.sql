ALTER TABLE users
ADD COLUMN learner_id VARCHAR(100) NULL AFTER email,
ADD UNIQUE KEY uniq_users_learner_id (learner_id);
