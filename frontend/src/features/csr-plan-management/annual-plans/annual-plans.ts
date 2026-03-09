import { Component, computed, signal, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStore } from '@core/services/auth-store';
import { CsrPlansApi } from '../api/csr-plans-api';
import type { ImportConflict, ImportPreviewPlan, ImportPreviewRow } from '../api/csr-plans-api';
import type { CsrPlan } from '../models/csr-plan.model';
import { I18nService } from '@core/services/i18n.service';
import { PlanCreateSidebarComponent } from '../plan-create-sidebar/plan-create-sidebar';

export type PlanWithMode = ImportPreviewPlan & { validation_mode: '101' | '111' };

@Component({
  selector: 'app-annual-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, PlanCreateSidebarComponent],
  templateUrl: './annual-plans.html',
  styles: [`
    .import-preview-table input.import-preview-input,
    .import-preview-table input.import-preview-input:focus,
    .import-preview-table input.import-preview-input:hover,
    .import-preview-table input.import-preview-input:disabled {
      min-width: max-content;
      width: auto;
      border: none !important;
      border-width: 0 !important;
      border-style: none !important;
      outline: none !important;
      background: transparent !important;
      background-color: transparent !important;
    }
  `]
})
export class AnnualPlansComponent implements OnInit {
  private authStore = inject(AuthStore);
  private csrPlansApi = inject(CsrPlansApi);
  private router = inject(Router);
  private i18n = inject(I18nService);

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
  /** Filter by plan type: 'planned' (current+next year), 'realized' (past years), 'all'. */
  planTypeFilter = signal<'planned' | 'realized' | 'all'>('all');

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
    const planFilter = this.planTypeFilter();
    const currentYear = new Date().getFullYear();
    const filtered = list.filter(plan => {
      if (planFilter === 'planned' && (plan.year == null || plan.year < currentYear || plan.year > currentYear + 1)) return false;
      if (planFilter === 'realized' && (plan.year == null || plan.year >= currentYear)) return false;
      return (!year || plan.year === year) &&
        this.planMatchesStatus(plan, status) &&
        (!q ||
          (plan.site_name ?? '').toLowerCase().includes(q) ||
          (plan.site_code ?? '').toLowerCase().includes(q) ||
          (plan.site_country ?? '').toLowerCase().includes(q) ||
          String(plan.year).includes(q));
    });
    const col = this.sortColumn();
    const dir = this.sortDirection();
    return [...filtered].sort((a, b) => {
      const valA = (a as any)[col]?.toString().toLowerCase() ?? '';
      const valB = (b as any)[col]?.toString().toLowerCase() ?? '';
      const numA = typeof (a as any)[col] === 'number' ? (a as any)[col] : parseFloat(valA) || 0;
      const numB = typeof (b as any)[col] === 'number' ? (b as any)[col] : parseFloat(valB) || 0;
      if (col === 'year' || col === 'total_budget' || col === 'activities_count') {
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

  /** Unique years from plans + current year and next year (for filter). */
  filterYears = computed(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set(this.plans().map(p => p.year).filter((y): y is number => y != null));
    years.add(currentYear);
    years.add(currentYear + 1);
    return Array.from(years).sort((a, b) => b - a);
  });

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
    if (!confirm(this.i18n.t('ANNUAL_PLANS.CONFIRM.BULK_SUBMIT').replace('{n}', String(ids.length)))) return;
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
      error: () => {
        this.bulkActionLoading.set(false);
      },
    });
  }

  bulkDelete(): void {
    const ids = this.selectedDeletableIds();
    if (!ids.length) return;
    if (!confirm(this.i18n.t('ANNUAL_PLANS.CONFIRM.BULK_DELETE').replace('{n}', String(ids.length)))) return;
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
      error: () => {
        this.bulkActionLoading.set(false);
      },
    });
  }

  /** Display label: Brouillon, Soumis, Validé, Verrouillé, Rejeté. VALIDATED + unlock_until in future = Verrouillé, else Validé. */
  getStatusLabel(plan: CsrPlan): string {
    const s = plan?.status;
    if (s === 'DRAFT') return this.i18n.t('ANNUAL_PLANS.STATUS.DRAFT');
    if (s === 'SUBMITTED') return this.i18n.t('ANNUAL_PLANS.STATUS.SUBMITTED');
    if (s === 'REJECTED') return this.i18n.t('ANNUAL_PLANS.STATUS.REJECTED');
    if (s === 'VALIDATED') {
      const u = plan?.unlock_until;
      return (u && new Date(u) > new Date())
        ? this.i18n.t('ANNUAL_PLANS.STATUS.UNLOCKED')
        : this.i18n.t('ANNUAL_PLANS.STATUS.VALIDATED');
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
    if (label === this.i18n.t('ANNUAL_PLANS.STATUS.DRAFT')) return 'bg-gray-200 text-gray-700';
    if (label === this.i18n.t('ANNUAL_PLANS.STATUS.SUBMITTED')) return 'bg-yellow-100 text-yellow-700';
    if (label === this.i18n.t('ANNUAL_PLANS.STATUS.VALIDATED')) return 'bg-green-100 text-green-700';
    if (label === this.i18n.t('ANNUAL_PLANS.STATUS.UNLOCKED')) return 'bg-amber-100 text-amber-800';
    if (label === this.i18n.t('ANNUAL_PLANS.STATUS.REJECTED')) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-600';
  }

  validationModeLabel(mode: string): string {
    return mode === '111' ? 'ALL' : this.i18n.t('ANNUAL_PLANS.MODE.CORPORATE_ONLY');
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
    const msg = isResubmit
      ? this.i18n.t('ANNUAL_PLANS.CONFIRM.RESUBMIT')
      : this.i18n.t('ANNUAL_PLANS.CONFIRM.SUBMIT_ONE');
    if (!confirm(msg)) return;
    this.csrPlansApi.submitForValidation(plan.id).subscribe({
      next: (updated) => {
        this.plans.update((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        this.closeMenu();
      },
      error: () => {},
    });
  }

  deleteFromMenu(plan: CsrPlan): void {
    if (plan.status !== 'DRAFT' && plan.status !== 'REJECTED') return;
    if (!confirm(this.i18n.t('ANNUAL_PLANS.CONFIRM.DELETE_ONE'))) return;
    this.csrPlansApi.delete(plan.id).subscribe({
      next: () => {
        this.plans.update((list) => list.filter((p) => p.id !== plan.id));
        this.closeMenu();
      },
      error: () => {},
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
    if (!confirm(this.i18n.t('ANNUAL_PLANS.CONFIRM.SUBMIT_ONE'))) return;
    this.csrPlansApi.submitForValidation(plan.id).subscribe({
      next: (updated) => {
        this.plans.update((list) =>
          list.map((p) => (p.id === updated.id ? updated : p))
        );
      },
      error: () => {},
    });
  }

  importLoading = signal(false);
  importProgress = signal(0);
  private importProgressInterval: ReturnType<typeof setInterval> | null = null;
  importResult = signal<{ success: boolean; message: string; details?: string } | null>(null);
  /** After preview: file to send on confirm, and modal visibility */
  pendingImportFile = signal<File | null>(null);
  showImportModal = signal(false);
  /** Plans from preview with validation_mode per plan (user can change in modal) */
  importPlansWithModes = signal<PlanWithMode[]>([]);
  /** Editable activity rows from preview */
  importRows = signal<ImportPreviewRow[]>([]);
  importPreviewErrors = signal<string[]>([]);
  /** True while re-validating rows on Next click. */
  importValidateLoading = signal(false);
  /** Import modal step: 0 = Activity rows, 1 = Plan settings */
  importStep = signal(0);
  /** Row indices that have activity_number conflicts (already exist) */
  importConflictIndices = signal<Set<number>>(new Set());
  /** Conflict details from check endpoint */
  importConflicts = signal<ImportConflict[]>([]);
  /** Row indices (0-based) that have validation warnings (region/country/site). Parsed from importPreviewErrors. */
  importWarningIndices = computed(() => {
    const errors = this.importPreviewErrors();
    const set = new Set<number>();
    for (const err of errors) {
      const m = String(err).match(/^Activity (\d+):/);
      if (m) {
        const rowNum = parseInt(m[1], 10);
        const index = rowNum - 2; // row_num is 2-based (header + 1-based)
        if (index >= 0) set.add(index);
      }
    }
    return set;
  });
  /** When true, table is editable even when conflicts exist (user clicked Edit). */
  importTableEditable = signal(false);
  /** Sort state for import preview table (step 0). */
  importSortColumn = signal<string>('activity_number');
  importSortDirection = signal<'asc' | 'desc'>('asc');

  /** Sorted view of import rows; each row has __originalIndex for trackBy and updates. */
  sortedImportRows = computed(() => {
    const rows = this.importRows();
    const col = this.importSortColumn();
    const dir = this.importSortDirection();
    const numericKeys = new Set(['year', 'start_year', 'edition', 'participants', 'total_hc', 'percentage_employees', 'planned_budget', 'realized_budget', 'impact_actual', 'number_external_partners']);
    const withIndices = rows.map((r, i) => ({ row: r, originalIndex: i }));
    const sorted = [...withIndices].sort((a, b) => {
      const rawA = (a.row as any)[col];
      const rawB = (b.row as any)[col];
      const valA = rawA?.toString().trim().toLowerCase() ?? '';
      const valB = rawB?.toString().trim().toLowerCase() ?? '';
      if (numericKeys.has(col)) {
        const numA = typeof rawA === 'number' ? rawA : parseFloat(String(rawA ?? '')) ?? 0;
        const numB = typeof rawB === 'number' ? rawB : parseFloat(String(rawB ?? '')) ?? 0;
        if (numA < numB) return dir === 'asc' ? -1 : 1;
        if (numA > numB) return dir === 'asc' ? 1 : -1;
      } else {
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return {
      rows: sorted.map(x => ({ ...x.row, __originalIndex: x.originalIndex } as ImportPreviewRow & { __originalIndex: number })),
      originalIndices: sorted.map(x => x.originalIndex),
    };
  });

  sortByImportColumn(column: string): void {
    if (this.importSortColumn() === column) {
      this.importSortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.importSortColumn.set(column);
      this.importSortDirection.set('asc');
    }
  }

  /** True if every import row has non-empty region, country and site (required to proceed). */
  importRequiredValid = computed(() => {
    const rows = this.importRows();
    if (!rows.length) return true;
    return rows.every(r => {
      const region = String(r.region ?? '').trim();
      const country = String(r.country ?? '').trim();
      const site = String(r.site ?? '').trim();
      return region !== '' && country !== '' && site !== '';
    });
  });

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.importResult.set({ success: false, message: this.i18n.t('ANNUAL_PLANS.MESSAGES.SELECT_XLSX') });
      return;
    }
    this.importLoading.set(true);
    this.importProgress.set(0);
    this.importResult.set(null);
    this.startSimulatedProgress();
    this.csrPlansApi.importExcelPreview(file, {
      onProgress: (p) => {
        this.stopSimulatedProgress();
        this.importProgress.set(p);
      },
    }).subscribe({
      next: (res) => {
        this.stopSimulatedProgress();
        this.importLoading.set(false);
        this.importProgress.set(100);
        const plansWithModes: PlanWithMode[] = (res.plans || []).map(p => ({ ...p, validation_mode: '101' }));
        this.pendingImportFile.set(file);
        this.importPlansWithModes.set(plansWithModes);
        this.importRows.set(res.rows || []);
        this.importPreviewErrors.set(res.errors || []);
        this.importStep.set(0);
        this.showImportModal.set(true);
        input.value = '';
      },
      error: (err) => {
        this.stopSimulatedProgress();
        this.importLoading.set(false);
        this.importProgress.set(0);
        const msg = err.error?.message || this.i18n.t('ANNUAL_PLANS.MESSAGES.READ_FILE_ERROR');
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

  /** Update a cell in the import preview rows. */
  updateImportRow(index: number, key: keyof ImportPreviewRow, value: string | number | null): void {
    const v = value === '' || value === null ? undefined : value;
    this.importRows.update(rows => rows.map((r, i) => {
      if (i !== index) return r;
      const next = { ...r, [key]: v };
      if (key === 'impact_actual') next['impact_target'] = v;
      if (key === 'participants') next['planned_volunteers'] = v;
      return next;
    }));
  }

  /** Stable identity for import table rows so the input keeps focus when typing. */
  trackByImportOriginalIndex(_index: number, row: ImportPreviewRow & { __originalIndex?: number }): number {
    return row.__originalIndex ?? _index;
  }

  confirmImport(): void {
    const file = this.pendingImportFile();
    const plans = this.importPlansWithModes();
    const rows = this.importRows().length ? this.importRows() : undefined;
    if (!file || !plans.length) return;
    if (!rows?.length) {
      this.doImport(file, plans, undefined);
      return;
    }
    this.importLoading.set(true);
    this.csrPlansApi.importExcelCheckConflicts(rows).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        if (res.conflicts?.length) {
          this.importConflicts.set(res.conflicts);
          this.importConflictIndices.set(new Set(res.conflicts.map((c) => c.row_index)));
          this.importTableEditable.set(true);
          this.importStep.set(0);
        } else {
          this.doImport(file, plans, rows);
        }
      },
      error: () => {
        this.importLoading.set(false);
        this.doImport(file, plans, rows);
      },
    });
  }

  /** Overwrite existing activities (use current import, backend will update). */
  resolveConflictsOverwrite(): void {
    const file = this.pendingImportFile();
    const plans = this.importPlansWithModes();
    const rows = this.importRows().length ? this.importRows() : undefined;
    if (!file || !plans.length) return;
    this.importConflictIndices.set(new Set());
    this.importConflicts.set([]);
    this.doImport(file, plans, rows);
  }

  /** Change activity numbers for conflicting rows: use sequential numbers starting from max+1 (201, 202, ...). */
  resolveConflictsChangeNumbers(): void {
    const conflicts = this.importConflicts();
    if (!conflicts.length) return;
    this.importRows.update((rows) =>
      rows.map((r, i) => {
        const c = conflicts.find((x) => x.row_index === i);
        if (!c || c.next_activity_number == null) return r;
        const newNum = String(c.next_activity_number);
        return { ...r, activity_number: newNum, impact_target: r.impact_actual ?? r.impact_target };
      })
    );
    this.importConflictIndices.set(new Set());
    this.importConflicts.set([]);
    this.resolveConflictsOverwrite();
  }

  private doImport(file: File, plans: PlanWithMode[], rows?: ImportPreviewRow[]): void {
    this.importLoading.set(true);
    this.importProgress.set(0);
    this.startSimulatedProgress();
    const validation_modes = plans.map((p) => ({ site_id: p.site_id, year: p.year, validation_mode: p.validation_mode }));
    this.csrPlansApi.importExcel(file, {
      validation_modes,
      rows: rows?.length ? rows : undefined,
      onProgress: (p) => {
        this.stopSimulatedProgress();
        this.importProgress.set(p);
      },
    }).subscribe({
      next: (res) => {
        this.stopSimulatedProgress();
        this.importLoading.set(false);
        this.importProgress.set(100);
        this.showImportModal.set(false);
        this.pendingImportFile.set(null);
        this.importPlansWithModes.set([]);
        this.importRows.set([]);
        this.importStep.set(0);
        const details = [
          this.i18n.t('ANNUAL_PLANS.MESSAGES.CREATED_PLANS').replace('{n}', String(res.plans_created)),
          this.i18n.t('ANNUAL_PLANS.MESSAGES.CREATED_ACTIVITIES').replace('{n}', String(res.activities_created)),
          res.realized_created ? this.i18n.t('ANNUAL_PLANS.MESSAGES.CREATED_REALIZED').replace('{n}', String(res.realized_created)) : '',
          res.errors?.length ? this.i18n.t('ANNUAL_PLANS.MESSAGES.WARNINGS').replace('{n}', String(res.errors.length)) : '',
        ].filter(Boolean).join(', ');
        this.importResult.set({
          success: true,
          message: res.message,
          details: details + (res.errors?.length ? '\n' + res.errors.slice(0, 5).join('\n') : ''),
        });
        this.refreshPlans();
      },
      error: (err) => {
        this.stopSimulatedProgress();
        this.importLoading.set(false);
        this.importProgress.set(0);
        this.importResult.set({
          success: false,
          message: err.error?.message || this.i18n.t('ANNUAL_PLANS.MESSAGES.IMPORT_ERROR'),
          details: Array.isArray(err.error?.errors) ? err.error.errors.join('\n') : undefined,
        });
      },
    });
  }

  cancelImportModal(): void {
    this.showImportModal.set(false);
    this.pendingImportFile.set(null);
    this.importPlansWithModes.set([]);
    this.importRows.set([]);
    this.importPreviewErrors.set([]);
    this.importValidateLoading.set(false);
    this.importStep.set(0);
    this.importConflictIndices.set(new Set());
    this.importConflicts.set([]);
    this.importTableEditable.set(false);
  }

  /** True if the import preview table is editable (always when conflicts exist so user can fix directly). */
  canEditImportTable(): boolean {
    return !this.importConflicts().length || this.importTableEditable();
  }

  nextImportStep(): void {
    this.importStep.set(1);
  }

  /** Re-validate rows when user clicks Next; only proceed if no errors. */
  goToNextImportStep(): void {
    const rows = this.importRows();
    if (!rows.length) {
      this.nextImportStep();
      return;
    }
    this.importValidateLoading.set(true);
    this.csrPlansApi.importValidateRows(rows).subscribe({
      next: (res) => {
        this.importValidateLoading.set(false);
        this.importPreviewErrors.set(res.errors ?? []);
        if (!(res.errors?.length)) {
          this.nextImportStep();
        }
      },
      error: () => {
        this.importValidateLoading.set(false);
        this.importPreviewErrors.set([this.i18n.t('ANNUAL_PLANS.MESSAGES.READ_FILE_ERROR')]);
      },
    });
  }

  prevImportStep(): void {
    this.importStep.set(0);
    this.importConflictIndices.set(new Set());
    this.importConflicts.set([]);
    this.importTableEditable.set(false);
  }

  /** True if row index has activity_number conflict. */
  hasImportConflict(index: number): boolean {
    return this.importConflictIndices().has(index);
  }

  /** True if row index has a validation warning (region/country/site). */
  hasImportWarning(index: number): boolean {
    return this.importWarningIndices().has(index);
  }

  /** True if row should be highlighted (conflict or warning). */
  hasImportConflictOrWarning(index: number): boolean {
    return this.hasImportConflict(index) || this.hasImportWarning(index);
  }

  /** Format import error with translated "Activity" prefix and message. */
  formatImportError(err: string): string {
    if (!err || typeof err !== 'string') return err;
    const t = (key: string) => this.i18n.t(key);
    const prefix = t('ANNUAL_PLANS.MODAL.ACTIVITY_ROW_PREFIX');
    let out = err.replace(/^Activity /, prefix);
    out = out.replace(/région inconnue '/g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_REGION_UNKNOWN') + " '");
    out = out.replace(/région manquante/g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_REGION_MISSING'));
    out = out.replace(/pays inconnu '/g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_COUNTRY_UNKNOWN') + " '");
    out = out.replace(/pays manquant/g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_COUNTRY_MISSING'));
    out = out.replace(/site inconnu '/g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_SITE_UNKNOWN') + " '");
    out = out.replace(/site manquant/g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_SITE_MISSING'));
    out = out.replace(/accès refusé au site /g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_ACCESS_DENIED') + ' ');
    out = out.replace(/année invalide /g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_YEAR_INVALID') + ' ');
    out = out.replace(/impossible de créer la catégorie/g, t('ANNUAL_PLANS.MODAL.IMPORT_ERR_CATEGORY_CREATE'));
    return out;
  }

  clearImportResult(): void {
    this.importResult.set(null);
  }

  private startSimulatedProgress(): void {
    this.stopSimulatedProgress();
    this.importProgressInterval = setInterval(() => {
      const curr = this.importProgress();
      if (curr < 90) {
        this.importProgress.set(Math.min(90, curr + 2));
      }
    }, 400);
  }

  private stopSimulatedProgress(): void {
    if (this.importProgressInterval) {
      clearInterval(this.importProgressInterval);
      this.importProgressInterval = null;
    }
  }

  // ── Plan create sidebar ───────────────────────────────────────────────────
  showCreateSidebar = signal(false);

  openCreateSidebar(): void {
    this.showCreateSidebar.set(true);
  }

  closeCreateSidebar(): void {
    this.showCreateSidebar.set(false);
  }

  onPlanCreated(): void {
    this.refreshPlans();
  }
}
