import type { EntityType } from '@core/models/enums';

export interface AuditLog {
  id: string;
  site_id: string;
  user_id: string;
  action: string;
  entity_type: EntityType;
  entity_id: string;
  description: string;
  created_at: string;
}
