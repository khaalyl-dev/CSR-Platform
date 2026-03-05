/**
 * Change Requests API – create, list, get, approve, reject.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { ChangeRequest } from '../models/change-request.model';

export interface ChangeRequestWithDocs extends ChangeRequest {
  documents?: { id: string; file_name: string; file_path: string; file_type: string; uploaded_at: string | null }[];
  plan_site_name?: string;
  plan_year?: number;
  requested_by_name?: string;
  requested_duration?: string | null;
  reviewed_by_name?: string;
  site_name?: string;
}

@Injectable({ providedIn: 'root' })
export class ChangeRequestsApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  create(payload: { plan_id: string; reason: string; requested_duration?: number }): Observable<ChangeRequestWithDocs> {
    return this.http.post<ChangeRequestWithDocs>(`${this.apiUrl}/change-requests`, payload);
  }

  list(params?: { status?: string }): Observable<ChangeRequestWithDocs[]> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<ChangeRequestWithDocs[]>(`${this.apiUrl}/change-requests`, { params: httpParams });
  }

  get(id: string): Observable<ChangeRequestWithDocs> {
    return this.http.get<ChangeRequestWithDocs>(`${this.apiUrl}/change-requests/${id}`);
  }

  approve(id: string): Observable<ChangeRequestWithDocs> {
    return this.http.post<ChangeRequestWithDocs>(`${this.apiUrl}/change-requests/${id}/approve`, {});
  }

  reject(id: string, comment?: string): Observable<ChangeRequestWithDocs> {
    return this.http.post<ChangeRequestWithDocs>(`${this.apiUrl}/change-requests/${id}/reject`, { comment: comment ?? '' });
  }
}
