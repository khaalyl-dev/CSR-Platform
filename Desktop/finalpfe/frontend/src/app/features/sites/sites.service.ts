import { Injectable, signal } from '@angular/core';
import { Site } from './models/site.model';

@Injectable({ providedIn: 'root' })
export class SitesService {

  private _sites: Site[] = [
    { id: 1, name: 'Tunis Plant', city: 'Tunis', country: 'Tunisia', manager: 'Ali Ben', status: 'Active' },
    { id: 2, name: 'Sfax Factory', city: 'Sfax', country: 'Tunisia', manager: 'Sara Trabelsi', status: 'Active' },
    { id: 3, name: 'Gabes Facility', city: 'Gabes', country: 'Tunisia', manager: 'Omar Khaled', status: 'Inactive' },
    { id: 4, name: 'Sousse Hub', city: 'Sousse', country: 'Tunisia', manager: 'Meriem Fares', status: 'Active' },
    { id: 5, name: 'Bizerte Unit', city: 'Bizerte', country: 'Tunisia', manager: 'Hichem Salah', status: 'Inactive' },
  ];

  // signal for reactive updates
  sites = signal<Site[]>([...this._sites]);

  getSites() {
    return this.sites();
  }

  getSiteById(id: number) {
    return this.sites().find(site => site.id === id);
  }

  addSite(site: Site) {
    this.sites.update(current => [...current, site]);
  }

  updateSite(updatedSite: Site) {
    this.sites.update(current =>
      current.map(site => site.id === updatedSite.id ? updatedSite : site)
    );
  }
}
