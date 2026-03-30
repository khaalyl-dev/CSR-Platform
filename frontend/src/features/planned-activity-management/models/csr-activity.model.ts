/** CSR Activity - aligned with csr_activities table (for dropdown). */
export interface CsrActivity {
  id: string;
  plan_id: string;
  activity_number: string;
  title: string;
  description?: string | null;
  category_id?: string;
  status?: string;
  is_off_plan?: boolean;
  planned_budget?: number | null;
  collaboration_nature?: string | null;
  periodicity?: string | null;
  organizer?: string | null;
  action_impact_target?: number | null;
  action_impact_unit?: string | null;
  action_impact_duration?: string | null;
  edition?: number | null;
  start_year?: number | null;
  number_external_partners?: number | null;
  external_partner_name?: string | null;
  off_plan_validation_mode?: string | null;
  off_plan_validation_step?: number | null;
}
