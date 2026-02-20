import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../services/auth-store';

export const jwtInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const token = authStore.token();

  let authReq = req;
  if (token && req.url.startsWith('/api')) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err && err.status === 401) {
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
