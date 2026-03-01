import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Site {
  id: string;
  name: string;
  code: string;
  region: string;
  country: string;
  location: string;
  description: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserSite {
  id: string;
  user_id: string;
  site_id: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  user_role: string;
  access_type: string;
  grade: string;
  is_active: boolean;
  granted_at: string | null;
}
export interface AvailableUser {
  user_id: string; // ⚠ correspond à l'id renvoyé par le backend
  first_name: string;
  last_name: string;
  email: string;
  already_assigned?: boolean;
}


export interface AssignUserPayload {
  user_id: string;
  access_type: 'FULL' | 'READ_ONLY';
  grade?: 'level_0' | 'level_1' | 'level_2' | null;
}

export interface UpdateUserSitePayload {
  access_type?: 'FULL' | 'READ_ONLY';
  grade?: 'level_0' | 'level_1' | 'level_2' | null;
}

@Injectable({ providedIn: 'root' })
export class SitesApi {
  private apiUrl = '/api'; // si tu utilises proxy, sinon mettre 'http://localhost:5001/api'

  constructor(private http: HttpClient) {}

  list(activeOnly = false): Observable<Site[]> {
    const url = activeOnly ? `${this.apiUrl}/sites?active=true` : `${this.apiUrl}/sites`;
    return this.http.get<Site[]>(url);
  }

  get(id: string): Observable<Site> {
    return this.http.get<Site>(`${this.apiUrl}/sites/${id}`);
  }

  createSite(site: Site): Observable<any> {
    return this.http.post(`${this.apiUrl}/sites`, site);
  }

  toggleStatus(siteId: string) {
    return this.http.patch(`${this.apiUrl}/sites/${siteId}/status`, {});
  }

updateSite(id: string, data: any) {
  return this.http.put<any>(`/api/sites/${id}`, data);
}


/** Lister les users d'un site */
getSiteUsers(siteId: string): Observable<UserSite[]> {
  return this.http.get<UserSite[]>(`${this.apiUrl}/sites/${siteId}/users`);
}

/** Affecter un user à un site */
assignUser(siteId: string, payload: AssignUserPayload): Observable<UserSite> {
  return this.http.post<UserSite>(`${this.apiUrl}/sites/${siteId}/users`, payload);
}

/** Modifier grade/access_type d'un user sur un site */
updateUserSite(siteId: string, userId: string, payload: UpdateUserSitePayload): Observable<UserSite> {
  return this.http.put<UserSite>(`${this.apiUrl}/sites/${siteId}/users/${userId}`, payload);
}

/** Révoquer l'accès d'un user */
revokeUser(siteId: string, userId: string): Observable<{ message: string }> {
  return this.http.delete<{ message: string }>(`${this.apiUrl}/sites/${siteId}/users/${userId}`);
}





} 