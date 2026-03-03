import type { PlanStatus } from '@core/models/enums';

export interface CsrPlan {
  id: string;
  site_id: string;
  site_name?: string | null;
  site_code?: string | null;
  year: number;
  validation_mode: string;
  status: PlanStatus;
  total_budget: number | null;
  rejected_comment?: string | null;
  validation_step?: number | null;
  submitted_at: string | null;
  validated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  can_approve?: boolean;
  can_reject?: boolean;
}

export interface CreateCsrPlanPayload {
  site_id: string;
  year: number;
  validation_mode?: '101' | '111';
  total_budget?: number | null;
}
