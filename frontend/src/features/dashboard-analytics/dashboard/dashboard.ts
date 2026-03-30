import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  ViewChildren,
  inject,
  signal,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardApi, type DashboardSummary, type DashboardFilterOptions, type DashboardFilters } from './dashboard-api';
import {
  faCalendarPlus,
  faChartLine,
  faCheckCircle,
  faClock,
  faFileImport,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule } from '@ngx-translate/core';

declare const Chart: any;

const BRAND_COLORS = {
  primary: '#1B3C53',
  secondary: '#234C6A',
  accent: '#456882',
  env: '#10b981',
  social: '#3b82f6',
  gov: '#8b5cf6'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    TranslateModule
  ],
  templateUrl: './dashboard.html'
})
export class Dashboard implements AfterViewInit, OnDestroy {
  private readonly api = inject(DashboardApi);
  private readonly cdr = inject(ChangeDetectorRef);

  faFileImport = faFileImport;
  faChartLine = faChartLine;
  faCalendarPlus = faCalendarPlus;
  faCheckCircle = faCheckCircle;
  faClock = faClock;
  faExclamationTriangle = faExclamationTriangle;

  loading = signal(true);
  errorMessage = signal<string | null>(null);
  summary = signal<DashboardSummary | null>(null);
  kpis = signal<any>(null);
  plannedVsCompleted = signal<any>(null);
  categoriesData = signal<any[]>([]);
  monthlyTimeline = signal<any>(null);
  sitePerformance = signal<any[]>([]);
  topActivities = signal<any[]>([]);
  notifications = signal<any[]>([]);

  filterOptions = signal<DashboardFilterOptions>({ years: [], sites: [], categories: [] });
  selectedYear = signal<number | null>(null);
  selectedSite = signal<string | null>(null);
  selectedCategory = signal<string | null>(null);

  @ViewChild('chartPlannedVsCompleted') chartPlannedVsCompleted?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCategories') chartCategories?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartTimeline') chartTimeline?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartSites') chartSites?: ElementRef<HTMLCanvasElement>;

  private chartInstances: (any | null)[] = [null, null, null, null];

  constructor() {
    // Dashboard intentionally kept empty for now.
    // Do not trigger analytics endpoints.
    this.loading.set(false);
  }

  getFilters(): DashboardFilters {
    return {
      year: this.selectedYear() ?? undefined,
      siteId: this.selectedSite() ?? undefined,
      categoryId: this.selectedCategory() ?? undefined
    };
  }

  onFiltersChange(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.chartInstances.forEach((c) => c?.destroy?.());
    this.chartInstances = [];
  }

  private loadData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    const f = this.getFilters();

    this.api.getSiteSummary(f).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Failed to load summary.');
        this.cdr.detectChanges();
      }
    });

    this.api.getDashboardKpis(f).subscribe({
      next: (k) => {
        this.kpis.set(k);
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.kpis.set(null);
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });

    this.api.getPlannedVsCompleted(f).subscribe((d) => {
      this.plannedVsCompleted.set(d);
      this.cdr.detectChanges();
      setTimeout(() => this.renderCharts(), 100);
    });

    this.api.getCategoriesData(f).subscribe((d) => {
      this.categoriesData.set(d);
      this.cdr.detectChanges();
      setTimeout(() => this.renderCharts(), 50);
    });

    this.api.getMonthlyTimeline(f).subscribe((d) => {
      this.monthlyTimeline.set(d);
      this.cdr.detectChanges();
      setTimeout(() => this.renderCharts(), 50);
    });

    this.api.getSitePerformance(f).subscribe((d) => {
      this.sitePerformance.set(d);
      this.cdr.detectChanges();
      setTimeout(() => this.renderCharts(), 50);
    });

    this.api.getTopActivities(f).subscribe((d) => this.topActivities.set(d));
    this.api.getNotifications(f).subscribe((d) => this.notifications.set(d));
  }

  private renderCharts(): void {
    if (typeof Chart === 'undefined') return;

    // Planned vs Completed (canvas is always in DOM)
    const pvc = this.plannedVsCompleted();
    const canvasPvc = this.chartPlannedVsCompleted?.nativeElement;
    if (pvc && canvasPvc) {
      const labels = Array.isArray(pvc.labels) ? pvc.labels : [];
      const planned = Array.isArray(pvc.planned) ? pvc.planned : [];
      const completed = Array.isArray(pvc.completed) ? pvc.completed : [];
      this.renderChart(canvasPvc, 0, () => ({
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Planned',
              data: planned,
              backgroundColor: `${BRAND_COLORS.primary}99`,
              borderRadius: 6
            },
            {
              label: 'Completed',
              data: completed,
              backgroundColor: `${BRAND_COLORS.env}cc`,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } }
          }
        }
      }));
    }

    // Categories Pie Chart
    const cat = this.categoriesData();
    if (cat?.length && this.chartCategories?.nativeElement) {
      this.renderChart(this.chartCategories.nativeElement, 1, () => ({
        type: 'pie',
        data: {
          labels: cat.map((c) => c.label),
          datasets: [
            {
              data: cat.map((c) => c.value),
              backgroundColor: cat.map((c) => c.color),
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right' } }
        }
      }));
    }

    // Monthly Timeline
    const timeline = this.monthlyTimeline();
    if (timeline && this.chartTimeline?.nativeElement) {
      this.renderChart(this.chartTimeline.nativeElement, 2, () => ({
        type: 'line',
        data: {
          labels: timeline.labels,
          datasets: [
            {
              label: 'Activities',
              data: timeline.data,
              borderColor: BRAND_COLORS.accent,
              backgroundColor: `${BRAND_COLORS.accent}22`,
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      }));
    }

    // Site Performance
    const sites = this.sitePerformance();
    if (sites?.length && this.chartSites?.nativeElement) {
      this.renderChart(this.chartSites.nativeElement, 3, () => ({
        type: 'bar',
        data: {
          labels: sites.map((s) => s.siteName),
          datasets: [
            {
              label: 'Planned',
              data: sites.map((s) => s.planned),
              backgroundColor: `${BRAND_COLORS.primary}99`,
              borderRadius: 6
            },
            {
              label: 'Completed',
              data: sites.map((s) => s.completed),
              backgroundColor: `${BRAND_COLORS.env}cc`,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { position: 'top' } },
          scales: { x: { beginAtZero: true } }
        }
      }));
    }
  }

  private renderChart(
    canvas: HTMLCanvasElement,
    index: number,
    config: () => any
  ): void {
    if (this.chartInstances[index]) {
      this.chartInstances[index].destroy();
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.chartInstances[index] = new Chart(ctx, config());
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  notificationIcon(type: string): any {
    switch (type) {
      case 'overdue':
        return faExclamationTriangle;
      case 'validation':
        return faCheckCircle;
      case 'change_request':
        return faClock;
      default:
        return faExclamationTriangle;
    }
  }

  notificationBgClass(type: string): string {
    switch (type) {
      case 'overdue':
        return 'bg-amber-50 border-amber-200';
      case 'validation':
        return 'bg-blue-50 border-blue-200';
      case 'change_request':
        return 'bg-slate-50 border-slate-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  }
}
