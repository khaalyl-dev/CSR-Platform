/**
 * UsersApi - HTTP client for /api/users endpoints (corporate only).
 * CRUD users, assign site access, reset password.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** User base model from backend */
export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
}

/** User with site assignments (from GET /api/users/:id) */
export interface UserWithSites extends User {
  sites: UserSiteAccess[];
}

/** Site access record in user detail */
export interface UserSiteAccess {
  id: string;
  site_id: string;
  site_name: string;
  granted_at: string | null;
}

/** Payload for creating a SITE_USER */
export interface CreateUserPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

/** Payload for POST /api/users/:id/sites - replaces site assignment */
export interface AssignSitesPayload {
  site_ids: string[];
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  /** List all users (corporate only) */
  list(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  /** Get user by ID with site assignments */
  get(id: string): Observable<UserWithSites> {
    return this.http.get<UserWithSites>(`${this.apiUrl}/users/${id}`);
  }

  /** Create SITE_USER, optionally assign sites */
  create(payload: CreateUserPayload): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, payload);
  }

  /** Update user (first_name, last_name, is_active, password) */
  update(id: string, payload: Partial<CreateUserPayload & { is_active: boolean; password?: string }>): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${id}`, payload);
  }

  /** Replace user's site access (full replace semantics) */
  assignSites(userId: string, payload: AssignSitesPayload): Observable<{ sites: UserSiteAccess[] }> {
    return this.http.post<{ sites: UserSiteAccess[] }>(`${this.apiUrl}/users/${userId}/sites`, payload);
  }

  /** Revoke site access for a user */
  revokeSiteAccess(userId: string, siteId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/users/${userId}/sites/${siteId}`);
  }

  /** Generate new random password (returns password for one-time display) */
  resetPassword(userId: string): Observable<{ password: string; message: string }> {
    return this.http.post<{ password: string; message: string }>(`${this.apiUrl}/users/${userId}/reset-password`, {});
  }
}
