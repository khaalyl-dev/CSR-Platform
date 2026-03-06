/**
 * CSR Activities API – list and create activities.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { CsrActivity } from '../models/csr-activity.model';

export interface PlannedActivityListItem extends CsrActivity {
  site_id?: string | null;
  site_name?: string | null;
  site_code?: string | null;
  year?: number;
  category_name?: string | null;
  /** Plan status (VALIDATED = locked, no edit/delete). */
  plan_status?: string | null;
  /** When false, plan is locked; user must submit a change request to edit/delete. */
  plan_editable?: boolean;
}

export interface CreateCsrActivityPayload {
  plan_id: string;
  title: string;
  /** When draft=true, category_id and activity_number are optional (backend uses defaults). */
  draft?: boolean;
  category_id?: string;
  activity_number?: string;
  description?: string | null;
  planned_budget?: number | null;
}

@Injectable({ providedIn: 'root' })
export class CsrActivitiesApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  /** List with optional plan_id and year. Backend returns site_name, year, category_name for list view. */
  list(params?: { plan_id?: string; year?: number }): Observable<PlannedActivityListItem[]> {
    let httpParams = new HttpParams();
    if (params?.plan_id) httpParams = httpParams.set('plan_id', params.plan_id);
    if (params?.year != null) httpParams = httpParams.set('year', params.year.toString());
    return this.http.get<PlannedActivityListItem[]>(`${this.apiUrl}/csr-activities`, { params: httpParams });
  }

  get(id: string): Observable<PlannedActivityListItem> {
    return this.http.get<PlannedActivityListItem>(`${this.apiUrl}/csr-activities/${id}`);
  }

  create(payload: CreateCsrActivityPayload): Observable<CsrActivity> {
    return this.http.post<CsrActivity>(`${this.apiUrl}/csr-activities`, payload);
  }

  update(id: string, payload: UpdateCsrActivityPayload): Observable<CsrActivity> {
    return this.http.put<CsrActivity>(`${this.apiUrl}/csr-activities/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/csr-activities/${id}`);
  }
}

export interface UpdateCsrActivityPayload {
  category_id: string;
  activity_number: string;
  title: string;
  description?: string | null;
  planned_budget?: number | null;
  organization?: string | null;
  collaboration_nature?: string | null;
  organizer?: string | null;
  planned_volunteers?: number | null;
  action_impact_target?: number | null;
  action_impact_unit?: string | null;
}
