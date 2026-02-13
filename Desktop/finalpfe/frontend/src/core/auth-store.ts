import { Injectable, signal, computed } from '@angular/core';

const TOKEN_KEY = 'auth.token';
const USER_KEY = 'auth.user';

// Update user interface to include role
export interface User {
  email: string;
  role: 'site' | 'corporate';
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  // Static initialization - happens once before any instance is created
  private static readonly initialToken = (() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    } catch {
      return null;
    }
  })();

  private static readonly initialUser = (() => {
    try {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  // Signals initialized with static values
  readonly token = signal<string | null>(AuthStore.initialToken);
  readonly user = signal<User | null>(AuthStore.initialUser);
  readonly isAuthenticated = computed(() => !!this.token());
  readonly userRole = computed(() => this.user()?.role ?? null);

  setAuth(token: string, user: User) {
    this.token.set(token);
    this.user.set(user);
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
  }

  clearAuth() {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  }
}
