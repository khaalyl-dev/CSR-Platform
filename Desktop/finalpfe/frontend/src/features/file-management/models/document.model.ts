export interface Document {
  id: string;
  site_id: string;
  site_name: string;
  file_name: string;
  file_path: string;
  file_type: string;
  is_pinned: boolean; 
  uploaded_by: string;
  uploader_name: string;
  uploaded_at: string | null;
  updated_at: string | null;
}