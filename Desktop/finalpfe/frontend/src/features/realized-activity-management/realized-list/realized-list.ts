import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RealizedCsrApi } from '../api/realized-csr-api';
import type { RealizedCsr } from '../models/realized-csr.model';

const MONTHS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

@Component({
  selector: 'app-realized-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './realized-list.html'
})
export class RealizedListComponent implements OnInit {
  private api = inject(RealizedCsrApi);

  list = signal<RealizedCsr[]>([]);
  loading = signal(true);
  selectedYear = signal<number | null>(null);
  selectedMonth = signal<number | null>(null);
  search = signal<string>('');

  sortColumn = signal<string>('year');
  sortDirection = signal<'asc' | 'desc'>('desc');

  filteredList = computed(() => {
    const items = this.list();
    const year = this.selectedYear();
    const month = this.selectedMonth();
    const q = this.search().toLowerCase().trim();
    const filtered = items.filter(item =>
      (!year || item.year === year) &&
      (!month || item.month === month) &&
      (!q ||
        (item.activity_title ?? '').toLowerCase().includes(q) ||
        (item.activity_number ?? '').toLowerCase().includes(q) ||
        (item.site_name ?? '').toLowerCase().includes(q) ||
        String(item.year).includes(q) ||
        String(item.month).includes(q))
    );
    const col = this.sortColumn();
    const dir = this.sortDirection();
    return [...filtered].sort((a, b) => {
      const valA = (a as any)[col]?.toString().toLowerCase() ?? '';
      const valB = (b as any)[col]?.toString().toLowerCase() ?? '';
      const numA = typeof (a as any)[col] === 'number' ? (a as any)[col] : parseFloat(valA) || 0;
      const numB = typeof (b as any)[col] === 'number' ? (b as any)[col] : parseFloat(valB) || 0;
      if (col === 'year' || col === 'month' || col === 'realized_budget') {
        if (numA < numB) return dir === 'asc' ? -1 : 1;
        if (numA > numB) return dir === 'asc' ? 1 : -1;
      } else {
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  });

  sortBy(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set(column === 'year' || column === 'month' ? 'desc' : 'asc');
    }
  }

  totalRecords = computed(() => this.list().length);
  totalBudget = computed(() => this.list().reduce((sum, r) => sum + (r.realized_budget ?? 0), 0));

  monthLabel(m: number): string {
    return MONTHS[m] ?? String(m);
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (data) => {
        this.list.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
