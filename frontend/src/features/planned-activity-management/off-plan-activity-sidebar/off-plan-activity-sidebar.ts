import { Component, inject, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, finalize, of, switchMap, timeout } from 'rxjs';
import { CsrActivitiesApi, type OffPlanRealizationPayload } from '../api/csr-activities-api';
import { DocumentsApi } from '@features/file-management/api/documents-api';
import { CategoriesApi, CATEGORY_OTHER_VALUE } from '@features/realized-activity-management/api/categories-api';
import type { Category } from '@features/realized-activity-management/api/categories-api';
import { AuthStore } from '@core/services/auth-store';

const LOAD_TIMEOUT_MS = 8000;

@Component({
  selector: 'app-off-plan-activity-sidebar',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, TranslateModule],
  templateUrl: './off-plan-activity-sidebar.html',
  host: {
    class: 'flex flex-col flex-1 min-h-0 overflow-hidden block w-full',
  },
})
export class OffPlanActivitySidebarComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private activitiesApi = inject(CsrActivitiesApi);
  private documentsApi = inject(DocumentsApi);
  private categoriesApi = inject(CategoriesApi);
  private authStore = inject(AuthStore);

  @Input({ required: true }) planId!: string;
  @Input() siteLabel = '';
  @Input() planYear: number | null = null;
  /** off_plan = flux hors plan ; plan_realized_draft = année passée, brouillon dans le plan (API plan-realized-draft). */
  @Input() submissionMode: 'off_plan' | 'plan_realized_draft' = 'off_plan';
  /** Clé i18n du titre (défaut : activité hors plan). */
  @Input() titleTranslateKey = 'OFF_PLAN_SIDEBAR.TITLE';
  /** Sous-titre optionnel sous le titre. */
  @Input() hintTranslateKey: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  form!: FormGroup;
  loading = false;
  submitError: string | null = null;
  selectedFiles: File[] = [];
  currentYear = new Date().getFullYear();

  readonly categoryOtherValue = CATEGORY_OTHER_VALUE;
  categories: Category[] = [];
  loadingCategories = true;

  /** Bornes du sélecteur de date de réalisation : année civile du plan. */
  get planRealizationDateMin(): string {
    const y = this.planYear ?? this.currentYear;
    return `${y}-01-01`;
  }

  get planRealizationDateMax(): string {
    const y = this.planYear ?? this.currentYear;
    return `${y}-12-31`;
  }

  get isOffPlanSubmission(): boolean {
    return this.submissionMode === 'off_plan';
  }

  isCorporateUser(): boolean {
    return this.authStore.userRole() === 'corporate';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      include_planned_details: [false],
      activity_number: ['', [Validators.required, Validators.maxLength(50)]],
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],

      category_id: ['', Validators.required],
      new_category_name: [''],
      collaboration_nature: [''],
      planned_budget: [null as number | null],
      action_impact_target: [null as number | null],
      start_year: [this.planYear ?? this.currentYear],
      edition: [null as number | null],

      participants: [null as number | null],
      total_hc: [null as number | null],
      percentage_employees: [null as number | null],
      realized_budget: [null as number | null],
      action_impact_actual: [null as number | null],
      action_impact_unit_realized: [''],

      organizer: [''],
      external_partner: [''],
      number_external_partners: [null as number | null],
      realization_date: [''],

      validation_mode: ['101' as '101' | '111', Validators.required],

      comment: [''],
      contact_name: [''],
      contact_email: [''],
      contact_department: [''],
    });

    this.form.get('category_id')?.valueChanges.subscribe(() => this.updateNewCategoryValidators());
    if (this.submissionMode === 'plan_realized_draft') {
      this.form.get('validation_mode')?.clearValidators();
      this.form.get('validation_mode')?.updateValueAndValidity({ emitEvent: false });
    }
    // Corporate users don't choose validation mode (always corporate-only).
    if (this.isCorporateUser()) {
      const v = this.form.get('validation_mode');
      v?.setValue('101', { emitEvent: false });
      v?.disable({ emitEvent: false });
      v?.clearValidators();
      v?.updateValueAndValidity({ emitEvent: false });
    }
    this.loadCategories();
  }

  private loadCategories(): void {
    this.categoriesApi
      .list()
      .pipe(
        timeout(LOAD_TIMEOUT_MS),
        catchError(() => of([] as Category[])),
      )
      .subscribe({
        next: (cats) => {
          this.categories = Array.isArray(cats) ? cats : [];
          this.loadingCategories = false;
          this.updateNewCategoryValidators();
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingCategories = false;
          this.cdr.markForCheck();
        },
      });
  }

  isOtherCategorySelected(): boolean {
    return this.form.get('category_id')?.value === this.categoryOtherValue;
  }

  private updateNewCategoryValidators(): void {
    const ctrl = this.form.get('new_category_name');
    if (!ctrl) return;
    if (this.isOtherCategorySelected()) {
      ctrl.setValidators([Validators.required, Validators.minLength(2)]);
    } else {
      ctrl.clearValidators();
      ctrl.setValue('');
    }
    ctrl.updateValueAndValidity();
  }

  close(): void {
    this.closed.emit();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFiles.push(...Array.from(input.files));
      input.value = '';
      this.cdr.markForCheck();
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.cdr.markForCheck();
  }

  private uploadFiles(siteId: string, activityId: string): void {
    if (!this.selectedFiles.length) return;
    this.selectedFiles.forEach((file) => {
      const form = new FormData();
      form.append('file', file);
      form.append('site_id', siteId);
      form.append('entity_type', 'ACTIVITY');
      form.append('entity_id', activityId);
      this.documentsApi.upload(form).subscribe({ next: () => {}, error: () => {} });
    });
    this.selectedFiles = [];
    this.cdr.markForCheck();
  }

  private buildPayload(categoryId: string): OffPlanRealizationPayload {
    const raw = this.form.getRawValue();
    const includePlannedDetails =
      this.submissionMode === 'plan_realized_draft'
        ? !!raw.include_planned_details
        : false;
    const planY = this.planYear ?? this.currentYear;
    let month = new Date().getMonth() + 1;
    const rd = raw.realization_date?.trim();
    if (rd && rd.length >= 10) {
      const d = new Date(`${rd.slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        month = d.getMonth() + 1;
      }
    }

    return {
      plan_id: this.planId,
      validation_mode: raw.validation_mode,
      include_planned_details: includePlannedDetails,
      activity_number: String(raw.activity_number).trim(),
      title: String(raw.title).trim(),
      description: raw.description?.trim() ? String(raw.description).trim() : null,

      category_id: categoryId,
      collaboration_nature: raw.collaboration_nature?.trim() || null,
      planned_budget:
        includePlannedDetails && raw.planned_budget != null && raw.planned_budget !== ''
          ? Number(raw.planned_budget)
          : null,
      action_impact_target:
        includePlannedDetails && raw.action_impact_target != null && raw.action_impact_target !== ''
          ? Number(raw.action_impact_target)
          : null,
      start_year: raw.start_year != null && raw.start_year !== '' ? Number(raw.start_year) : null,
      edition: raw.edition != null && raw.edition !== '' ? Number(raw.edition) : null,
      external_partner: raw.external_partner?.trim() || null,

      year: planY,
      month,

      realized_budget: raw.realized_budget != null && raw.realized_budget !== '' ? Number(raw.realized_budget) : null,
      participants: raw.participants != null && raw.participants !== '' ? Number(raw.participants) : null,
      total_hc: raw.total_hc != null && raw.total_hc !== '' ? Number(raw.total_hc) : null,
      percentage_employees: raw.percentage_employees != null && raw.percentage_employees !== '' ? Number(raw.percentage_employees) : null,
      action_impact_actual: raw.action_impact_actual != null && raw.action_impact_actual !== '' ? Number(raw.action_impact_actual) : null,
      action_impact_unit_realized: raw.action_impact_unit_realized?.trim() || null,
      organizer: raw.organizer?.trim() || null,
      number_external_partners:
        raw.number_external_partners != null && raw.number_external_partners !== ''
          ? Number(raw.number_external_partners)
          : null,
      realization_date: raw.realization_date?.trim() ? raw.realization_date.substring(0, 10) : null,

      comment: raw.comment?.trim() || null,
      contact_department: raw.contact_department?.trim() || null,
      contact_name: raw.contact_name?.trim() || null,
      contact_email: raw.contact_email?.trim() || null,
    };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitError = null;
    this.loading = true;
    this.cdr.markForCheck();
    const raw = this.form.getRawValue();

    const categoryId$ =
      raw.category_id === this.categoryOtherValue && raw.new_category_name?.trim()
        ? this.categoriesApi.create(raw.new_category_name.trim()).pipe(switchMap((cat) => of(cat.id)))
        : of(raw.category_id);

    const api$ =
      this.submissionMode === 'plan_realized_draft'
        ? (cid: string) =>
            this.activitiesApi.createPlanRealizedDraftWithRealization(this.buildPayload(cid)).pipe(timeout(LOAD_TIMEOUT_MS))
        : (cid: string) =>
            this.activitiesApi.createOffPlanRealization(this.buildPayload(cid)).pipe(timeout(LOAD_TIMEOUT_MS));

    categoryId$
      .pipe(
        switchMap((categoryId) => api$(categoryId)),
        catchError((err) => {
          const msg = err?.error?.message || err?.message || 'Erreur lors de la soumission';
          this.submitError = String(msg);
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          if (!res) return;
          const siteId = res.activity.site_id;
          const activityId = res.activity.id;
          if (siteId && activityId && this.selectedFiles.length) {
            this.uploadFiles(siteId, activityId);
          } else {
            this.selectedFiles = [];
          }
          this.created.emit();
          this.closed.emit();
        },
      });
  }
}
