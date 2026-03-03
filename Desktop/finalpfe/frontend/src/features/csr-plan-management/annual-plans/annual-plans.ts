import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthStore } from '@core/services/auth-store';
import { CsrPlansApi } from '../api/csr-plans-api';
import type { CsrPlan } from '../models/csr-plan.model';

@Component({
  selector: 'app-annual-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './annual-plans.html'
})
export class AnnualPlansComponent implements OnInit {
  private authStore = inject(AuthStore);
  private csrPlansApi = inject(CsrPlansApi);

  isAuthenticated = this.authStore.isAuthenticated;
  user = this.authStore.user;

  plans = signal<CsrPlan[]>([]);
  loading = signal(true);
  selectedYear = signal<number | null>(null);
  selectedStatus = signal<string>('');
  search = signal<string>('');

  sortColumn = signal<string>('year');
  sortDirection = signal<'asc' | 'desc'>('desc');

  filteredPlans = computed(() => {
    const list = this.plans();
    const year = this.selectedYear();
    const status = this.selectedStatus();
    const q = this.search().toLowerCase().trim();
    const filtered = list.filter(plan =>
      (!year || plan.year === year) &&
      (!status || plan.status === status) &&
      (!q ||
        (plan.site_name ?? '').toLowerCase().includes(q) ||
        (plan.site_code ?? '').toLowerCase().includes(q) ||
        String(plan.year).includes(q))
    );
    const col = this.sortColumn();
    const dir = this.sortDirection();
    return [...filtered].sort((a, b) => {
      const valA = (a as any)[col]?.toString().toLowerCase() ?? '';
      const valB = (b as any)[col]?.toString().toLowerCase() ?? '';
      const numA = typeof (a as any)[col] === 'number' ? (a as any)[col] : parseFloat(valA) || 0;
      const numB = typeof (b as any)[col] === 'number' ? (b as any)[col] : parseFloat(valB) || 0;
      if (col === 'year' || col === 'total_budget') {
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

  totalPlans = computed(() => this.plans().length);
  submittedPlans = computed(() => this.plans().filter(p => p.status === 'SUBMITTED').length);
  approvedPlans = computed(() => this.plans().filter(p => p.status === 'VALIDATED').length);
  totalBudget = computed(() =>
    this.plans().reduce((sum, p) => sum + (p.total_budget ?? 0), 0)
  );

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Brouillon',
      SUBMITTED: 'Soumis',
      VALIDATED: 'Validé',
      REJECTED: 'Rejeté',
      LOCKED: 'Verrouillé',
    };
    return map[s] ?? s;
  }

  ngOnInit(): void {
    this.refreshPlans();
  }

  refreshPlans(): void {
    this.loading.set(true);
    this.csrPlansApi.list().subscribe({
      next: (data) => {
        this.plans.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submitForValidation(plan: CsrPlan): void {
    if (plan.status !== 'DRAFT') return;
    if (!confirm('Envoyer ce plan en validation ?')) return;
    this.csrPlansApi.submitForValidation(plan.id).subscribe({
      next: (updated) => {
        this.plans.update((list) =>
          list.map((p) => (p.id === updated.id ? updated : p))
        );
      },
      error: (err) => {
        alert(err.error?.message || 'Erreur lors de l\'envoi pour validation');
      },
    });
  }
}
