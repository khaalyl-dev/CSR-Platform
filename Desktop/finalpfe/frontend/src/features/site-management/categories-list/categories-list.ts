import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoriesApi } from '../api/categories-api';
import type { Category } from '../models/category.model';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories-list.html',
})
export class CategoriesListComponent implements OnInit {
  private categoriesApi = inject(CategoriesApi);

  categories = signal<Category[]>([]);
  loading = signal(true);
  errorMsg = signal('');
  adding = signal(false);
  newName = '';

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
        this.errorMsg.set('Impossible de charger les catégories.');
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
}
