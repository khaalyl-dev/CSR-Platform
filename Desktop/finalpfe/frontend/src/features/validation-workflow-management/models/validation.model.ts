import type { EntityType, ValidationStatus } from '@core/models/enums';

export interface Validation {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  site_id: string;
  status: ValidationStatus;
  validated_by: string | null;
  comment: string;
  validated_at: string | null;
  created_at: string;
}
