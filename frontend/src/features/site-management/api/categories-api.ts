/**
 * Categories API – list, create and delete CSR categories.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Category } from '../models/category.model';

export interface RelatedActivity {
  id: string;
  activity_number: string;
  title: string;
  plan_id: string;
  plan_status: string | null;
  plan_editable: boolean;
  site_name: string | null;
  year: number | null;
}

export interface RelatedActivitiesResponse {
  activities: RelatedActivity[];
}

export interface DeleteCategoryResponse {
  message: string;
  deleted_activities: number;
  reassigned_activities: number;
}

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  list(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  create(name: string): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, { name: name.trim() });
  }

  getRelatedActivities(categoryId: string): Observable<RelatedActivitiesResponse> {
    return this.http.get<RelatedActivitiesResponse>(`${this.apiUrl}/categories/${categoryId}/related-activities`);
  }

  delete(categoryId: string, deleteRelatedActivities: boolean): Observable<DeleteCategoryResponse> {
    return this.http.delete<DeleteCategoryResponse>(`${this.apiUrl}/categories/${categoryId}`, {
      body: { delete_related_activities: deleteRelatedActivities },
    });
  }
}
