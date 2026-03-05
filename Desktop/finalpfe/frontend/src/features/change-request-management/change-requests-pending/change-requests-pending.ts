import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChangeRequestsApi } from '../api/change-requests-api';
import type { ChangeRequestWithDocs } from '../api/change-requests-api';

@Component({
  selector: 'app-change-requests-pending',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './change-requests-pending.html',
})
export class ChangeRequestsPendingComponent implements OnInit {
  private api = inject(ChangeRequestsApi);
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

  approve(id: string): void {
    if (!confirm('Approuver cette demande ? Le plan sera déverrouillé pour modification.')) return;
    this.actionLoading.set(id);
    this.api.approve(id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.load();
      },
      error: (err) => {
        alert(err.error?.message || 'Erreur');
        this.actionLoading.set(null);
      },
    });
  }

  reject(id: string): void {
    const comment = prompt('Motif du rejet (optionnel) :');
    if (comment === null) return;
    this.actionLoading.set(id);
    this.api.reject(id, comment ?? undefined).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.load();
      },
      error: (err) => {
        alert(err.error?.message || 'Erreur');
        this.actionLoading.set(null);
      },
    });
  }
}
