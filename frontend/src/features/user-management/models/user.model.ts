/**
 * User model - aligns with backend users table.
 * Used for type safety in components (users-api uses its own User interface).
 */
import type { UserRole } from '@core/models/enums';

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
