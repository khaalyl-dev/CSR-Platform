import type { ValidationStatus } from '@core/models/enums';

export interface ValidationStep {
  id: string;
  validation_id: string;
  level: number;
  validator_id: string;
  status: ValidationStatus;
  comment: string;
  validated_at: string | null;
}
