import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChangeRequestsApi, type ChangeRequestWithDocs } from '../api/change-requests-api';
import { UserAvatarNameComponent } from '@shared/components/user-avatar-name/user-avatar-name';

@Component({
  selector: 'app-change-requests-history',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, UserAvatarNameComponent],
  templateUrl: './change-requests-history.html',
})
export class ChangeRequestsHistoryComponent implements OnInit {
  private api = inject(ChangeRequestsApi);
  private translate = inject(TranslateService);
  requests = signal<ChangeRequestWithDocs[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.requests.set(list.filter((r) => r.status !== 'PENDING'));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  statusLabel(s: string): string {
    const keyMap: Record<string, string> = {
      PENDING: 'CHANGE_REQUEST.STATUS_PENDING',
      APPROVED: 'CHANGE_REQUEST.STATUS_APPROVED',
      REJECTED: 'CHANGE_REQUEST.STATUS_REJECTED',
    };
    const key = keyMap[s];
    return key ? this.translate.instant(key) : s;
  }

  isOffPlanRow(r: ChangeRequestWithDocs): boolean {
    return r.pending_item_type === 'OFF_PLAN_ACTIVITY';
  }

  planDetailId(r: ChangeRequestWithDocs): string {
    if (r.plan_id) return r.plan_id;
    if (r.entity_type === 'PLAN') return r.entity_id;
    return r.entity_id;
  }
}
