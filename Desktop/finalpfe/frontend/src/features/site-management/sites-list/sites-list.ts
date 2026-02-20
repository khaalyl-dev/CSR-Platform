import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SitesApi, type Site } from '../api/sites-api';

@Component({
  selector: 'app-sites-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sites-list.html'
})
export class SitesListComponent implements OnInit {
  private sitesApi = inject(SitesApi);

  sites = signal<Site[]>([]);
  loading = signal(true);
  searchTerm = signal('');
  selectedStatus = signal<string | null>(null);

  filteredSites = computed(() =>
    this.sites().filter(site => {
      const matchesSearch = site.name.toLowerCase().includes(this.searchTerm().toLowerCase()) ||
        site.code.toLowerCase().includes(this.searchTerm().toLowerCase());
      const status = site.is_active ? 'Active' : 'Inactif';
      const matchesStatus = this.selectedStatus() ? status === this.selectedStatus() : true;
      return matchesSearch && matchesStatus;
    })
  );

  ngOnInit(): void {
    this.sitesApi.list().subscribe({
      next: (data) => {
        this.sites.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
