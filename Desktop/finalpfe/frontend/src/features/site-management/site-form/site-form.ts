import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SitesApi, type Site } from '../api/sites-api';

@Component({
  selector: 'app-site-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './site-form.html',
  styleUrls: ['./site-form.css']
})
export class SiteFormComponent {
  siteForm: FormGroup;
  submitting: boolean = false;
  errorMsg: string = '';

  constructor(
    private fb: FormBuilder,
    private sitesApi: SitesApi,
    public router: Router
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

  submit() {
    if (this.siteForm.invalid) {
      this.siteForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const newSite: Site = this.siteForm.value;

    this.sitesApi.createSite(newSite).subscribe({
      next: (res) => {
        this.submitting = false;
        alert('Site créé avec succès !');
        this.router.navigate(['/sites']); // retour à la liste
      },
      error: (err) => {
        this.submitting = false;
        this.errorMsg = err.error?.message || 'Erreur lors de la création';
      }
    });
  }
}