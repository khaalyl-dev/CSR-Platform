import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '@core/services/auth-store';
import { SitesApi, type Site } from '../api/sites-api';


@Component({
 selector: 'app-sites-list',
 standalone: true,
 imports: [CommonModule, RouterModule, FormsModule],
 templateUrl: './sites-list.html'
})
export class SitesListComponent implements OnInit {
 private sitesApi = inject(SitesApi);
 private authStore = inject(AuthStore);


 sites = signal<Site[]>([]);
 loading = signal(true);
 searchTerm = signal('');
 selectedRegion = signal<string | null>(null);
 selectedCountry = signal<string | null>(null);


 /** Valeurs pour ngModel (string vide = pas de filtre) */
 get regionFilterValue(): string {
   return this.selectedRegion() ?? '';
 }
 set regionFilterValue(v: string) {
   const val = this.norm(v);
   this.selectedRegion.set(val === '' ? null : val);
 }
 get countryFilterValue(): string {
   return this.selectedCountry() ?? '';
 }
 set countryFilterValue(v: string) {
   const val = this.norm(v);
   this.selectedCountry.set(val === '' ? null : val);
 }


 // Tri
 sortColumn = signal<string>('name');
 sortDirection = signal<'asc' | 'desc'>('asc');


 /** Valeur normalisée pour comparaison (trim, unicode NFC, null → '') */
 private norm(s: string | null | undefined): string {
   const t = (s ?? '').toString().trim();
   return t.normalize ? t.normalize('NFC') : t;
 }


 // Régions uniques (normalisées, sans doublons)
 regions = computed(() => {
   const all = this.sites().map(s => this.norm(s.region)).filter(r => r !== '');
   return [...new Set(all)].sort();
 });


 // Pays uniques (normalisés, sans doublons)
 countries = computed(() => {
   const all = this.sites().map(s => this.norm(s.country)).filter(c => c !== '');
   return [...new Set(all)].sort();
 });


 // Filtrage + tri combinés (comparaison normalisée pour région et pays)
 filteredSites = computed(() => {
   const selRegion = this.selectedRegion();
   const selCountry = this.selectedCountry();


   const term = this.norm(this.searchTerm()).toLowerCase();
   const filtered = this.sites().filter(site => {
     const matchesSearch = !term ||
       site.name.toLowerCase().includes(term) ||
       site.code.toLowerCase().includes(term) ||
       this.norm(site.region).toLowerCase().includes(term) ||
       this.norm(site.country).toLowerCase().includes(term);
     const matchesRegion = !selRegion || this.norm(site.region) === this.norm(selRegion);
     const matchesCountry = !selCountry || this.norm(site.country) === this.norm(selCountry);


     return matchesSearch && matchesRegion && matchesCountry;
   });


   // Tri
   const col = this.sortColumn();
   const dir = this.sortDirection();


   return [...filtered].sort((a, b) => {
     const valA = (a as any)[col]?.toString().toLowerCase() ?? '';
     const valB = (b as any)[col]?.toString().toLowerCase() ?? '';
     if (valA < valB) return dir === 'asc' ? -1 : 1;
     if (valA > valB) return dir === 'asc' ? 1 : -1;
     return 0;
   });
 });


 isCorporate = false;


 ngOnInit(): void {
   this.isCorporate = this.authStore.userRole() === 'corporate';
   this.sitesApi.list().subscribe({
     next: (data) => { this.sites.set(data); this.loading.set(false); },
     error: () => this.loading.set(false),
   });
 }


 constructor(private router: Router) {}


 sortBy(column: string) {
   if (this.sortColumn() === column) {
     this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
   } else {
     this.sortColumn.set(column);
     this.sortDirection.set('asc');
   }
   this.currentPage = 1;
 }


 goToAddSite(): void { this.router.navigate(['/sites/create']); }
 editSite(siteId: string) { this.router.navigate(['/sites/edit', siteId]); }


 // Pagination
 pageSize = 8;
 currentPage = 1;


 get totalPages() { return Math.ceil(this.filteredSites().length / this.pageSize); }


 get paginatedSites() {
   const start = (this.currentPage - 1) * this.pageSize;
   return this.filteredSites().slice(start, start + this.pageSize);
 }


 nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
 prevPage() { if (this.currentPage > 1) this.currentPage--; }
 goToPage(page: number) { this.currentPage = page; }


 toggleSiteStatus(site: Site) {
   if (!confirm('Confirmer le changement de statut ?')) return;
   const originalStatus = site.is_active;
   site.is_active = !site.is_active;
   this.sitesApi.toggleStatus(site.id).subscribe({
     next: (res: any) => {
       this.sites.update(currentSites =>
         currentSites.map(s => s.id === site.id ? { ...s, is_active: res.is_active } : s)
       );
     },
     error: () => {
       alert('Action non autorisée');
       site.is_active = originalStatus;
     }
   });
 }
}
