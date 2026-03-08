# file_management

Documents and attachments (upload, download, profile photos).

---

## Files

| File | Purpose |
|------|---------|
| **documents_routes.py** | Blueprint `/api/documents`. Create document record, upload file (change_requests or activity_photos), list, download. Serves profile photos via `/api/documents/serve/<path>`. Uses `config.get_media_folder()`. |
| **__init__.py** | Exports `documents_bp`. |
