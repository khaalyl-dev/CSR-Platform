import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CsrActivitiesApi } from '@features/realized-activity-management/api/csr-activities-api';
import { DocumentsApi } from '@features/file-management/api/documents-api';
import type { Document } from '@features/file-management/models/document.model';
import type { PlannedActivityListItem } from '@features/realized-activity-management/api/csr-activities-api';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { PlannedActivityEditComponent } from '../planned-activity-edit/planned-activity-edit';
import { RealizedCreateSidebarComponent } from '@features/realized-activity-management/realized-create-sidebar/realized-create-sidebar';

@Component({
  selector: 'app-planned-activity-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, PlannedActivityEditComponent, RealizedCreateSidebarComponent],
  templateUrl: './planned-activity-detail.html',
})
export class PlannedActivityDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private api = inject(CsrActivitiesApi);
  private documentsApi = inject(DocumentsApi);
  private http = inject(HttpClient);
  private breadcrumb = inject(BreadcrumbService);
  private translate = inject(TranslateService);

  activity = signal<PlannedActivityListItem | null>(null);
  photos = signal<Document[]>([]);
  /** Blob URLs for image photos (so img works with auth). */
  photoBlobUrls = signal<Record<string, string>>({});
  loading = signal(true);
  errorMsg = signal('');
  private currentYear = new Date().getFullYear();
  private blobUrls: string[] = [];
  /** Year from query param (when coming from plan detail) or from loaded activity. */
  planYear = signal<number | null>(null);

  /** True when the activity belongs to a past-year (realized) plan. */
  isPlanRealized(): boolean {
    const y = this.planYear() ?? this.activity()?.year;
    return y != null && y < this.currentYear;
  }

  activityTitle(): string {
    return this.activity()?.title || (this.isPlanRealized() ? this.translate.instant('PLANNED_ACTIVITY_DETAIL.TITLE_REALIZED') : this.translate.instant('PLANNED_ACTIVITY_DETAIL.TITLE_PLANNED'));
  }

  sectionTitle(): string {
    return this.isPlanRealized() ? this.translate.instant('PLANNED_ACTIVITY_DETAIL.SECTION_INFO_REALIZED') : this.translate.instant('PLANNED_ACTIVITY_DETAIL.SECTION_INFO_PLANNED');
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const yearParam = this.route.snapshot.queryParamMap.get('year');
    if (yearParam !== null) {
      const y = parseInt(yearParam, 10);
      if (!isNaN(y)) this.planYear.set(y);
    }
    if (!id) {
      this.router.navigate(['/planned-activities']);
      return;
    }
    this.api.get(id).subscribe({
      next: (data) => {
        this.activity.set(data);
        if (data.year != null) this.planYear.set(data.year);
        this.loading.set(false);
        const siteName = data.site_name ?? data.site_code ?? this.translate.instant('PLANNED_ACTIVITY_DETAIL.ACTIVITY_FALLBACK');
        const title = (data.title ?? '').slice(0, 40) || this.translate.instant('PLANNED_ACTIVITY_DETAIL.TITLE_PLANNED');
        this.breadcrumb.setContext([siteName, String(data.year ?? ''), title]);
        this.documentsApi.listByEntity('ACTIVITY', data.id).subscribe({
          next: (list) => {
            const docs = list ?? [];
            this.photos.set(docs);
            const imageDocs = docs.filter((d) => this.isImageType(d));
            imageDocs.forEach((doc) => {
              const url = this.documentsApi.getServeUrl(doc.file_path);
              this.http.get(url, { responseType: 'blob' }).subscribe({
                next: (blob) => {
                  const blobUrl = URL.createObjectURL(blob);
                  this.blobUrls.push(blobUrl);
                  this.photoBlobUrls.update((m) => ({ ...m, [doc.id]: blobUrl }));
                },
              });
            });
          },
          error: () => {},
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message ?? this.translate.instant('PLANNED_ACTIVITY_DETAIL.NOT_FOUND'));
      },
    });
  }

  isImageType(doc: Document): boolean {
    const t = (doc.file_type || '').toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(t);
  }

  getPhotoUrl(doc: Document): string {
    const urls = this.photoBlobUrls();
    return urls[doc.id] ?? this.documentsApi.getServeUrl(doc.file_path);
  }

  getDownloadUrl(doc: Document): string {
    return this.documentsApi.getDownloadUrl(doc.file_path);
  }

  back(): void {
    this.location.back();
  }

  showEditSidebar = signal(false);

  openEditSidebar(): void {
    this.showEditSidebar.set(true);
  }

  closeEditSidebar(): void {
    this.showEditSidebar.set(false);
  }

  onActivityUpdated(): void {
    this.closeEditSidebar();
    const act = this.activity();
    if (act?.id) {
      this.api.get(act.id).subscribe({
        next: (data) => this.activity.set(data),
      });
    }
  }

  showAddRealizationSidebar = signal(false);

  openAddRealizationSidebar(): void {
    this.showAddRealizationSidebar.set(true);
  }

  closeAddRealizationSidebar(): void {
    this.showAddRealizationSidebar.set(false);
  }

  onRealizationCreated(): void {
    this.closeAddRealizationSidebar();
    this.router.navigate(['/realized-csr']);
  }

  ngOnDestroy(): void {
    this.blobUrls.forEach((u) => URL.revokeObjectURL(u));
    this.breadcrumb.clearContext();
  }
}
