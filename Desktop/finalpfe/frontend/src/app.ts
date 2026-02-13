import { Component, inject } from '@angular/core';
import { AuthStore } from './core/auth-store';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>'
})
export class AppComponent {
  constructor(private authStore: AuthStore) {
    // Force signals to load from localStorage before any rendering
    this.authStore.token();
    this.authStore.user();
  }
}
