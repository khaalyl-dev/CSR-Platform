import { Injectable, signal, computed } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'app.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _currentTheme = signal<AppTheme>('light');
  readonly currentTheme = this._currentTheme.asReadonly();
  readonly isDark = computed(() => this._currentTheme() === 'dark');

  init(): void {
    const stored = this.readStoredTheme();
    this.use(stored ?? 'light');
  }

  use(theme: string): void {
    const normalized: AppTheme = theme === 'dark' ? 'dark' : 'light';
    this.applyTheme(normalized, true);
  }

  /**
   * Apply a theme without persisting it in localStorage.
   * Useful for route-specific visual constraints (e.g. login page always light).
   */
  useTemporary(theme: string): void {
    const normalized: AppTheme = theme === 'dark' ? 'dark' : 'light';
    this.applyTheme(normalized, false);
  }

  private readStoredTheme(): AppTheme | null {
    if (typeof localStorage === 'undefined') return null;
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  }

  private applyTheme(theme: AppTheme, persist: boolean): void {
    this._currentTheme.set(theme);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.toggle('theme-dark', theme === 'dark');
      root.classList.toggle('theme-light', theme !== 'dark');
    }
    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }
}

