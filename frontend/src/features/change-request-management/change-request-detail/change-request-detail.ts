import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChangeRequestsApi, type ChangeRequestWithDocs } from '../api/change-requests-api';
import { AuthStore } from '@core/services/auth-store';
import { UserAvatarNameComponent } from '@shared/components/user-avatar-name/user-avatar-name';

@Component({
  selector: 'app-change-request-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, UserAvatarNameComponent],
  templateUrl: './change-request-detail.html',
})
export class ChangeRequestDetailComponent implements OnInit, OnDestroy {
  private api = inject(ChangeRequestsApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private sanitizer = inject(DomSanitizer);
  private translate = inject(TranslateService);

  request = signal<ChangeRequestWithDocs | null>(null);
  loading = signal(true);
  error = signal('');
  actionLoading = signal(false);
  /** Document preview modal: doc info + blob URL for display */
  previewDoc = signal<{ file_path: string; file_name: string; file_type?: string } | null>(null);
  previewBlobUrl = signal<string | null>(null);
  /** Sanitized URL for PDF iframe (Angular blocks raw blob in iframe) */
  previewSafeUrl = signal<SafeResourceUrl | null>(null);
  previewLoading = signal(false);
  /** Reject: styled modal (same pattern as pending list) instead of browser prompt */
  rejectModalOpen = signal(false);
  rejectComment = signal('');
  rejectSubmitError = signal('');
  /** Approve: confirmation modal instead of browser confirm */
  approveConfirmOpen = signal(false);

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

  /** Plan ID for the "View plan" link (entity_id for PLAN, plan_id for ACTIVITY). */
  planIdForLink(): string | null {
    const r = this.request();
    if (!r) return null;
    const withExt = r as ChangeRequestWithDocs;
    return (r.entity_type === 'ACTIVITY' && withExt.plan_id) ? withExt.plan_id : (r.entity_id ?? null);
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

  /** Site L1 step (111, not yet corporate): API requires rejection comment. Corporate final reject does not. */
  rejectRequiresComment(): boolean {
    const r = this.request();
    if (!r || r.status !== 'PENDING') return false;
    const vm = String(r.validation_mode ?? '').trim();
    const step = r.validation_step;
    return vm === '111' && step !== 2;
  }

  /** Unlock request validation path (101 / 111); same wording as create form. */
  validationModeLabel(): string {
    const r = this.request();
    if (!r) return '–';
    const m = String(r.validation_mode ?? '').trim();
    if (m === '101') return this.translate.instant('CHANGE_REQUEST.UNLOCK_MODE_CORPORATE_ONLY');
    if (m === '111') return this.translate.instant('CHANGE_REQUEST.UNLOCK_MODE_SITE_THEN_CORPORATE');
    return m || '–';
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

  isPreviewableType(d: { file_name: string; file_type?: string }): boolean {
    const t = (d.file_type ?? '').toLowerCase();
    const ext = (d.file_name ?? '').split('.').pop()?.toLowerCase() ?? '';
    const previewable = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
    return previewable.includes(t) || previewable.includes(ext);
  }

  isPdf(d: { file_name: string; file_type?: string }): boolean {
    const t = (d.file_type ?? '').toLowerCase();
    const ext = (d.file_name ?? '').split('.').pop()?.toLowerCase() ?? '';
    return t === 'pdf' || ext === 'pdf';
  }

  isImage(d: { file_name: string; file_type?: string }): boolean {
    const t = (d.file_type ?? '').toLowerCase();
    const ext = (d.file_name ?? '').split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(t) || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  }

  openPreview(d: { file_path: string; file_name: string; file_type?: string }): void {
    if (!this.isPreviewableType(d)) return;
    this.previewDoc.set(d);
    this.previewBlobUrl.set(null);
    this.previewSafeUrl.set(null);
    this.previewLoading.set(true);
    this.http.get(`/api/documents/serve/${d.file_path}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        this.previewBlobUrl.set(url);
        this.previewSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewLoading.set(false);
        this.error.set('Impossible de charger l\'aperçu.');
      },
    });
  }

  closePreview(): void {
    const url = this.previewBlobUrl();
    if (url) window.URL.revokeObjectURL(url);
    this.previewDoc.set(null);
    this.previewBlobUrl.set(null);
    this.previewSafeUrl.set(null);
  }

  openApproveConfirm(): void {
    const r = this.request();
    if (!r || r.status !== 'PENDING') return;
    this.approveConfirmOpen.set(true);
  }

  closeApproveConfirm(): void {
    this.approveConfirmOpen.set(false);
  }

  confirmApprove(): void {
    const r = this.request();
    if (!r || r.status !== 'PENDING') return;
    this.actionLoading.set(true);
    this.api.approve(r.id).subscribe({
      next: (updated) => {
        this.request.set(updated);
        this.actionLoading.set(false);
        this.approveConfirmOpen.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Erreur');
        this.actionLoading.set(false);
      },
    });
  }

  openRejectModal(): void {
    const r = this.request();
    if (!r || r.status !== 'PENDING') return;
    this.rejectComment.set('');
    this.rejectSubmitError.set('');
    this.rejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalOpen.set(false);
    this.rejectComment.set('');
    this.rejectSubmitError.set('');
  }

  confirmReject(): void {
    const r = this.request();
    if (!r || r.status !== 'PENDING') return;
    const comment = this.rejectComment().trim();
    if (this.rejectRequiresComment() && !comment) {
      this.rejectSubmitError.set(this.translate.instant('CHANGE_REQUEST.REJECT_COMMENT_REQUIRED'));
      return;
    }
    this.rejectSubmitError.set('');
    this.actionLoading.set(true);
    this.api.reject(r.id, comment || undefined).subscribe({
      next: (updated) => {
        this.request.set(updated);
        this.actionLoading.set(false);
        this.closeRejectModal();
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Erreur');
        this.actionLoading.set(false);
      },
    });
  }

  back(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    this.closePreview();
  }
}
