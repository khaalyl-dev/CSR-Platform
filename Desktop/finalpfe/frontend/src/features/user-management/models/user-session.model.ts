/**
 * UserSession model - aligns with backend user_sessions table.
 * Tracks JWT session: refresh_token, ip, user_agent, expires_at.
 */
export interface UserSession {
  id: string;
  user_id: string;
  refresh_token: string;
  ip_address: string;
  user_agent: string;
  expires_at: string;
  created_at: string;
}
