/**
 * UserSite model - aligns with backend user_sites table.
 * Association user–site: which sites a user has access to.
 */
export interface UserSite {
  id: string;
  user_id: string;
  site_id: string;
  granted_by: string;
  granted_at: string;
}
