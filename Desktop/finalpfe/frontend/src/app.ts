import { Component } from '@angular/core';
import { AuthStore } from '@core/services/auth-store';
import { I18nService } from '@core/services/i18n.service';
import { RuntimeTranslationService } from '@core/services/runtime-translation.service';
import { ThemeService } from '@core/services/theme.service';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>'
})
export class AppComponent {
  constructor(
    private authStore: AuthStore,
    private i18n: I18nService,
    private runtimeTranslation: RuntimeTranslationService,
    private theme: ThemeService,
  ) {
    // Force signals to load from localStorage before any rendering
    this.authStore.token();
    this.authStore.user();
    this.i18n.init();
    this.theme.init();
    this.runtimeTranslation.init();
  }
}
