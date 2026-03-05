import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RealizedCsrApi } from '../api/realized-csr-api';
import type { RealizedCsr } from '../models/realized-csr.model';

const MONTHS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

@Component({
  selector: 'app-realized-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './realized-detail.html',
})
export class RealizedDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(RealizedCsrApi);

  realized = signal<RealizedCsr | null>(null);
  loading = signal(true);
  errorMsg = signal('');

  monthLabel(m: number): string {
    return MONTHS[m] ?? String(m);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/realized-csr']);
      return;
    }
    this.api.get(id).subscribe({
      next: (data) => {
        this.realized.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message ?? 'Réalisation introuvable');
      },
    });
  }

  back(): void {
    this.router.navigate(['/realized-csr']);
  }
}
