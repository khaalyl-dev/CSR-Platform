import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule } from '@ngx-translate/core';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import {
  faBell,
  faCalendarCheck,
  faCircleCheck,
  faCircleXmark,
  faEnvelope,
  faGear,
  faHouse,
  faIdCard,
  faKey,
  faMessage,
  faUserCog,
} from '@fortawesome/free-solid-svg-icons';
import { I18nService } from '@core/services/i18n.service';
import { ThemeService } from '@core/services/theme.service';
import { AuthApi, type ProfileResponse } from '../login/auth-api';
import allCountriesData from '../models/JSON All Countries with name, code, phone prefix and currencies.json';

type SettingsTab = 'profile' | 'account' | 'security' | 'notifications' | 'preferences';
type CountryPrefix = { code: string; name: string; prefix: string };

const COUNTRY_PREFIXES: CountryPrefix[] = ((allCountriesData as { countries?: Array<{ code?: string; name?: string; prefix?: string }> }).countries || [])
  .map((c) => ({
    code: (c.code || '').trim().toUpperCase(),
    name: (c.name || '').trim(),
    prefix: (c.prefix || '').trim(),
  }))
  .filter((c) => c.code && c.name && c.prefix && c.prefix.startsWith('+') && c.prefix.length > 1)
  .sort((a, b) => a.name.localeCompare(b.name));

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule, TranslateModule, ToggleSwitchModule],
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.css',
})
export class ProfileSettingsComponent implements OnInit, OnDestroy {
  private readonly authApi = inject(AuthApi);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  protected readonly faUserCog = faUserCog;
  protected readonly faIdCard = faIdCard;
  protected readonly faKey = faKey;
  protected readonly faBell = faBell;
  protected readonly faGear = faGear;
  protected readonly faHouse = faHouse;
  protected readonly faMessage = faMessage;
  protected readonly faCalendarCheck = faCalendarCheck;
  protected readonly faEnvelope = faEnvelope;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleXmark = faCircleXmark;

  profile = signal<ProfileResponse | null>(null);
  loading = signal(true);
  loadError = signal<string | null>(null);
  formSuccess = signal<string | null>(null);
  formError = signal<string | null>(null);
  settingsSuccess = signal<string | null>(null);
  settingsError = signal<string | null>(null);
  passwordSuccess = signal<string | null>(null);
  passwordError = signal<string | null>(null);
  photoError = signal<string | null>(null);

  savingProfile = signal(false);
  savingNotifications = signal(false);
  savingPreferences = signal(false);
  changingPassword = signal(false);
  photoUploading = signal(false);
  avatarBlobUrl = signal<string | null>(null);
  activeTab = signal<SettingsTab>('profile');
  countryPrefixes = COUNTRY_PREFIXES;

