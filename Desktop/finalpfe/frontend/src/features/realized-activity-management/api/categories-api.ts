/** Categories API – list and create categories for activity form. */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Category {
  id: string;
  name: string;
}

/** Value for "Other" in category dropdown; user then enters a new category name. */
export const CATEGORY_OTHER_VALUE = '__other__';

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
}
