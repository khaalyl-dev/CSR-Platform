import type { EntityType } from '@core/models/enums';

export interface EntityHistory {
  id: string;
  site_id: string;
  entity_type: EntityType;
  entity_id: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  modified_by: string;
  modified_at: string;
}
