/**
 * Realized CSR API – list and create realized activities.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { RealizedCsr } from '../models/realized-csr.model';
import type { CreateRealizedCsrPayload } from '../models/realized-csr.model';

@Injectable({ providedIn: 'root' })
export class RealizedCsrApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * Get a single realized CSR by id.
   */
  get(id: string): Observable<RealizedCsr> {
    return this.http.get<RealizedCsr>(`${this.apiUrl}/realized-csr/${id}`);
  }

  /**
   * List realized CSR. Optional filters: activity_id.
   * SITE_USER only receives realized for their assigned sites' activities.
   */
  list(params?: { activity_id?: string }): Observable<RealizedCsr[]> {
    let httpParams = new HttpParams();
    if (params?.activity_id) httpParams = httpParams.set('activity_id', params.activity_id);
    return this.http.get<RealizedCsr[]>(`${this.apiUrl}/realized-csr`, { params: httpParams });
  }

  /**
   * Create a realized CSR record.
   */
  create(payload: CreateRealizedCsrPayload): Observable<RealizedCsr> {
    return this.http.post<RealizedCsr>(`${this.apiUrl}/realized-csr`, payload);
  }

  update(id: string, payload: Partial<CreateRealizedCsrPayload>): Observable<RealizedCsr> {
    return this.http.put<RealizedCsr>(`${this.apiUrl}/realized-csr/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/realized-csr/${id}`);
  }
}
