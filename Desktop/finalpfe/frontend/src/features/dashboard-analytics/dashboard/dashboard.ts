import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal, ChangeDetectorRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DashboardApi, type ActivitiesChart, type DashboardSummary } from './dashboard-api';

declare const Chart: any;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './dashboard.html'
})
export class Dashboard implements AfterViewInit, OnDestroy {
  private readonly api = inject(DashboardApi);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly chart = signal<ActivitiesChart | null>(null);

  @ViewChild('activitiesChart') activitiesChart?: ElementRef<HTMLCanvasElement>;
  private chartInstance: any;
  private viewInitialized = false;

  constructor() {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }

  private loadData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.getSiteSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Impossible de charger le tableau de bord.');
        this.cdr.detectChanges();
      }
    });

    this.api.getActivitiesChart().subscribe({
      next: (chart) => {
        this.chart.set(chart);
        if (this.viewInitialized) {
          this.renderChart();
        }
      },
      error: () => {}
    });
  }

  private renderChart(): void {
    if (!this.activitiesChart?.nativeElement || !this.chart()) return;
    const { labels, data } = this.chart()!;
    if (!labels.length || !data.length || typeof Chart === 'undefined') return;
    if (this.chartInstance) this.chartInstance.destroy();
    const ctx = this.activitiesChart.nativeElement.getContext('2d');
    if (!ctx) return;
    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Activités', data, backgroundColor: 'rgba(99,102,241,0.8)', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }
}
