import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuditApi, type AuditLogsParams } from '../api/audit-api';
import type { AuditLog } from '../models/audit-log.model';
import { SitesApi, type Site } from '@features/site-management/api/sites-api';

@Component({
  selector: 'app-audit-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './audit-list.html',
})
export class AuditListComponent implements OnInit {
  private auditApi = inject(AuditApi);
  private sitesApi = inject(SitesApi);

  logs = signal<AuditLog[]>([]);
  sites = signal<Site[]>([]);
  loading = signal(true);
  rollbackLoading = signal<string | null>(null);
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
        this.error.set(err?.error?.message ?? 'Erreur lors du chargement');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.load();
  }

  actionLabel(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'Création',
      UPDATE: 'Modification',
      DELETE: 'Suppression',
      APPROVE: 'Approbation',
      REJECT: 'Rejet',
      REQUEST_MODIFICATION: 'Demande de modification',
    };
    return map[action] ?? action;
  }

  entityTypeLabel(et: string): string {
    return et === 'PLAN' ? 'Plan' : et === 'ACTIVITY' ? 'Activité' : et;
  }

  canRollback(log: AuditLog): boolean {
    return !!log.entity_history_id;
  }

  rollback(log: AuditLog): void {
    const id = log.entity_history_id;
    if (!id) return;
    const confirmed = window.confirm(
      'Êtes-vous sûr de vouloir restaurer cette action ? L\'état précédent sera rétabli.'
    );
    if (!confirmed) return;
    this.error.set(null);
    this.rollbackLoading.set(id);
    this.auditApi.rollback(id).subscribe({
      next: () => {
        this.rollbackLoading.set(null);
        this.logs.update((list) => list.filter((l) => l.id !== log.id));
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Erreur lors du rollback');
        this.rollbackLoading.set(null);
      },
    });
  }

  entityLink(log: AuditLog): string | null {
    if (!log.entity_id) return null;
    if (log.entity_type === 'PLAN') return `/csr-plans/${log.entity_id}`;
    if (log.entity_type === 'ACTIVITY') return `/planned-activity/${log.entity_id}`;
    return null;
  }
}
