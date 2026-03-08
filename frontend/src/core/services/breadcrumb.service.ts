import { Injectable, signal } from '@angular/core';

/**
 * Optional context segments for the header breadcrumb (e.g. site name, activity name).
 * Detail/edit pages set this when they load; layout merges it so breadcrumb shows e.g. "Plans CSR / Tunis / Détail".
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  /** Extra segments to insert before "Détail" (or the last segment), e.g. ['Tunis', '2025'] */
  private context = signal<string[]>([]);

  getContext() {
    return this.context.asReadonly();
  }

  setContext(segments: string[]) {
    this.context.set(segments ?? []);
  }

  clearContext() {
    this.context.set([]);
  }
}
