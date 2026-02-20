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

@Injectable({ providedIn: 'root' })
export class SitesApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  list(activeOnly = false): Observable<Site[]> {
    const url = activeOnly ? `${this.apiUrl}/sites?active=true` : `${this.apiUrl}/sites`;
    return this.http.get<Site[]>(url);
  }

  get(id: string): Observable<Site> {
    return this.http.get<Site>(`${this.apiUrl}/sites/${id}`);
  }
}
