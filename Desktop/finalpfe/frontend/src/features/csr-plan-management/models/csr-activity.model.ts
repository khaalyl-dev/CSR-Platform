import type {
  ActivityStatus,
  OrganizationType,
  ContractType,
  CollaborationNature
} from '@core/models/enums';

export interface CsrActivity {
  id: string;
  plan_id: string | null;
  site_id: string;
  category_id: string;
  external_partner_id: string | null;
  activity_number: string;
  title: string;
  description: string;
  activity_type: string;
  organization: OrganizationType;
  collaboration_nature: CollaborationNature | null;
  contract_type: ContractType;
  periodicity: string;
  planned_budget: number | null;
  planned_volunteers: number | null;
  action_impact_target: number | null;
  action_impact_unit: string | null;
  action_impact_duration: string | null;
  sustainability_description: string | null;
  start_year: number | null;
  edition: number | null;
  organizer: string | null;
  responsible_user_id: string;
  start_date: string;
  end_date: string;
  status: ActivityStatus;
  slide_number: string | null;
  created_at: string;
  updated_at: string;
}
