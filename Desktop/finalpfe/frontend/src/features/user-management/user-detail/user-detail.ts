/**
 * UserDetailComponent - Page détail utilisateur (corporate only).
 * Route: /admin/users/:id
 * Features: view user, activate/deactivate, generate password, manage site access (SITE_USER).
 */
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faKey, faBan, faCheck, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { UsersApi, type UserWithSites } from '../api/users-api';
import { SitesApi, type Site } from '@features/site-management/api/sites-api';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FontAwesomeModule],
  templateUrl: './user-detail.html',
})
export class UserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly usersApi = inject(UsersApi);
  private readonly sitesApi = inject(SitesApi);
  private readonly fb = inject(FormBuilder);

  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faKey = faKey;
  protected readonly faBan = faBan;
  protected readonly faCheck = faCheck;
  protected readonly faBuilding = faBuilding;

  user = signal<UserWithSites | null>(null);
  sites = signal<Site[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  saving = signal(false);
  actionLoading = signal<string | null>(null);
  showPasswordModal = signal(false);
  generatedPassword = signal<string | null>(null);

  form = this.fb.group({
    site_ids: [[] as string[]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadUser(id);
    }
    this.loadSites();
  }

  /** Fetch user with sites from GET /api/users/:id */
  loadUser(id: string): void {
    this.loading.set(true);
    this.usersApi.get(id).subscribe({
      next: (data) => {
        this.user.set(data);
        this.form.patchValue({
          site_ids: data.sites.map((s) => s.site_id),
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Erreur');
        this.loading.set(false);
      },
    });
  }

  /** Fetch active sites for site assignment checkboxes */
  loadSites(): void {
    this.sitesApi.list(true).subscribe({
      next: (data) => this.sites.set(data),
    });
  }

  /** Toggle site in assignment form */
  toggleSite(siteId: string): void {
    const current = this.form.get('site_ids')?.value ?? [];
    const next = current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId];
    this.form.patchValue({ site_ids: next });
  }

  /** Check if site is selected in assignment form */
  isSelected(siteId: string): boolean {
    return (this.form.get('site_ids')?.value ?? []).includes(siteId);
  }

  /** Save site assignment via POST /api/users/:id/sites */
  saveSites(): void {
    const u = this.user();
    if (!u) return;

    this.saving.set(true);
    this.errorMessage.set(null);
    const raw = this.form.getRawValue();
    this.usersApi.assignSites(u.id, {
      site_ids: raw.site_ids ?? [],
    }).subscribe({
      next: () => {
        this.loadUser(u.id);
        this.saving.set(false);
        this.successMessage.set('Accès aux sites mis à jour.');
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Erreur');
        this.saving.set(false);
      },
    });
  }

  /** Activate/deactivate user */
  toggleActive(): void {
    const u = this.user();
    if (!u || this.actionLoading()) return;

    this.actionLoading.set('toggle');
    this.errorMessage.set(null);
    this.usersApi.update(u.id, { is_active: !u.is_active }).subscribe({
      next: (updated) => {
        this.user.set({ ...u, ...updated });
        this.successMessage.set(updated.is_active ? 'Utilisateur activé.' : 'Utilisateur désactivé.');
        this.actionLoading.set(null);
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Erreur');
        this.actionLoading.set(null);
      },
    });
  }

  /** Generate new password, show in modal */
  generatePassword(): void {
    const u = this.user();
    if (!u || this.actionLoading()) return;

    this.actionLoading.set('password');
    this.errorMessage.set(null);
    this.usersApi.resetPassword(u.id).subscribe({
      next: (res) => {
        this.generatedPassword.set(res.password);
        this.showPasswordModal.set(true);
        this.actionLoading.set(null);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Erreur');
        this.actionLoading.set(null);
      },
    });
  }

  /** Close password modal and clear generated password */
  closePasswordModal(): void {
    this.showPasswordModal.set(false);
    this.generatedPassword.set(null);
  }

  /** Copy generated password to clipboard */
  copyPassword(): void {
    const p = this.generatedPassword();
    if (p && navigator.clipboard) {
      navigator.clipboard.writeText(p);
    }
  }

  /** Map role to display label */
  roleLabel(role: string): string {
    return role === 'CORPORATE_USER' ? 'Corporate' : 'Site';
  }
}
