import { HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from './auth-store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err) => {
      if (err && err.status === 401) {
        // Clear local auth and redirect to login
        authStore.clearAuth();
        try {
          router.navigate(['/login']);
        } catch (e) {
          // ignore navigation errors
        }
      }
      return throwError(() => err);
    })
  );
};
