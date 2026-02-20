import { inject } from '@angular/core';
import { AuthApi } from '@features/user-management/login/auth-api';
import { AuthStore } from './auth-store';
import { firstValueFrom } from 'rxjs';
import { catchError, of } from 'rxjs';

/**
 * Validates the stored session on app init.
 * If token exists but GET /api/auth/me returns 401, clears auth.
 */
export function initSession(): () => Promise<void> {
  return () => {
    const authStore = inject(AuthStore);
    const authApi = inject(AuthApi);
    if (!authStore.token()) {
      return Promise.resolve();
    }
    return firstValueFrom(
      authApi.getMe().pipe(
        catchError(() => {
          authStore.clearAuth();
          return of(null);
        })
      )
    ).then(() => undefined);
  };
}
