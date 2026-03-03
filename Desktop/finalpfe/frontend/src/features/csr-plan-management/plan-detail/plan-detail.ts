import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CsrPlansApi, CsrPlanDetail } from '../api/csr-plans-api';
import { AuthStore } from '@core/services/auth-store';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './plan-detail.html'
})
export class PlanDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private plansApi = inject(CsrPlansApi);
  private authStore = inject(AuthStore);

  plan = signal<CsrPlanDetail | null>(null);
  loading = signal(true);
  errorMsg = signal('');
  actionLoading = signal(false);

  get canApprove(): boolean {
    return this.plan()?.can_approve ?? false;
  }

  get canReject(): boolean {
    return this.plan()?.can_reject ?? false;
  }

  validationStepLabel(): string {
    const p = this.plan();
    if (!p || p.status !== 'SUBMITTED') return '';
    const step = p.validation_step;
    const mode = p.validation_mode || '101';
    if (mode === '111' && step === 1) return 'En attente validation Level 1';
    if (mode === '111' && step === 2) return 'En attente validation Level 2 (finale)';
    if (mode === '101') return 'En attente validation Level 2';
    return '';
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      DRAFT: 'Brouillon',
      SUBMITTED: 'Soumis',
      VALIDATED: 'Validé',
      REJECTED: 'Rejeté',
      LOCKED: 'Verrouillé',
    };
    return m[s] ?? s;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/csr-plans']);
      return;
    }
    this.plansApi.get(id).subscribe({
      next: (p) => {
        this.plan.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('Plan introuvable');
      },
    });
  }

  submitForValidation(): void {
    const p = this.plan();
    if (!p || p.status !== 'DRAFT') return;
    if (!confirm('Soumettre ce plan pour validation ?')) return;
    this.actionLoading.set(true);
    this.plansApi.submitForValidation(p.id).subscribe({
      next: (updated) => {
        this.plan.set({ ...p, ...updated });
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.errorMsg.set(err.error?.message || 'Erreur lors de la soumission');
      },
    });
  }

  approve(): void {
    const p = this.plan();
    if (!p || p.status !== 'SUBMITTED') return;
    this.actionLoading.set(true);
    this.plansApi.approve(p.id).subscribe({
      next: (updated) => {
        this.plan.set({ ...p, ...updated });
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.errorMsg.set(err.error?.message || 'Erreur');
      },
    });
  }

  reject(): void {
    const p = this.plan();
    if (!p || p.status !== 'SUBMITTED') return;
    const motif = prompt('Motif de rejet (obligatoire) :');
    if (!motif?.trim()) return;
    this.actionLoading.set(true);
    this.plansApi.reject(p.id, motif.trim()).subscribe({
      next: (updated) => {
        this.plan.set({ ...p, ...updated });
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.errorMsg.set(err.error?.message || 'Erreur');
      },
    });
  }

  addActivity(): void {
    const p = this.plan();
    if (p) {
      this.router.navigate(['/realized-csr/create'], { queryParams: { plan_id: p.id } });
    }
  }

  back(): void {
    this.router.navigate(['/csr-plans']);
  }
}
