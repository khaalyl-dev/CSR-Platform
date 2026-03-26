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
import { PlanEditSidebarComponent } from '../plan-edit-sidebar/plan-edit-sidebar';

export type PlanWithMode = ImportPreviewPlan & { validation_mode: '101' | '111' };

type ImportDuplicateGroup = {
  kind: 'excel' | 'db';
  activity_number: string;
  site: string;
  year: string;
  count: number;
  lines: number[]; // 2-based excel lines for display (header counts as 1)
  linesText: string;
};

@Component({
  selector: 'app-annual-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, PlanCreateSidebarComponent, PlanEditSidebarComponent],
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

  // ── Confirmation modal (replace window.confirm) ──────────────────────────
  confirmOpen = signal(false);
  confirmTitle = signal<string>('');
  confirmMessage = signal<string>('');
  confirmButtonLabel = signal<string>('');
  private confirmAction: (() => void) | null = null;

  openConfirm(options: { title?: string; message: string; confirmLabel?: string; onConfirm: () => void }): void {
    this.confirmTitle.set(options.title ?? this.i18n.t('COMMON.CONFIRM'));
    this.confirmMessage.set(options.message);
    this.confirmButtonLabel.set(options.confirmLabel ?? this.i18n.t('COMMON.CONFIRM'));
    this.confirmAction = options.onConfirm;
    this.confirmOpen.set(true);
  }

  closeConfirm(): void {
    this.confirmOpen.set(false);
    this.confirmAction = null;
  }

  runConfirm(): void {
    const fn = this.confirmAction;
    this.closeConfirm();
    try { fn?.(); } catch {}
  }

  onBulkActionChange(value: string): void {
    if (!value) return;
    this.bulkActionChoice.set('');
    if (value === 'submit') this.bulkSubmit();
    else if (value === 'delete') this.bulkDelete();
  }

  isAuthenticated = this.authStore.isAuthenticated;
  user = this.authStore.user;

  isCorporateUser(): boolean {
    return this.user()?.role === 'corporate';
  }

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

  /** Import year choices: full backend-valid range. */
  importYearOptions = computed(() => {
    const years: number[] = [];
    for (let y = 2100; y >= 2000; y--) years.push(y);
    return years;
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
  canBulkSubmit = computed(() => this.selectedPlans().some(p => p.status === 'DRAFT' || p.status === 'REJECTED'));
  canBulkDelete = computed(() => this.selectedPlans().some(p => this.isCorporateUser() || p.status === 'DRAFT' || p.status === 'REJECTED'));
  selectedSubmittableIds = computed(() => this.selectedPlans().filter(p => this.isCorporateUser() || p.status === 'DRAFT' || p.status === 'REJECTED').map(p => p.id));
  selectedDeletableIds = computed(() => this.selectedPlans().filter(p => this.isCorporateUser() || p.status === 'DRAFT' || p.status === 'REJECTED').map(p => p.id));
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
    const ids = this.selectedSubmittableIds();
    if (!ids.length) return;
    this.openConfirm({
      title: this.i18n.t('COMMON.CONFIRM'),
      message: this.i18n.t('ANNUAL_PLANS.CONFIRM.BULK_SUBMIT').replace('{n}', String(ids.length)),
      onConfirm: () => {
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
      },
    });
  }

  bulkDelete(): void {
    const ids = this.selectedDeletableIds();
    if (!ids.length) return;
    this.openConfirm({
      title: this.i18n.t('COMMON.CONFIRM'),
      message: this.i18n.t('ANNUAL_PLANS.CONFIRM.BULK_DELETE').replace('{n}', String(ids.length)),
      confirmLabel: this.i18n.t('COMMON.DELETE'),
      onConfirm: () => {
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

  /** True if plan can be submitted for validation (DRAFT/REJECTED or VALIDATED with unlock_until in future). */
  canSubmitFromList(plan: CsrPlan): boolean {
    if (!plan) return false;
    if (plan.status === 'DRAFT') return true;
    if (plan.status === 'REJECTED') return true;
    if (plan.status === 'VALIDATED') {
      const u = plan?.unlock_until;
      return !!(u && new Date(u) > new Date());
    }
    return false;
  }

  /** True if plan can be edited (DRAFT, REJECTED, or VALIDATED with unlock_until in future). */
  isPlanEditable(plan: CsrPlan): boolean {
    if (!plan) return false;
    if (this.isCorporateUser()) return true;
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
    this.openConfirm({
      title: this.i18n.t('COMMON.CONFIRM'),
      message: msg,
      onConfirm: () => {
        this.csrPlansApi.submitForValidation(plan.id).subscribe({
          next: (updated) => {
            this.plans.update((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
            this.closeMenu();
          },
          error: () => {},
        });
      },
    });
  }

  deleteFromMenu(plan: CsrPlan): void {
    if (!this.isCorporateUser() && plan.status !== 'DRAFT' && plan.status !== 'REJECTED') return;
    this.openConfirm({
      title: this.i18n.t('COMMON.CONFIRM'),
      message: this.i18n.t('ANNUAL_PLANS.CONFIRM.DELETE_ONE'),
      confirmLabel: this.i18n.t('COMMON.DELETE'),
      onConfirm: () => {
        this.csrPlansApi.delete(plan.id).subscribe({
          next: () => {
            this.plans.update((list) => list.filter((p) => p.id !== plan.id));
            this.closeMenu();
          },
          error: () => {},
        });
      },
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
    if (plan.status !== 'DRAFT' && plan.status !== 'REJECTED') return;
    this.openConfirm({
      title: this.i18n.t('COMMON.CONFIRM'),
      message: this.i18n.t('ANNUAL_PLANS.CONFIRM.SUBMIT_ONE'),
      onConfirm: () => {
        this.csrPlansApi.submitForValidation(plan.id).subscribe({
          next: (updated) => {
            this.plans.update((list) =>
              list.map((p) => (p.id === updated.id ? updated : p))
            );
          },
          error: () => {},
        });
      },
    });
  }

  importLoading = signal(false);
  importProgress = signal(0);
  private importProgressInterval: ReturnType<typeof setInterval> | null = null;
  importResult = signal<{ success: boolean; message: string; details?: string } | null>(null);
  importDragOver = signal(false);

  private autoValidateTimer: ReturnType<typeof setTimeout> | null = null;
  private autoConflictsTimer: ReturnType<typeof setTimeout> | null = null;
  /** After preview: file to send on confirm, and modal visibility */
  pendingImportFile = signal<File | null>(null);
  showImportModal = signal(false);
  importSelectedYear = signal<number>(new Date().getFullYear());
  /** Plans from preview with validation_mode per plan (user can change in modal) */
  importPlansWithModes = signal<PlanWithMode[]>([]);
  /** Editable activity rows from preview */
  importRows = signal<ImportPreviewRow[]>([]);
  importPreviewErrors = signal<string[]>([]);
  /** True while re-validating rows on Next click. */
  importValidateLoading = signal(false);
  /** Row index (0-based) to scroll/highlight in preview table. */
  importFocusedRowIndex = signal<number | null>(null);
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

  private compressNumberRanges(nums: number[]): string {
    const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
    const out: string[] = [];
    let start: number | null = null;
    let prev: number | null = null;
    for (const n of sorted) {
      if (start == null) {
        start = n;
        prev = n;
        continue;
      }
      if (prev != null && n === prev + 1) {
        prev = n;
        continue;
      }
      out.push(start === prev ? String(start) : `${start}–${prev}`);
      start = n;
      prev = n;
    }
    if (start != null) out.push(start === prev ? String(start) : `${start}–${prev}`);
    return out.join(', ');
  }

  extractErrorRowNumber(err: string): number | null {
    const m = String(err).match(/^Activity (\d+):/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : null;
  }

  private extractFormattedErrorMessage(err: string): string {
    const formatted = this.formatImportError(err);
    // Remove leading "Activity 12:" or "Activité n° 12:" prefix (localized).
    return formatted.replace(/^(Activity|Activité).*?\d+\s*:\s*/i, '').trim();
  }

  groupedImportErrors = computed(() => {
    const errors = this.importPreviewErrors() || [];
    const groups = new Map<string, number[]>();
    const standalone: string[] = [];
    for (const e of errors) {
      const rowNum = this.extractErrorRowNumber(e);
      const msg = this.extractFormattedErrorMessage(e);
      if (rowNum == null || !msg) {
        standalone.push(this.formatImportError(e));
        continue;
      }
      const list = groups.get(msg) ?? [];
      list.push(rowNum);
      groups.set(msg, list);
    }
    const grouped = Array.from(groups.entries())
      .map(([message, rows]) => ({
        message,
        count: rows.length,
        rows,
        rowsText: this.compressNumberRanges(rows),
      }))
      .sort((a, b) => b.count - a.count || a.message.localeCompare(b.message));
    return { grouped, standalone };
  });

  importWarningGroupCount = computed(() => {
    const g = this.groupedImportErrors();
    return (g.grouped?.length ?? 0) + (g.standalone?.length ?? 0);
  });

  mergedIssuesList = computed(() => {
    const out: Array<{ text: string; firstExcelLine: number }> = [];
    const prefix = this.i18n.t('ANNUAL_PLANS.MODAL.ACTIVITY_ROW_PREFIX');

    // Warnings (grouped) — no "78×" prefix, just message + lines.
    const g = this.groupedImportErrors();
    for (const item of g.grouped ?? []) {
      const first = (item.rows?.[0] ?? 2) as number;
      out.push({
        text: `${item.message} — ${prefix}${item.rowsText}`,
        firstExcelLine: first,
      });
    }
    for (const s of g.standalone ?? []) {
      out.push({
        text: String(s),
        firstExcelLine: 2,
      });
    }

    // Duplicates — same list, same style.
    for (const d of this.importDuplicateGroups()) {
      const kind = d.kind === 'db'
      const dupLabel = d.kind === 'db'
        ? this.i18n.t('ANNUAL_PLANS.MODAL.DUP_ERR_DB_CSR_NUMBER')
        : this.i18n.t('ANNUAL_PLANS.MODAL.DUP_ERR_EXCEL_CSR_NUMBER');
      out.push({
        text: `${kind ? (kind + ' : ') : ''}${dupLabel} — ${d.activity_number} — ${d.site} (${d.year}) — ${this.i18n.t('ANNUAL_PLANS.MODAL.DUP_LINES')} ${d.linesText}`,
        firstExcelLine: d.lines?.[0] ?? 2,
      });
    }

    return out;
  });

  issuesWarningsBadgeText(): string {
    const n = this.importPreviewErrors().length;
    const linesLabel = n === 1 ? this.i18n.t('ANNUAL_PLANS.MODAL.ONE_LINE') : this.i18n.t('ANNUAL_PLANS.MODAL.MANY_LINES');
    return this.i18n
      .t('ANNUAL_PLANS.MODAL.WARNINGS_BADGE')
      .replace('{n}', String(n))
      .replace('{lines}', linesLabel);
  }

  issuesDuplicatesBadgeText(): string {
    const n = this.importDuplicateGroups().length;
    const groupsLabel = n === 1 ? this.i18n.t('ANNUAL_PLANS.MODAL.ONE_GROUP') : this.i18n.t('ANNUAL_PLANS.MODAL.MANY_GROUPS');
    return this.i18n
      .t('ANNUAL_PLANS.MODAL.DUPLICATES_BADGE')
      .replace('{n}', String(n))
      .replace('{groups}', groupsLabel);
  }

  focusImportRowByOriginalIndex(index: number): void {
    if (index == null || index < 0) return;
    this.importFocusedRowIndex.set(index);
    // Scroll the table row into view.
    try {
      const el = document.querySelector(`[data-import-row-index="${index}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
    // Clear highlight after a short delay.
    setTimeout(() => {
      if (this.importFocusedRowIndex() === index) this.importFocusedRowIndex.set(null);
    }, 1800);
  }

  focusImportRowByExcelLine(excelLine: number): void {
    // excelLine is 2-based (header row is 1). Convert to 0-based importRows index.
    const idx = (excelLine ?? 0) - 2;
    this.focusImportRowByOriginalIndex(idx);
  }
  /** When true, table is editable even when conflicts exist (user clicked Edit). */
  importTableEditable = signal(false);
  /** Strategy chosen to handle duplicates at import time. */
  importDuplicateStrategy = signal<'delete' | 'ignore' | null>(null);

  /** Row indices (0-based) that are duplicates inside the Excel file. */
  private internalDuplicateRowIndices = computed(() => {
    const rows = this.importRows();
    const map = new Map<string, number[]>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const activityNumber = String(r.activity_number ?? r.title ?? '').trim();
      const site = String(r.site ?? '').trim();
      const year = String(this.importSelectedYear()).trim();
      if (!activityNumber || !site || !year) continue;

      const k = `${site.toLowerCase()}|${year}|${activityNumber.toLowerCase()}`;
      const list = map.get(k) ?? [];
      list.push(i);
      map.set(k, list);
    }

    const indices = new Set<number>();
    for (const [, list] of map.entries()) {
      if (list.length > 1) {
        for (const idx of list) indices.add(idx);
      }
    }
    return indices;
  });

  /** Row indices (0-based) that should be highlighted as duplicates (Excel + DB). */
  private importDuplicateRowIndices = computed(() => {
    const set = new Set<number>(this.importConflictIndices());
    for (const idx of this.internalDuplicateRowIndices()) set.add(idx);
    return set;
  });

  importHasDuplicates = computed(() => this.importDuplicateRowIndices().size > 0);

  /** Duplicates list for the UI table. */
  importDuplicateGroups = computed<ImportDuplicateGroup[]>(() => {
    const rows = this.importRows();
    const groups = new Map<string, ImportDuplicateGroup & { _kinds: Set<'excel' | 'db'> }>();

    // Excel duplicates (internal).
    const excelMap = new Map<string, number[]>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const activityNumber = String(r.activity_number ?? r.title ?? '').trim();
      const site = String(r.site ?? '').trim();
      const year = String(this.importSelectedYear()).trim();
      if (!activityNumber || !site || !year) continue;
      const k = `${site.toLowerCase()}|${year}|${activityNumber.toLowerCase()}`;
      const list = excelMap.get(k) ?? [];
      list.push(i);
      excelMap.set(k, list);
    }
    for (const [k, list] of excelMap.entries()) {
      if (list.length <= 1) continue;
      const parts = k.split('|');
      const site = parts[0] ?? '';
      const year = parts[1] ?? '';
      const activity_number = parts.slice(2).join('|') ?? '';
      const existing = groups.get(k);
      if (existing) {
        existing.count = list.length;
        existing.lines = list.map(x => x + 2);
        existing._kinds.add('excel');
      } else {
        groups.set(k, {
          kind: 'excel',
          activity_number,
          site,
          year,
          count: list.length,
          lines: list.map(x => x + 2),
          _kinds: new Set(['excel']),
        } as any);
      }
    }

    // DB duplicates (from check-conflicts).
    for (const c of this.importConflicts()) {
      const site = String(c.site_name ?? '').trim();
      const year = String(c.year ?? '').trim();
      const activity_number = String(c.activity_number ?? '').trim();
      if (!activity_number || !site || !year) continue;
      const k = `${site.toLowerCase()}|${year}|${activity_number.toLowerCase()}`;
      const existing = groups.get(k);
      const indices = [c.row_index];
      if (existing) {
        existing.count += 1; // count is only used for quick display; keep it approximate
        existing.lines = Array.from(new Set([...existing.lines, ...indices.map(x => x + 2)]));
        existing._kinds.add('db');
      } else {
        groups.set(k, {
          kind: 'db',
          activity_number,
          site,
          year,
          count: 1,
          lines: indices.map(x => x + 2),
          _kinds: new Set(['db']),
        } as any);
      }
    }

    return Array.from(groups.values()).map((g) => {
      const kinds = Array.from((g as any)._kinds ?? []);
      // Keep UI kind as a single string.
      const kindLabel = kinds.includes('db') && kinds.includes('excel') ? 'excel+db' : kinds[0] ?? g.kind;
      const lines = g.lines.sort((a, b) => a - b);
      return {
        kind: kindLabel === 'excel+db' ? 'db' : g.kind,
        activity_number: g.activity_number,
        site: g.site,
        year: g.year,
        count: lines.length,
        lines,
        linesText: this.compressNumberRanges(lines),
      };
    });
  });
  /** Sort state for import preview table (step 0). */
  importSortColumn = signal<string>('activity_number');
  importSortDirection = signal<'asc' | 'desc'>('asc');

  /** Sorted view of import rows; each row has __originalIndex for trackBy and updates. */
  sortedImportRows = computed(() => {
    const rows = this.importRows();
    const col = this.importSortColumn();
    const dir = this.importSortDirection();
    const numericKeys = new Set(['start_year', 'edition', 'participants', 'total_hc', 'percentage_employees', 'planned_budget', 'realized_budget', 'impact_actual', 'number_external_partners']);
    const withIndices = rows.map((r, i) => ({ row: r, originalIndex: i }));
    const sorted = [...withIndices].sort((a, b) => {
      const rawA = (a.row as any)[col];
      const rawB = (b.row as any)[col];
      const valA = rawA?.toString().trim().toLowerCase() ?? '';
      const valB = rawB?.toString().trim().toLowerCase() ?? '';

      // Special numeric sort for activity numbers: "CSR 1" < "CSR 10"
      if (col === 'activity_number') {
        const getNum = (v: any): number => {
          const s = v == null ? '' : String(v);
          const m = s.match(/(\d+)/);
          return m ? parseInt(m[1], 10) : 0;
        };
        const numA = getNum(rawA);
        const numB = getNum(rawB);
        if (numA < numB) return dir === 'asc' ? -1 : 1;
        if (numA > numB) return dir === 'asc' ? 1 : -1;
        return 0;
      }

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

  // ── Import preview selection (multi-row delete) ───────────────────────────
  selectedImportRowIndices = signal<Set<number>>(new Set());

  selectedImportCount = computed(() => this.selectedImportRowIndices().size);

  /** True if all rows currently displayed in the sorted view are selected. */
  isAllImportRowsSelected = computed(() => {
    const selected = this.selectedImportRowIndices();
    const view = this.sortedImportRows().rows;
    if (!view.length) return false;
    return view.every((r) => selected.has((r as any).__originalIndex));
  });

  /** True if some (but not all) rows in current view are selected. */
  isSomeImportRowsSelected = computed(() => {
    const selected = this.selectedImportRowIndices();
    const view = this.sortedImportRows().rows;
    if (!view.length) return false;
    const any = view.some((r) => selected.has((r as any).__originalIndex));
    return any && !this.isAllImportRowsSelected();
  });

  toggleSelectImportRow(originalIndex: number): void {
    this.selectedImportRowIndices.update((set) => {
      const next = new Set(set);
      if (next.has(originalIndex)) next.delete(originalIndex);
      else next.add(originalIndex);
      return next;
    });
  }

  toggleSelectAllImportRows(): void {
    const view = this.sortedImportRows().rows as Array<ImportPreviewRow & { __originalIndex: number }>;
    if (!view.length) return;
    if (this.isAllImportRowsSelected()) {
      // Unselect all visible
      const visible = new Set(view.map((r) => r.__originalIndex));
      this.selectedImportRowIndices.update((set) => {
        const next = new Set(set);
        visible.forEach((i) => next.delete(i));
        return next;
      });
    } else {
      // Select all visible
      this.selectedImportRowIndices.update((set) => {
        const next = new Set(set);
        view.forEach((r) => next.add(r.__originalIndex));
        return next;
      });
    }
  }

  clearImportSelection(): void {
    this.selectedImportRowIndices.set(new Set());
  }

  deleteSelectedImportRows(): void {
    const selected = this.selectedImportRowIndices();
    if (!selected.size) return;
    // Delete by original indices
    this.importRows.update((rows) => rows.filter((_r, idx) => !selected.has(idx)));
    this.clearImportSelection();
    // Re-run realtime checks since indices changed.
    this.scheduleAutoValidateRows();
    this.scheduleAutoConflictsCheck();
  }

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
      const activityNumber = String(r.activity_number ?? '').trim();
      return region !== '' && country !== '' && site !== '' && activityNumber !== '';
    });
  });

  private importExcelFile(file: File): void {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.importResult.set({ success: false, message: this.i18n.t('ANNUAL_PLANS.MESSAGES.SELECT_XLSX') });
      return;
    }
    this.importLoading.set(true);
    this.importProgress.set(0);
    this.importResult.set(null);
    this.startSimulatedProgress();
    this.csrPlansApi.importExcelPreview(file, {
      year: this.importSelectedYear(),
      onProgress: (p) => {
        this.stopSimulatedProgress();
        this.importProgress.set(p);
      },
    }).subscribe({
      next: (res) => {
        this.stopSimulatedProgress();
        this.importLoading.set(false);
        this.importProgress.set(100);
        const selectedYear = this.importSelectedYear();
        const plansWithModes: PlanWithMode[] = (res.plans || []).map(p => ({ ...p, year: selectedYear, validation_mode: '101' }));
        this.pendingImportFile.set(file);
        this.importPlansWithModes.set(plansWithModes);
        this.importRows.set(res.rows || []);
        this.importPreviewErrors.set(res.errors || []);
        this.importStep.set(0);
        this.showImportModal.set(true);
        this.importDuplicateStrategy.set(null);
        this.importConflicts.set([]);
        this.importConflictIndices.set(new Set());
        this.importTableEditable.set(true);

        // Real-time DB duplicates (based on current preview values).
        if ((res.rows || []).length) {
          this.csrPlansApi.importExcelCheckConflicts(res.rows || [], { year: selectedYear }).subscribe({
            next: (cRes) => {
              const conflicts = cRes.conflicts ?? [];
              this.importConflicts.set(conflicts);
              this.importConflictIndices.set(new Set(conflicts.map((c) => c.row_index)));
            },
            error: () => {
              this.importConflicts.set([]);
              this.importConflictIndices.set(new Set());
            },
          });
        }
      },
      error: (err) => {
        this.stopSimulatedProgress();
        this.importLoading.set(false);
        this.importProgress.set(0);
        const msg = err.error?.message || this.i18n.t('ANNUAL_PLANS.MESSAGES.READ_FILE_ERROR');
        const errors = err.error?.errors;
        alert(msg + (Array.isArray(errors) && errors.length ? `\n\n${errors.slice(0, 10).join('\n')}` : ''));
        this.pendingImportFile.set(null);
        this.showImportModal.set(false);
      },
    });
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.importExcelFile(file);
    input.value = '';
  }

  onImportDragOver(event: DragEvent): void {
    event.preventDefault();
    this.importDragOver.set(true);
  }

  onImportDragLeave(): void {
    this.importDragOver.set(false);
  }

  onImportDrop(event: DragEvent): void {
    event.preventDefault();
    this.importDragOver.set(false);
    if (event.dataTransfer?.files?.length) {
      const file = event.dataTransfer.files[0];
      if (file) this.importExcelFile(file);
    }
  }

  setPlanMode(index: number, mode: '101' | '111'): void {
    this.importPlansWithModes.update(list =>
      list.map((p, i) => (i === index ? { ...p, validation_mode: mode } : p))
    );
  }

  setImportSelectedYear(year: number): void {
    this.importSelectedYear.set(year);
    this.importPlansWithModes.update((list) => list.map((p) => ({ ...p, year })));
    this.scheduleAutoConflictsCheck();
  }

  /** Update a cell in the import preview rows. */
  updateImportRow(index: number, key: keyof ImportPreviewRow, value: string | number | null): void {
    let v: any = value === '' || value === null ? undefined : value;
    if (key === 'percentage_employees' && v != null) {
      const s = String(v).trim().replace(',', '.');
      const n = Number(s);
      if (!Number.isNaN(n) && n > 0 && n <= 1) {
        v = String(n * 100);
      }
    }
    this.importRows.update(rows => rows.map((r, i) => {
      if (i !== index) return r;
      const next = { ...r, [key]: v };
      if (key === 'impact_actual') next['impact_target'] = v;
      if (key === 'participants') next['planned_volunteers'] = v;
      return next;
    }));

    // Real-time validation (types/coherence/required) while editing step 0.
    this.scheduleAutoValidateRows();

    // Real-time DB duplicates (depends on activity_number/title + site + year).
    if (key === 'activity_number' || key === 'title' || key === 'site' || key === 'year' || key === 'start_year') {
      this.scheduleAutoConflictsCheck();
    }
  }

  private scheduleAutoValidateRows(): void {
    if (!this.showImportModal() || this.importStep() !== 1) return;
    if (this.autoValidateTimer) clearTimeout(this.autoValidateTimer);
    this.autoValidateTimer = setTimeout(() => {
      if (!this.showImportModal() || this.importStep() !== 1) return;
      const rows = this.importRows();
      if (!rows.length) return;
      this.csrPlansApi.importValidateRows(rows, { year: this.importSelectedYear() }).subscribe({
        next: (res) => this.importPreviewErrors.set(res.errors ?? []),
        error: () => {},
      });
    }, 600);
  }

  private scheduleAutoConflictsCheck(): void {
    if (!this.showImportModal() || this.importStep() !== 1) return;
    if (this.autoConflictsTimer) clearTimeout(this.autoConflictsTimer);
    this.autoConflictsTimer = setTimeout(() => {
      if (!this.showImportModal() || this.importStep() !== 1) return;
      const rows = this.importRows();
      if (!rows.length) return;
      this.csrPlansApi.importExcelCheckConflicts(rows, { year: this.importSelectedYear() }).subscribe({
        next: (res) => {
          const conflicts = res.conflicts ?? [];
          this.importConflicts.set(conflicts);
          this.importConflictIndices.set(new Set(conflicts.map((c) => c.row_index)));
        },
        error: () => {},
      });
    }, 600);
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
      this.doImport(file, plans, undefined, this.importDuplicateStrategy() ?? 'overwrite');
      return;
    }
    const duplicate_strategy = this.importDuplicateStrategy();
    if (this.importHasDuplicates() && !duplicate_strategy) return;
    this.doImport(file, plans, rows, duplicate_strategy ?? 'overwrite');
  }

  /** Overwrite existing activities (use current import, backend will update). */
  resolveConflictsOverwrite(): void {
    const file = this.pendingImportFile();
    const plans = this.importPlansWithModes();
    const rows = this.importRows().length ? this.importRows() : undefined;
    if (!file || !plans.length) return;
    this.importConflictIndices.set(new Set());
    this.importConflicts.set([]);
    this.doImport(file, plans, rows, 'overwrite');
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

  private doImport(file: File, plans: PlanWithMode[], rows?: ImportPreviewRow[], duplicate_strategy: 'delete' | 'ignore' | 'overwrite' = 'overwrite'): void {
    this.importLoading.set(true);
    this.importProgress.set(0);
    this.startSimulatedProgress();
    const selectedYear = this.importSelectedYear();
    const validation_modes = plans.map((p) => ({ site_id: p.site_id, year: selectedYear, validation_mode: p.validation_mode }));
    this.csrPlansApi.importExcel(file, {
      year: selectedYear,
      validation_modes,
      rows: rows?.length ? rows : undefined,
      duplicate_strategy,
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
        const summary = [
          this.i18n.t('ANNUAL_PLANS.MESSAGES.CREATED_PLANS').replace('{n}', String(res.plans_created)),
          this.i18n.t('ANNUAL_PLANS.MESSAGES.CREATED_ACTIVITIES').replace('{n}', String(res.activities_created)),
          res.realized_created ? this.i18n.t('ANNUAL_PLANS.MESSAGES.CREATED_REALIZED').replace('{n}', String(res.realized_created)) : '',
        ].filter(Boolean).join(', ');
        const msg = `${res.message} — ${summary}` +
          (res.errors?.length ? `\n\n${this.i18n.t('ANNUAL_PLANS.MESSAGES.WARNINGS').replace('{n}', String(res.errors.length))}` : '');
        alert(msg);
        this.refreshPlans();
      },
      error: (err) => {
        this.stopSimulatedProgress();
        this.importLoading.set(false);
        this.importProgress.set(0);
        const msg = err.error?.message || this.i18n.t('ANNUAL_PLANS.MESSAGES.IMPORT_ERROR');
        const errors = err.error?.errors;
        alert(msg + (Array.isArray(errors) && errors.length ? `\n\n${errors.slice(0, 10).join('\n')}` : ''));
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
    this.clearImportSelection();
    this.importStep.set(0);
    this.importConflictIndices.set(new Set());
    this.importConflicts.set([]);
    this.importDuplicateStrategy.set(null);
    this.importDragOver.set(false);
    if (this.autoValidateTimer) clearTimeout(this.autoValidateTimer);
    if (this.autoConflictsTimer) clearTimeout(this.autoConflictsTimer);
    this.autoValidateTimer = null;
    this.autoConflictsTimer = null;
    this.importTableEditable.set(false);
  }

  /** True if the import preview table is editable (always when conflicts exist so user can fix directly). */
  canEditImportTable(): boolean {
    return !this.importConflicts().length || this.importTableEditable();
  }

  nextImportStep(): void {
    this.importStep.update((s) => Math.min(2, s + 1));
  }

  chooseDuplicateStrategy(strategy: 'delete' | 'ignore'): void {
    this.importDuplicateStrategy.set(strategy);
    this.goToNextImportStep();
  }

  /** Re-validate rows when user clicks Next; only proceed if no errors. */
  goToNextImportStep(): void {
    if (this.importStep() === 0) {
      this.nextImportStep();
      return;
    }
    const rows = this.importRows();
    if (!rows.length) {
      this.nextImportStep();
      return;
    }
    this.importValidateLoading.set(true);
    this.csrPlansApi.importValidateRows(rows, { year: this.importSelectedYear() }).subscribe({
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
    this.importStep.update((s) => Math.max(0, s - 1));
    this.importTableEditable.set(true);
    this.clearImportSelection();
  }

  /** True if row index has activity_number conflict. */
  hasImportConflict(index: number): boolean {
    return this.importConflictIndices().has(index);
  }

  /** True if row index has a validation warning (region/country/site). */
  hasImportWarning(index: number): boolean {
    return this.importWarningIndices().has(index);
  }

  /** True if row index is a duplicate (Excel internal or already exists in DB). */
  hasImportDuplicate(index: number): boolean {
    return this.importDuplicateRowIndices().has(index);
  }

  /** True if row should be highlighted (conflict or warning). */
  hasImportConflictOrWarning(index: number): boolean {
    return this.hasImportDuplicate(index) || this.hasImportWarning(index);
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

  // ── Plan edit sidebar ────────────────────────────────────────────────────
  showEditSidebar = signal(false);
  editSidebarPlan = signal<CsrPlan | null>(null);

  openCreateSidebar(): void {
    this.showCreateSidebar.set(true);
  }

  closeCreateSidebar(): void {
    this.showCreateSidebar.set(false);
  }

  onPlanCreated(): void {
    this.refreshPlans();
  }

  openEditSidebar(plan: CsrPlan): void {
    this.editSidebarPlan.set(plan);
    this.showEditSidebar.set(true);
    this.closeMenu();
  }

  closeEditSidebar(): void {
    this.showEditSidebar.set(false);
    this.editSidebarPlan.set(null);
  }

  onPlanUpdated(): void {
    this.refreshPlans();
  }
}
