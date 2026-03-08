import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CategoriesApi, type RelatedActivity } from '../api/categories-api';
import type { Category } from '../models/category.model';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './categories-list.html',
})
export class CategoriesListComponent implements OnInit {
  private categoriesApi = inject(CategoriesApi);
  private translate = inject(TranslateService);

  categories = signal<Category[]>([]);
  loading = signal(true);
  errorMsg = signal('');
  successMsg = signal('');
  adding = signal(false);
  newName = '';

  /** Delete modal */
  deleteTarget = signal<Category | null>(null);
  relatedActivities = signal<RelatedActivity[]>([]);
  relatedLoading = signal(false);
  deleteRelated = signal(false);
  deleteSubmitting = signal(false);

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.errorMsg.set('');
    this.categoriesApi.list().subscribe({
      next: (list) => {
        this.categories.set(Array.isArray(list) ? list : []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set(this.translate.instant('CATEGORIES.LOAD_ERROR'));
      },
    });
  }

  openAdd(): void {
    this.adding.set(true);
    this.newName = '';
    this.errorMsg.set('');
  }

  cancelAdd(): void {
    this.adding.set(false);
    this.newName = '';
  }

  submitAdd(): void {
    const name = this.newName.trim();
    if (!name) return;
    this.adding.set(false);
    this.loading.set(true);
    this.categoriesApi.create(name).subscribe({
      next: (created) => {
        this.categories.update((list) => [...list, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        this.loading.set(false);
        this.newName = '';
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message || 'Erreur lors de la création.');
      },
    });
  }

  isUncategorized(c: Category): boolean {
    return (c.name || '').toLowerCase() === 'uncategorized';
  }

  openDeleteModal(c: Category): void {
    if (this.isUncategorized(c)) return;
    this.deleteTarget.set(c);
    this.deleteRelated.set(false);
    this.relatedActivities.set([]);
    this.relatedLoading.set(true);
    this.categoriesApi.getRelatedActivities(c.id).subscribe({
      next: (res) => {
        this.relatedActivities.set(res.activities || []);
        this.relatedLoading.set(false);
      },
      error: () => {
        this.relatedLoading.set(false);
        this.errorMsg.set(this.translate.instant('CATEGORIES.LOAD_ERROR'));
        this.closeDeleteModal();
      },
    });
  }

  closeDeleteModal(): void {
    this.deleteTarget.set(null);
    this.relatedActivities.set([]);
    this.deleteRelated.set(false);
    this.deleteSubmitting.set(false);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleteSubmitting.set(true);
    this.categoriesApi.delete(target.id, this.deleteRelated()).subscribe({
      next: (res) => {
        this.closeDeleteModal();
        this.categories.update((list) => list.filter((x) => x.id !== target.id));
        const msg = this.translate.instant('CATEGORIES.DELETE_SUCCESS');
        const extras: string[] = [];
        if (res.deleted_activities > 0) {
          extras.push(this.translate.instant('CATEGORIES.DELETE_DELETED', { n: res.deleted_activities }));
        }
        if (res.reassigned_activities > 0) {
          extras.push(this.translate.instant('CATEGORIES.DELETE_REASSIGNED', { n: res.reassigned_activities }));
        }
        this.errorMsg.set('');
        this.successMsg.set(extras.length ? msg + ' ' + extras.join(' ') : msg);
        setTimeout(() => this.successMsg.set(''), 5000);
      },
      error: (err) => {
        this.deleteSubmitting.set(false);
        this.errorMsg.set(err.error?.message || 'Erreur lors de la suppression.');
      },
    });
  }
}
