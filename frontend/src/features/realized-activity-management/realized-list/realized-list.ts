import { Component, computed, signal, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RealizedCsrApi } from '../api/realized-csr-api';
import type { RealizedCsr } from '../models/realized-csr.model';
import { RealizedCreateSidebarComponent } from '../realized-create-sidebar/realized-create-sidebar';
import { RealizedEditComponent } from '../realized-edit/realized-edit';

@Component({
  selector: 'app-realized-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, RealizedCreateSidebarComponent, RealizedEditComponent],
  templateUrl: './realized-list.html'
})
export class RealizedListComponent implements OnInit {
  private api = inject(RealizedCsrApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  activeMenuRealized: RealizedCsr | null = null;
  activeRequestChangeRealized: RealizedCsr | null = null;
  menuPosition = { top: 0, left: 0 };

  /** True if user can request a change for this realization (plan validated and locked, has plan_id and activity_id). */
  canRequestChange(r: RealizedCsr): boolean {
    return !!(
      !r.plan_editable &&
      r.plan_status === 'VALIDATED' &&
      r.plan_id &&
      r.activity_id
    );
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
    this.closeRequestChangeMenu();
  }

  toggleRequestChangeMenu(r: RealizedCsr, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeRequestChangeRealized?.id === r.id) {
      this.closeRequestChangeMenu();
      return;
    }
    const btn = event.target as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosition = { top: rect.bottom + 4, left: rect.right - 224 };
    this.activeRequestChangeRealized = r;
  }

  closeRequestChangeMenu(): void {
    this.activeRequestChangeRealized = null;
  }

  goToChangeRequest(r: RealizedCsr): void {
    if (!r.plan_id || !r.activity_id) return;
    this.closeRequestChangeMenu();
    this.router.navigate(['/changes/create'], { queryParams: { planId: r.plan_id, activityId: r.activity_id } });
  }

  toggleMenu(r: RealizedCsr, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeMenuRealized?.id === r.id) {
      this.closeMenu();
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosition = { top: rect.bottom + 4, left: rect.right - 176 };
    this.activeMenuRealized = r;
  }

  closeMenu(): void {
    this.activeMenuRealized = null;
  }

  showEditSidebar = signal(false);
  realizedIdToEdit = signal<string | null>(null);

  goToEdit(r: RealizedCsr): void {
    this.closeMenu();
    this.realizedIdToEdit.set(r.id);
    this.showEditSidebar.set(true);
  }

  closeEditSidebar(): void {
    this.showEditSidebar.set(false);
    this.realizedIdToEdit.set(null);
  }

  onRealizedUpdated(): void {
    this.closeEditSidebar();
    this.refresh();
  }

  deleteFromMenu(r: RealizedCsr): void {
    if (!confirm('Supprimer définitivement cette réalisation ?')) return;
    this.api.delete(r.id).subscribe({
      next: () => {
        this.list.update((list) => list.filter((x) => x.id !== r.id));
        this.closeMenu();
      },
      error: () => {},
    });
  }

  list = signal<RealizedCsr[]>([]);
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
    for (const r of items) {
      if (r.plan_id && !seen.has(r.plan_id)) {
        seen.add(r.plan_id);
        out.push({
          plan_id: r.plan_id,
          site_name: (r.site_name ?? '–') as string,
          year: r.year ?? 0,
        });
      }
    }
    return out.sort((a, b) => b.year - a.year || a.site_name.localeCompare(b.site_name));
  });

  years = computed(() => {
    const set = new Set(this.list().map(r => r.year));
    return Array.from(set).sort((a, b) => b - a);
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
        (item.activity_title ?? '').toLowerCase().includes(q) ||
        (item.activity_number ?? '').toLowerCase().includes(q) ||
        (item.site_name ?? '').toLowerCase().includes(q) ||
        String(item.year).includes(q))
    );
    const col = this.sortColumn();
    const dir = this.sortDirection();
    return [...filtered].sort((a, b) => {
      const valA = (a as any)[col]?.toString().toLowerCase() ?? '';
      const valB = (b as any)[col]?.toString().toLowerCase() ?? '';
      let numA: number, numB: number;
      if (col === 'activity_number') {
        // Natural sort: extract numbers for comparison (CSR 1 < CSR 2 < CSR 10 < CSR 100)
        const matchA = valA.match(/\d+/g);
        const matchB = valB.match(/\d+/g);
        numA = matchA?.length ? parseInt(matchA[matchA.length - 1], 10) : 0;
        numB = matchB?.length ? parseInt(matchB[matchB.length - 1], 10) : 0;
        if (numA !== numB) {
          if (numA < numB) return dir === 'asc' ? -1 : 1;
          if (numA > numB) return dir === 'asc' ? 1 : -1;
        }
        return dir === 'asc' ? (valA < valB ? -1 : valA > valB ? 1 : 0) : (valA < valB ? 1 : valA > valB ? -1 : 0);
      }
      numA = typeof (a as any)[col] === 'number' ? (a as any)[col] : parseFloat(valA) || 0;
      numB = typeof (b as any)[col] === 'number' ? (b as any)[col] : parseFloat(valB) || 0;
      if (col === 'year' || col === 'planned_budget' || col === 'realized_budget' || col === 'participants' || col === 'total_hc') {
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
  totalBudget = computed(() => this.filteredList().reduce((sum, r) => sum + (r.realized_budget ?? 0), 0));

  showCreateSidebar = signal(false);
  initialPlanIdForSidebar: string | null = null;

  ngOnInit(): void {
    this.refresh();
    this.route.queryParamMap.subscribe((params) => {
      const planId = params.get('plan_id');
      this.initialPlanIdForSidebar = planId || null;
      if (planId) {
        this.showCreateSidebar.set(true);
        this.router.navigate([], { queryParams: { plan_id: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
  }

  openCreateSidebar(): void {
    this.showCreateSidebar.set(true);
  }

  closeCreateSidebar(): void {
    this.showCreateSidebar.set(false);
  }

  onRealizedCreated(): void {
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
