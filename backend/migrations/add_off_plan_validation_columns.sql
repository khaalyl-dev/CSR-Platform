-- Off-plan validation workflow (101 / 111) — columns referenced by CsrActivity model
-- Run once on existing MySQL databases (create_all does not ALTER existing tables)

ALTER TABLE csr_activities
  ADD COLUMN off_plan_validation_mode VARCHAR(10) NULL COMMENT 'Mode validation hors plan soumis: 101 ou 111',
  ADD COLUMN off_plan_validation_step INT NULL COMMENT '111: 1=niveau 1 site, 2=corporate. 101: 2=corporate seul';
