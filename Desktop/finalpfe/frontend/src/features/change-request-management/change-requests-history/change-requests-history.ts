import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChangeRequestsApi, type ChangeRequestWithDocs } from '../api/change-requests-api';

@Component({
  selector: 'app-change-requests-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './change-requests-history.html',
})
export class ChangeRequestsHistoryComponent implements OnInit {
  private api = inject(ChangeRequestsApi);
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
    const map: Record<string, string> = { PENDING: 'En attente', APPROVED: 'Approuvée', REJECTED: 'Rejetée' };
    return map[s] ?? s;
  }
}
