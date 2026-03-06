import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Sidebar } from '@shared/components/sidebar/sidebar';
import { AuthStore } from '@core/services/auth-store';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { SidebarService } from '@core/services/sidebar.service';
import { NotificationBellComponent } from '@features/notification-management/notification-bell/notification-bell';

/** Segment labels for breadcrumb (path segment -> display label). */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  'csr-plans': 'Plans CSR',
  create: 'Création',
  'annual-plans': 'Plans annuels',
  validation: 'Validation',
  'planned-activities': 'Activités planifiées',
  'planned-activity': 'Activité planifiée',
  'realized-csr': 'Activités réalisées',
  sites: 'Sites',
  categories: 'Catégories',
  admin: 'Administration',
  users: 'Utilisateurs',
  account: 'Compte',
  profile: 'Mon profil',
  documents: 'Documents',
  changes: 'Demandes de modification',
  pending: 'En attente',
  history: 'Historique',
  edit: 'Modification',
  audit: 'Journal d\'audit',
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, Sidebar, NotificationBellComponent],
  templateUrl: './main-layout.html'
})
export class MainLayout implements OnInit, OnDestroy {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private location = inject(Location);
  private breadcrumbService = inject(BreadcrumbService);
  sidebarService = inject(SidebarService);

  isAuthenticated = this.authStore.isAuthenticated;
  /** Base breadcrumb from URL (without context) */
  private baseBreadcrumb = signal<string[]>([]);

  /** Final breadcrumb: base + optional context (e.g. site name) before "Détail" */
  breadcrumb = computed(() => {
    const base = this.baseBreadcrumb();
    const context = this.breadcrumbService.getContext()();
    if (!context.length) return base;
    const detailIndex = base.indexOf('Détail');
    if (detailIndex === -1) return base;
    const isEditPage = base[detailIndex + 1] === 'Modification';
    const replacement = isEditPage ? [...context] : [...context, 'Détail'];
    return [...base.slice(0, detailIndex), ...replacement, ...base.slice(detailIndex + 1)];
  });

  private sub: ReturnType<typeof this.router.events.subscribe> | null = null;

  ngOnInit(): void {
    this.updateBreadcrumb(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateBreadcrumb(e.urlAfterRedirects || e.url));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private updateBreadcrumb(url: string): void {
    const path = url.split('?')[0];
    const segments = path.split('/').filter(Boolean);
    const labels = segments.map((seg, i) => {
      const key = seg.toLowerCase();
      if (SEGMENT_LABELS[key]) return SEGMENT_LABELS[key];
      const isId = /^\d+$/.test(seg) || /^[0-9a-f-]{36}$/i.test(seg);
      if (isId) return 'Détail';
      return key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    });
    this.baseBreadcrumb.set(labels.length ? labels : ['Tableau de bord']);
  }

  /** Toggle sidebar collapse (header return icon acts as hide/show bar). */
  toggleSidebar(): void {
    this.sidebarService.toggle();
  }
}