import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

function extractErrorMessage(err: HttpErrorResponse): string {
  const payload = err.error;
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (err.status === 0) return 'Network error. Please check your connection.';
  if (err.status === 401) return 'Session expired. Please log in again.';
  if (err.status === 403) return 'Access denied.';
  if (err.status === 404) return 'Resource not found.';
  if (err.status >= 500) return 'Server error. Please try again.';
  return 'An error occurred while processing your request.';
}

export const errorToastInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (req.url.startsWith('/api')) {
        const msg = extractErrorMessage(err);
        const appToast = (window as { __appToast?: (message: string, type?: 'success' | 'error') => void }).__appToast;
        if (typeof appToast === 'function') {
          appToast(msg, 'error');
        } else {
          window.alert(msg);
        }
      }
      // Rethrow so the current flow is stopped by the caller chain.
      return throwError(() => err);
    }),
  );
};
