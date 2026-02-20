import type { EntityType } from '@core/models/enums';

export interface Notification {
  id: string;
  site_id: string;
  title: string;
  message: string;
  type: string;
  entity_type: EntityType;
  entity_id: string;
  created_by: string;
  created_at: string;
}
