import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SitesApi } from '../api/sites-api';
import { PAYS } from '../models/All_countries';

@Component({
  selector: 'app-edit-site',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-site.html',
  styleUrl: './edit-site.css',
})
export class EditSiteComponent implements OnInit {

  siteForm!: FormGroup;
  siteId!: string;
  loading = false;
  errorMsg = '';

  /** Liste des noms de pays (français si dispo, sinon anglais), triée. */
  countries: string[] = (PAYS || [])
    .map((p: { name?: string; translations?: { fr?: string | null } }) => (p.translations?.fr ?? p.name ?? '').toString())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'fr'));

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private sitesApi: SitesApi  // ← injection API
  ) {}

  ngOnInit(): void {
    this.siteId = this.route.snapshot.paramMap.get('id')!;

    // Initialisation du formulaire vide
    this.siteForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      region: [''],
      country: [''],
      location: [''],
      description: ['']
    });

    // Chargement des données du site depuis le backend
    this.sitesApi.get(this.siteId).subscribe({
      next: (site) => {
        // Pré-remplir le formulaire avec les données existantes
        this.siteForm.patchValue({
          name: site.name,
          code: site.code,
          region: site.region,
          country: site.country,
          location: site.location,
          description: site.description
        });
      },
      error: () => {
        this.errorMsg = 'Impossible de charger les données du site';
      }
    });
  }

  onSubmit() {
    if (this.siteForm.invalid) return;

    this.loading = true;
    this.errorMsg = '';

    // Appel API update
    this.sitesApi.updateSite(this.siteId, this.siteForm.value).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/sites']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Erreur lors de la mise à jour';
      }
    });
  }

  cancel() {
    this.router.navigate(['/sites']);
  }
}