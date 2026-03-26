import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
  requests = signal<ChangeRequestWithDocs[]>([]);
  loading = signal(true);
  actionLoading = signal<string | null>(null);

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

  /** Off-plan or in-plan modification submitted for validation — approve/reject via csr-activities API. */
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

  approve(r: ChangeRequestWithDocs): void {
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
        this.load();
      },
      error: () => {
        this.actionLoading.set(null);
      },
    });
  }

  reject(r: ChangeRequestWithDocs): void {
    const key = this.rowActionKey(r);
    const comment = prompt(this.translate.instant('CHANGE_REQUEST.REJECT_PROMPT'));
    if (comment === null) return;
    if (this.isActivityValidationPendingRow(r)) {
      if (!r.activity_id) return;
      const c = (comment ?? '').trim();
      if (!c) {
        alert(this.translate.instant('CHANGE_REQUEST.REJECT_COMMENT_REQUIRED'));
        return;
      }
      this.actionLoading.set(key);
      this.activitiesApi.rejectOffPlan(r.activity_id, { comment: c }).subscribe({
        next: () => {
          this.actionLoading.set(null);
          this.load();
        },
        error: () => this.actionLoading.set(null),
      });
      return;
    }
    this.actionLoading.set(key);
    this.api.reject(r.id, comment ?? undefined).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.load();
      },
      error: () => {
        this.actionLoading.set(null);
      },
    });
  }
}
