import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '@core/services/auth-store';
import { AuthService } from '@core/services/auth.service';
import { navItems, type NavSection, type NavItem } from './nav-config';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class Sidebar {
  private authStore = inject(AuthStore);
  private authService = inject(AuthService);
  private router = inject(Router);

  isCollapsed = signal(false);

  filteredNavItems = computed(() => {
    const role = this.authStore.userRole();
    if (!role) return [];

    return navItems
      .filter(section => section.roles.includes(role))
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.roles.includes(role))
      }))
      .filter(section => section.items.length > 0);
  });

  isAuthenticated = this.authStore.isAuthenticated;
  user = this.authStore.user;

  constructor() {
    const stored = localStorage.getItem('sidebarCollapsed');
    if (stored !== null) {
      this.isCollapsed.set(stored === 'true');
    }
  }

  toggleSidebar() {
    const collapsed = !this.isCollapsed();
    this.isCollapsed.set(collapsed);
    localStorage.setItem('sidebarCollapsed', collapsed.toString());
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) {
      sidebarEl.classList.toggle('collapsed', collapsed);
    }
  }

  trackBySection(index: number, section: NavSection) {
    return section.section;
  }

  trackByItem(index: number, item: NavItem) {
    return item.path;
  }

  logout() {
    this.authService.logout();
  }
}
