/** CSR Activity - aligned with csr_activities table (for dropdown). */
export interface CsrActivity {
  id: string;
  plan_id: string;
  activity_number: string;
  title: string;
  description?: string | null;
  category_id?: string;
  status?: string;
  planned_budget?: number | null;
  organization?: string | null;
  collaboration_nature?: string | null;
  organizer?: string | null;
  planned_volunteers?: number | null;
  action_impact_target?: number | null;
  action_impact_unit?: string | null;
}
