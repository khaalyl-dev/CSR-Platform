import { Component, computed, signal, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthStore } from '@core/services/auth-store';
import { CsrPlansApi } from '../api/csr-plans-api';
import type { ImportPreviewPlan } from '../api/csr-plans-api';
import type { CsrPlan } from '../models/csr-plan.model';

export type PlanWithMode = ImportPreviewPlan & { validation_mode: '101' | '111' };

@Component({
  selector: 'app-annual-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './annual-plans.html'
})
export class AnnualPlansComponent implements OnInit {
  private authStore = inject(AuthStore);
  private csrPlansApi = inject(CsrPlansApi);
  private router = inject(Router);

  // ── Menu 3 points (like document action) ─────────────────────────────────
  activeMenuPlan: CsrPlan | null = null;
  menuPosition = { top: 0, left: 0 };

  // ── Bulk selection ─────────────────────────────────────────────────────
  selectedPlanIds = signal<Set<string>>(new Set());
  bulkActionLoading = signal(false);
  bulkActionChoice = signal<string>('');

  onBulkActionChange(value: string): void {
    if (!value) return;
    this.bulkActionChoice.set('');
    if (value === 'submit') this.bulkSubmit();
    else if (value === 'delete') this.bulkDelete();
  }

  isAuthenticated = this.authStore.isAuthenticated;
  user = this.authStore.user;

  plans = signal<CsrPlan[]>([]);
  loading = signal(true);
  selectedYear = signal<number | null>(null);
  selectedStatus = signal<string>('');
  search = signal<string>('');

  sortColumn = signal<string>('year');
  sortDirection = signal<'asc' | 'desc'>('desc');

  /** True if plan matches the selected status filter (including Validé vs Verrouillé). */
  planMatchesStatus(plan: CsrPlan, status: string): boolean {
    if (!status) return true;
    if (status === 'VALIDATED_LOCKED') return plan.status === 'VALIDATED' && this.getStatusLabel(plan) === 'Validé';
    if (status === 'VALIDATED_OPEN') return plan.status === 'VALIDATED' && this.getStatusLabel(plan) === 'Verrouillé';
    return plan.status === status;
  }

