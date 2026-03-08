import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { SitesApi, type Site } from '../api/sites-api';
import { PAYS } from '../models/All_countries';

@Component({
  selector: 'app-site-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, TranslateModule],
  templateUrl: './site-form.html',
  styleUrls: ['./site-form.css']
})
export class SiteFormComponent {
  siteForm: FormGroup;
  submitting: boolean = false;
  errorMsg: string = '';

  /** Liste des noms de pays (français si dispo, sinon anglais), triée. */
  countries: string[] = (PAYS || [])
    .map((p: { name?: string; translations?: { fr?: string | null } }) => (p.translations?.fr ?? p.name ?? '').toString())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'fr'));

  constructor(
    private fb: FormBuilder,
    private sitesApi: SitesApi,
    public router: Router,
    private location: Location
  ) {
    this.siteForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      region: [''],
      country: [''],
      location: [''],
      description: ['']
    });
  }

  goBack(): void {
    this.location.back();
  }

  submit() {
    if (this.siteForm.invalid) {
      this.siteForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMsg = '';
    const newSite: Site = this.siteForm.value;

    this.sitesApi.createSite(newSite).pipe(
      finalize(() => {
        this.submitting = false;
      }),
    ).subscribe({
      next: () => {
        alert('Site créé avec succès !');
        this.router.navigate(['/sites']); // retour à la liste
      },
      error: (err) => {
        this.errorMsg = err.error?.message || 'Erreur lors de la création';
      }
    });
  }
}