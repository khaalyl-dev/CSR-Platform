import type { PlanStatus } from '@core/models/enums';

export interface CsrPlan {
  id: string;
  site_id: string;
  year: number;
  status: PlanStatus;
  total_budget: number;
  submitted_at: string | null;
  validated_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
