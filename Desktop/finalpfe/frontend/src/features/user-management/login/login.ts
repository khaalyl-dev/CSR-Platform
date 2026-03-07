/**
 * LoginComponent - Page de connexion.
 * Formulaire email/password + option "Se souvenir de moi".
 * Redirige vers le dashboard après connexion réussie.
 */
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { I18nService } from '@core/services/i18n.service';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './login.html'
})
export class Login implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [true]
  });

  ngOnInit(): void {
    // Login page is always displayed in light theme.
    this.theme.useTemporary('light');
    // Login page is always displayed in English.
    this.i18n.useTemporary('en');
  }

  ngOnDestroy(): void {
    // Restore persisted user preferences once leaving login page.
    this.theme.init();
    this.i18n.init();
  }

  /** Submit login form: call AuthService.login, handle success/error */
  onSubmit(): void {
    this.errorMessage.set(null);
    if (this.form.invalid) return;

    this.loading.set(true);
    const { email, password, remember } = this.form.getRawValue();

    this.authService.login(email, password, remember).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.message ?? this.i18n.t('LOGIN.ERROR'));
      }
    });
  }
}
