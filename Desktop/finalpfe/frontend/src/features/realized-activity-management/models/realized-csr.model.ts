export interface RealizedCsr {
  id: string;
  activity_id: string;
  realized_budget: number;
  participants: number;
  total_hc: number | null;
  percentage_employees: number | null;
  volunteer_hours: number;
  action_impact_actual: number | null;
  action_impact_unit: string | null;
  impact_description: string;
  organizer: string | null;
  number_external_partners: number | null;
  realization_date: string;
  comment: string;
  contact_department: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_by: string;
  created_at: string;
}
