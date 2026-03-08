import { Injectable, signal, computed } from '@angular/core';

const TOKEN_KEY = 'auth.token';
const USER_KEY = 'auth.user';

export interface User {
  email: string;
  role: 'site' | 'corporate';
}

type StorageLike = Storage | null;

function safeStorage(storage: StorageLike): Storage | null {
  try {
    return typeof window !== 'undefined' ? storage : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private getStorage(remember: boolean): Storage | null {
    const s = safeStorage(window.sessionStorage);
    const l = safeStorage(window.localStorage);
    return remember && l ? l : s;
  }

  private static readonly initialToken = (() => {
    try {
      if (typeof window === 'undefined') return null;
      return (
        window.sessionStorage.getItem(TOKEN_KEY) ??
        window.localStorage.getItem(TOKEN_KEY)
      );
    } catch {
      return null;
    }
  })();

  private static readonly initialUser = (() => {
    try {
      if (typeof window === 'undefined') return null;
      const stored =
        window.sessionStorage.getItem(USER_KEY) ??
        window.localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  readonly token = signal<string | null>(AuthStore.initialToken);
  readonly user = signal<User | null>(AuthStore.initialUser);
  readonly isAuthenticated = computed(() => !!this.token());
  readonly userRole = computed(() => this.user()?.role ?? null);

  setAuth(token: string, user: User, remember = true): void {
    this.token.set(token);
    this.user.set(user);
    this.clearStorage();
    const storage = this.getStorage(remember);
    if (storage) {
      try {
        storage.setItem(TOKEN_KEY, token);
        storage.setItem(USER_KEY, JSON.stringify(user));
      } catch {}
    }
  }

  clearAuth(): void {
    this.token.set(null);
    this.user.set(null);
    this.clearStorage();
  }

  private clearStorage(): void {
    try {
      if (typeof window === 'undefined') return;
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    } catch {}
  }
}
