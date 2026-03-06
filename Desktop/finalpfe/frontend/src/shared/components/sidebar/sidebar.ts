import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '@core/services/auth-store';
import { AuthService } from '@core/services/auth.service';
import { SidebarService } from '@core/services/sidebar.service';
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
  sidebarService = inject(SidebarService);

  isCollapsed = this.sidebarService.isCollapsed;

  constructor() {
    this.sidebarService.initFromStorage();
  }

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

  toggleSidebar(): void {
    this.sidebarService.toggle();
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
