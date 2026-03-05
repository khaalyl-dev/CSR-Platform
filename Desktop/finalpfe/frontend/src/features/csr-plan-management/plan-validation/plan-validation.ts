import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CsrPlansApi, CsrPlanDetail } from '../api/csr-plans-api';
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

  // Reject modal
  showRejectModal = signal(false);
  planToReject = signal<CsrPlan | null>(null);
  planDetailForReject = signal<CsrPlanDetail | null>(null);
  rejectComment = signal('');
  rejectActivityIds = signal<string[]>([]);
  rejectModalError = signal('');
  rejectModalLoading = signal(false);

  validationStepLabel(plan: CsrPlan): string {
    if (plan.status !== 'SUBMITTED') return '';
    const step = plan.validation_step;
    const mode = plan.validation_mode || '101';
    if (mode === '111' && step === 1) return 'En attente validation manager';
    if (mode === '111' && step === 2) return 'En attente validation corporate (finale)';
    if (mode === '101') return 'En attente validation corporate';
    return '';
  }

  validationModeLabel(mode: string): string {
    return mode === '111' ? 'ALL' : 'Corporate only';
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

  openRejectModal(plan: CsrPlan): void {
    if (plan.status !== 'SUBMITTED' || !plan.can_reject) return;
    this.planToReject.set(plan);
    this.rejectComment.set('');
    this.rejectActivityIds.set([]);
    this.rejectModalError.set('');
    this.showRejectModal.set(true);
    this.rejectModalLoading.set(true);
    this.plansApi.get(plan.id).subscribe({
      next: (detail) => {
        this.planDetailForReject.set(detail);
        this.rejectModalLoading.set(false);
      },
      error: () => {
        this.rejectModalLoading.set(false);
        this.rejectModalError.set('Impossible de charger le détail du plan.');
      },
    });
  }

  closeRejectModal(): void {
    this.showRejectModal.set(false);
    this.planToReject.set(null);
    this.planDetailForReject.set(null);
    this.rejectComment.set('');
    this.rejectActivityIds.set([]);
    this.rejectModalError.set('');
  }

  toggleRejectActivity(activityId: string): void {
    const current = this.rejectActivityIds();
    const idx = current.indexOf(activityId);
    if (idx === -1) {
      this.rejectActivityIds.set([...current, activityId]);
    } else {
      this.rejectActivityIds.set(current.filter((id) => id !== activityId));
    }
  }

  isRejectActivitySelected(activityId: string): boolean {
    return this.rejectActivityIds().includes(activityId);
  }

  submitReject(): void {
    const comment = this.rejectComment().trim();
    if (!comment) {
      this.rejectModalError.set('Le motif de rejet est obligatoire.');
      return;
    }
    const plan = this.planToReject();
    if (!plan) return;
    this.rejectModalError.set('');
    this.actionLoading.set(plan.id);
    const activityIds = this.rejectActivityIds();
    this.plansApi.reject(plan.id, {
      comment,
      activity_ids: activityIds.length ? activityIds : undefined,
    }).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.closeRejectModal();
        this.loadPlans();
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.rejectModalError.set(err.error?.message || 'Erreur lors du rejet');
      },
    });
  }

  backToList(): void {
    window.history.back();
  }
}
