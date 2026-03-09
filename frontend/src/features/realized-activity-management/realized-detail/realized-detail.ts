import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RealizedCsrApi } from '../api/realized-csr-api';
import type { RealizedCsr } from '../models/realized-csr.model';
import { RealizedEditComponent } from '../realized-edit/realized-edit';

const MONTHS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

@Component({
  selector: 'app-realized-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, RealizedEditComponent],
  templateUrl: './realized-detail.html',
})
export class RealizedDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
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
    this.location.back();
  }

  showEditSidebar = signal(false);

  openEditSidebar(): void {
    this.showEditSidebar.set(true);
  }

  closeEditSidebar(): void {
    this.showEditSidebar.set(false);
  }

  onRealizedUpdated(): void {
    this.closeEditSidebar();
    const r = this.realized();
    if (r?.id) {
      this.api.get(r.id).subscribe({
        next: (data) => this.realized.set(data),
      });
    }
  }
}
