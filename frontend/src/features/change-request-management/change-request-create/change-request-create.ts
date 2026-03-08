import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ChangeRequestsApi } from '../api/change-requests-api';
import { DocumentsApi } from '@features/file-management/api/documents-api';
import { CsrPlansApi } from '@features/csr-plan-management/api/csr-plans-api';
import type { CsrPlanDetail } from '@features/csr-plan-management/api/csr-plans-api';

@Component({
  selector: 'app-change-request-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './change-request-create.html',
})
export class ChangeRequestCreateComponent implements OnInit {
  private changeRequestsApi = inject(ChangeRequestsApi);
  private documentsApi = inject(DocumentsApi);
  private csrPlansApi = inject(CsrPlansApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  plan = signal<CsrPlanDetail | null>(null);
  /** When set, this is an activity-level change request. */
  activityId = signal<string | null>(null);
  /** Activity label for display (e.g. "CSR-1 – Title"). */
  activityLabel = signal<string>('');
  loading = signal(true);
  error = signal('');
  reason = signal('');
  requestedDurationDays = signal<number | null>(null);
  durationError = signal('');
  files = signal<File[]>([]);
  dragOver = signal(false);
  submitting = signal(false);

  ngOnInit(): void {
    const planId = this.route.snapshot.queryParamMap.get('planId') ?? this.route.snapshot.paramMap.get('planId');
    const activityId = this.route.snapshot.queryParamMap.get('activityId') ?? null;
    if (!planId) {
      this.error.set('Identifiant du plan manquant.');
      this.loading.set(false);
      return;
    }
    this.activityId.set(activityId);
    this.csrPlansApi.get(planId).subscribe({
      next: (p) => {
        if (p.status !== 'VALIDATED') {
          this.error.set('Seuls les plans validés peuvent faire l\'objet d\'une demande de modification.');
        } else {
          this.plan.set(p);
          if (activityId && p.activities) {
            const act = p.activities.find((a) => a.id === activityId);
            if (act) {
              this.activityLabel.set(`${act.activity_number ?? act.id} – ${act.title ?? ''}`);
            }
          }
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Plan introuvable.');
        this.loading.set(false);
      },
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.files.update((list) => [...list, ...Array.from(input.files!)]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (event.dataTransfer?.files?.length) {
      this.files.update((list) => [...list, ...Array.from(event.dataTransfer!.files)]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  removeFile(index: number): void {
    this.files.update((list) => list.filter((_, i) => i !== index));
  }

  onDurationInput(value: string): void {
    this.durationError.set('');
    const n = value.trim() === '' ? null : parseInt(value, 10);
    if (n !== null && !Number.isNaN(n)) {
      this.requestedDurationDays.set(n);
    } else {
      this.requestedDurationDays.set(null);
    }
  }

  submit(): void {
    const p = this.plan();
    const reason = this.reason().trim();
    const days = this.requestedDurationDays();
    if (!p) return;
    if (!reason) {
      this.error.set('Veuillez indiquer la raison de votre demande.');
      return;
    }
    if (days == null || days < 1 || days > 365) {
      this.durationError.set('La durée est obligatoire (entre 1 et 365 jours).');
      return;
    }
    this.error.set('');
    this.durationError.set('');
    this.submitting.set(true);
    const aid = this.activityId();
    const payload = aid
      ? { activity_id: aid, reason, requested_duration: days }
      : { plan_id: p.id, reason, requested_duration: days };
    this.changeRequestsApi.create(payload).subscribe({
      next: (cr) => {
        const fileList = this.files();
        if (fileList.length === 0) {
          this.submitting.set(false);
          this.router.navigate(['/changes']);
          return;
        }
        const siteId = p.site_id;
        let done = 0;
        const total = fileList.length;
        const onComplete = (): void => {
          done++;
          if (done >= total) {
            this.submitting.set(false);
            this.router.navigate(['/changes']);
          }
        };
        fileList.forEach((file) => {
          const form = new FormData();
          form.append('file', file);
          form.append('site_id', siteId);
          form.append('change_request_id', cr.id);
          this.documentsApi.upload(form).subscribe({
            next: () => onComplete(),
            error: () => onComplete(),
          });
        });
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Erreur lors de la création de la demande.');
        this.submitting.set(false);
      },
    });
  }

  back(): void {
    this.location.back();
  }
}
