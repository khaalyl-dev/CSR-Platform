import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, of, timeout, switchMap } from 'rxjs';
import { CsrPlansApi } from '../api/csr-plans-api';
import type { CreateCsrPlanPayload } from '../models/csr-plan.model';
import { SitesApi, type Site } from '@features/site-management/api/sites-api';
import { AuthApi } from '@features/user-management/login/auth-api';
import { AuthStore } from '@core/services/auth-store';

const LOAD_TIMEOUT_MS = 8000;

@Component({
  selector: 'app-plan-create',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './plan-create.html',
})
export class PlanCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private csrPlansApi = inject(CsrPlansApi);
  private sitesApi = inject(SitesApi);
  private authApi = inject(AuthApi);
  private authStore = inject(AuthStore);

  planForm!: FormGroup;
  sites: Site[] = [];
  loading = false;
  currentYear = new Date().getFullYear();
  loadingSites = true;
  errorMsg = '';

  ngOnInit(): void {
    this.planForm = this.fb.group({
      site_id: ['', Validators.required],
      year: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
      validation_mode: ['101'],
      total_budget: [null as number | null],
    });

    this.loadSites();
  }

  private mapProfileSitesToSites(profile: { sites?: Array<{ site_id: string; site_name?: string | null; site_code?: string | null }> }): Site[] {
    if (!profile?.sites?.length) return [];
    return profile.sites.map((s) => ({
      id: s.site_id,
      name: s.site_name ?? s.site_code ?? 'Site',
      code: s.site_code ?? '',
      region: '',
      country: '',
      location: '',
      description: '',
      is_active: true,
      created_at: null,
      updated_at: null,
    }));
  }

  private loadSites(): void {
    this.loadingSites = true;
    this.errorMsg = '';
    this.cdr.markForCheck();

    const isSiteUser = this.authStore.userRole() === 'site';

    // 1) Toujours essayer le profil d'abord (sites assignés pour SITE_USER)
    this.authApi.getProfile().pipe(
      timeout(LOAD_TIMEOUT_MS),
      catchError(() => of(null)),
    ).pipe(
      switchMap((profile) => {
        const fromProfile = this.mapProfileSitesToSites(profile ?? {});
        if (fromProfile.length > 0) {
          return of({ sites: fromProfile, done: true });
        }
        if (isSiteUser) {
          return of({ sites: [] as Site[], done: true });
        }
        // 2) Corporate : charger toute la liste des sites
        return this.sitesApi.list().pipe(
          timeout(LOAD_TIMEOUT_MS),
          catchError(() => of([] as Site[])),
          switchMap((list) => of({ sites: Array.isArray(list) ? list : [], done: true })),
        );
      }),
      finalize(() => {
        this.loadingSites = false;
        this.cdr.markForCheck();
      }),
    ).subscribe((result) => {
      this.sites = result.sites;
      if (this.sites.length === 0) {
        this.errorMsg = isSiteUser
          ? 'Aucun site actif affecté à votre compte.'
          : 'Impossible de charger la liste des sites. Réessayez.';
      }
      this.loadingSites = false;
      this.cdr.markForCheck();
    });
  }

  retryLoadSites(): void {
    this.loadSites();
  }

  submit(): void {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMsg = '';
    const raw = this.planForm.getRawValue();
    const payload: CreateCsrPlanPayload = {
      site_id: raw.site_id,
      year: Number(raw.year),
      validation_mode: raw.validation_mode === '111' ? '111' : '101',
      total_budget: raw.total_budget != null && raw.total_budget !== '' ? Number(raw.total_budget) : null,
    };

    this.csrPlansApi.create(payload).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/csr-plans']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Erreur lors de la création du plan';
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/csr-plans']);
  }
}
