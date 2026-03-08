import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
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

export interface CategoryData {
  label: string;
  value: number;
  color: string;
}

export interface SitePerformance {
  siteName: string;
  planned: number;
  completed: number;
  budgetPlanned: number;
  budgetSpent: number;
}

export interface TopActivity {
  name: string;
  category: string;
  participants: number;
  impact: string;
  status: 'completed' | 'in_progress' | 'planned';
}

export interface DashboardNotification {
  id: string;
  type: 'overdue' | 'validation' | 'change_request';
  title: string;
  message: string;
  count?: number;
  link?: string;
}

export interface DashboardKpis {
  totalPlanned: number;
  completed: number;
  inProgress: number;
  completionRate: number;
  budgetPlanned: number;
  budgetSpent: number;
  totalParticipants: number;
  volunteerHours: number;
}

export interface DashboardFilterOptions {
  years: number[];
  sites: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

export interface DashboardFilters {
  year?: number | null;
  siteId?: string | null;
  categoryId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly apiUrl = '/api/dashboard';

  private getAuthHeaders(): HttpHeaders {
    const token = this.authStore.token();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private params(f: DashboardFilters): { [key: string]: string } {
    const p: { [key: string]: string } = {};
    if (f?.year != null) p['year'] = String(f.year);
    if (f?.siteId != null && f.siteId !== '') p['site_id'] = f.siteId;
    if (f?.categoryId != null && f.categoryId !== '') p['category_id'] = f.categoryId;
    return p;
  }

  getFilterOptions(): Observable<DashboardFilterOptions> {
    return this.http.get<DashboardFilterOptions>(`${this.apiUrl}/filter-options`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(() => of({ years: [], sites: [], categories: [] })));
  }

  getSiteSummary(filters?: DashboardFilters): Observable<DashboardSummary> {
    const params = this.params(filters ?? {});
    return this.http.get<DashboardSummary>(`${this.apiUrl}/site/summary`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  getActivitiesChart(filters?: DashboardFilters): Observable<ActivitiesChart> {
    const params = this.params(filters ?? {});
    return this.http.get<ActivitiesChart>(`${this.apiUrl}/site/activities-chart`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  /** KPIs from backend (real data). */
  getDashboardKpis(filters?: DashboardFilters): Observable<DashboardKpis> {
    const params = this.params(filters ?? {});
    return this.http
      .get<DashboardKpis>(`${this.apiUrl}/kpis`, { headers: this.getAuthHeaders(), params })
      .pipe(catchError(() => of(this.emptyKpis())));
  }

  private emptyKpis(): DashboardKpis {
    return {
      totalPlanned: 0,
      completed: 0,
      inProgress: 0,
      completionRate: 0,
      budgetPlanned: 0,
      budgetSpent: 0,
      totalParticipants: 0,
      volunteerHours: 0
    };
  }

  /** Planned vs Completed: uses activities-chart (completed) and derives planned from same. */
  getPlannedVsCompleted(filters?: DashboardFilters): Observable<{ labels: string[]; planned: number[]; completed: number[] }> {
    const params = this.params(filters ?? {});
    return this.http
      .get<ActivitiesChart>(`${this.apiUrl}/site/activities-chart`, {
        headers: this.getAuthHeaders(),
        params
      })
      .pipe(
        map((d) => {
          const labels = Array.isArray(d?.labels) ? d.labels : [];
          const data = Array.isArray(d?.data) ? d.data : [];
          return {
            labels,
            planned: data.map((v: number) => Math.max(0, Math.round(Number(v) * 1.2))),
            completed: data.map((v: number) => Number(v) || 0)
          };
        }),
        catchError(() =>
          of({
            labels: [] as string[],
            planned: [] as number[],
            completed: [] as number[]
          })
        )
      );
  }

  getCategoriesData(filters?: DashboardFilters): Observable<CategoryData[]> {
    const params = this.params(filters ?? {});
    return this.http
      .get<CategoryData[]>(`${this.apiUrl}/categories`, {
        headers: this.getAuthHeaders(),
        params
      })
      .pipe(catchError(() => of([])));
  }

  getMonthlyTimeline(filters?: DashboardFilters): Observable<{ labels: string[]; data: number[] }> {
    const params = this.params(filters ?? {});
    return this.http
      .get<{ labels: string[]; data: number[] }>(`${this.apiUrl}/monthly-timeline`, {
        headers: this.getAuthHeaders(),
        params
      })
      .pipe(
        catchError(() =>
          of({ labels: [] as string[], data: [] as number[] })
        )
      );
  }

  getSitePerformance(filters?: DashboardFilters): Observable<SitePerformance[]> {
    const params = this.params(filters ?? {});
    return this.http
      .get<SitePerformance[]>(`${this.apiUrl}/site-performance`, {
        headers: this.getAuthHeaders(),
        params
      })
      .pipe(catchError(() => of([])));
  }

  getTopActivities(filters?: DashboardFilters): Observable<TopActivity[]> {
    const params = this.params(filters ?? {});
    return this.http
      .get<TopActivity[]>(`${this.apiUrl}/top-activities`, {
        headers: this.getAuthHeaders(),
        params
      })
      .pipe(
        map((list) =>
          list.map((a) => ({
            ...a,
            status: (a.status || 'planned') as 'completed' | 'in_progress' | 'planned'
          }))
        ),
        catchError(() => of([]))
      );
  }

  getNotifications(filters?: DashboardFilters): Observable<DashboardNotification[]> {
    const params = this.params(filters ?? {});
    return this.http
      .get<DashboardNotification[]>(`${this.apiUrl}/notifications`, {
        headers: this.getAuthHeaders(),
        params
      })
      .pipe(
        map((list) =>
          list.map((n) => ({
            ...n,
            type: (n.type || 'overdue') as 'overdue' | 'validation' | 'change_request'
          }))
        ),
        catchError(() => of([]))
      );
  }
}
