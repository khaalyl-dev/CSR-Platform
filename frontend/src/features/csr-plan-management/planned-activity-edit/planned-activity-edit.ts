import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of, switchMap, timeout } from 'rxjs';
import { CsrActivitiesApi } from '@features/realized-activity-management/api/csr-activities-api';
import { CategoriesApi, CATEGORY_OTHER_VALUE } from '@features/realized-activity-management/api/categories-api';
import { RealizedCsrApi } from '@features/realized-activity-management/api/realized-csr-api';
import { HttpClient } from '@angular/common/http';
import { DocumentsApi } from '@features/file-management/api/documents-api';
import type { Document } from '@features/file-management/models/document.model';
import type { PlannedActivityListItem } from '@features/realized-activity-management/api/csr-activities-api';
import type { Category } from '@features/realized-activity-management/api/categories-api';
import type { RealizedCsr } from '@features/realized-activity-management/models/realized-csr.model';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_LABELS: Record<number, string> = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
  7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
};

@Component({
  selector: 'app-planned-activity-edit',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, TranslateModule],
  templateUrl: './planned-activity-edit.html',
})
export class PlannedActivityEditComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private activitiesApi = inject(CsrActivitiesApi);
  private categoriesApi = inject(CategoriesApi);
  private realizedApi = inject(RealizedCsrApi);
  private documentsApi = inject(DocumentsApi);
  private http = inject(HttpClient);
  private location = inject(Location);
  private translate = inject(TranslateService);

  form!: FormGroup;
  /** Photos linked to this activity. */
  activityPhotos: Document[] = [];
  /** Blob URLs for image thumbnails (auth). */
  photoBlobUrls: Record<string, string> = {};
  private blobUrlsToRevoke: string[] = [];
  uploadingPhotos = false;
  /** When isPlanRealized: form for first realization (or new). */
  realizedForm!: FormGroup;
  activity = null as PlannedActivityListItem | null;
  /** First realization for this activity when isPlanRealized (null if none yet). */
  firstRealization: RealizedCsr | null = null;
  categories: Category[] = [];
  loading = false;
  loadingData = true;
  errorMsg = '';
  readonly categoryOtherValue = CATEGORY_OTHER_VALUE;
  readonly months = MONTHS;
  monthLabel = (m: number) => MONTH_LABELS[m] ?? String(m);
  private currentYear = new Date().getFullYear();
  /** Year from query param (when coming from plan detail) or from loaded activity. */
  planYear: number | null = null;

  /** True when the activity belongs to a past-year (realized) plan. */
  get isPlanRealized(): boolean {
    const y = this.planYear ?? this.activity?.year;
    return y != null && y < this.currentYear;
  }

  get pageTitle(): string {
    const key = this.isPlanRealized ? 'PLANNED_ACTIVITY_EDIT.PAGE_TITLE_REALIZED' : 'PLANNED_ACTIVITY_EDIT.PAGE_TITLE_PLANNED';
    return this.translate.instant(key);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      category_id: ['', Validators.required],
      new_category_name: [''],
      activity_number: ['', Validators.required],
      title: ['', Validators.required],
      description: [''],
      planned_budget: [null as number | null],
      organization: ['INTERNAL'],
      collaboration_nature: [''],
      organizer: [''],
      planned_volunteers: [null as number | null],
      action_impact_target: [null as number | null],
      action_impact_unit: [''],
    });
    this.realizedForm = this.fb.group({
      year: [this.planYear ?? new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
      month: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
      realized_budget: [null as number | null],
      participants: [null as number | null],
      action_impact_actual: [null as number | null],
      action_impact_unit: [''],
      organizer: [''],
    });

    const id = this.route.snapshot.paramMap.get('id');
    const yearParam = this.route.snapshot.queryParamMap.get('year');
    if (yearParam !== null) {
      const y = parseInt(yearParam, 10);
      if (!isNaN(y)) this.planYear = y;
    }
    if (!id) {
      this.router.navigate(['/planned-activities']);
      return;
    }

    this.activitiesApi.get(id).pipe(
      timeout(8000),
      catchError(() => of(null)),
    ).subscribe({
      next: (a) => {
        this.activity = a;
        if (a?.year != null) this.planYear = a.year;
        if (!a) {
          this.errorMsg = 'Activité introuvable.';
          this.loadingData = false;
          this.cdr.markForCheck();
          return;
        }
        if ((a as PlannedActivityListItem).plan_editable === false) {
          this.router.navigate(['/planned-activity', a.id], { queryParams: { locked: '1' } });
          return;
        }
        this.form.patchValue({
          category_id: a.category_id ?? '',
          activity_number: a.activity_number ?? '',
          title: a.title ?? '',
          description: a.description ?? '',
          planned_budget: a.planned_budget ?? null,
          organization: a.organization ?? 'INTERNAL',
          collaboration_nature: a.collaboration_nature ?? '',
          organizer: a.organizer ?? '',
          planned_volunteers: a.planned_volunteers ?? null,
          action_impact_target: a.action_impact_target ?? null,
          action_impact_unit: a.action_impact_unit ?? '',
        });
        this.loadCategories();
        if (this.isPlanRealized && a.id) this.loadFirstRealization(a.id);
        this.loadActivityPhotos(a.id);
      },
      error: () => {
        this.errorMsg = 'Impossible de charger l\'activité.';
        this.loadingData = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadFirstRealization(activityId: string): void {
    this.realizedApi.list({ activity_id: activityId }).pipe(
      timeout(5000),
      catchError(() => of([] as RealizedCsr[])),
    ).subscribe({
      next: (list) => {
        const first = list.length ? list[0] : null;
        this.firstRealization = first ?? null;
        if (first) {
          this.realizedForm.patchValue({
            year: first.year,
            month: first.month,
            realized_budget: first.realized_budget ?? null,
            participants: first.participants ?? null,
            action_impact_actual: first.action_impact_actual ?? null,
            action_impact_unit: first.action_impact_unit ?? '',
            organizer: first.organizer ?? '',
          });
        } else if (this.planYear != null) {
          this.realizedForm.patchValue({ year: this.planYear, month: 1 });
        }
        this.cdr.markForCheck();
      },
    });
  }

  private loadActivityPhotos(activityId: string): void {
    this.documentsApi.listByEntity('ACTIVITY', activityId).pipe(
      catchError(() => of([] as Document[])),
    ).subscribe({
      next: (list) => {
        this.activityPhotos = list ?? [];
        this.activityPhotos.filter((d) => this.isImageType(d)).forEach((doc) => {
          const url = this.documentsApi.getServeUrl(doc.file_path);
          this.http.get(url, { responseType: 'blob' }).subscribe({
            next: (blob) => {
              const blobUrl = URL.createObjectURL(blob);
              this.blobUrlsToRevoke.push(blobUrl);
              this.photoBlobUrls = { ...this.photoBlobUrls, [doc.id]: blobUrl };
              this.cdr.markForCheck();
            },
          });
        });
        this.cdr.markForCheck();
      },
    });
  }

  onPhotoFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length || !this.activity?.id) return;
    const siteId = (this.activity as PlannedActivityListItem).site_id;
    if (!siteId) return;
    this.uploadingPhotos = true;
    this.cdr.markForCheck();
    let done = 0;
    const total = files.length;
    Array.from(files).forEach((file) => {
      const form = new FormData();
      form.append('file', file);
      form.append('site_id', siteId);
      form.append('entity_type', 'ACTIVITY');
      form.append('entity_id', this.activity!.id);
      this.documentsApi.upload(form).subscribe({
        next: (doc) => {
          this.activityPhotos = [...this.activityPhotos, doc];
          done++;
          if (done === total) {
            this.uploadingPhotos = false;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          done++;
          if (done === total) {
            this.uploadingPhotos = false;
            this.cdr.markForCheck();
          }
        },
      });
    });
    input.value = '';
  }

  deletePhoto(doc: Document): void {
    this.documentsApi.deleteDocument(doc.id).subscribe({
      next: () => {
        this.activityPhotos = this.activityPhotos.filter((d) => d.id !== doc.id);
        this.cdr.markForCheck();
      },
    });
  }

  isImageType(doc: Document): boolean {
    const t = (doc.file_type || '').toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(t);
  }

  getPhotoUrl(doc: Document): string {
    return this.photoBlobUrls[doc.id] ?? this.documentsApi.getServeUrl(doc.file_path);
  }

  getDownloadUrl(doc: Document): string {
    return this.documentsApi.getDownloadUrl(doc.file_path);
  }

  private loadCategories(): void {
    this.categoriesApi.list().pipe(
      timeout(8000),
      catchError(() => of([] as Category[])),
    ).subscribe({
      next: (cats) => {
        this.categories = Array.isArray(cats) ? cats : [];
        this.loadingData = false;
        this.form.get('category_id')?.valueChanges.subscribe(() => this.updateNewCategoryValidators());
        this.updateNewCategoryValidators();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingData = false;
        this.errorMsg = 'Impossible de charger les catégories.';
        this.cdr.markForCheck();
      },
    });
  }

  isOtherCategorySelected(): boolean {
    return this.form.get('category_id')?.value === CATEGORY_OTHER_VALUE;
  }

  private updateNewCategoryValidators(): void {
    const ctrl = this.form.get('new_category_name');
    if (this.isOtherCategorySelected()) {
      ctrl?.setValidators([Validators.required, Validators.minLength(2)]);
    } else {
      ctrl?.clearValidators();
      ctrl?.setValue('');
    }
    ctrl?.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  submit(): void {
    if (!this.activity || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isPlanRealized && this.realizedForm.invalid) {
      this.realizedForm.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const plannedBudget = raw.planned_budget != null && raw.planned_budget !== '' ? Number(raw.planned_budget) : null;
    const plannedVolunteers = raw.planned_volunteers != null && raw.planned_volunteers !== '' ? Number(raw.planned_volunteers) : null;
    const actionImpactTarget = raw.action_impact_target != null && raw.action_impact_target !== '' ? Number(raw.action_impact_target) : null;

    const categoryId$ = raw.category_id === CATEGORY_OTHER_VALUE && raw.new_category_name?.trim()
      ? this.categoriesApi.create(raw.new_category_name.trim()).pipe(switchMap((cat) => of(cat.id)))
      : of(raw.category_id);

    this.loading = true;
    this.errorMsg = '';
    categoryId$.pipe(
      switchMap((categoryId) =>
        this.activitiesApi.update(this.activity!.id, {
          category_id: categoryId,
          activity_number: raw.activity_number.trim(),
          title: raw.title.trim(),
          description: raw.description?.trim() || null,
          planned_budget: plannedBudget,
          organization: raw.organization?.trim() || null,
          collaboration_nature: raw.collaboration_nature?.trim() || null,
          organizer: raw.organizer?.trim() || null,
          planned_volunteers: plannedVolunteers,
          action_impact_target: actionImpactTarget,
          action_impact_unit: raw.action_impact_unit?.trim() || null,
        })
      ),
      switchMap(() => {
        if (!this.isPlanRealized) return of(null);
        const r = this.realizedForm.getRawValue();
        const year = Number(r.year);
        const month = Number(r.month);
        const payload = {
          year,
          month,
          realized_budget: r.realized_budget != null && r.realized_budget !== '' ? Number(r.realized_budget) : null,
          participants: r.participants != null && r.participants !== '' ? Number(r.participants) : null,
          action_impact_actual: r.action_impact_actual != null && r.action_impact_actual !== '' ? Number(r.action_impact_actual) : null,
          action_impact_unit: r.action_impact_unit?.trim() || null,
          organizer: r.organizer?.trim() || null,
        };
        if (this.firstRealization) {
          return this.realizedApi.update(this.firstRealization.id, payload).pipe(switchMap(() => of(null)));
        }
        return this.realizedApi.create({ activity_id: this.activity!.id, ...payload }).pipe(switchMap(() => of(null)));
      }),
    ).subscribe({
      next: () => {
        this.loading = false;
        if (this.activity?.plan_id) this.router.navigate(['/csr-plans', this.activity.plan_id]);
        else this.router.navigate(['/planned-activities']);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message ?? 'Erreur lors de l\'enregistrement.';
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    this.blobUrlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
  }
}
