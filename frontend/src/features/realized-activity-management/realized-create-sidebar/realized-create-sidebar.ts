import { Component, inject, OnInit, Output, EventEmitter, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, finalize, of, switchMap, timeout } from 'rxjs';
import { RealizedCsrApi } from '../api/realized-csr-api';
import { CsrActivitiesApi, type PlannedActivityListItem } from '../api/csr-activities-api';
import { CsrPlansApi } from '@features/csr-plan-management/api/csr-plans-api';
import { CategoriesApi, CATEGORY_OTHER_VALUE } from '../api/categories-api';
import { DocumentsApi } from '@features/file-management/api/documents-api';
import type { CreateRealizedCsrPayload } from '../models/realized-csr.model';
import type { CsrPlan } from '@features/csr-plan-management/models/csr-plan.model';
import type { Category } from '../api/categories-api';

const LOAD_TIMEOUT_MS = 8000;
const HORS_PLAN = '__hors_plan__';
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_LABELS: Record<number, string> = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
  7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
};

@Component({
  selector: 'app-realized-create-sidebar',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, TranslateModule],
  templateUrl: './realized-create-sidebar.html',
  host: {
    class: 'flex flex-col flex-1 min-h-0 overflow-hidden block w-full',
  },
})
export class RealizedCreateSidebarComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private realizedApi = inject(RealizedCsrApi);
  private activitiesApi = inject(CsrActivitiesApi);
  private plansApi = inject(CsrPlansApi);
  private categoriesApi = inject(CategoriesApi);
  private documentsApi = inject(DocumentsApi);

  @Input() initialPlanId: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  form!: FormGroup;
  readonly horsPlanValue = HORS_PLAN;

  get isHorsPlan(): boolean {
    return this.form?.get('activity_id')?.value === HORS_PLAN;
  }
  plans: CsrPlan[] = [];
  editablePlans: CsrPlan[] = [];
  activities: PlannedActivityListItem[] = [];
  categories: Category[] = [];
  currentYear = new Date().getFullYear();
  loading = false;
  loadingData = true;
  months = MONTHS;
  monthLabel = (m: number) => MONTH_LABELS[m] ?? String(m);
  readonly categoryOtherValue = CATEGORY_OTHER_VALUE;
  selectedFiles: File[] = [];

  get selectedPlan(): CsrPlan | null {
    const id = this.form.get('plan_id')?.value;
    return this.plans.find((p) => p.id === id) ?? null;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      plan_id: ['', Validators.required],
      activity_id: [''],
      // Planned (when not_planned)
      category_id: [''],
      new_category_name: [''],
      activity_number: [''],
      title: [''],
      description: [''],
      planned_budget: [null as number | null],
      // Realized
      year: [this.currentYear, [Validators.required, Validators.min(2000), Validators.max(2100)]],
      month: [new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]],
      realized_budget: [null as number | null],
      participants: [null as number | null],
      total_hc: [null as number | null],
      volunteer_hours: [null as number | null],
      impact_description: [''],
      organizer: [''],
      number_external_partners: [null as number | null],
      realization_date: [''],
      comment: [''],
      contact_name: [''],
      contact_email: [''],
    });

    this.form.get('plan_id')?.valueChanges.subscribe((id) => this.onPlanChange(id));
    this.form.get('activity_id')?.valueChanges.subscribe(() => {
      this.updateValidators();
      this.cdr.markForCheck();
    });
    this.form.get('category_id')?.valueChanges.subscribe(() => this.updateNewCategoryValidators());

    if (this.initialPlanId) {
      this.form.patchValue({ plan_id: this.initialPlanId });
    }

    this.loadData();
  }

  private loadData(): void {
    this.loadingData = true;
    this.cdr.markForCheck();
    this.plansApi.list().pipe(
      timeout(LOAD_TIMEOUT_MS),
      catchError(() => of([] as CsrPlan[])),
      switchMap((plans) => {
        this.plans = Array.isArray(plans) ? plans : [];
        this.editablePlans = this.getEditablePlans(this.plans);
        return this.categoriesApi.list().pipe(
          timeout(LOAD_TIMEOUT_MS),
          catchError(() => of([] as Category[]))
        );
      }),
      finalize(() => {
        this.loadingData = false;
        if (this.initialPlanId && this.editablePlans.some((p) => p.id === this.initialPlanId)) {
          this.form.patchValue({ plan_id: this.initialPlanId });
          this.onPlanChange(this.initialPlanId);
        }
        this.updateValidators();
        this.cdr.markForCheck();
      }),
    ).subscribe((cats) => {
      this.categories = Array.isArray(cats) ? cats : [];
      this.updateNewCategoryValidators();
      this.cdr.markForCheck();
    });
  }

  private getEditablePlans(plans: CsrPlan[]): CsrPlan[] {
    const currentYear = new Date().getFullYear();
    // Include current year and past 2 years to allow recording realizations for recent plans (e.g. late reporting)
    return plans
      .filter((p) => p.year >= currentYear - 2 && p.year <= currentYear + 1)
      .sort((a, b) => b.year - a.year || (a.site_name ?? '').localeCompare(b.site_name ?? ''));
  }

  private onPlanChange(planId: string): void {
    this.form.patchValue({ activity_id: '' });
    this.activities = [];
    if (!planId) {
      this.cdr.markForCheck();
      return;
    }
    this.activitiesApi.list({ plan_id: planId }).pipe(
      timeout(LOAD_TIMEOUT_MS),
      catchError(() => of([])),
    ).subscribe((list) => {
      this.activities = Array.isArray(list) ? list : [];
      this.updateValidators();
      this.cdr.markForCheck();
    });
  }

  private updateValidators(): void {
    const activityIdCtrl = this.form.get('activity_id');
    const categoryCtrl = this.form.get('category_id');
    const titleCtrl = this.form.get('title');
    const activityNumberCtrl = this.form.get('activity_number');
    if (this.isHorsPlan) {
      activityIdCtrl?.setValidators([Validators.required]);
      categoryCtrl?.setValidators([Validators.required]);
      titleCtrl?.setValidators([Validators.required]);
      activityNumberCtrl?.setValidators([Validators.required]);
    } else {
      activityIdCtrl?.setValidators([Validators.required]);
      categoryCtrl?.clearValidators();
      titleCtrl?.clearValidators();
      activityNumberCtrl?.clearValidators();
    }
    activityIdCtrl?.updateValueAndValidity();
    categoryCtrl?.updateValueAndValidity();
    titleCtrl?.updateValueAndValidity();
    activityNumberCtrl?.updateValueAndValidity();
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

  isOtherCategorySelected(): boolean {
    return this.form.get('category_id')?.value === CATEGORY_OTHER_VALUE;
  }

  private updateNewCategoryValidators(): void {
    const ctrl = this.form.get('new_category_name');
    if (this.isOtherCategorySelected()) {
      ctrl?.setValidators([Validators.required, Validators.minLength(2)]);
    } else {
      ctrl?.clearValidators();
      ctrl?.setValue('');
    }
    ctrl?.updateValueAndValidity();
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    const raw = this.form.getRawValue();

    if (this.isHorsPlan) {
      this.submitNotPlanned(raw);
    } else {
      this.submitPlanned(raw);
    }
  }

  private submitPlanned(raw: any): void {
    const payload: CreateRealizedCsrPayload = {
      activity_id: raw.activity_id,
      year: Number(raw.year),
      month: Number(raw.month),
      realized_budget: raw.realized_budget != null && raw.realized_budget !== '' ? Number(raw.realized_budget) : null,
      participants: raw.participants != null && raw.participants !== '' ? Number(raw.participants) : null,
      total_hc: raw.total_hc != null && raw.total_hc !== '' ? Number(raw.total_hc) : null,
      volunteer_hours: raw.volunteer_hours != null && raw.volunteer_hours !== '' ? Number(raw.volunteer_hours) : null,
      impact_description: raw.impact_description?.trim() || null,
      organizer: raw.organizer?.trim() || null,
      number_external_partners: raw.number_external_partners != null && raw.number_external_partners !== '' ? Number(raw.number_external_partners) : null,
      realization_date: raw.realization_date?.trim() ? raw.realization_date.substring(0, 10) : null,
      comment: raw.comment?.trim() || null,
      contact_name: raw.contact_name?.trim() || null,
      contact_email: raw.contact_email?.trim() || null,
    };
    this.realizedApi.create(payload).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: () => {
        const siteId = this.selectedPlan?.site_id;
        const activityId = raw.activity_id;
        if (siteId && activityId && this.selectedFiles.length) {
          this.uploadFiles(siteId, activityId);
        } else {
          this.selectedFiles = [];
        }
        this.created.emit();
        this.closed.emit();
      },
      error: () => {},
    });
  }

  private submitNotPlanned(raw: any): void {
    const plannedBudget = raw.planned_budget != null && raw.planned_budget !== '' ? Number(raw.planned_budget) : null;
    const categoryId$ = raw.category_id === CATEGORY_OTHER_VALUE && raw.new_category_name?.trim()
      ? this.categoriesApi.create(raw.new_category_name.trim()).pipe(switchMap((cat) => of(cat.id)))
      : of(raw.category_id);

    categoryId$.pipe(
      switchMap((categoryId) =>
        this.activitiesApi.create({
          plan_id: raw.plan_id,
          category_id: categoryId,
          activity_number: raw.activity_number.trim(),
          title: raw.title.trim(),
          description: raw.description?.trim() || null,
          planned_budget: plannedBudget,
        })
      ),
      switchMap((activity) => {
        const payload: CreateRealizedCsrPayload = {
          activity_id: activity.id,
          year: Number(raw.year),
          month: Number(raw.month),
          realized_budget: raw.realized_budget != null && raw.realized_budget !== '' ? Number(raw.realized_budget) : null,
          participants: raw.participants != null && raw.participants !== '' ? Number(raw.participants) : null,
          total_hc: raw.total_hc != null && raw.total_hc !== '' ? Number(raw.total_hc) : null,
          volunteer_hours: raw.volunteer_hours != null && raw.volunteer_hours !== '' ? Number(raw.volunteer_hours) : null,
          impact_description: raw.impact_description?.trim() || null,
          organizer: raw.organizer?.trim() || null,
          number_external_partners: raw.number_external_partners != null && raw.number_external_partners !== '' ? Number(raw.number_external_partners) : null,
          realization_date: raw.realization_date?.trim() ? raw.realization_date.substring(0, 10) : null,
          comment: raw.comment?.trim() || null,
          contact_name: raw.contact_name?.trim() || null,
          contact_email: raw.contact_email?.trim() || null,
        };
        return this.realizedApi.create(payload);
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: (created) => {
        const siteId = this.selectedPlan?.site_id;
        const activityId = created?.activity_id;
        if (siteId && activityId && this.selectedFiles.length) {
          this.uploadFiles(siteId, activityId);
        } else {
          this.selectedFiles = [];
        }
        this.created.emit();
        this.closed.emit();
      },
      error: () => {},
    });
  }
}
