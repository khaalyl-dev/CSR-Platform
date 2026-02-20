import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '@core/services/auth-store';

export interface CsrPlan {
  id: number;
  year: number;
  strategicObjectives: string;
  budgetTotal: number;
  budgetConsumed: number;
  pillars: string[];
  kpiTarget: number;
  kpiAchieved: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  version: number;
}

@Component({
  selector: 'app-annual-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './annual-plans.html'
})
export class AnnualPlansComponent {
  private authStore = inject(AuthStore);

  isAuthenticated = this.authStore.isAuthenticated;
  user = this.authStore.user;

  selectedYear = signal<number | null>(null);
  selectedStatus = signal<string>('');
  search = signal<string>('');

  plans = signal<CsrPlan[]>([
    { id: 1, year: 2025, strategicObjectives: 'Reduce carbon footprint and energy consumption', budgetTotal: 150000, budgetConsumed: 92000, pillars: ['Environment'], kpiTarget: 15, kpiAchieved: 9, status: 'Approved', version: 3 },
    { id: 2, year: 2024, strategicObjectives: 'Strengthen local community education programs', budgetTotal: 95000, budgetConsumed: 47000, pillars: ['Social'], kpiTarget: 12, kpiAchieved: 8, status: 'Submitted', version: 2 },
    { id: 3, year: 2023, strategicObjectives: 'Improve workplace safety and employee wellbeing', budgetTotal: 120000, budgetConsumed: 88000, pillars: ['Governance'], kpiTarget: 10, kpiAchieved: 10, status: 'Approved', version: 1 },
    { id: 4, year: 2022, strategicObjectives: 'Water consumption optimization and recycling', budgetTotal: 110000, budgetConsumed: 54000, pillars: ['Environment'], kpiTarget: 14, kpiAchieved: 6, status: 'Draft', version: 1 },
    { id: 5, year: 2021, strategicObjectives: 'Youth employability and training initiatives', budgetTotal: 100000, budgetConsumed: 72000, pillars: ['Social'], kpiTarget: 9, kpiAchieved: 7, status: 'Approved', version: 2 },
    { id: 6, year: 2020, strategicObjectives: 'Waste management and plastic reduction program', budgetTotal: 85000, budgetConsumed: 43000, pillars: ['Environment'], kpiTarget: 11, kpiAchieved: 5, status: 'Submitted', version: 1 }
  ]);

  filteredPlans = computed(() =>
    this.plans().filter(plan =>
      (!this.selectedYear() || plan.year === this.selectedYear()) &&
      (!this.selectedStatus() || plan.status === this.selectedStatus()) &&
      (!this.search() || plan.strategicObjectives.toLowerCase().includes(this.search().toLowerCase()))
    )
  );

  totalPlans = computed(() => this.plans().length);
  submittedPlans = computed(() => this.plans().filter(p => p.status === 'Submitted').length);
  approvedPlans = computed(() => this.plans().filter(p => p.status === 'Approved').length);
  totalBudget = computed(() => this.plans().reduce((sum, p) => sum + p.budgetTotal, 0));

  getBudgetProgress(plan: CsrPlan) {
    return Math.round((plan.budgetConsumed / plan.budgetTotal) * 100);
  }

  getKpiProgress(plan: CsrPlan) {
    return Math.round((plan.kpiAchieved / plan.kpiTarget) * 100);
  }

  approve(plan: CsrPlan) {
    plan.status = 'Approved';
  }

  reject(plan: CsrPlan) {
    plan.status = 'Rejected';
  }
}
