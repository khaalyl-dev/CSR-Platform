import type { EntityType, ValidationStatus } from '@core/models/enums';

export interface ChangeRequest {
  id: string;
  site_id: string;
  entity_type: EntityType;
  entity_id: string;
  year: number;
  reason: string;
  status: ValidationStatus;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
