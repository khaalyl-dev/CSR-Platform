import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RealizedCsrApi } from '../api/realized-csr-api';
import type { RealizedCsr } from '../models/realized-csr.model';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_LABELS: Record<number, string> = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
  7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
};

@Component({
  selector: 'app-realized-edit',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, TranslateModule],
  templateUrl: './realized-edit.html',
})
export class RealizedEditComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private api = inject(RealizedCsrApi);
  private location = inject(Location);

  form!: FormGroup;
  realized: RealizedCsr | null = null;
  loading = false;
  loadingData = true;
  errorMsg = '';
  months = MONTHS;
  monthLabel = (m: number) => MONTH_LABELS[m] ?? String(m);

  ngOnInit(): void {
    this.form = this.fb.group({
      year: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
      month: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
      realized_budget: [null as number | null],
      participants: [null as number | null],
      total_hc: [null as number | null],
      percentage_employees: [null as number | null],
      volunteer_hours: [null as number | null],
      action_impact_actual: [null as number | null],
      action_impact_unit: [''],
      impact_description: [''],
      organizer: [''],
      number_external_partners: [null as number | null],
      realization_date: [''],
      comment: [''],
      contact_department: [''],
      contact_name: [''],
      contact_email: [''],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/realized-csr']);
      return;
    }

    this.api.get(id).subscribe({
      next: (r) => {
        this.realized = r;
        if (r.plan_editable === false) {
          this.errorMsg = 'Le plan est verrouillé. Soumettez une demande de modification pour modifier cette réalisation.';
          this.loadingData = false;
          this.cdr.markForCheck();
          return;
        }
        const rd = r.realization_date ? (r.realization_date as string).substring(0, 10) : '';
        this.form.patchValue({
          year: r.year,
          month: r.month,
          realized_budget: r.realized_budget ?? null,
          participants: r.participants ?? null,
          total_hc: r.total_hc ?? null,
          percentage_employees: r.percentage_employees ?? null,
          volunteer_hours: r.volunteer_hours ?? null,
          action_impact_actual: r.action_impact_actual ?? null,
          action_impact_unit: r.action_impact_unit ?? '',
          impact_description: r.impact_description ?? '',
          organizer: r.organizer ?? '',
          number_external_partners: r.number_external_partners ?? null,
          realization_date: rd,
          comment: r.comment ?? '',
          contact_department: r.contact_department ?? '',
          contact_name: r.contact_name ?? '',
          contact_email: r.contact_email ?? '',
        });
        this.loadingData = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadingData = false;
        this.errorMsg = err.error?.message ?? 'Réalisation introuvable.';
        this.cdr.markForCheck();
      },
    });
  }

  submit(): void {
    if (!this.realized || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.loading = true;
    this.errorMsg = '';
    this.api.update(this.realized.id, {
      year: Number(raw.year),
      month: Number(raw.month),
      realized_budget: raw.realized_budget != null && raw.realized_budget !== '' ? Number(raw.realized_budget) : null,
      participants: raw.participants != null && raw.participants !== '' ? Number(raw.participants) : null,
      total_hc: raw.total_hc != null && raw.total_hc !== '' ? Number(raw.total_hc) : null,
      percentage_employees: raw.percentage_employees != null && raw.percentage_employees !== '' ? Number(raw.percentage_employees) : null,
      volunteer_hours: raw.volunteer_hours != null && raw.volunteer_hours !== '' ? Number(raw.volunteer_hours) : null,
      action_impact_actual: raw.action_impact_actual != null && raw.action_impact_actual !== '' ? Number(raw.action_impact_actual) : null,
      action_impact_unit: raw.action_impact_unit?.trim() || null,
      impact_description: raw.impact_description?.trim() || null,
      organizer: raw.organizer?.trim() || null,
      number_external_partners: raw.number_external_partners != null && raw.number_external_partners !== '' ? Number(raw.number_external_partners) : null,
      realization_date: raw.realization_date?.trim() ? raw.realization_date.substring(0, 10) : null,
      comment: raw.comment?.trim() || null,
      contact_department: raw.contact_department?.trim() || null,
      contact_name: raw.contact_name?.trim() || null,
      contact_email: raw.contact_email?.trim() || null,
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/realized-csr']);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message ?? 'Erreur lors de l\'enregistrement.';
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.location.back();
  }
}
