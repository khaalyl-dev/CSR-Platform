-- Add change_request_id to documents for change request attachments
ALTER TABLE documents
  ADD COLUMN change_request_id CHAR(36) NULL
  COMMENT 'Demande de modification à laquelle ce document est joint'
  AFTER is_pinned;

ALTER TABLE documents
  ADD CONSTRAINT fk_documents_change_request
  FOREIGN KEY (change_request_id) REFERENCES change_requests(id) ON DELETE CASCADE;
