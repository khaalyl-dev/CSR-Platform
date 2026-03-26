import type { PlanStatus } from '@core/models/enums';

export interface CsrPlan {
  id: string;
  site_id: string;
  site_name?: string | null;
  site_code?: string | null;
  site_region?: string | null;
  site_country?: string | null;
  year: number;
  validation_mode: string;
  status: PlanStatus;
  total_budget: number | null;
  rejected_comment?: string | null;
  /** IDs des activités à modifier (plusieurs possibles). */
  rejected_activity_ids?: string[] | null;
  validation_step?: number | null;
  submitted_at: string | null;
  validated_at: string | null;
  /** Date limite de modification (après approbation d'une demande de modification); après cette date le plan redevient verrouillé */
  unlock_until?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  activities_count?: number;
  can_approve?: boolean;
  can_reject?: boolean;
}

export interface CreateCsrPlanPayload {
  site_id: string;
  year: number;
  validation_mode?: '101' | '111';
  total_budget?: number | null;
}

export interface UpdateCsrPlanPayload {
  year?: number;
  validation_mode?: '101' | '111';
  total_budget?: number | null;
}
