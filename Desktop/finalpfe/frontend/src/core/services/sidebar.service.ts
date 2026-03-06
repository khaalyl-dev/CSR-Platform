import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'sidebarCollapsed';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  isCollapsed = signal(false);

  initFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      this.isCollapsed.set(stored === 'true');
    }
  }

  toggle(): void {
    const collapsed = !this.isCollapsed();
    this.isCollapsed.set(collapsed);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, collapsed.toString());
    }
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) {
      sidebarEl.classList.toggle('collapsed', collapsed);
    }
  }
}
