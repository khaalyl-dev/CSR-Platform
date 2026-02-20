/**
 * AuthApi - HTTP client for /api/auth endpoints.
 * Handles login, logout, session validation, profile, and password change.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Response from POST /api/auth/login */
export interface LoginResponse {
  token: string;
  email: string;
  role: string; // SITE_USER | CORPORATE_USER from backend
  user_id?: string | number;
  expires_at?: string;
}

/** Response from GET /api/auth/me - minimal user info for session validation */
export interface MeResponse {
  user_id: string | number;
  email: string;
  role: string;
}

/** Site assignment in profile (SITE_USER only) */
export interface ProfileSite {
  id: string;
  site_id: string;
  site_name: string | null;
  site_code: string | null;
  granted_at: string | null;
}

/** Response from GET /api/auth/profile - full user profile */
export interface ProfileResponse {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  sites: ProfileSite[];
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password,
    });
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/logout`, {});
  }

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.apiUrl}/auth/me`);
  }

  /** Fetch full profile of the current user (requires auth) */
  getProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.apiUrl}/auth/profile`);
  }

  /** Change current user's password. Requires current password and new password (min 8 chars). */
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }
}
