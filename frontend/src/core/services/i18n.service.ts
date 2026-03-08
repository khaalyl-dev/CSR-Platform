import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const LANG_STORAGE_KEY = 'app.language';
const SUPPORTED_LANGS = ['en', 'fr'] as const;
type AppLang = (typeof SUPPORTED_LANGS)[number];

@Injectable({ providedIn: 'root' })
export class I18nService {
  private translate = inject(TranslateService);

  init(): void {
    this.translate.addLangs([...SUPPORTED_LANGS]);
    this.translate.setDefaultLang('en');
    const stored = this.readStoredLanguage();
    this.use(stored ?? 'en');
  }

  use(lang: string): void {
    const normalized: AppLang = lang === 'fr' ? 'fr' : 'en';
    this.applyLanguage(normalized, true);
  }

  /**
   * Apply language without persisting it.
   * Useful for routes that should enforce a fixed language (e.g. login page).
   */
  useTemporary(lang: string): void {
    const normalized: AppLang = lang === 'fr' ? 'fr' : 'en';
    this.applyLanguage(normalized, false);
  }

  t(key: string): string {
    return this.translate.instant(key);
  }

  private readStoredLanguage(): AppLang | null {
    if (typeof localStorage === 'undefined') return null;
    const value = localStorage.getItem(LANG_STORAGE_KEY);
    return value === 'fr' || value === 'en' ? value : null;
  }

  private applyLanguage(lang: AppLang, persist: boolean): void {
    this.translate.use(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    }
  }
}

