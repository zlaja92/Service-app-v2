import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideAppInitializer } from '@angular/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { appInitializer } from './app/core/initializer/app-initializer';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes),
    provideAppInitializer(appInitializer),
  ],
});
