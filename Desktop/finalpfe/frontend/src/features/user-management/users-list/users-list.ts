/**
 * UsersListComponent - Page liste des utilisateurs (corporate only).
 * Route: /admin/users
 * Features: create user, list users table, toggle active, generate password, assign sites on create.
 */
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faUserPlus, faKey, faBan, faCheck, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { UsersApi, type User, type CreateUserPayload } from '../api/users-api';
import { SitesApi, type Site } from '@features/site-management/api/sites-api';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FontAwesomeModule, TranslateModule],
  templateUrl: './users-list.html',
})
export class UsersListComponent implements OnInit {
  private readonly usersApi = inject(UsersApi);
  private readonly sitesApi = inject(SitesApi);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  protected readonly faUserPlus = faUserPlus;
  protected readonly faKey = faKey;
  protected readonly faBan = faBan;
  protected readonly faCheck = faCheck;
  protected readonly faBuilding = faBuilding;

  users = signal<User[]>([]);
  sites = signal<Site[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showCreateForm = signal(false);
  showPasswordModal = signal(false);
  generatedPassword = signal<string | null>(null);
  userForPassword = signal<string | null>(null);
  actionLoading = signal<string | null>(null);

  createForm = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    site_ids: [[] as string[]],
    default_grade: ['level_0' as 'level_0' | 'level_1'],
  });

  ngOnInit(): void {
    this.loadUsers();
    this.loadSites();
  }

  /** Fetch all users from GET /api/users */
  loadUsers(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.usersApi.list().subscribe({
      next: (data) => {
        this.users.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? this.translate.instant('USERS.LOAD_ERROR'));
        this.loading.set(false);
      },
    });
  }

  /** Fetch active sites for create form */
  loadSites(): void {
    this.sitesApi.list(true).subscribe({
      next: (data) => this.sites.set(data),
      error: () => {},
    });
  }

  /** Show/hide create user form, reset form when hiding */
  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    if (!this.showCreateForm()) {
      this.createForm.reset({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        site_ids: [],
        default_grade: 'level_0',
      });
      this.errorMessage.set(null);
    }
  }

  /** Submit create form: create user, optionally assign sites */
  onSubmitCreate(): void {
    if (this.createForm.invalid) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    const raw = this.createForm.getRawValue();
    const payload: CreateUserPayload = {
      first_name: raw.first_name,
      last_name: raw.last_name,
      email: raw.email,
      password: raw.password,
    };

    this.usersApi.create(payload).subscribe({
      next: (user) => {
        this.users.update((list) => [...list, user]);
        this.toggleCreateForm();
        this.successMessage.set(this.translate.instant('USERS.USER_CREATED_SUCCESS', { email: user.email }));

        if (raw.site_ids.length > 0) {
          this.usersApi.assignSites(user.id, {
            site_ids: raw.site_ids,
            default_grade: raw.default_grade ?? undefined,
          }).subscribe({
            next: () => this.loadUsers(),
          });
        }
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? this.translate.instant('USERS.CREATE_ERROR'));
      },
    });
  }

  /** Toggle site checkbox in create form */
  toggleSiteSelection(siteId: string): void {
    const siteIds = this.createForm.get('site_ids')?.value ?? [];
    const idx = siteIds.indexOf(siteId);
    const next = idx >= 0 ? siteIds.filter((_, i) => i !== idx) : [...siteIds, siteId];
    this.createForm.patchValue({ site_ids: next });
  }

  /** Check if site is selected in create form */
  isSiteSelected(siteId: string): boolean {
    return (this.createForm.get('site_ids')?.value ?? []).includes(siteId);
  }

  /** Activate/deactivate user via PATCH /api/users/:id */
  toggleActive(user: User): void {
    if (this.actionLoading()) return;
    this.actionLoading.set(user.id);
    this.errorMessage.set(null);
    this.usersApi.update(user.id, { is_active: !user.is_active }).subscribe({
      next: (updated) => {
        this.users.update((list) =>
          list.map((u) => (u.id === updated.id ? updated : u))
        );
        this.successMessage.set(
          updated.is_active ? this.translate.instant('USERS.USER_ACTIVATED') : this.translate.instant('USERS.USER_DEACTIVATED')
        );
        this.actionLoading.set(null);
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? this.translate.instant('USERS.ERROR_GENERIC'));
        this.actionLoading.set(null);
      },
    });
  }

  /** Generate new password for user, show in modal */
  generatePassword(user: User): void {
    if (this.actionLoading()) return;
    this.actionLoading.set(user.id);
    this.errorMessage.set(null);
    this.usersApi.resetPassword(user.id).subscribe({
      next: (res) => {
        this.generatedPassword.set(res.password);
        this.userForPassword.set(`${user.first_name} ${user.last_name} (${user.email})`);
        this.showPasswordModal.set(true);
        this.actionLoading.set(null);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? this.translate.instant('USERS.ERROR_GENERIC'));
        this.actionLoading.set(null);
      },
    });
  }

  /** Close password modal and clear state */
  closePasswordModal(): void {
    this.showPasswordModal.set(false);
    this.generatedPassword.set(null);
    this.userForPassword.set(null);
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
    return role === 'CORPORATE_USER'
      ? this.translate.instant('USERS.ROLE_CORPORATE')
      : this.translate.instant('USERS.ROLE_SITE');
  }

  /** Map level to display label */
  levelLabel(level: string | null | undefined): string {
    if (!level) return this.translate.instant('USERS.LEVEL_NA');
    return level === 'level_1'
      ? this.translate.instant('USERS.LEVEL_1')
      : level === 'level_0'
        ? this.translate.instant('USERS.LEVEL_0')
        : level;
  }
}
