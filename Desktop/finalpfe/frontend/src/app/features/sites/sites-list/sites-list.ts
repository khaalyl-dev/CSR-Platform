import { Component, signal, computed } from '@angular/core';
import { SitesService } from '../sites.service';
import { Site } from '../models/site.model';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-sites-list',
  imports: [CommonModule],
  templateUrl: './sites-list.html'
})
export class SitesListComponent {

  sites = signal<Site[]>([]);
  searchTerm = signal('');
  selectedStatus = signal<string | null>(null);

  filteredSites = computed(() =>
    this.sites().filter(site => {
      const matchesSearch = site.name.toLowerCase().includes(this.searchTerm().toLowerCase());
      const matchesStatus = this.selectedStatus() ? site.status === this.selectedStatus() : true;
      return matchesSearch && matchesStatus;
    })
  );

  constructor(private sitesService: SitesService) {
    this.sites.set(this.sitesService.getSites());
  }
}
