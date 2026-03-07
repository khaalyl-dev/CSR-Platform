import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  LOCALE_ID,
  APP_INITIALIZER,
  importProvidersFrom,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import localeEn from '@angular/common/locales/en';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { jwtInterceptor } from '@core/interceptors/jwt.interceptor';
import { errorToastInterceptor } from '@core/interceptors/error-toast.interceptor';
import { initSession } from '@core/services/session-init';

// Register French locale
registerLocaleData(localeFr);
registerLocaleData(localeEn);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor, errorToastInterceptor])),
    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'en',
      }),
    ),
    provideTranslateHttpLoader({
      prefix: '/i18n/',
      suffix: '.json',
    }),
    { provide: LOCALE_ID, useValue: 'en-US' },
    { provide: APP_INITIALIZER, useFactory: initSession, multi: true },
  ],
};
