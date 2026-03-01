import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { isDevMode, provideAppInitializer } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { appInitializer } from './app/core/initializer/app-initializer';
import { FirestoreTranslocoLoader } from './app/core/i18n/firestore-transloco-loader';
import { DEFAULT_LANGUAGE, BUNDLED_LANGUAGES } from './app/core/i18n/i18n.model';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes),
    provideTransloco({
      config: {
        availableLangs: BUNDLED_LANGUAGES,
        defaultLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: FirestoreTranslocoLoader,
    }),
    provideAppInitializer(appInitializer),
  ],
});
