/**
 * ProfileComponent - Paramètres / Gestion du compte.
 * Displays identity with photo upload, personal info, password change, site access.
 * Route: /account/profile
 */
import { Component, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faEnvelope,
  faIdCard,
  faCalendarCheck,
  faBuilding,
  faShieldHalved,
  faCircleCheck,
  faCircleXmark,
  faKey,
} from '@fortawesome/free-solid-svg-icons';
import { AuthApi, type ProfileResponse } from '../login/auth-api';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule, TranslateModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly authApi = inject(AuthApi);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);

  protected readonly faEnvelope = faEnvelope;
  protected readonly faIdCard = faIdCard;
  protected readonly faCalendarCheck = faCalendarCheck;
  protected readonly faBuilding = faBuilding;
  protected readonly faShieldHalved = faShieldHalved;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleXmark = faCircleXmark;
  protected readonly faKey = faKey;

  profile = signal<ProfileResponse | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  passwordSuccess = signal<string | null>(null);
  passwordError = signal<string | null>(null);
  changingPassword = signal(false);
  photoUploading = signal(false);
  photoError = signal<string | null>(null);
  /** Blob URL for avatar image (loaded with auth so img can display it) */
  avatarBlobUrl = signal<string | null>(null);

  passwordForm = this.fb.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      const p = this.profile();
      const prevUrl = this.avatarBlobUrl();
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
        this.avatarBlobUrl.set(null);
      }
      if (p?.avatar_url) {
        const sep = p.avatar_url.includes('?') ? '&' : '?';
        this.http.get(`${p.avatar_url}${sep}t=${Date.now()}`, { responseType: 'blob' }).subscribe({
          next: (blob) => this.avatarBlobUrl.set(URL.createObjectURL(blob)),
          error: () => {},
        });
      }
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    const url = this.avatarBlobUrl();
    if (url) URL.revokeObjectURL(url);
  }

  /** Fetch profile from GET /api/auth/profile and update state */
  loadProfile(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.authApi.getProfile().subscribe({
      next: (data) => {
        this.profile.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? this.translate.instant('PROFILE_SETTINGS.LOAD_ERROR'));
        this.loading.set(false);
      },
    });
  }

  /** Map backend role (CORPORATE_USER/SITE_USER) to display label */
  roleLabel(role: string): string {
    const key = role === 'CORPORATE_USER' ? 'PROFILE_SETTINGS.ACCOUNT.CORPORATE_USER' : 'PROFILE_SETTINGS.ACCOUNT.SITE_USER';
    return this.translate.instant(key);
  }

  /** Format ISO date string to current locale */
  formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
      const locale = lang.startsWith('fr') ? 'fr-FR' : 'en-US';
      return new Date(iso).toLocaleDateString(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  /** Build display name from first_name + last_name, or fallback to email */
  fullName(p: ProfileResponse): string {
    const first = (p.first_name || '').trim();
    const last = (p.last_name || '').trim();
    if (first || last) return `${first} ${last}`.trim();
    return p.email;
  }

  /** Handle profile photo file selection: upload and refresh profile avatar_url */
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.photoError.set(this.translate.instant('PROFILE_SETTINGS.PHOTO_FORMAT_ERROR'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError.set(this.translate.instant('PROFILE_SETTINGS.PHOTO_SIZE_ERROR'));
      return;
    }
    this.photoError.set(null);
    this.photoUploading.set(true);
    this.authApi.uploadProfilePhoto(file).subscribe({
      next: () => {
        this.photoUploading.set(false);
        input.value = '';
        this.loadProfile();
      },
      error: (err) => {
        this.photoUploading.set(false);
        this.photoError.set(err?.error?.message ?? this.translate.instant('PROFILE_SETTINGS.PHOTO_UPLOAD_ERROR'));
        input.value = '';
      },
    });
  }

  /** Submit password change form: validate confirm match, call changePassword API */
  onSubmitPassword(): void {
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    const raw = this.passwordForm.getRawValue();
    const newPw = raw.new_password ?? '';
    const confirm = raw.confirm_password ?? '';
    if (newPw !== confirm) {
      this.passwordError.set(this.translate.instant('PROFILE_SETTINGS.PASSWORD_MISMATCH'));
      return;
    }
    if (!raw.current_password || !newPw) return;
    this.changingPassword.set(true);
    this.authApi.changePassword(raw.current_password, newPw).subscribe({
      next: (res) => {
        this.passwordForm.reset();
        this.passwordSuccess.set(res.message ?? this.translate.instant('PROFILE_SETTINGS.PASSWORD_CHANGE_SUCCESS'));
        this.changingPassword.set(false);
        setTimeout(() => this.passwordSuccess.set(null), 4000);
      },
      error: (err) => {
        this.passwordError.set(err?.error?.message ?? this.translate.instant('PROFILE_SETTINGS.PASSWORD_CHANGE_ERROR'));
        this.changingPassword.set(false);
      },
    });
  }
}
