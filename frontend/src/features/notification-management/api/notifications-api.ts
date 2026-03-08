/**
 * Notifications API – list and mark notifications as read.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private apiUrl = '/api/notifications';

  constructor(private http: HttpClient) {}

  list(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.apiUrl);
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/unread-count`);
  }

  markRead(id: string): Observable<Notification> {
    return this.http.patch<Notification>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllRead(): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/read-all`, {});
  }
}
