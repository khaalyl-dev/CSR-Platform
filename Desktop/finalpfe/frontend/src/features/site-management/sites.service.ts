import { Injectable, signal } from '@angular/core';
import { Site } from './models/site.model';

@Injectable({ providedIn: 'root' })
export class SitesService {
  private _sites: Site[] = [
    { id: '1', name: 'Tunis Plant', code: 'COFTN', region: 'North Africa', country: 'Tunisia', location: 'Tunis', description: '', is_active: true, created_at: '', updated_at: '' },
    { id: '2', name: 'Sfax Factory', code: 'COFSF', region: 'North Africa', country: 'Tunisia', location: 'Sfax', description: '', is_active: true, created_at: '', updated_at: '' },
    { id: '3', name: 'Gabes Facility', code: 'COFGB', region: 'North Africa', country: 'Tunisia', location: 'Gabes', description: '', is_active: false, created_at: '', updated_at: '' },
    { id: '4', name: 'Sousse Hub', code: 'COFSS', region: 'North Africa', country: 'Tunisia', location: 'Sousse', description: '', is_active: true, created_at: '', updated_at: '' },
    { id: '5', name: 'Bizerte Unit', code: 'COFBZ', region: 'North Africa', country: 'Tunisia', location: 'Bizerte', description: '', is_active: false, created_at: '', updated_at: '' }
  ];

  sites = signal<Site[]>([...this._sites]);

  getSites() {
    return this.sites();
  }

  getSiteById(id: string) {
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
