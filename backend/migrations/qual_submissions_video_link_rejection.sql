-- Widen video link storage; add tutor reject / student resubmit workflow for external links
-- Safe to run once (may error if columns already exist — skip those statements).

ALTER TABLE qual_submissions MODIFY COLUMN video_link TEXT NULL;

ALTER TABLE qual_submissions
  ADD COLUMN video_link_status ENUM('submitted','rejected') NOT NULL DEFAULT 'submitted' AFTER video_link,
  ADD COLUMN video_link_reject_reason TEXT NULL AFTER video_link_status,
  ADD COLUMN video_link_rejected_at TIMESTAMP NULL AFTER video_link_reject_reason;
