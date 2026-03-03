/**
 * CSR Plans API – list and create plans (csr_plans table).
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { CsrPlan } from '../models/csr-plan.model';
import type { CreateCsrPlanPayload } from '../models/csr-plan.model';

export interface CsrPlanDetail extends CsrPlan {
  activities?: Array<{ id: string; activity_number: string; title: string; status?: string; planned_budget?: number | null }>;
  can_approve?: boolean;
  can_reject?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CsrPlansApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * List CSR plans. Optional filters: site_id, year, status.
   * SITE_USER only receives plans for their assigned sites.
   */
  list(params?: { site_id?: string; year?: number; status?: string }): Observable<CsrPlan[]> {
    let httpParams = new HttpParams();
    if (params?.site_id) httpParams = httpParams.set('site_id', params.site_id);
    if (params?.year != null) httpParams = httpParams.set('year', params.year.toString());
    if (params?.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<CsrPlan[]>(`${this.apiUrl}/csr-plans`, { params: httpParams });
  }

  /**
   * Create a new plan (status DRAFT). Requires site_id and year.
   */
  create(payload: CreateCsrPlanPayload): Observable<CsrPlan> {
    return this.http.post<CsrPlan>(`${this.apiUrl}/csr-plans`, payload);
  }

  get(planId: string): Observable<CsrPlanDetail> {
    return this.http.get<CsrPlanDetail>(`${this.apiUrl}/csr-plans/${planId}`);
  }

  submitForValidation(planId: string): Observable<CsrPlan> {
    return this.http.patch<CsrPlan>(`${this.apiUrl}/csr-plans/${planId}/submit`, {});
  }

  approve(planId: string): Observable<CsrPlan> {
    return this.http.patch<CsrPlan>(`${this.apiUrl}/csr-plans/${planId}/approve`, {});
  }

  reject(planId: string, motif: string): Observable<CsrPlan> {
    return this.http.patch<CsrPlan>(`${this.apiUrl}/csr-plans/${planId}/reject`, { comment: motif });
  }
}
