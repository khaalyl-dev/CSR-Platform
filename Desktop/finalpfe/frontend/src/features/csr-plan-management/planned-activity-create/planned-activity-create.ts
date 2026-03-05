import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, timeout } from 'rxjs';
import { CsrPlansApi } from '../api/csr-plans-api';
import { CsrActivitiesApi } from '@features/realized-activity-management/api/csr-activities-api';
import { CategoriesApi, CATEGORY_OTHER_VALUE } from '@features/realized-activity-management/api/categories-api';
import type { CsrPlan } from '../models/csr-plan.model';
import type { Category } from '@features/realized-activity-management/api/categories-api';

/**
 * Add a planned activity only (for current or future year plans).
 * User inputs only the data needed for planning: category, number, title, description, estimated budget.
 */
@Component({
  selector: 'app-planned-activity-create',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './planned-activity-create.html',
})
export class PlannedActivityCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private plansApi = inject(CsrPlansApi);
  private activitiesApi = inject(CsrActivitiesApi);
  private categoriesApi = inject(CategoriesApi);

  form!: FormGroup;
  plan = null as CsrPlan | null;
  /** Plans with year >= current year, for dropdown when no plan_id in URL */
  plansForSelection: CsrPlan[] = [];
  currentYear = new Date().getFullYear();
  categories: Category[] = [];
  loading = false;
  loadingData = true;
  errorMsg = '';
  addAnotherMode = false;
  /** After saving as draft, id of the created activity (to offer "Compléter maintenant"). */
  draftSavedId: string | null = null;
  readonly categoryOtherValue = CATEGORY_OTHER_VALUE;

  ngOnInit(): void {
    this.form = this.fb.group({
      plan_id: [''],
      category_id: ['', Validators.required],
      new_category_name: [''],
      activity_number: ['', Validators.required],
      title: ['', Validators.required],
      description: [''],
      planned_budget: [null as number | null],
    });

    const planIdFromUrl = this.route.snapshot.queryParamMap.get('plan_id');
    if (planIdFromUrl) {
      this.form.patchValue({ plan_id: planIdFromUrl });
      this.loadPlanAndCategories(planIdFromUrl);
      return;
    }

    this.plansApi.list({ status: 'VALIDATED' }).pipe(
      timeout(8000),
      catchError(() => of([] as CsrPlan[])),
    ).subscribe({
      next: (list) => {
        this.plansForSelection = (list || [])
          .filter((p) => p.year >= this.currentYear && p.status === 'VALIDATED')
          .sort((a, b) => b.year - a.year || (a.site_name ?? '').localeCompare(b.site_name ?? ''));
        this.loadCategories();
      },
      error: () => {
        this.loadingData = false;
        this.errorMsg = 'Impossible de charger la liste des plans.';
        this.cdr.markForCheck();
      },
    });
  }

  private loadPlanAndCategories(planId: string): void {
    this.plan = null;
    this.loadingData = true;
    this.errorMsg = '';
    this.plansApi.get(planId).pipe(
      timeout(8000),
      catchError(() => of(null)),
    ).subscribe({
      next: (p) => {
        this.plan = p;
        if (!p) {
          this.errorMsg = 'Plan introuvable.';
          this.loadingData = false;
          this.cdr.markForCheck();
          return;
        }
        if (p.year < this.currentYear) {
          this.errorMsg = 'Ce plan est pour une année passée. Utilisez "Activité et réalisation" pour saisir les données réalisées.';
          this.loadingData = false;
          this.cdr.markForCheck();
          return;
        }
        if (p.status !== 'VALIDATED') {
          this.errorMsg = 'Seuls les plans validés peuvent recevoir des activités planifiées.';
          this.loadingData = false;
          this.cdr.markForCheck();
          return;
        }
        this.loadCategories();
      },
      error: () => {
        this.errorMsg = 'Impossible de charger le plan.';
        this.loadingData = false;
        this.cdr.markForCheck();
      },
    });
  }

  onPlanSelected(planId: string): void {
    this.form.patchValue({ plan_id: planId || '' });
    if (!planId) {
      this.plan = null;
      this.cdr.markForCheck();
      return;
    }
    this.loadPlanAndCategories(planId);
  }

  private loadCategories(): void {
    this.categoriesApi.list().pipe(
      timeout(8000),
      catchError(() => of([] as Category[])),
    ).subscribe({
      next: (cats) => {
        this.categories = Array.isArray(cats) ? cats : [];
        this.loadingData = false;
        this.form.get('category_id')?.valueChanges.subscribe(() => this.updateNewCategoryValidators());
        this.updateNewCategoryValidators();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingData = false;
        this.errorMsg = 'Impossible de charger les catégories.';
        this.cdr.markForCheck();
      },
    });
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
    this.cdr.markForCheck();
  }

  submit(): void {
    if (!this.plan || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const plannedBudget = raw.planned_budget != null && raw.planned_budget !== '' ? Number(raw.planned_budget) : null;

    const categoryId$ = raw.category_id === CATEGORY_OTHER_VALUE && raw.new_category_name?.trim()
      ? this.categoriesApi.create(raw.new_category_name.trim()).pipe(switchMap((cat) => of(cat.id)))
      : of(raw.category_id);

    this.loading = true;
    this.errorMsg = '';
    this.draftSavedId = null;
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
    ).subscribe({
      next: () => {
        this.loading = false;
        this.addAnotherMode = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Erreur lors de la création de l\'activité.';
        this.cdr.markForCheck();
      },
    });
  }

  saveAsDraft(): void {
    if (!this.plan) return;
    const title = this.form.get('title')?.value?.toString()?.trim();
    if (!title) {
      this.form.get('title')?.markAsTouched();
      this.form.get('title')?.setErrors({ required: true });
      this.cdr.markForCheck();
      return;
    }
    const raw = this.form.getRawValue();
    const plannedBudget = raw.planned_budget != null && raw.planned_budget !== '' ? Number(raw.planned_budget) : null;
    let categoryId: string | undefined = raw.category_id && raw.category_id !== this.categoryOtherValue ? raw.category_id : undefined;
    if (raw.category_id === this.categoryOtherValue && raw.new_category_name?.trim()) {
      this.loading = true;
      this.errorMsg = '';
      this.draftSavedId = null;
      this.categoriesApi.create(raw.new_category_name.trim()).pipe(
        switchMap((cat) =>
          this.activitiesApi.create({
            plan_id: this.plan!.id,
            title,
            draft: true,
            category_id: cat.id,
            activity_number: raw.activity_number?.trim() || undefined,
            description: raw.description?.trim() || null,
            planned_budget: plannedBudget,
          })
        ),
      ).subscribe({
        next: (activity) => {
          this.loading = false;
          this.draftSavedId = activity.id;
          this.addAnotherMode = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = err.error?.message || 'Erreur lors de l\'enregistrement du brouillon.';
          this.cdr.markForCheck();
        },
      });
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    this.draftSavedId = null;
    this.activitiesApi.create({
      plan_id: this.plan!.id,
      title,
      draft: true,
      category_id: categoryId,
      activity_number: raw.activity_number?.trim() || undefined,
      description: raw.description?.trim() || null,
      planned_budget: plannedBudget,
    }).subscribe({
      next: (activity) => {
        this.loading = false;
        this.draftSavedId = activity.id;
        this.addAnotherMode = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Erreur lors de l\'enregistrement du brouillon.';
        this.cdr.markForCheck();
      },
    });
  }

  completeDraft(): void {
    if (this.draftSavedId) this.router.navigate(['/planned-activity', this.draftSavedId, 'edit']);
  }

  addAnother(): void {
    this.addAnotherMode = false;
    this.draftSavedId = null;
    this.form.patchValue({
      category_id: '',
      new_category_name: '',
      activity_number: '',
      title: '',
      description: '',
      planned_budget: null,
    });
    this.form.markAsUntouched();
    this.errorMsg = '';
    this.cdr.markForCheck();
  }

  backToPlan(): void {
    if (this.plan) this.router.navigate(['/csr-plans', this.plan.id]);
    else this.router.navigate(['/csr-plans']);
  }

  cancel(): void {
    if (this.plan) this.router.navigate(['/csr-plans', this.plan.id]);
    else this.router.navigate(['/csr-plans']);
  }
}
