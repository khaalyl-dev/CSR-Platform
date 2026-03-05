import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ChangeRequestsApi } from '../api/change-requests-api';
import { DocumentsApi } from '@features/file-management/api/documents-api';
import { CsrPlansApi } from '@features/csr-plan-management/api/csr-plans-api';
import type { CsrPlanDetail } from '@features/csr-plan-management/api/csr-plans-api';

@Component({
  selector: 'app-change-request-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './change-request-create.html',
})
export class ChangeRequestCreateComponent implements OnInit {
  private changeRequestsApi = inject(ChangeRequestsApi);
  private documentsApi = inject(DocumentsApi);
  private csrPlansApi = inject(CsrPlansApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  plan = signal<CsrPlanDetail | null>(null);
  loading = signal(true);
  error = signal('');
  reason = signal('');
  requestedDurationDays = signal<number>(30);
  files = signal<File[]>([]);
  dragOver = signal(false);
  submitting = signal(false);

  readonly durationOptions = [7, 14, 30];

  ngOnInit(): void {
    const planId = this.route.snapshot.queryParamMap.get('planId') ?? this.route.snapshot.paramMap.get('planId');
    if (!planId) {
      this.error.set('Identifiant du plan manquant.');
      this.loading.set(false);
      return;
    }
    this.csrPlansApi.get(planId).subscribe({
      next: (p) => {
        if (p.status !== 'VALIDATED') {
          this.error.set('Seuls les plans validés peuvent faire l\'objet d\'une demande de modification.');
        } else {
          this.plan.set(p);
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

  submit(): void {
    const p = this.plan();
    const reason = this.reason().trim();
    if (!p) return;
    if (!reason) {
      this.error.set('Veuillez indiquer la raison de votre demande.');
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    this.changeRequestsApi.create({
      plan_id: p.id,
      reason,
      requested_duration: this.requestedDurationDays(),
    }).subscribe({
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
    const p = this.plan();
    if (p) this.router.navigate(['/csr-plans', p.id]);
    else this.router.navigate(['/csr-plans']);
  }
}
