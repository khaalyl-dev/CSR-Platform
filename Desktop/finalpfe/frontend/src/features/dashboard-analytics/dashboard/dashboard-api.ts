import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStore } from '@core/services/auth-store';

export interface DashboardSummary {
  siteId: string | null;
  plansCount: number;
  validatedPlansCount: number;
  activitiesThisMonth: number;
  totalCost: number;
}

export interface ActivitiesChart {
  labels: string[];
  data: number[];
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly apiUrl = '/api';

  private getAuthHeaders(): HttpHeaders {
    const token = this.authStore.token();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getSiteSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(
      `${this.apiUrl}/dashboard/site/summary`,
      { headers: this.getAuthHeaders() }
    );
  }

  getActivitiesChart(): Observable<ActivitiesChart> {
    return this.http.get<ActivitiesChart>(
      `${this.apiUrl}/dashboard/site/activities-chart`,
      { headers: this.getAuthHeaders() }
    );
  }
}
