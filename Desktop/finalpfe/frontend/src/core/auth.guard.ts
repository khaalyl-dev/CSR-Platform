import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStore } from './auth-store';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

// Role-based guard for routes that require specific roles
export const roleGuard = (allowedRoles: ('site' | 'corporate')[]): CanActivateFn => {
  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    if (!authStore.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    const userRole = authStore.userRole();

    if (userRole && allowedRoles.includes(userRole)) {
      return true;
    }

    // Redirect to appropriate dashboard if user doesn't have access
    const defaultRoute = userRole === 'site' ? '/dashboard/site' : '/dashboard/corporate';
    return router.createUrlTree([defaultRoute]);
  };
};
