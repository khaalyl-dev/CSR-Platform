-- Add rejected_activity_id to csr_plans (activity to modify when plan is rejected).
-- Run this if the column does not exist (e.g. after pulling the reject-modal feature).

-- MySQL:
ALTER TABLE csr_plans
  ADD COLUMN rejected_activity_id CHAR(36) NULL COMMENT 'Activité à modifier (si rejet ciblé)',
  ADD CONSTRAINT fk_csr_plans_rejected_activity
    FOREIGN KEY (rejected_activity_id) REFERENCES csr_activities(id) ON DELETE SET NULL;
