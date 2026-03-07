import { Component, inject, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, finalize, of, switchMap, timeout } from 'rxjs';
import { CsrPlansApi } from '../api/csr-plans-api';
import { CsrActivitiesApi } from '@features/realized-activity-management/api/csr-activities-api';
import { CategoriesApi, CATEGORY_OTHER_VALUE } from '@features/realized-activity-management/api/categories-api';
import { DocumentsApi } from '@features/file-management/api/documents-api';
import type { CsrPlan } from '../models/csr-plan.model';
import type { Category } from '@features/realized-activity-management/api/categories-api';

const LOAD_TIMEOUT_MS = 8000;

@Component({
  selector: 'app-planned-activity-create-sidebar',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, TranslateModule],
  templateUrl: './planned-activity-create-sidebar.html',
})
export class PlannedActivityCreateSidebarComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private plansApi = inject(CsrPlansApi);
  private activitiesApi = inject(CsrActivitiesApi);
  private categoriesApi = inject(CategoriesApi);
  private documentsApi = inject(DocumentsApi);

  @Input() initialPlanId: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  form!: FormGroup;
  plan: CsrPlan | null = null;
  plansForSelection: CsrPlan[] = [];
  categories: Category[] = [];
  selectedPhotoFiles: File[] = [];
  currentYear = new Date().getFullYear();
  loading = false;
  loadingData = true;
  readonly categoryOtherValue = CATEGORY_OTHER_VALUE;

  ngOnInit(): void {
    this.form = this.fb.group({
      plan_id: ['', Validators.required],
      category_id: ['', Validators.required],
      new_category_name: [''],
      activity_number: ['', Validators.required],
      title: ['', Validators.required],
      description: [''],
      planned_budget: [null as number | null],
    });

    this.form.get('plan_id')?.valueChanges.subscribe((id) => this.onPlanSelected(id));
    this.form.get('category_id')?.valueChanges.subscribe(() => this.updateNewCategoryValidators());

    if (this.initialPlanId) {
      this.form.patchValue({ plan_id: this.initialPlanId });
    }

    this.plansApi.list().pipe(
      timeout(LOAD_TIMEOUT_MS),
      catchError(() => of([] as CsrPlan[])),
    ).subscribe({
      next: (list) => {
        this.plansForSelection = (list || [])
          .filter((p) => p.year >= this.currentYear && ['DRAFT', 'REJECTED', 'VALIDATED'].includes(p.status ?? ''))
          .sort((a, b) => b.year - a.year || (a.site_name ?? '').localeCompare(b.site_name ?? ''));
        if (this.initialPlanId) {
          const p = this.plansForSelection.find((x) => x.id === this.initialPlanId);
          if (p) {
            this.plan = p;
            this.form.patchValue({ plan_id: this.initialPlanId }, { emitEvent: false });
          }
        }
        this.loadCategories();
      },
      error: () => {
        this.loadingData = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadCategories(): void {
    this.categoriesApi.list().pipe(
      timeout(LOAD_TIMEOUT_MS),
      catchError(() => of([] as Category[])),
    ).subscribe({
      next: (cats) => {
        this.categories = Array.isArray(cats) ? cats : [];
        this.loadingData = false;
        this.updateNewCategoryValidators();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingData = false;
        this.cdr.markForCheck();
      },
    });
  }

  onPlanSelected(planId: string): void {
    if (!planId) {
      this.plan = null;
      this.cdr.markForCheck();
      return;
    }
    const p = this.plansForSelection.find((x) => x.id === planId) ?? null;
    this.plan = p;
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

  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedPhotoFiles.push(...Array.from(input.files));
      input.value = '';
      this.cdr.markForCheck();
    }
  }

  removePhoto(index: number): void {
    this.selectedPhotoFiles.splice(index, 1);
    this.cdr.markForCheck();
  }

  private uploadActivityPhotos(siteId: string, activityId: string): void {
    if (!this.selectedPhotoFiles.length) return;
    this.selectedPhotoFiles.forEach((file) => {
      const form = new FormData();
      form.append('file', file);
      form.append('site_id', siteId);
      form.append('entity_type', 'ACTIVITY');
      form.append('entity_id', activityId);
      this.documentsApi.upload(form).subscribe({ next: () => {}, error: () => {} });
    });
    this.selectedPhotoFiles = [];
    this.cdr.markForCheck();
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (this.loading || this.form.invalid || !this.plan) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading = true;
    this.cdr.markForCheck();
    const raw = this.form.getRawValue();
    const plannedBudget = raw.planned_budget != null && raw.planned_budget !== '' ? Number(raw.planned_budget) : null;

    const categoryId$ = raw.category_id === CATEGORY_OTHER_VALUE && raw.new_category_name?.trim()
      ? this.categoriesApi.create(raw.new_category_name.trim()).pipe(switchMap((cat) => of(cat.id)))
      : of(raw.category_id);

    categoryId$.pipe(
      switchMap((categoryId) =>
        this.activitiesApi.create({
          plan_id: this.plan!.id,
          category_id: categoryId,
          activity_number: raw.activity_number.trim(),
          title: raw.title.trim(),
          description: raw.description?.trim() || null,
          planned_budget: plannedBudget,
        })
      ),
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: (activity) => {
        const siteId = this.plan?.site_id;
        if (siteId && this.selectedPhotoFiles.length) {
          this.uploadActivityPhotos(siteId, activity.id);
        } else {
          this.selectedPhotoFiles = [];
        }
        this.created.emit();
        this.closed.emit();
      },
      error: () => {},
    });
  }
}
