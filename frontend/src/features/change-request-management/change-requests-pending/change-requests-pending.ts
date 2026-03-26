import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChangeRequestsApi } from '../api/change-requests-api';
import type { ChangeRequestWithDocs } from '../api/change-requests-api';
import { CsrActivitiesApi } from '@features/realized-activity-management/api/csr-activities-api';

@Component({
  selector: 'app-change-requests-pending',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
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

  showActionsModal = signal(false);
  modalRejectStep = signal(false);
  modalRejectComment = signal('');
  modalRejectError = signal('');
  selectedRequest = signal<ChangeRequestWithDocs | null>(null);

  /** Safe template context when the actions modal is open. */
  modalRow(): ChangeRequestWithDocs | null {
    return this.showActionsModal() ? this.selectedRequest() : null;
  }

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

  rowActionKey(r: ChangeRequestWithDocs): string {
    return r.id;
  }

  planLinkId(r: ChangeRequestWithDocs): string {
    if (this.isOffPlanRow(r) && r.plan_id) return r.plan_id;
    if (r.entity_type === 'ACTIVITY' && r.plan_id) return r.plan_id;
    return r.entity_id ?? '';
  }

  modalContextTitle(r: ChangeRequestWithDocs): string {
    const site = r.plan_site_name ?? r.site_name ?? r.site_id ?? '–';
    const year = r.plan_year ?? r.year ?? '';
    let act = '';
    if (r.activity_number || r.activity_title) {
      act = ` · ${r.activity_number ?? ''} – ${r.activity_title ?? ''}`;
    }
    return `${site} – ${year}${act}`;
  }

  modalTypeLabelKey(r: ChangeRequestWithDocs): string {
    if (this.isOffPlanRow(r)) return 'CHANGE_REQUEST.TYPE_OFF_PLAN';
    if (r.pending_item_type === 'IN_PLAN_ACTIVITY_MOD') return 'CHANGE_REQUEST.TYPE_IN_PLAN_MOD';
    return 'CHANGE_REQUEST.TYPE_CHANGE_REQUEST';
  }

  openActionsModal(r: ChangeRequestWithDocs): void {
    this.selectedRequest.set(r);
    this.modalRejectStep.set(false);
    this.modalRejectComment.set('');
    this.modalRejectError.set('');
    this.showActionsModal.set(true);
  }

  closeActionsModal(): void {
    this.showActionsModal.set(false);
    this.selectedRequest.set(null);
    this.modalRejectStep.set(false);
    this.modalRejectComment.set('');
    this.modalRejectError.set('');
  }

  openFromModal(): void {
    const r = this.selectedRequest();
    if (!r) return;
    this.closeActionsModal();
    if (r.pending_item_type === 'CHANGE_REQUEST' && r.id) {
      void this.router.navigate(['/changes', r.id]);
    } else if (r.plan_id) {
      void this.router.navigate(['/csr-plans', r.plan_id]);
    }
  }

  canOpenFromModal(r: ChangeRequestWithDocs): boolean {
    if (r.pending_item_type === 'CHANGE_REQUEST' && r.id) return true;
    if ((this.isOffPlanRow(r) || r.pending_item_type === 'IN_PLAN_ACTIVITY_MOD') && r.plan_id) return true;
    return false;
  }

  openButtonLabelKey(r: ChangeRequestWithDocs): string {
    if (r.pending_item_type === 'CHANGE_REQUEST' && r.id) return 'CHANGE_REQUEST.DETAILS';
    return 'CHANGE_REQUEST.VIEW_PLAN';
  }

  startModalReject(): void {
    this.modalRejectStep.set(true);
    this.modalRejectComment.set('');
    this.modalRejectError.set('');
  }

  backModalReject(): void {
    this.modalRejectStep.set(false);
    this.modalRejectComment.set('');
    this.modalRejectError.set('');
  }

  approveFromModal(): void {
    const r = this.selectedRequest();
    if (!r) return;
    this.executeApprove(r, () => this.closeActionsModal());
  }

  submitModalReject(): void {
    const r = this.selectedRequest();
    if (!r) return;
    const c = this.modalRejectComment().trim();
    if (this.isActivityValidationPendingRow(r)) {
      if (!c) {
        this.modalRejectError.set(this.translate.instant('CHANGE_REQUEST.REJECT_COMMENT_REQUIRED'));
        return;
      }
    }
    this.modalRejectError.set('');
    this.executeReject(r, c, () => this.closeActionsModal());
  }

  private executeApprove(r: ChangeRequestWithDocs, onSuccess?: () => void): void {
    const key = this.rowActionKey(r);
    if (this.isActivityValidationPendingRow(r)) {
      if (!r.activity_id) return;
      const confirmKey =
        r.pending_item_type === 'IN_PLAN_ACTIVITY_MOD'
          ? 'CHANGE_REQUEST.CONFIRM_APPROVE_IN_PLAN_MOD'
          : 'CHANGE_REQUEST.CONFIRM_APPROVE_OFF_PLAN';
      if (!confirm(this.translate.instant(confirmKey))) return;
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
    if (!confirm(this.translate.instant('CHANGE_REQUEST.CONFIRM_APPROVE'))) return;
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
