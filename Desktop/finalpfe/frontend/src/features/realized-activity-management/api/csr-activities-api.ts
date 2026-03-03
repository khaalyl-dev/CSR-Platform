/**
 * CSR Activities API – list and create activities.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { CsrActivity } from '../models/csr-activity.model';

export interface CreateCsrActivityPayload {
  plan_id: string;
  category_id: string;
  activity_number: string;
  title: string;
  description?: string | null;
  planned_budget?: number | null;
}

@Injectable({ providedIn: 'root' })
export class CsrActivitiesApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  list(params?: { plan_id?: string }): Observable<CsrActivity[]> {
    let httpParams = new HttpParams();
    if (params?.plan_id) httpParams = httpParams.set('plan_id', params.plan_id);
    return this.http.get<CsrActivity[]>(`${this.apiUrl}/csr-activities`, { params: httpParams });
  }

  create(payload: CreateCsrActivityPayload): Observable<CsrActivity> {
    return this.http.post<CsrActivity>(`${this.apiUrl}/csr-activities`, payload);
  }
}
