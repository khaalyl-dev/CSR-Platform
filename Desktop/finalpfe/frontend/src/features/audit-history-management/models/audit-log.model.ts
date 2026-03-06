import type { EntityType } from '@core/models/enums';

export interface AuditLog {
  id: string;
  site_id: string | null;
  site_name?: string | null;
  user_id: string | null;
  user_name?: string | null;
  action: string;
  entity_type: EntityType;
  entity_id: string | null;
  description: string | null;
  entity_history_id: string | null;
  created_at: string | null;
}
