/**
 * Categories API – list and create CSR categories.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Category } from '../models/category.model';

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
