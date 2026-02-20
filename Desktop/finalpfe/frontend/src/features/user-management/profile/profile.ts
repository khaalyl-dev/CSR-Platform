/**
 * ProfileComponent - "Mon Profil" page.
 * Displays current user identity, personal info, site access (SITE_USER), and password change form.
 * Route: /account/profile
 */
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faUser,
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
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfileComponent implements OnInit {
  private readonly authApi = inject(AuthApi);
  private readonly fb = inject(FormBuilder);

  protected readonly faUser = faUser;
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

  passwordForm = this.fb.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadProfile();
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
        this.errorMessage.set(err?.error?.message ?? 'Impossible de charger le profil.');
        this.loading.set(false);
      },
    });
  }

  /** Map backend role (CORPORATE_USER/SITE_USER) to display label */
  roleLabel(role: string): string {
    return role === 'CORPORATE_USER' ? 'Corporate' : 'Site';
  }

  /** Format ISO date string to French locale (e.g. "19 février 2026") */
  formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
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

  /** Submit password change form: validate confirm match, call changePassword API */
  onSubmitPassword(): void {
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    const raw = this.passwordForm.getRawValue();
    const newPw = raw.new_password ?? '';
    const confirm = raw.confirm_password ?? '';
    if (newPw !== confirm) {
      this.passwordError.set('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!raw.current_password || !newPw) return;
    this.changingPassword.set(true);
    this.authApi.changePassword(raw.current_password, newPw).subscribe({
      next: (res) => {
        this.passwordForm.reset();
        this.passwordSuccess.set(res.message ?? 'Mot de passe modifié avec succès.');
        this.changingPassword.set(false);
        setTimeout(() => this.passwordSuccess.set(null), 4000);
      },
      error: (err) => {
        this.passwordError.set(err?.error?.message ?? 'Erreur lors du changement de mot de passe.');
        this.changingPassword.set(false);
      },
    });
  }
}
