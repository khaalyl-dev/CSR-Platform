import { Component, computed, signal, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { RealizedCsrApi } from '../api/realized-csr-api';
import type { RealizedCsr } from '../models/realized-csr.model';

@Component({
  selector: 'app-realized-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './realized-list.html'
})
export class RealizedListComponent implements OnInit {
  private api = inject(RealizedCsrApi);
  private router = inject(Router);

  activeMenuRealized: RealizedCsr | null = null;
  menuPosition = { top: 0, left: 0 };

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
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

  goToEdit(r: RealizedCsr): void {
    this.router.navigate(['/realized-csr', r.id, 'edit']);
    this.closeMenu();
  }

  deleteFromMenu(r: RealizedCsr): void {
    if (!confirm('Supprimer définitivement cette réalisation ?')) return;
    this.api.delete(r.id).subscribe({
      next: () => {
        this.list.update((list) => list.filter((x) => x.id !== r.id));
        this.closeMenu();
      },
      error: (err) => alert(err.error?.message ?? 'Erreur lors de la suppression'),
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
      const numA = typeof (a as any)[col] === 'number' ? (a as any)[col] : parseFloat(valA) || 0;
      const numB = typeof (b as any)[col] === 'number' ? (b as any)[col] : parseFloat(valB) || 0;
      if (col === 'year' || col === 'realized_budget') {
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
