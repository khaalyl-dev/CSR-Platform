import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CsrPlansApi } from '../api/csr-plans-api';
import type { CsrPlan } from '../models/csr-plan.model';

@Component({
  selector: 'app-plan-validation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './plan-validation.html',
})
export class PlanValidationComponent implements OnInit {
  private plansApi = inject(CsrPlansApi);

  plans = signal<CsrPlan[]>([]);
  loading = signal(true);
  errorMsg = signal('');
  actionLoading = signal<string | null>(null);

  validationStepLabel(plan: CsrPlan): string {
    if (plan.status !== 'SUBMITTED') return '';
    const step = plan.validation_step;
    const mode = plan.validation_mode || '101';
    if (mode === '111' && step === 1) return 'En attente validation Level 1';
    if (mode === '111' && step === 2) return 'En attente validation Level 2 (finale)';
    if (mode === '101') return 'En attente validation Level 2';
    return '';
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.errorMsg.set('');
    this.plansApi.list({ status: 'SUBMITTED' }).subscribe({
      next: (data) => {
        this.plans.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('Impossible de charger les plans en attente de validation');
      },
    });
  }

  approve(plan: CsrPlan): void {
    if (plan.status !== 'SUBMITTED' || !plan.can_approve) return;
    this.actionLoading.set(plan.id);
    this.plansApi.approve(plan.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.loadPlans();
      },
      error: (err) => {
        this.actionLoading.set(null);
        alert(err.error?.message || 'Erreur lors de l\'approbation');
      },
    });
  }

  reject(plan: CsrPlan): void {
    if (plan.status !== 'SUBMITTED' || !plan.can_reject) return;
    const motif = prompt('Motif de rejet (obligatoire) :');
    if (!motif?.trim()) return;
    this.actionLoading.set(plan.id);
    this.plansApi.reject(plan.id, motif.trim()).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.loadPlans();
      },
      error: (err) => {
        this.actionLoading.set(null);
        alert(err.error?.message || 'Erreur lors du rejet');
      },
    });
  }

  backToList(): void {
    window.history.back();
  }
}
