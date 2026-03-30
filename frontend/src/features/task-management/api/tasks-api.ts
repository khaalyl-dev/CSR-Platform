import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserTask {
  id: string;
  kind: string;
  href: string;
  meta: {
    site_name?: string | null;
    site_code?: string | null;
    year?: number | null;
    status?: string | null;
    activity_number?: string | null;
    activity_title?: string | null;
    plan_id?: string | null;
    entity_type?: string | null;
  };
}

export interface UserTasksResponse {
  tasks: UserTask[];
  count: number;
}

@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly base = '/api/tasks';

  constructor(private http: HttpClient) {}

  list(): Observable<UserTasksResponse> {
    return this.http.get<UserTasksResponse>(this.base);
  }
}
