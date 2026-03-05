import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CsrActivitiesApi } from '@features/realized-activity-management/api/csr-activities-api';
import type { PlannedActivityListItem } from '@features/realized-activity-management/api/csr-activities-api';

@Component({
  selector: 'app-planned-activity-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './planned-activity-detail.html',
})
export class PlannedActivityDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(CsrActivitiesApi);

  activity = signal<PlannedActivityListItem | null>(null);
  loading = signal(true);
  errorMsg = signal('');
  private currentYear = new Date().getFullYear();
  /** Year from query param (when coming from plan detail) or from loaded activity. */
  planYear = signal<number | null>(null);

  /** True when the activity belongs to a past-year (realized) plan. */
  isPlanRealized(): boolean {
    const y = this.planYear() ?? this.activity()?.year;
    return y != null && y < this.currentYear;
  }

  activityTitle(): string {
    return this.activity()?.title || (this.isPlanRealized() ? 'Activité (plan réalisé)' : 'Activité planifiée');
  }

  sectionTitle(): string {
    return this.isPlanRealized() ? "Informations de l'activité (plan réalisé)" : "Informations de l'activité planifiée";
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const yearParam = this.route.snapshot.queryParamMap.get('year');
    if (yearParam !== null) {
      const y = parseInt(yearParam, 10);
      if (!isNaN(y)) this.planYear.set(y);
    }
    if (!id) {
      this.router.navigate(['/planned-activities']);
      return;
    }
    this.api.get(id).subscribe({
      next: (data) => {
        this.activity.set(data);
        if (data.year != null) this.planYear.set(data.year);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message ?? 'Activité introuvable');
      },
    });
  }

  back(): void {
    this.router.navigate(['/planned-activities']);
  }
}
