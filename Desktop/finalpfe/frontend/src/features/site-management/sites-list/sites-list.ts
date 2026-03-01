import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SitesApi, type Site } from '../api/sites-api';

@Component({
  selector: 'app-sites-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
      const status = site.is_active ? 'Actif' : 'Inactif';
      const matchesStatus = this.selectedStatus() ? status === this.selectedStatus() : true;
      return matchesSearch && matchesStatus;
    })
  );

  isCorporate = false;

  ngOnInit(): void {
    const role = localStorage.getItem('role') || '';
    this.isCorporate = role.toLowerCase() === 'corporate';

    this.sitesApi.list().subscribe({
      next: (data) => {
        this.sites.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  constructor(private router: Router) {}  

  goToAddSite(): void {
    this.router.navigate(['/sites/create']);
  }

  editSite(siteId: string) {
    this.router.navigate(['/sites/edit', siteId]);
  }

  // Pagination
  pageSize = 5;
  currentPage = 1;

  get totalPages() {
    return Math.ceil(this.filteredSites().length / this.pageSize);
  }

  get paginatedSites() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredSites().slice(start, end);
  }

  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  prevPage() { if (this.currentPage > 1) this.currentPage--; }
  goToPage(page: number) { this.currentPage = page; }

  // ✅ Toggle statut avec mise à jour du signal sites
  toggleSiteStatus(site: Site) {
    if (!confirm('Confirmer le changement de statut ?')) return;

    // Optimistic update (UI immédiate)
    const originalStatus = site.is_active;
    site.is_active = !site.is_active;

    this.sitesApi.toggleStatus(site.id).subscribe({
      next: (res: any) => {
        // Mise à jour finale avec la valeur renvoyée par le serveur
        this.sites.update(currentSites =>
          currentSites.map(s =>
            s.id === site.id ? { ...s, is_active: res.is_active } : s
          )
        );
      },
      error: () => {
        alert('Action non autorisée');
        // rollback si erreur
        site.is_active = originalStatus;
      }
    });
  }
}