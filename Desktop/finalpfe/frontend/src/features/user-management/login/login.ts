/**
 * LoginComponent - Page de connexion.
 * Formulaire email/password + option "Se souvenir de moi".
 * Redirige vers le dashboard après connexion réussie.
 */
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html'
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [false]
  });

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
        this.errorMessage.set(err?.error?.message ?? 'Erreur de connexion. Veuillez réessayer.');
      }
    });
  }
}
