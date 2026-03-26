import { Component, computed, signal, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CsrActivitiesApi, type PlannedActivityListItem } from '@features/realized-activity-management/api/csr-activities-api';
import { PlannedActivityEditComponent } from '../planned-activity-edit/planned-activity-edit';
import { RealizedCreateSidebarComponent } from '@features/realized-activity-management/realized-create-sidebar/realized-create-sidebar';

@Component({
  selector: 'app-planned-activities-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, PlannedActivityEditComponent, RealizedCreateSidebarComponent],
  templateUrl: './planned-activities-list.html',
})
export class PlannedActivitiesListComponent implements OnInit {
  private api = inject(CsrActivitiesApi);
  private router = inject(Router);
  private readonly currentYear = new Date().getFullYear();

  activeMenuActivity: PlannedActivityListItem | null = null;
  menuPosition = { top: 0, left: 0 };

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  toggleMenu(activity: PlannedActivityListItem, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeMenuActivity?.id === activity.id) {
      this.closeMenu();
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosition = { top: rect.bottom + 4, left: rect.right - 176 };
    this.activeMenuActivity = activity;
  }

  closeMenu(): void {
    this.activeMenuActivity = null;
  }

  showEditSidebar = signal(false);
  activityIdToEdit = signal<string | null>(null);
  planIdToEdit = signal<string | null>(null);
  planYearToEdit = signal<number | null>(null);

  goToEdit(activity: PlannedActivityListItem): void {
    this.closeMenu();
    this.activityIdToEdit.set(activity.id);
    this.planIdToEdit.set(activity.plan_id ?? null);
    this.planYearToEdit.set(activity.year ?? null);
    this.showEditSidebar.set(true);
  }

  closeEditSidebar(): void {
    this.showEditSidebar.set(false);
    this.activityIdToEdit.set(null);
    this.planIdToEdit.set(null);
    this.planYearToEdit.set(null);
  }

  onActivityUpdated(): void {
    this.closeEditSidebar();
    this.refresh();
  }

  showAddRealizationSidebar = signal(false);
  addRealizationPlanId = signal<string | null>(null);
  addRealizationActivityId = signal<string | null>(null);

  openAddRealization(activity: PlannedActivityListItem): void {
    this.closeMenu();
    this.addRealizationPlanId.set(activity.plan_id ?? null);
    this.addRealizationActivityId.set(activity.id);
    this.showAddRealizationSidebar.set(true);
  }

  closeAddRealizationSidebar(): void {
    this.showAddRealizationSidebar.set(false);
    this.addRealizationPlanId.set(null);
    this.addRealizationActivityId.set(null);
  }

  onRealizationCreated(): void {
    this.closeAddRealizationSidebar();
    this.refresh();
  }

  /** Past-year plan: realized data is edited on the activity, not via “add realization”. */
  isPastPlanYear(activity: PlannedActivityListItem): boolean {
    const y = activity.year;
    return y != null && y < this.currentYear;
  }

  deleteFromMenu(activity: PlannedActivityListItem): void {
    if (!confirm('Supprimer définitivement cette activité planifiée ?')) return;
    this.api.delete(activity.id).subscribe({
      next: () => {
        this.list.update((list) => list.filter((a) => a.id !== activity.id));
        this.closeMenu();
      },
      error: () => {},
    });
  }

  list = signal<PlannedActivityListItem[]>([]);
  loading = signal(true);
  selectedYear = signal<number | null>(null);
  selectedPlanId = signal<string | null>(null);
  search = signal<string>('');

  sortColumn = signal<string>('year');
  sortDirection = signal<'asc' | 'desc'>('desc');

  /** Unique plans from current list (for filter dropdown). */
  plans = computed(() => {
    const items = this.list();
    const seen = new Set<string>();
    const out: { plan_id: string; site_name: string; year: number }[] = [];
    for (const a of items) {
      if (a.plan_id && !seen.has(a.plan_id)) {
        seen.add(a.plan_id);
        out.push({
          plan_id: a.plan_id,
          site_name: (a.site_name ?? a.site_code ?? '–') as string,
          year: a.year ?? 0,
        });
      }
    }
    return out.sort((a, b) => b.year - a.year || a.site_name.localeCompare(b.site_name));
  });

  filteredList = computed(() => {
    const items = this.list();
    const year = this.selectedYear();
    const planId = this.selectedPlanId();
    const q = this.search().toLowerCase().trim();
    const filtered = items.filter(item =>
      (!year || item.year === year) &&
      (!planId || item.plan_id === planId) &&
      (!q ||
        (item.title ?? '').toLowerCase().includes(q) ||
        (item.activity_number ?? '').toLowerCase().includes(q) ||
        (item.site_name ?? '').toLowerCase().includes(q) ||
        (item.site_code ?? '').toLowerCase().includes(q) ||
        (item.category_name ?? '').toLowerCase().includes(q) ||
        String(item.year).includes(q))
    );
    const col = this.sortColumn();
    const dir = this.sortDirection();
    return [...filtered].sort((a, b) => {
      const valA = (a as any)[col]?.toString().toLowerCase() ?? '';
      const valB = (b as any)[col]?.toString().toLowerCase() ?? '';
      const numA = typeof (a as any)[col] === 'number' ? (a as any)[col] : parseFloat(valA) || 0;
      const numB = typeof (b as any)[col] === 'number' ? (b as any)[col] : parseFloat(valB) || 0;
      if (col === 'year' || col === 'planned_budget') {
        if (numA < numB) return dir === 'asc' ? -1 : 1;
        if (numA > numB) return dir === 'asc' ? 1 : -1;
      } else {
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  });

  sortBy(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set(column === 'year' ? 'desc' : 'asc');
    }
  }

  totalRecords = computed(() => this.filteredList().length);
  totalBudget = computed(() => this.filteredList().reduce((sum, a) => sum + (a.planned_budget ?? 0), 0));

  years = computed(() => {
    const set = new Set(this.list().map(a => a.year).filter(y => y != null));
    return Array.from(set).sort((a, b) => (b ?? 0) - (a ?? 0));
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (data) => {
        this.list.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
