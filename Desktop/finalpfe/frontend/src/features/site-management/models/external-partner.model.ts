import type { PartnerType } from '@core/models/enums';

export interface ExternalPartner {
  id: string;
  name: string;
  type: PartnerType;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
