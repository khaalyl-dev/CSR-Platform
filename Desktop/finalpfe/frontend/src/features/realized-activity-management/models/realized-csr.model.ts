/**
 * Realized CSR - aligned with realized_csr table.
 */
export interface RealizedCsr {
  id: string;
  activity_id: string;
  activity_title?: string | null;
  activity_number?: string | null;
  planned_budget?: number | null;
  plan_id?: string | null;
  site_name?: string | null;
  /** When false, plan is locked; user must submit a change request to edit/delete this realization. */
  plan_editable?: boolean;
  plan_status?: string | null;
  year: number;
  month: number;
  realized_budget: number | null;
  participants: number | null;
  total_hc: number | null;
  percentage_employees: number | null;
  volunteer_hours: number | null;
  action_impact_actual: number | null;
  action_impact_unit: string | null;
  impact_description: string | null;
  organizer: string | null;
  number_external_partners: number | null;
  realization_date: string | null;
  comment: string | null;
  contact_department: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface CreateRealizedCsrPayload {
  activity_id: string;
  year: number;
  month: number;
  realized_budget?: number | null;
  participants?: number | null;
  total_hc?: number | null;
  percentage_employees?: number | null;
  volunteer_hours?: number | null;
  action_impact_actual?: number | null;
  action_impact_unit?: string | null;
  impact_description?: string | null;
  organizer?: string | null;
  number_external_partners?: number | null;
  realization_date?: string | null;
  comment?: string | null;
  contact_department?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
}
