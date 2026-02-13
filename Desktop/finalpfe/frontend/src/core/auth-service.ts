import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthApi } from '../features/auth/auth-api';
import { AuthStore } from './auth-store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private authApi = inject(AuthApi);

  login(email: string, password: string) {
    console.log('🔵 AuthService.login called with:', email); // DEBUG

    return this.authApi.login(email, password).pipe(
      tap(res => {
        console.log('🟢 Login API response:', res); // DEBUG
        console.log('🟢 Response type:', typeof res); // DEBUG
        console.log('🟢 Response keys:', Object.keys(res)); // DEBUG

        const user = {
          email: res.email,
          role: res.role
        };

        console.log('🟡 User object to save:', user); // DEBUG

        this.authStore.setAuth(res.token, user);

        console.log('🟣 AuthStore.user() after setAuth:', this.authStore.user()); // DEBUG
        console.log('🟣 AuthStore.userRole() after setAuth:', this.authStore.userRole()); // DEBUG
        console.log('🟣 localStorage auth.user:', localStorage.getItem('auth.user')); // DEBUG

        // Redirect to appropriate dashboard based on role
        const defaultRoute = res.role === 'site' ? '/dashboard/site' : '/dashboard/corporate';
        console.log('🔴 Navigating to:', defaultRoute); // DEBUG
        this.router.navigate([defaultRoute]);
      }),
      catchError(error => {
        console.error('❌ Login error:', error);
        return throwError(() => error);
      })
    );
  }

  logout() {
    const token = this.authStore.token();
    if (!token) {
      this.authStore.clearAuth();
      this.router.navigate(['/login']);
      return;
    }

    this.authApi.logout(token).subscribe({
      next: () => {
        this.authStore.clearAuth();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.authStore.clearAuth();
        this.router.navigate(['/login']);
      }
    });
  }
}
