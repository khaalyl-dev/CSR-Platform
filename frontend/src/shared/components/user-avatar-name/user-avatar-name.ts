import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

/**
 * Avatar (profile photo or initials) + display name.
 * API paths like `/api/documents/serve/...` are loaded via HttpClient so the JWT is sent;
 * raw `<img src="/api/...">` does not include Authorization and always falls back to initials.
 */
@Component({
  selector: 'app-user-avatar-name',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex min-w-0 items-center gap-2">
      @if (resolvedSrc(); as src) {
        <img
          [src]="src"
          alt=""
          loading="lazy"
          (error)="onImgError()"
          class="shrink-0 rounded-full bg-gray-100 object-cover ring-1 ring-gray-200/80"
          [ngClass]="frameClass()"
        />
      } @else {
        <div
          class="flex shrink-0 items-center justify-center rounded-full bg-brand-900/10 ring-1 ring-gray-200/80"
          [ngClass]="frameClass()"
        >
          <span class="font-semibold text-brand-900" [ngClass]="initialsSizeClass()">{{ initials() }}</span>
        </div>
      }
      <span class="min-w-0 truncate" [ngClass]="nameClass()">{{ displayText() }}</span>
    </div>
  `,
})
export class UserAvatarNameComponent {
  private http = inject(HttpClient);

  displayName = input<string | null | undefined>(undefined);
  avatarUrl = input<string | null | undefined>(null);
  /** Match documents table uploader tone */
  muted = input(false);
  /** Detail page: slightly larger chip */
  large = input(false);

  /** Blob or data URL safe for <img>; null => show initials */
  resolvedSrc = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const raw = (this.avatarUrl() ?? '').trim();
      let createdForThisRun: string | null = null;
      let cancelled = false;

      const revokeIfNeeded = () => {
        if (createdForThisRun) {
          URL.revokeObjectURL(createdForThisRun);
          createdForThisRun = null;
        }
      };

      this.resolvedSrc.set(null);

      if (!raw) {
        return;
      }

      // Already displayable without auth (e.g. cached blob from elsewhere)
      if (raw.startsWith('blob:') || raw.startsWith('data:')) {
        this.resolvedSrc.set(raw);
        return;
      }

      const sep = raw.includes('?') ? '&' : '?';
      const fetchUrl = `${raw}${sep}t=${Date.now()}`;
      const sub = this.http.get(fetchUrl, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          const u = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(u);
            return;
          }
          createdForThisRun = u;
          this.resolvedSrc.set(u);
        },
        error: () => {
          if (!cancelled) {
            this.resolvedSrc.set(null);
          }
        },
      });

      onCleanup(() => {
        cancelled = true;
        sub.unsubscribe();
        revokeIfNeeded();
        this.resolvedSrc.set(null);
      });
    });
  }

  onImgError(): void {
    const cur = this.resolvedSrc();
    if (cur?.startsWith('blob:')) {
      URL.revokeObjectURL(cur);
    }
    this.resolvedSrc.set(null);
  }

  displayText = computed(() => {
    const n = (this.displayName() ?? '').trim();
    return n.length ? n : '–';
  });

  initials = computed(() => {
    const n = (this.displayName() ?? '').trim();
    if (!n || n === '—' || n === '–') return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0] ?? '';
      const b = parts[parts.length - 1][0] ?? '';
      return ((a + b).toUpperCase() || '?').slice(0, 2);
    }
    return n.slice(0, 2).toUpperCase() || '?';
  });

  frameClass = computed(() => (this.large() ? 'h-9 w-9' : 'h-7 w-7'));

  initialsSizeClass = computed(() => (this.large() ? 'text-xs' : 'text-xs'));

  nameClass = computed(() => {
    if (this.muted()) return 'text-sm text-gray-600';
    if (this.large()) return 'text-sm font-medium text-gray-800';
    return 'text-sm text-gray-700';
  });
}
