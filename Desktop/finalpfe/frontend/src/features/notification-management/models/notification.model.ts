export interface Notification {
  id: string;
  user_id: string;
  site_id: string | null;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string | null;
}