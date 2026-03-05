import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ChangeRequestsApi, type ChangeRequestWithDocs } from '../api/change-requests-api';
import { AuthStore } from '@core/services/auth-store';

@Component({
  selector: 'app-change-request-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './change-request-detail.html',
})
export class ChangeRequestDetailComponent implements OnInit {
  private api = inject(ChangeRequestsApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

  request = signal<ChangeRequestWithDocs | null>(null);
  loading = signal(true);
  error = signal('');
  actionLoading = signal(false);

  get isCorporate(): boolean {
    return this.authStore.user()?.role === 'corporate';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/changes']);
      return;
    }
    this.api.get(id).subscribe({
      next: (r) => {
        this.request.set(r);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Demande introuvable.');
        this.loading.set(false);
      },
    });
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = { PENDING: 'En attente', APPROVED: 'Approuvée', REJECTED: 'Rejetée' };
    return map[s] ?? s;
  }

  downloadDocument(filePath: string, fileName?: string): void {
    this.http.get(`/api/documents/download/${filePath}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName ?? filePath.split('/').pop() ?? 'document';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Erreur lors du téléchargement'),
    });
  }

  approve(): void {
    const r = this.request();
    if (!r || r.status !== 'PENDING') return;
    if (!confirm('Approuver cette demande ? Le plan sera déverrouillé pour modification.')) return;
    this.actionLoading.set(true);
    this.api.approve(r.id).subscribe({
      next: (updated) => {
        this.request.set(updated);
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Erreur');
        this.actionLoading.set(false);
      },
    });
  }

  reject(): void {
    const r = this.request();
    if (!r || r.status !== 'PENDING') return;
    const comment = prompt('Motif du rejet (optionnel) :');
    if (comment === null) return;
    this.actionLoading.set(true);
    this.api.reject(r.id, comment ?? undefined).subscribe({
      next: (updated) => {
        this.request.set(updated);
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Erreur');
        this.actionLoading.set(false);
      },
    });
  }

  back(): void {
    if (this.isCorporate) this.router.navigate(['/changes/pending']);
    else this.router.navigate(['/changes']);
  }
}
