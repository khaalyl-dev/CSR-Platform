import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStore } from '../../core/auth-store';

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
  private apiUrl = 'http://localhost:8000/api';

  constructor(
    private http: HttpClient,
    private authStore: AuthStore
  ) {}

  /**
   * Get HTTP headers with JWT token from auth store.
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authStore.token();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  /**
   * Fetch high-level metrics for the current site dashboard.
   * Expected Flask endpoint:
   *   GET /api/dashboard/site/summary
   * Requires JWT token in Authorization header.
   */
  getSiteSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(
      `${this.apiUrl}/dashboard/site/summary`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Fetch chart data for activities over the last N months.
   * Expected Flask endpoint:
   *   GET /api/dashboard/site/activities-chart
   * Requires JWT token in Authorization header.
   */
  getActivitiesChart(): Observable<ActivitiesChart> {
    return this.http.get<ActivitiesChart>(
      `${this.apiUrl}/dashboard/site/activities-chart`,
      { headers: this.getAuthHeaders() }
    );
  }
}

