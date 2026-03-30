import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChangeRequestsApi } from '../api/change-requests-api';
import type { ChangeRequestWithDocs } from '../api/change-requests-api';
import { CsrActivitiesApi } from '@features/planned-activity-management/api/csr-activities-api';
import { UserAvatarNameComponent } from '@shared/components/user-avatar-name/user-avatar-name';

@Component({
  selector: 'app-change-requests-pending',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, UserAvatarNameComponent],
  templateUrl: './change-requests-pending.html',
})
export class ChangeRequestsPendingComponent implements OnInit {
  private api = inject(ChangeRequestsApi);
  private activitiesApi = inject(CsrActivitiesApi);
  private translate = inject(TranslateService);
  private router = inject(Router);

  requests = signal<ChangeRequestWithDocs[]>([]);
  loading = signal(true);
  actionLoading = signal<string | null>(null);

  /** Row targeted by approve / reject flow (same pattern as change-request-detail). */
  pendingActionRow = signal<ChangeRequestWithDocs | null>(null);
  approveConfirmOpen = signal(false);
  rejectModalOpen = signal(false);
  rejectComment = signal('');
  rejectError = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list({ status: 'PENDING' }).subscribe({
      next: (list) => {
        this.requests.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  isOffPlanRow(r: ChangeRequestWithDocs): boolean {
    return r.pending_item_type === 'OFF_PLAN_ACTIVITY';
  }

  isActivityValidationPendingRow(r: ChangeRequestWithDocs): boolean {
    return r.pending_item_type === 'OFF_PLAN_ACTIVITY' || r.pending_item_type === 'IN_PLAN_ACTIVITY_MOD';
  }

  /** Unlock request at site level 1 step (111 / step 1) — reject requires a comment. */
  isUnlockRequestL1Step(r: ChangeRequestWithDocs): boolean {
    const step = r.validation_step;
    return (
      r.pending_item_type === 'CHANGE_REQUEST' &&
      r.validation_mode === '111' &&
      step !== 2 &&
      (step === 1 || step == null)
    );
  }

  /** Decline modal: reason required for activity validation and L1 unlock step only. */
  rejectRowRequiresComment(): boolean {
    const r = this.pendingActionRow();
    if (!r) return false;
    return this.isActivityValidationPendingRow(r) || this.isUnlockRequestL1Step(r);
  }

  rowActionKey(r: ChangeRequestWithDocs): string {
    return r.id;
  }

  planLinkId(r: ChangeRequestWithDocs): string {
    if (this.isOffPlanRow(r) && r.plan_id) return r.plan_id;
    if (r.entity_type === 'ACTIVITY' && r.plan_id) return r.plan_id;
    return r.entity_id ?? '';
  }

  /** Unlock / CR rows with a DB id open change request detail; synthetic activity rows open the plan. */
  onPendingRowClick(r: ChangeRequestWithDocs, event: MouseEvent): void {
    const el = event.target as HTMLElement | null;
    if (el?.closest('button, a')) return;
    if (r.pending_item_type === 'CHANGE_REQUEST' && r.id) {
      void this.router.navigate(['/changes', r.id]);
      return;
    }
    const pid = this.planLinkId(r);
    if (pid) void this.router.navigate(['/csr-plans', pid]);
  }

  openApproveConfirm(r: ChangeRequestWithDocs): void {
    this.pendingActionRow.set(r);
    this.approveConfirmOpen.set(true);
  }

  closeApproveConfirm(): void {
    this.approveConfirmOpen.set(false);
    this.pendingActionRow.set(null);
  }

  confirmApprove(): void {
    const r = this.pendingActionRow();
    if (!r) return;
    this.executeApprove(r, () => this.closeApproveConfirm());
  }

  openRejectModal(r: ChangeRequestWithDocs): void {
    this.pendingActionRow.set(r);
    this.rejectComment.set('');
    this.rejectError.set('');
    this.rejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalOpen.set(false);
    this.rejectComment.set('');
    this.rejectError.set('');
    this.pendingActionRow.set(null);
  }

  confirmReject(): void {
    const r = this.pendingActionRow();
    if (!r) return;
    const c = this.rejectComment().trim();
    if (this.rejectRowRequiresComment()) {
      if (!c) {
        this.rejectError.set(this.translate.instant('CHANGE_REQUEST.REJECT_COMMENT_REQUIRED'));
        return;
      }
    }
    this.rejectError.set('');
    this.executeReject(r, c, () => this.closeRejectModal());
  }

  private executeApprove(r: ChangeRequestWithDocs, onSuccess?: () => void): void {
    const key = this.rowActionKey(r);
    if (this.isActivityValidationPendingRow(r)) {
      if (!r.activity_id) return;
      this.actionLoading.set(key);
      this.activitiesApi.approveOffPlan(r.activity_id).subscribe({
        next: () => {
          this.actionLoading.set(null);
          onSuccess?.();
          this.load();
        },
        error: () => this.actionLoading.set(null),
      });
      return;
    }
    this.actionLoading.set(key);
    this.api.approve(r.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        onSuccess?.();
        this.load();
      },
      error: () => this.actionLoading.set(null),
    });
  }

  private executeReject(r: ChangeRequestWithDocs, comment: string, onSuccess?: () => void): void {
    const key = this.rowActionKey(r);
    if (this.isActivityValidationPendingRow(r)) {
      if (!r.activity_id) return;
      this.actionLoading.set(key);
      this.activitiesApi.rejectOffPlan(r.activity_id, { comment }).subscribe({
        next: () => {
          this.actionLoading.set(null);
          onSuccess?.();
          this.load();
        },
        error: () => this.actionLoading.set(null),
      });
      return;
    }
    this.actionLoading.set(key);
    this.api.reject(r.id, comment || undefined).subscribe({
      next: () => {
        this.actionLoading.set(null);
        onSuccess?.();
        this.load();
      },
      error: () => this.actionLoading.set(null),
    });
  }
}