  profileForm = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(255)]],
    last_name: ['', [Validators.required, Validators.maxLength(255)]],
    phone_prefix: ['+216'],
    phone: ['', [Validators.maxLength(40)]],
    email: [{ value: '', disabled: true }],
  });

  passwordForm = this.fb.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
  });

  notificationForm = this.fb.group({
    csrPlanValidation: [true],
    activityValidation: [true],
    activityReminders: [true],
  });

  preferencesForm = this.fb.group({
    language: ['en' as 'fr' | 'en'],
    theme: ['light' as 'light' | 'dark'],
  });

  constructor() {
    effect(() => {
      const p = this.profile();
      const prev = untracked(() => this.avatarBlobUrl());
      if (prev) {
        URL.revokeObjectURL(prev);
        untracked(() => this.avatarBlobUrl.set(null));
      }
      if (p?.avatar_url) {
        const sep = p.avatar_url.includes('?') ? '&' : '?';
        this.http.get(`${p.avatar_url}${sep}t=${Date.now()}`, { responseType: 'blob' }).subscribe({
          next: (blob) => untracked(() => this.avatarBlobUrl.set(URL.createObjectURL(blob))),
          error: () => {},
        });
      }
    });
    effect(() => {
      const t = this.theme.currentTheme();
      this.preferencesForm.patchValue({ theme: t }, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    const url = this.avatarBlobUrl();
    if (url) URL.revokeObjectURL(url);
  }

  loadProfile(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.authApi.getProfile().subscribe({
      next: (p) => {
        try {
          this.profile.set(p);
          const fullPhone = p.phone || '';
          this.profileForm.patchValue({
            first_name: p.first_name ?? '',
            last_name: p.last_name ?? '',
            phone_prefix: this.extractPhonePrefix(fullPhone),
            phone: this.extractPhoneNumber(fullPhone),
            email: p.email,
          });
          this.notificationForm.patchValue({
            csrPlanValidation: !!p.notifications?.csr_plan_validation,
            activityValidation: !!p.notifications?.activity_validation,
            activityReminders: !!p.notifications?.activity_reminders,
          });
          this.preferencesForm.patchValue({
            language: p.language ?? 'en',
            theme: this.theme.currentTheme(),
          });
          this.i18n.use(p.language ?? 'en');
        } catch (e) {
          console.error('Failed to initialize profile settings view', e);
          this.loadError.set(this.i18n.t('PROFILE_SETTINGS.MESSAGES.UPDATE_FAILED'));
        } finally {
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.loadError.set(err?.error?.message ?? this.i18n.t('PROFILE_SETTINGS.MESSAGES.UPDATE_FAILED'));
        this.loading.set(false);
      },
    });
  }

  onUpdateProfile(): void {
    this.formError.set(null);
    this.formSuccess.set(null);
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const raw = this.profileForm.getRawValue();
    const phonePrefix = (raw.phone_prefix ?? '+216').trim();
    const phoneNumber = (raw.phone ?? '').trim();
    const fullPhone = this.composeFullPhone(phonePrefix, phoneNumber);
    const payload = {
      first_name: (raw.first_name ?? '').trim(),
      last_name: (raw.last_name ?? '').trim(),
      phone: fullPhone,
    };

    this.savingProfile.set(true);
    this.authApi.updateProfile(payload).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.profileForm.patchValue({
          first_name: updated.first_name ?? payload.first_name,
          last_name: updated.last_name ?? payload.last_name,
          phone_prefix: phonePrefix,
          phone: phoneNumber,
          email: updated.email,
        });
        this.formSuccess.set(this.i18n.t('PROFILE_SETTINGS.MESSAGES.PROFILE_UPDATED'));
        this.savingProfile.set(false);
      },
      error: (err) => {
        this.formError.set(err?.error?.message ?? this.i18n.t('PROFILE_SETTINGS.MESSAGES.UPDATE_FAILED'));
        this.savingProfile.set(false);
      },
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.photoError.set(this.i18n.t('PROFILE_SETTINGS.MESSAGES.PHOTO_FORMAT'));
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError.set(this.i18n.t('PROFILE_SETTINGS.MESSAGES.PHOTO_SIZE'));
      input.value = '';
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
        this.photoError.set(err?.error?.message ?? this.i18n.t('PROFILE_SETTINGS.MESSAGES.PHOTO_UPLOAD_FAILED'));
        input.value = '';
      },
    });
  }

  onChangePassword(): void {
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const raw = this.passwordForm.getRawValue();
    const current = raw.current_password ?? '';
    const next = raw.new_password ?? '';
    const confirm = raw.confirm_password ?? '';
    if (next !== confirm) {
      this.passwordError.set(this.i18n.t('PROFILE_SETTINGS.MESSAGES.PASSWORD_MISMATCH'));
      return;
    }

    this.changingPassword.set(true);
    this.authApi.changePassword(current, next).subscribe({
      next: (res) => {
        this.passwordForm.reset();
        this.passwordSuccess.set(res.message ?? this.i18n.t('PROFILE_SETTINGS.MESSAGES.PASSWORD_CHANGED'));
        this.changingPassword.set(false);
      },
      error: (err) => {
        this.passwordError.set(err?.error?.message ?? this.i18n.t('PROFILE_SETTINGS.MESSAGES.PASSWORD_CHANGE_FAILED'));
        this.changingPassword.set(false);
      },
    });
  }

  onSaveNotifications(): void {
    this.settingsError.set(null);
    this.settingsSuccess.set(null);
    const raw = this.notificationForm.getRawValue();
    this.savingNotifications.set(true);
    this.authApi.updateProfile({
      notifications: {
        csr_plan_validation: !!raw.csrPlanValidation,
        activity_validation: !!raw.activityValidation,
        activity_reminders: !!raw.activityReminders,
      },
    }).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.settingsSuccess.set(this.i18n.t('PROFILE_SETTINGS.MESSAGES.NOTIFICATIONS_SAVED'));
        this.savingNotifications.set(false);
      },
      error: (err) => {
        this.settingsError.set(err?.error?.message ?? this.i18n.t('PROFILE_SETTINGS.MESSAGES.NOTIFICATIONS_SAVE_FAILED'));
        this.savingNotifications.set(false);
      },
    });
  }

  onSavePreferences(): void {
    this.settingsError.set(null);
    this.settingsSuccess.set(null);
    const raw = this.preferencesForm.getRawValue();
    this.savingPreferences.set(true);
    this.authApi.updateProfile({
      language: raw.language ?? 'en',
      theme: raw.theme ?? 'light',
    }).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.i18n.use(updated.language ?? 'en');
        this.theme.use(updated.theme ?? 'light');
        this.settingsSuccess.set(this.i18n.t('PROFILE_SETTINGS.MESSAGES.PREFERENCES_SAVED'));
        this.savingPreferences.set(false);
      },
      error: (err) => {
        this.settingsError.set(err?.error?.message ?? this.i18n.t('PROFILE_SETTINGS.MESSAGES.PREFERENCES_SAVE_FAILED'));
        this.savingPreferences.set(false);
      },
    });
  }

  setTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }

  roleLabel(role: string): string {
    return role === 'CORPORATE_USER'
      ? this.i18n.t('PROFILE_SETTINGS.ACCOUNT.CORPORATE_USER')
      : this.i18n.t('PROFILE_SETTINGS.ACCOUNT.SITE_USER');
  }

  assignedSiteLabel(profile: ProfileResponse): string {
    if (profile.role === 'CORPORATE_USER') return this.i18n.t('PROFILE_SETTINGS.ACCOUNT.ALL_SITES');
    if (!profile.sites?.length) return this.i18n.t('PROFILE_SETTINGS.ACCOUNT.NO_SITE');
    return profile.sites.map((s) => s.site_name || s.site_code || this.i18n.t('PROFILE_SETTINGS.ACCOUNT.SITE')).join(', ');
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  private composeFullPhone(prefix: string, number: string): string {
    if (!number) return '';
    const normalizedPrefix = prefix.startsWith('+') ? prefix : `+${prefix}`;
    return `${normalizedPrefix} ${number}`.trim();
  }

  private extractPhonePrefix(fullPhone: string): string {
    if (!fullPhone) return '+216';
    const sortedPrefixes = this.countryPrefixes
      .map((c) => c.prefix)
      .sort((a, b) => b.length - a.length);
    const matched = sortedPrefixes.find((p) => fullPhone.startsWith(p));
    if (matched) return matched;
    return '+216';
  }

  private extractPhoneNumber(fullPhone: string): string {
    if (!fullPhone) return '';
    const prefix = this.extractPhonePrefix(fullPhone);
    if (!fullPhone.startsWith(prefix)) return fullPhone.trim();
    return fullPhone.slice(prefix.length).trim();
  }
}

