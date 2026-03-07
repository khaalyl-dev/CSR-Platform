import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Empty maps: all UI text should use en.json/fr.json via the translate pipe. */
const EMPTY_MAP: Record<string, string> = {};

@Injectable({ providedIn: 'root' })
export class RuntimeTranslationService {
  private readonly translate = inject(TranslateService);
  private observer: MutationObserver | null = null;
  private initialized = false;
  private isApplying = false;
  private normalizedFrToEnMap: Record<string, string> = {};
  private normalizedEnToFrMap: Record<string, string> = {};
  private enToFrTextMap: Record<string, string> = {};
  private enToFrTokenMap: Record<string, string> = {};
  private applyScheduled = false;
  private toastHost: HTMLElement | null = null;

  init(): void {
    if (this.initialized || typeof document === 'undefined') return;
    this.initialized = true;

    this.patchBrowserDialogs();
    this.normalizedFrToEnMap = { ...EMPTY_MAP };
    this.enToFrTextMap = { ...EMPTY_MAP };
    this.normalizedEnToFrMap = { ...EMPTY_MAP };
    this.enToFrTokenMap = { ...EMPTY_MAP };
    this.scheduleApply();

    this.translate.onLangChange.subscribe(() => {
      this.scheduleApply();
    });

    this.observer = new MutationObserver(() => {
      if (this.isApplying) return;
      this.scheduleApply();
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });
  }

  translateRawText(text: string): string {
    const lang = this.translate.currentLang || this.translate.getDefaultLang() || 'en';
    if (!text) return text;
    if (lang === 'fr') {
      return this.translateWithMaps(text, this.enToFrTextMap, this.normalizedEnToFrMap, this.enToFrTokenMap);
    }
    return this.translateWithMaps(text, EMPTY_MAP, this.normalizedFrToEnMap, EMPTY_MAP);
  }

  private applyToDocument(): void {
    if (typeof document === 'undefined') return;
    this.isApplying = true;
    try {
      this.translateTextNodes(document.body);
      this.translateAttributes(document.body);
    } finally {
      this.isApplying = false;
    }
  }

  private scheduleApply(): void {
    if (this.applyScheduled || typeof window === 'undefined') return;
    this.applyScheduled = true;
    window.requestAnimationFrame(() => {
      this.applyScheduled = false;
      this.applyToDocument();
    });
  }

  private translateTextNodes(root: HTMLElement): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      const parent = textNode.parentElement;
      if (parent) {
        const tag = parent.tagName;
        // Skip heavy/interactive nodes to avoid UI freezes on large forms.
        if (
          tag === 'OPTION' ||
          tag === 'SELECT' ||
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SCRIPT' ||
          tag === 'STYLE' ||
          tag === 'CODE' ||
          tag === 'PRE'
        ) {
          node = walker.nextNode();
          continue;
        }
      }
      const current = (textNode.textContent || '').trim();
      if (current) {
        const translated = this.translateRawText(current);
        if ((textNode.textContent || '').trim() !== translated) {
          textNode.textContent = translated;
        }
      }
      node = walker.nextNode();
    }
  }

  private translateAttributes(root: HTMLElement): void {
    const elements = root.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]');
    for (const el of Array.from(elements)) {
      for (const attr of ['placeholder', 'title', 'aria-label']) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const translated = this.translateRawText(value);
        if (value !== translated) {
          el.setAttribute(attr, translated);
        }
      }
    }
  }

  private translateWithMaps(
    text: string,
    phraseMap: Record<string, string>,
    normalizedMap: Record<string, string>,
    tokenMap: Record<string, string>,
  ): string {
    let out = phraseMap[text] || normalizedMap[this.normalize(text)] || text;
    if (out === text) {
      const entries = Object.entries(phraseMap).sort((a, b) => b[0].length - a[0].length);
      for (const [from, to] of entries) {
        // Skip if replacement contains the key to avoid recursive re-matching (e.g. "Site" -> "Le site" causing "Le Le Le...")
        if (to.toLowerCase().includes(from.toLowerCase())) continue;
        if (out.includes(from)) out = out.split(from).join(to);
      }
    }
    if (out === text) {
      for (const [from, to] of Object.entries(tokenMap)) {
        out = out.replace(this.wordLike(from), to);
      }
    }
    return out;
  }

  private patchBrowserDialogs(): void {
    if (typeof window === 'undefined') return;
    const originalConfirm = window.confirm.bind(window);
    const originalPrompt = window.prompt.bind(window);
    (window as { __appToast?: (message: string, type?: 'success' | 'error') => void }).__appToast = (
      message: string,
      type: 'success' | 'error' = 'success',
    ) => {
      this.showBottomToast(this.translateRawText(message ?? ''), type);
    };

    window.alert = ((message?: unknown) => {
      const msg = typeof message === 'string' ? this.translateRawText(message) : String(message ?? '');
      this.showBottomToast(msg);
    }) as typeof window.alert;

    window.confirm = ((message?: string) => {
      return originalConfirm(this.translateRawText(message ?? ''));
    }) as typeof window.confirm;

    window.prompt = ((message?: string, defaultValue?: string) => {
      return originalPrompt(this.translateRawText(message ?? ''), defaultValue);
    }) as typeof window.prompt;
  }

  private showBottomToast(message: string, type?: 'success' | 'error'): void {
    if (typeof document === 'undefined') return;
    const host = this.getToastHost();
    const toast = document.createElement('div');
    toast.className = this.toastClassForMessage(message, type);
    toast.textContent = message;
    host.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      window.setTimeout(() => toast.remove(), 220);
    }, 3600);
  }

  private getToastHost(): HTMLElement {
    if (this.toastHost && document.body.contains(this.toastHost)) return this.toastHost;
    const host = document.createElement('div');
    host.className = 'app-toast-host';
    document.body.appendChild(host);
    this.toastHost = host;
    return host;
  }

  private toastClassForMessage(message: string, type?: 'success' | 'error'): string {
    if (type === 'error') return 'app-toast app-toast--error';
    if (type === 'success') return 'app-toast app-toast--success';
    const text = this.normalize(message);
    const isError =
      text.includes('error') ||
      text.includes('failed') ||
      text.includes('fail') ||
      text.includes('erreur') ||
      text.includes('echec') ||
      text.includes('rejet');
    return isError ? 'app-toast app-toast--error' : 'app-toast app-toast--success';
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[\u2019']/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private wordLike(source: string): RegExp {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'gi');
  }
}

