import { Component, EventEmitter, Input, Output, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CsrPlansApi } from '../api/csr-plans-api';
import type { CsrPlan, UpdateCsrPlanPayload } from '../models/csr-plan.model';
import { I18nService } from '@core/services/i18n.service';

@Component({
  selector: 'app-plan-edit-sidebar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './plan-edit-sidebar.html',
})
export class PlanEditSidebarComponent implements OnInit {
  private fb = inject(FormBuilder);
  private csrPlansApi = inject(CsrPlansApi);
  private i18n = inject(I18nService);

  @Input({ required: true }) plan!: CsrPlan;
  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  form!: FormGroup;
  saving = signal(false);
  errorMsg = signal<string>('');

  siteLabel = computed(() => this.plan?.site_name ?? this.plan?.site_code ?? this.plan?.site_id ?? '');

  ngOnInit(): void {
    this.form = this.fb.group({
      year: [this.plan.year, [Validators.required, Validators.min(2000), Validators.max(2100)]],
      validation_mode: [this.plan.validation_mode || '101'],
      total_budget: [this.plan.total_budget ?? null],
    });
  }

  close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMsg.set('');

    const raw = this.form.getRawValue();
    const payload: UpdateCsrPlanPayload = {
      year: Number(raw.year),
      validation_mode: raw.validation_mode === '111' ? '111' : '101',
      total_budget: raw.total_budget != null && raw.total_budget !== '' ? Number(raw.total_budget) : null,
    };

    this.csrPlansApi.update(this.plan.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.updated.emit();
        this.closed.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.message || this.i18n.t('PLAN_EDIT.UPDATE_ERROR'));
      },
    });
  }
}

