import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthApi } from '@features/user-management/login/auth-api';
import { AuthStore } from './auth-store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private authApi = inject(AuthApi);

  private mapRole(role: string): 'site' | 'corporate' {
    return role === 'CORPORATE_USER' || role === 'corporate' ? 'corporate' : 'site';
  }

  login(email: string, password: string, remember = true) {
    return this.authApi.login(email, password).pipe(
      tap(res => {
        const user = {
          email: res.email,
          role: this.mapRole(res.role)
        };

        this.authStore.setAuth(res.token, user, remember);

        const defaultRoute = user.role === 'site' ? '/dashboard/site' : '/dashboard/corporate';
        this.router.navigate([defaultRoute]);
      }),
      catchError(error => {
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

    this.authApi.logout().subscribe({
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
