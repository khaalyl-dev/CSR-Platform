import { Component, inject, OnInit, Output, EventEmitter, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, finalize, of, switchMap, timeout } from 'rxjs';
import { RealizedCsrApi } from '../api/realized-csr-api';
import { CsrActivitiesApi, type PlannedActivityListItem } from '../api/csr-activities-api';
import { CsrPlansApi } from '@features/csr-plan-management/api/csr-plans-api';
import { DocumentsApi } from '@features/file-management/api/documents-api';
import type { CreateRealizedCsrPayload } from '../models/realized-csr.model';
import type { CsrPlan } from '@features/csr-plan-management/models/csr-plan.model';

const LOAD_TIMEOUT_MS = 8000;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_LABELS: Record<number, string> = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
  7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre',
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
  private documentsApi = inject(DocumentsApi);

  @Input() initialPlanId: string | null = null;
  @Input() initialActivityId: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  form!: FormGroup;
  plans: CsrPlan[] = [];
  editablePlans: CsrPlan[] = [];
  activities: PlannedActivityListItem[] = [];
  currentYear = new Date().getFullYear();
  loading = false;
  loadingData = true;
  months = MONTHS;
  monthLabel = (m: number) => MONTH_LABELS[m] ?? String(m);
  selectedFiles: File[] = [];

  get selectedPlan(): CsrPlan | null {
    const id = this.form.get('plan_id')?.value;
    return this.plans.find((p) => p.id === id) ?? null;
  }

  /** Date de réalisation : uniquement dans l'année civile du plan sélectionné. */
  get realizationDateMin(): string {
    const y = this.selectedPlan?.year ?? this.currentYear;
    return `${y}-01-01`;
  }

  get realizationDateMax(): string {
    const y = this.selectedPlan?.year ?? this.currentYear;
    return `${y}-12-31`;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      plan_id: ['', Validators.required],
      activity_id: ['', Validators.required],
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
        if (this.initialPlanId && !this.editablePlans.some((p) => p.id === this.initialPlanId)) {
          const initial = this.plans.find((p) => p.id === this.initialPlanId);
          if (initial) {
            this.editablePlans = [initial, ...this.editablePlans];
          }
        }
        return of(null);
      }),
      finalize(() => {
        this.loadingData = false;
        if (this.initialPlanId && this.editablePlans.some((p) => p.id === this.initialPlanId)) {
          this.form.patchValue({ plan_id: this.initialPlanId });
          this.onPlanChange(this.initialPlanId);
        }
        this.cdr.markForCheck();
      }),
    ).subscribe();
  }

  private getEditablePlans(plans: CsrPlan[]): CsrPlan[] {
    const currentYear = new Date().getFullYear();
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
    const pl = this.plans.find((p) => p.id === planId);
    if (pl) {
      this.form.patchValue({ year: pl.year });
    }
    this.activitiesApi.list({ plan_id: planId }).pipe(
      timeout(LOAD_TIMEOUT_MS),
      catchError(() => of([])),
    ).subscribe((list) => {
      this.activities = Array.isArray(list) ? list : [];
      if (planId === this.initialPlanId && this.initialActivityId && this.activities.some((a) => a.id === this.initialActivityId)) {
        this.form.patchValue({ activity_id: this.initialActivityId });
      }
      this.cdr.markForCheck();
    });
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
    const planY = this.selectedPlan?.year ?? Number(raw.year);
    let month = Number(raw.month);
    const rd = raw.realization_date?.trim();
    if (rd && rd.length >= 10) {
      const d = new Date(`${rd.slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        month = d.getMonth() + 1;
      }
    }
    const payload: CreateRealizedCsrPayload = {
      activity_id: raw.activity_id,
      year: planY,
      month,
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
}
