export interface Notification {
  id: string;
  user_id: string;
  site_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  target_route?: string | null;
  entity_type?: 'PLAN' | 'ACTIVITY' | 'CHANGE_REQUEST' | string;
  entity_id?: string;
  created_by?: string;
  created_at: string;
}
