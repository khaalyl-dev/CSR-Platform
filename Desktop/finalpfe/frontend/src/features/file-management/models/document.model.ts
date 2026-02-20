import type { EntityType } from '@core/models/enums';

export interface Document {
  id: string;
  site_id: string;
  entity_type: EntityType;
  entity_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
}
