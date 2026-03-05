import { Component, inject, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CsrPlansApi, CsrPlanDetail } from '../api/csr-plans-api';
import { CsrActivitiesApi } from '@features/realized-activity-management/api/csr-activities-api';
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
  private activitiesApi = inject(CsrActivitiesApi);
  private authStore = inject(AuthStore);

  plan = signal<CsrPlanDetail | null>(null);
  loading = signal(true);
  errorMsg = signal('');
  actionLoading = signal(false);
  currentYear = new Date().getFullYear();

  /** Plan is "planifié" (current or future year) → show only planned-activity columns. */
  get isPlanPlanned(): boolean {
    const p = this.plan();
    return p ? p.year >= this.currentYear : true;
  }

  // ── Menu 3 points (like document action) ─────────────────────────────────
  showActionMenu = signal(false);
  menuPosition = { top: 0, left: 0 };

  // ── Activity row 3-point menu ───────────────────────────────────────────
  activityMenuId = signal<string | null>(null);
  activityMenuPosition = { top: 0, left: 0 };

  // ── Reject modal ────────────────────────────────────────────────────────
  showRejectModal = signal(false);
  rejectComment = signal('');
  rejectActivityIds = signal<string[]>([]);
  rejectModalError = signal('');

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
    if (mode === '111' && step === 1) return 'En attente validation manager';
    if (mode === '111' && step === 2) return 'En attente validation corporate (finale)';
    if (mode === '101') return 'En attente validation corporate';
    return '';
  }

  /** Status label for display: Brouillon, Soumis, Validé, Verrouillé, Rejeté. */
  statusLabel(s: string): string {
    const m: Record<string, string> = {
      DRAFT: 'Brouillon',
      SUBMITTED: 'Soumis',
      REJECTED: 'Rejeté',
    };
    if (m[s]) return m[s];
    if (s === 'VALIDATED') {
      const p = this.plan();
      const u = p?.unlock_until;
      const open = u ? new Date(u) > new Date() : false;
      return open ? 'Verrouillé' : 'Validé';
    }
    return s ?? '';
  }

  /** True if any activity is marked as added or modified during the last unlock period (show legend). */
  hasUnlockHighlights(): boolean {
    const activities = this.plan()?.activities ?? [];
    return activities.some((a) => a.added_during_unlock || a.modified_during_unlock);
  }

  /** True if plan has unlock_until in the future (open for edit period). */
  isUnlockUntilFuture(): boolean {
    const u = this.plan()?.unlock_until;
    if (!u) return false;
    return new Date(u) > new Date();
  }

  /** True if user can submit the plan for validation (DRAFT or VALIDATED with unlock period). */
  canSubmitForValidation(): boolean {
    const p = this.plan();
    if (!p) return false;
    if (p.status === 'DRAFT') return true;
    if (p.status === 'VALIDATED' && this.isUnlockUntilFuture()) return true;
    return false;
  }

  /** Label for the submit button (differs when re-submitting modifications). */
  submitButtonLabel(): string {
    const p = this.plan();
    if (p?.status === 'VALIDATED' && this.isUnlockUntilFuture()) return 'Soumettre les modifications pour validation';
    return 'Soumettre pour validation';
  }

  /** True if plan can be edited: DRAFT/REJECTED (and not past unlock_until), or VALIDATED with unlock_until in the future. */
  canEditPlan(): boolean {
    const p = this.plan();
    if (!p) return false;
    const u = p.unlock_until;
    const now = new Date();
    const unlockFuture = u ? new Date(u) > now : false;
    if (p.status === 'DRAFT' || p.status === 'REJECTED') {
      if (!u) return true;
      return unlockFuture;
    }
    if (p.status === 'VALIDATED' && unlockFuture) return true;
    return false;
  }

  validationModeLabel(mode: string): string {
    return mode === '111' ? 'ALL' : 'Corporate only';
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
    if (!p || !this.canSubmitForValidation()) return;
    const isResubmit = p.status === 'VALIDATED' && this.isUnlockUntilFuture();
    const msg = isResubmit
      ? 'Soumettre les modifications pour validation ?'
      : 'Soumettre ce plan pour validation ?';
    if (!confirm(msg)) return;
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

  openRejectModal(): void {
    this.rejectComment.set('');
    this.rejectActivityIds.set([]);
    this.rejectModalError.set('');
    this.showRejectModal.set(true);
  }

  closeRejectModal(): void {
    this.showRejectModal.set(false);
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
    const p = this.plan();
    if (!p || p.status !== 'SUBMITTED') return;
    this.rejectModalError.set('');
    this.actionLoading.set(true);
    const activityIds = this.rejectActivityIds();
    this.plansApi.reject(p.id, {
      comment,
      activity_ids: activityIds.length ? activityIds : undefined,
    }).subscribe({
      next: (updated) => {
        this.plan.set({ ...p, ...updated });
        this.actionLoading.set(false);
        this.closeRejectModal();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.rejectModalError.set(err.error?.message || 'Erreur lors du rejet');
      },
    });
  }

  /** Rejected activities to display (id + label). */
  rejectedActivitiesList(): { id: string; label: string }[] {
    const p = this.plan();
    const ids = p?.rejected_activity_ids;
    if (!ids?.length || !p?.activities?.length) return [];
    return ids
      .map((id) => {
        const act = p.activities!.find((a) => a.id === id);
        return act ? { id, label: `${act.activity_number} – ${act.title}` } : null;
      })
      .filter((x): x is { id: string; label: string } => x != null);
  }

  addActivity(): void {
    const p = this.plan();
    if (!p) return;
    const currentYear = new Date().getFullYear();
    if (p.year >= currentYear) {
      this.router.navigate(['/planned-activity/create'], { queryParams: { plan_id: p.id } });
    } else {
      this.router.navigate(['/realized-csr/create'], { queryParams: { plan_id: p.id } });
    }
  }

  toggleActionMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.showActionMenu()) {
      this.showActionMenu.set(false);
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosition = { top: rect.bottom + 4, left: rect.right - 176 };
    this.showActionMenu.set(true);
  }

  closeActionMenu(): void {
    this.showActionMenu.set(false);
  }

  goToEdit(): void {
    const p = this.plan();
    if (p) this.router.navigate(['/csr-plans', p.id, 'edit']);
    this.closeActionMenu();
  }

  goToChangeRequest(planId: string): void {
    this.router.navigate(['/changes/create'], { queryParams: { planId } });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeActionMenu();
    this.closeActivityMenu();
  }

  toggleActivityMenu(event: MouseEvent, activityId: string): void {
    event.stopPropagation();
    if (this.activityMenuId() === activityId) {
      this.activityMenuId.set(null);
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.activityMenuPosition = { top: rect.bottom + 4, left: rect.right - 176 };
    this.activityMenuId.set(activityId);
  }

  closeActivityMenu(): void {
    this.activityMenuId.set(null);
  }

  deletePlan(): void {
    const p = this.plan();
    if (!p || (p.status !== 'DRAFT' && p.status !== 'REJECTED')) return;
    if (!confirm('Supprimer définitivement ce plan et toutes ses activités ?')) return;
    this.actionLoading.set(true);
    this.plansApi.delete(p.id).subscribe({
      next: () => {
        this.router.navigate(['/csr-plans']);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.errorMsg.set(err.error?.message || 'Erreur lors de la suppression');
      },
    });
  }

  back(): void {
    this.router.navigate(['/csr-plans']);
  }

  goToActivityDetail(activityId: string): void {
    this.closeActivityMenu();
    const year = this.plan()?.year;
    this.router.navigate(['/planned-activity', activityId], { queryParams: year != null ? { year } : {} });
  }

  goToEditActivity(activityId: string): void {
    this.closeActivityMenu();
    const year = this.plan()?.year;
    this.router.navigate(['/planned-activity', activityId, 'edit'], { queryParams: year != null ? { year } : {} });
  }

  deleteActivity(activityId: string): void {
    this.closeActivityMenu();
    if (!this.canEditPlan()) return;
    if (!confirm('Supprimer définitivement cette activité ?')) return;
    const planId = this.plan()?.id;
    if (!planId) return;
    this.actionLoading.set(true);
    this.activitiesApi.delete(activityId).subscribe({
      next: () => {
        this.errorMsg.set('');
        this.plansApi.get(planId).subscribe({
          next: (p) => {
            this.plan.set(p);
            this.actionLoading.set(false);
          },
          error: () => this.actionLoading.set(false),
        });
      },
      error: (err: { error?: { message?: string } }) => {
        this.actionLoading.set(false);
        this.errorMsg.set(err.error?.message ?? 'Erreur lors de la suppression');
      },
    });
  }
}
