import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError, of, switchMap, timeout } from 'rxjs';
import { RealizedCsrApi } from '../api/realized-csr-api';
import { CsrActivitiesApi } from '../api/csr-activities-api';
import { CsrPlansApi } from '@features/csr-plan-management/api/csr-plans-api';
import { CategoriesApi } from '../api/categories-api';
import type { CreateRealizedCsrPayload } from '../models/realized-csr.model';
import type { CsrPlan } from '@features/csr-plan-management/models/csr-plan.model';
import type { Category } from '../api/categories-api';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_LABELS: Record<number, string> = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
  7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
};

@Component({
  selector: 'app-realized-create',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './realized-create.html'
})
export class RealizedCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private realizedApi = inject(RealizedCsrApi);
  private activitiesApi = inject(CsrActivitiesApi);
  private plansApi = inject(CsrPlansApi);
  private categoriesApi = inject(CategoriesApi);

  form!: FormGroup;
  plans: CsrPlan[] = [];
  categories: Category[] = [];
  loading = false;
  loadingData = true;
  errorMsg = '';
  /** After a successful create: offer "Add another" or "Back to plan" */
  addAnotherMode = false;
  lastAddedPlanId: string | null = null;
  months = MONTHS;
  monthLabel = (m: number) => MONTH_LABELS[m] ?? String(m);
  currentYear = new Date().getFullYear();

  /** Plan year >= current year = new/planned → csr_activities only. Else = realized → csr_activities + realized_csr */
  isPlanRealized(planYear: number): boolean {
    return planYear < this.currentYear;
  }

  selectedPlanIsRealized(): boolean {
    const pid = this.form.get('plan_id')?.value;
    const p = this.plans.find((x) => x.id === pid);
    return p ? this.isPlanRealized(p.year) : false;
  }

  ngOnInit(): void {
    const now = new Date();
    this.form = this.fb.group({
      // --- Activité (csr_activities) ---
      plan_id: ['', Validators.required],
      category_id: ['', Validators.required],
      activity_number: ['', Validators.required],
      title: ['', Validators.required],
      description: [''],
      planned_budget: [null as number | null],
      // --- Réalisation (realized_csr) ---
      year: [now.getFullYear(), [Validators.min(2000), Validators.max(2100)]],
      month: [now.getMonth() + 1, [Validators.min(1), Validators.max(12)]],
      realized_budget: [null as number | null],
      participants: [null as number | null],
      total_hc: [null as number | null],
      volunteer_hours: [null as number | null],
      impact_description: [''],
      organizer: [''],
      number_external_partners: [null as number | null],
      realization_date: [''],
      comment: [''],
      contact_department: [''],
      contact_name: [''],
      contact_email: [''],
    });

    const planId = this.route.snapshot.queryParamMap.get('plan_id');
    if (planId) {
      this.form.patchValue({ plan_id: planId });
    }

    this.loadData();
  }

  /** True if user filled at least one realization field (so we create realized_csr). */
  hasRealizationData(raw: Record<string, unknown>): boolean {
    const has = (key: string) => {
      const v = raw[key];
      return v != null && v !== '' && String(v).trim() !== '';
    };
    return has('realized_budget') || has('participants') || has('total_hc') || has('volunteer_hours')
      || has('impact_description') || has('organizer') || has('number_external_partners')
      || has('realization_date') || has('comment') || has('contact_department') || has('contact_name') || has('contact_email');
  }

  /** Get year/month for realized_csr: from realization_date if set, else form values. */
  getRealizationYearMonth(raw: Record<string, unknown>): { year: number; month: number } {
    const rd = raw['realization_date'];
    if (rd && typeof rd === 'string' && rd.length >= 10) {
      const y = parseInt(rd.slice(0, 4), 10);
      const m = parseInt(rd.slice(5, 7), 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) return { year: y, month: m };
    }
    const now = new Date();
    const year = raw['year'] != null && raw['year'] !== '' ? Number(raw['year']) : now.getFullYear();
    const month = raw['month'] != null && raw['month'] !== '' ? Number(raw['month']) : now.getMonth() + 1;
    return { year: Number.isInteger(year) ? year : now.getFullYear(), month: (Number.isInteger(month) && month >= 1 && month <= 12) ? month : now.getMonth() + 1 };
  }

  private loadData(): void {
    this.loadingData = true;
    this.errorMsg = '';
    this.cdr.markForCheck();

    this.plansApi.list().pipe(
      timeout(8000),
      catchError(() => of([] as CsrPlan[])),
      switchMap((plans) => {
        this.plans = Array.isArray(plans) ? plans : [];
        return this.categoriesApi.list().pipe(
          timeout(8000),
          catchError(() => of([] as Category[]))
        );
      })
    ).subscribe({
      next: (cats) => {
        this.categories = Array.isArray(cats) ? cats : [];
        this.loadingData = false;
        if (this.plans.length === 0) {
          this.errorMsg = 'Aucun plan CSR disponible. Créez d\'abord un plan.';
        } else if (this.categories.length === 0) {
          this.errorMsg = 'Aucune catégorie CSR disponible.';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingData = false;
        this.errorMsg = 'Impossible de charger les données. Réessayez.';
        this.cdr.markForCheck();
      }
    });
  }

  retryLoadData(): void {
    this.loadData();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMsg = '';
    const raw = this.form.getRawValue();
    const plan = this.plans.find((p) => p.id === raw.plan_id);
    const planYear = plan?.year ?? this.currentYear;
    const planIsRealized = this.isPlanRealized(planYear);
    const wantsRealization = planIsRealized || this.hasRealizationData(raw);
    const { year: realYear, month: realMonth } = this.getRealizationYearMonth(raw);

    this.activitiesApi.create({
      plan_id: raw.plan_id,
      category_id: raw.category_id,
      activity_number: raw.activity_number.trim(),
      title: raw.title.trim(),
      description: raw.description?.trim() || null,
      planned_budget: raw.planned_budget != null && raw.planned_budget !== '' ? Number(raw.planned_budget) : null,
    }).pipe(
      switchMap((activity) => {
        if (!wantsRealization) return of(activity);
        const payload: CreateRealizedCsrPayload = {
          activity_id: activity.id,
          year: realYear,
          month: realMonth,
          realized_budget: raw.realized_budget != null && raw.realized_budget !== '' ? Number(raw.realized_budget) : null,
          participants: raw.participants != null && raw.participants !== '' ? Number(raw.participants) : null,
          total_hc: raw.total_hc != null && raw.total_hc !== '' ? Number(raw.total_hc) : null,
          volunteer_hours: raw.volunteer_hours != null && raw.volunteer_hours !== '' ? Number(raw.volunteer_hours) : null,
          impact_description: raw.impact_description?.trim() || null,
          organizer: raw.organizer?.trim() || null,
          number_external_partners: raw.number_external_partners != null && raw.number_external_partners !== '' ? Number(raw.number_external_partners) : null,
          realization_date: raw.realization_date?.trim() ? raw.realization_date.substring(0, 10) : null,
          comment: raw.comment?.trim() || null,
          contact_department: raw.contact_department?.trim() || null,
          contact_name: raw.contact_name?.trim() || null,
          contact_email: raw.contact_email?.trim() || null,
        };
        return this.realizedApi.create(payload).pipe(switchMap(() => of(activity)));
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        if (raw.plan_id) {
          this.lastAddedPlanId = raw.plan_id;
          this.addAnotherMode = true;
        } else {
          this.router.navigate(['/realized-csr']);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Erreur lors de la création de la réalisation';
        this.cdr.markForCheck();
      },
    });
  }

  /** Reset form to add another activity to the same plan (plan_id kept). */
  addAnotherActivity(): void {
    this.addAnotherMode = false;
    const planId = this.form.get('plan_id')?.value;
    const now = new Date();
    this.form.patchValue({
      category_id: '',
      activity_number: '',
      title: '',
      description: '',
      planned_budget: null,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      realized_budget: null,
      participants: null,
      total_hc: null,
      volunteer_hours: null,
      impact_description: '',
      organizer: '',
      number_external_partners: null,
      realization_date: '',
      comment: '',
      contact_department: '',
      contact_name: '',
      contact_email: '',
    });
    this.form.get('category_id')?.markAsUntouched();
    this.form.get('activity_number')?.markAsUntouched();
    this.form.get('title')?.markAsUntouched();
    this.errorMsg = '';
    if (planId) {
      this.form.patchValue({ plan_id: planId });
    }
    this.cdr.markForCheck();
  }

  /** Go back to plan detail (when coming from a plan). */
  backToPlan(): void {
    const planId = this.lastAddedPlanId ?? this.form.get('plan_id')?.value;
    if (planId) {
      this.router.navigate(['/csr-plans', planId]);
    } else {
      this.router.navigate(['/realized-csr']);
    }
  }

  cancel(): void {
    this.router.navigate(['/realized-csr']);
  }
}
