import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Sidebar } from '../../shared/sidebar/sidebar';
import { AuthStore } from '../../core/auth-store';


@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, Sidebar],
  templateUrl: './main-layout.html'
})
export class MainLayout {
  private authStore = inject(AuthStore);
  isAuthenticated = this.authStore.isAuthenticated;
}
