import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LoginResponse {
  token: string;
  email: string;
  role: 'site' | 'corporate';
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password
    });
  }

  logout(token: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}
