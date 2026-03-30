import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuditApi, type AuditLogsParams } from '../api/audit-api';
import type { AuditLog } from '../models/audit-log.model';
import { SitesApi, type Site } from '@features/site-management/api/sites-api';

@Component({
  selector: 'app-audit-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule],
  templateUrl: './audit-list.html',
})
export class AuditListComponent implements OnInit {
  private auditApi = inject(AuditApi);
  private sitesApi = inject(SitesApi);
  private translate = inject(TranslateService);

  logs = signal<AuditLog[]>([]);
  sites = signal<Site[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  filterAction = signal<string>('');
  filterEntityType = signal<string>('');
  filterSiteId = signal<string>('');

  ngOnInit(): void {
    this.sitesApi.list(true).subscribe({
      next: (list) => this.sites.set(list),
      error: () => {},
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const params: AuditLogsParams = { limit: 200 };
    const action = this.filterAction().trim();
    if (action) params.action = action;
    const entityType = this.filterEntityType().trim();
    if (entityType) params.entity_type = entityType;
    const siteId = this.filterSiteId().trim();
    if (siteId) params.site_id = siteId;

    this.auditApi.listLogs(params).subscribe({
      next: (list) => {
        this.logs.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? this.translate.instant('AUDIT_LOG.LOAD_ERROR'));
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.load();
  }

  actionLabel(action: string): string {
    const keyMap: Record<string, string> = {
      CREATE: 'AUDIT_LOG.ACTION_CREATE',
      UPDATE: 'AUDIT_LOG.ACTION_UPDATE',
      DELETE: 'AUDIT_LOG.ACTION_DELETE',
      APPROVE: 'AUDIT_LOG.ACTION_APPROVE',
      REJECT: 'AUDIT_LOG.ACTION_REJECT',
      REQUEST_MODIFICATION: 'AUDIT_LOG.ACTION_REQUEST_MODIFICATION',
    };
    const key = keyMap[action];
    return key ? this.translate.instant(key) : action;
  }

  entityTypeLabel(et: string): string {
    if (et === 'PLAN') return this.translate.instant('AUDIT_LOG.ENTITY_PLAN');
    if (et === 'ACTIVITY') return this.translate.instant('AUDIT_LOG.ENTITY_ACTIVITY');
    if (et === 'REALIZATION') return this.translate.instant('AUDIT_LOG.ENTITY_REALIZATION');
    return et;
  }

  /**
   * Translate audit description when it matches known backend patterns (FR).
   * Falls back to raw description otherwise.
   */
  descriptionLabel(log: AuditLog): string {
    const d = log.description?.trim() ?? '';
    if (!d) return '–';

    // Plan 2019 validé
    const planValidated = d.match(/^Plan (\d+) validé$/);
    if (planValidated) return this.translate.instant('AUDIT_LOG.DESC_PLAN_VALIDATED', { year: planValidated[1] });

    // Création plan X site Y
    const planCreated = d.match(/^Création plan (\d+) site (.+)$/);
    if (planCreated) return this.translate.instant('AUDIT_LOG.DESC_PLAN_CREATED', { year: planCreated[1] });

    // Modification plan X
    const planUpdated = d.match(/^Modification plan (\d+)$/);
    if (planUpdated) return this.translate.instant('AUDIT_LOG.DESC_PLAN_UPDATED', { year: planUpdated[1] });

    // Suppression plan X
    const planDeleted = d.match(/^Suppression plan (\d+)$/);
    if (planDeleted) return this.translate.instant('AUDIT_LOG.DESC_PLAN_DELETED', { year: planDeleted[1] });

    // Validation niveau 1 (Level 1)
    if (d === 'Validation niveau 1 (Level 1)') return this.translate.instant('AUDIT_LOG.DESC_APPROVE_LEVEL1');

    // Plan rejeté: ...
    const planRejected = d.match(/^Plan rejeté:\s*(.+)$/);
    if (planRejected) return this.translate.instant('AUDIT_LOG.DESC_PLAN_REJECTED', { reason: planRejected[1].trim() });

    // Demande de modification plan X: ...
    const changeReq = d.match(/^Demande de modification plan (\d+):\s*(.+)$/);
    if (changeReq) return this.translate.instant('AUDIT_LOG.DESC_CHANGE_REQUEST', { year: changeReq[1], reason: changeReq[2].trim() });

    // Demande de modification approuvée (plan X)
    const changeApprovedPlan = d.match(/^Demande de modification approuvée \(plan (\d+)\)$/);
    if (changeApprovedPlan) return this.translate.instant('AUDIT_LOG.DESC_CHANGE_APPROVED_PLAN', { year: changeApprovedPlan[1] });

    // Demande de modification approuvée
    if (d === 'Demande de modification approuvée') return this.translate.instant('AUDIT_LOG.DESC_CHANGE_APPROVED');

    // Demande de modification rejetée: ...
    const changeRejectedReason = d.match(/^Demande de modification rejetée:\s*(.+)$/);
    if (changeRejectedReason) return this.translate.instant('AUDIT_LOG.DESC_CHANGE_REJECTED_REASON', { reason: changeRejectedReason[1].trim() });

    // Demande de modification rejetée
    if (d === 'Demande de modification rejetée') return this.translate.instant('AUDIT_LOG.DESC_CHANGE_REJECTED');

    // Création activité X / Modification activité X / Suppression activité X
    const activityCreated = d.match(/^Création activité (.+)$/);
    if (activityCreated) return this.translate.instant('AUDIT_LOG.DESC_ACTIVITY_CREATED', { title: activityCreated[1].trim() });
    const activityUpdated = d.match(/^Modification activité (.+)$/);
    if (activityUpdated) return this.translate.instant('AUDIT_LOG.DESC_ACTIVITY_UPDATED', { title: activityUpdated[1].trim() });
    const activityDeleted = d.match(/^Suppression activité (.+)$/);
    if (activityDeleted) return this.translate.instant('AUDIT_LOG.DESC_ACTIVITY_DELETED', { title: activityDeleted[1].trim() });

    const realizationDeleted = d.match(/^Suppression réalisation pour activité (.+)$/);
    if (realizationDeleted) {
      return this.translate.instant('AUDIT_LOG.DESC_REALIZATION_DELETED', { title: realizationDeleted[1].trim() });
    }

    return d;
  }

  entityLink(log: AuditLog): string | null {
    if (!log.entity_id) return null;
    if (log.entity_type === 'PLAN') return `/csr-plans/${log.entity_id}`;
    if (log.entity_type === 'ACTIVITY') return `/planned-activity/${log.entity_id}`;
    if (log.entity_type === 'REALIZATION') return `/planned-activity/${log.entity_id}`;
    return null;
  }
}
