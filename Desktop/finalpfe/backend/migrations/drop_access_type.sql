-- Migration: Remove access_type column from user_sites
-- Run if you have existing data and want to update without recreating tables:
-- mysql -u root -p csr_db < migrations/drop_access_type.sql

ALTER TABLE user_sites DROP COLUMN access_type;
