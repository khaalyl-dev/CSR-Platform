/**
 * Audit API – list audit logs (corporate only), rollback to previous version.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { AuditLog } from '../models/audit-log.model';

export interface AuditLogsParams {
  action?: string;
  entity_type?: string;
  site_id?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private apiUrl = '/api/audit';

  constructor(private http: HttpClient) {}

  listLogs(params?: AuditLogsParams): Observable<AuditLog[]> {
    let httpParams = new HttpParams();
    if (params?.action) httpParams = httpParams.set('action', params.action);
    if (params?.entity_type) httpParams = httpParams.set('entity_type', params.entity_type);
    if (params?.site_id) httpParams = httpParams.set('site_id', params.site_id);
    if (params?.user_id) httpParams = httpParams.set('user_id', params.user_id);
    if (params?.date_from) httpParams = httpParams.set('date_from', params.date_from);
    if (params?.date_to) httpParams = httpParams.set('date_to', params.date_to);
    if (params?.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<AuditLog[]>(`${this.apiUrl}/logs`, { params: httpParams });
  }

  rollback(entityHistoryId: string): Observable<{ message: string; entity_type?: string; entity_id?: string }> {
    return this.http.post<{ message: string; entity_type?: string; entity_id?: string }>(
      `${this.apiUrl}/rollback`,
      { entity_history_id: entityHistoryId }
    );
  }
}