  filteredPlans = computed(() => {
    const list = this.plans();
    const year = this.selectedYear();
    const status = this.selectedStatus();
    const q = this.search().toLowerCase().trim();
    const filtered = list.filter(plan =>
      (!year || plan.year === year) &&
      this.planMatchesStatus(plan, status) &&
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

  selectedCount = computed(() => this.selectedPlanIds().size);
  selectedPlans = computed(() => {
    const ids = this.selectedPlanIds();
    return this.filteredPlans().filter(p => ids.has(p.id));
  });
  canBulkSubmit = computed(() => this.selectedPlans().some(p => p.status === 'DRAFT'));
  canBulkDelete = computed(() => this.selectedPlans().some(p => p.status === 'DRAFT' || p.status === 'REJECTED'));
  selectedDraftIds = computed(() => this.selectedPlans().filter(p => p.status === 'DRAFT').map(p => p.id));
  selectedDeletableIds = computed(() => this.selectedPlans().filter(p => p.status === 'DRAFT' || p.status === 'REJECTED').map(p => p.id));
  isAllFilteredSelected = computed(() => {
    const list = this.filteredPlans();
    const ids = this.selectedPlanIds();
    return list.length > 0 && list.every(p => ids.has(p.id));
  });
  isSomeFilteredSelected = computed(() => {
    const list = this.filteredPlans();
    const ids = this.selectedPlanIds();
    return list.some(p => ids.has(p.id));
  });

  toggleSelection(planId: string): void {
    this.selectedPlanIds.update(set => {
      const next = new Set(set);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  }

  toggleSelectAllFiltered(): void {
    if (this.isAllFilteredSelected()) {
      const list = this.filteredPlans();
      this.selectedPlanIds.update(set => {
        const next = new Set(set);
        list.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      const list = this.filteredPlans();
      this.selectedPlanIds.update(set => {
        const next = new Set(set);
        list.forEach(p => next.add(p.id));
        return next;
      });
    }
  }

  clearSelection(): void {
    this.selectedPlanIds.set(new Set());
  }

  isSelected(planId: string): boolean {
    return this.selectedPlanIds().has(planId);
  }

  bulkSubmit(): void {
    const ids = this.selectedDraftIds();
    if (!ids.length) return;
    if (!confirm(`Soumettre ${ids.length} plan(s) pour validation ?`)) return;
    this.bulkActionLoading.set(true);
    this.csrPlansApi.bulkSubmit(ids).subscribe({
      next: (res) => {
        this.bulkActionLoading.set(false);
        this.clearSelection();
        this.refreshPlans();
        const msg = res.errors?.length
          ? `${res.message} (${res.errors.length} erreur(s): ${res.errors.map(e => e.error).join(', ')})`
          : res.message;
        alert(msg);
      },
      error: (err) => {
        this.bulkActionLoading.set(false);
        alert(err.error?.message || 'Erreur lors de la soumission.');
      },
    });
  }

  bulkDelete(): void {
    const ids = this.selectedDeletableIds();
    if (!ids.length) return;
    if (!confirm(`Supprimer définitivement ${ids.length} plan(s) et toutes leurs activités ?`)) return;
    this.bulkActionLoading.set(true);
    this.csrPlansApi.bulkDelete(ids).subscribe({
      next: (res) => {
        this.bulkActionLoading.set(false);
        this.clearSelection();
        this.refreshPlans();
        const msg = res.errors?.length
          ? `${res.message} (${res.errors.length} non supprimé(s))`
          : res.message;
        alert(msg);
      },
      error: (err) => {
        this.bulkActionLoading.set(false);
        alert(err.error?.message || 'Erreur lors de la suppression.');
      },
    });
  }

  /** Display label: Brouillon, Soumis, Validé, Verrouillé, Rejeté. VALIDATED + unlock_until in future = Verrouillé, else Validé. */
  getStatusLabel(plan: CsrPlan): string {
    const s = plan?.status;
    if (s === 'DRAFT') return 'Brouillon';
    if (s === 'SUBMITTED') return 'Soumis';
    if (s === 'REJECTED') return 'Rejeté';
    if (s === 'VALIDATED') {
      const u = plan?.unlock_until;
      return (u && new Date(u) > new Date()) ? 'Verrouillé' : 'Validé';
    }
    return s ?? '';
  }

  /** True if plan can be submitted for validation (DRAFT or VALIDATED with unlock_until in future). */
  canSubmitFromList(plan: CsrPlan): boolean {
    if (!plan) return false;
    if (plan.status === 'DRAFT') return true;
    if (plan.status === 'VALIDATED') {
      const u = plan?.unlock_until;
      return !!(u && new Date(u) > new Date());
    }
    return false;
  }

  /** True if plan can be edited (DRAFT, REJECTED, or VALIDATED with unlock_until in future). */
  isPlanEditable(plan: CsrPlan): boolean {
    if (!plan) return false;
    if (plan.status === 'DRAFT' || plan.status === 'REJECTED') return true;
    if (plan.status === 'VALIDATED') {
      const u = plan?.unlock_until;
      return !!(u && new Date(u) > new Date());
    }
    return false;
  }

  /** Badge CSS class for plan status (for display label). */
  statusBadgeClass(plan: CsrPlan): string {
    const label = this.getStatusLabel(plan);
    if (label === 'Brouillon') return 'bg-gray-200 text-gray-700';
    if (label === 'Soumis') return 'bg-yellow-100 text-yellow-700';
    if (label === 'Validé') return 'bg-green-100 text-green-700';
    if (label === 'Verrouillé') return 'bg-amber-100 text-amber-800';
    if (label === 'Rejeté') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-600';
  }

  validationModeLabel(mode: string): string {
    return mode === '111' ? 'ALL' : 'Corporate only';
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  toggleMenu(plan: CsrPlan, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeMenuPlan?.id === plan.id) {
      this.closeMenu();
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosition = { top: rect.bottom + 4, left: rect.right - 176 };
    this.activeMenuPlan = plan;
  }

  closeMenu(): void {
    this.activeMenuPlan = null;
  }

  goToDetail(plan: CsrPlan): void {
    this.router.navigate(['/csr-plans', plan.id]);
    this.closeMenu();
  }

  goToEdit(plan: CsrPlan): void {
    this.router.navigate(['/csr-plans', plan.id, 'edit']);
    this.closeMenu();
  }

  goToChangeRequest(planId: string): void {
    this.router.navigate(['/changes/create'], { queryParams: { planId } });
  }

  submitFromMenu(plan: CsrPlan): void {
    if (!this.canSubmitFromList(plan)) return;
    const isResubmit = plan.status === 'VALIDATED';
    const msg = isResubmit ? 'Soumettre les modifications pour validation ?' : 'Envoyer ce plan en validation ?';
    if (!confirm(msg)) return;
    this.csrPlansApi.submitForValidation(plan.id).subscribe({
      next: (updated) => {
        this.plans.update((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        this.closeMenu();
      },
      error: (err) => alert(err.error?.message || 'Erreur lors de l\'envoi pour validation'),
    });
  }

  deleteFromMenu(plan: CsrPlan): void {
    if (plan.status !== 'DRAFT' && plan.status !== 'REJECTED') return;
    if (!confirm('Supprimer définitivement ce plan et toutes ses activités ?')) return;
    this.csrPlansApi.delete(plan.id).subscribe({
      next: () => {
        this.plans.update((list) => list.filter((p) => p.id !== plan.id));
        this.closeMenu();
      },
      error: (err) => alert(err.error?.message || 'Erreur lors de la suppression'),
    });
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

  importLoading = signal(false);
  importResult = signal<{ success: boolean; message: string; details?: string } | null>(null);
  /** After preview: file to send on confirm, and modal visibility */
  pendingImportFile = signal<File | null>(null);
  showImportModal = signal(false);
  /** Plans from preview with validation_mode per plan (user can change in modal) */
  importPlansWithModes = signal<PlanWithMode[]>([]);
  importPreviewErrors = signal<string[]>([]);

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.importResult.set({ success: false, message: 'Veuillez sélectionner un fichier .xlsx' });
      return;
    }
    this.importLoading.set(true);
    this.importResult.set(null);
    this.csrPlansApi.importExcelPreview(file).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        const plansWithModes: PlanWithMode[] = (res.plans || []).map(p => ({ ...p, validation_mode: '101' }));
        this.pendingImportFile.set(file);
        this.importPlansWithModes.set(plansWithModes);
        this.importPreviewErrors.set(res.errors || []);
        this.showImportModal.set(true);
        input.value = '';
      },
      error: (err) => {
        this.importLoading.set(false);
        const msg = err.error?.message || 'Erreur lors de la lecture du fichier';
        const errors = err.error?.errors;
        this.importResult.set({
          success: false,
          message: msg,
          details: Array.isArray(errors) ? errors.join('\n') : undefined,
        });
        input.value = '';
      },
    });
  }

  setPlanMode(index: number, mode: '101' | '111'): void {
    this.importPlansWithModes.update(list =>
      list.map((p, i) => (i === index ? { ...p, validation_mode: mode } : p))
    );
  }

  confirmImport(): void {
    const file = this.pendingImportFile();
    const plans = this.importPlansWithModes();
    if (!file || !plans.length) return;
    this.importLoading.set(true);
    const validation_modes = plans.map(p => ({ site_id: p.site_id, year: p.year, validation_mode: p.validation_mode }));
    this.csrPlansApi.importExcel(file, { validation_modes }).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        this.showImportModal.set(false);
        this.pendingImportFile.set(null);
        this.importPlansWithModes.set([]);
        const details = [
          `${res.plans_created} plan(s) créé(s)`,
          `${res.activities_created} activité(s) créée(s)`,
          res.realized_created ? `${res.realized_created} réalisation(s)` : '',
          res.errors?.length ? `${res.errors.length} avertissement(s)` : '',
        ].filter(Boolean).join(', ');
        this.importResult.set({
          success: true,
          message: res.message,
          details: details + (res.errors?.length ? '\n' + res.errors.slice(0, 5).join('\n') : ''),
        });
        this.refreshPlans();
      },
      error: (err) => {
        this.importLoading.set(false);
        this.importResult.set({
          success: false,
          message: err.error?.message || 'Erreur lors de l\'import',
          details: Array.isArray(err.error?.errors) ? err.error.errors.join('\n') : undefined,
        });
      },
    });
  }

  cancelImportModal(): void {
    this.showImportModal.set(false);
    this.pendingImportFile.set(null);
    this.importPlansWithModes.set([]);
    this.importPreviewErrors.set([]);
  }

  clearImportResult(): void {
    this.importResult.set(null);
  }
}
