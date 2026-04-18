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
import { CLEARABLE_SERVICES } from './app/core/session/clearable';
import { DeviceSearchService } from './app/features/device-catalog/services/device-search.service';
import { DeviceGroupsService } from './app/features/device-catalog/services/device-groups.service';
import { DevicePartsService } from './app/features/device-catalog/services/device-parts.service';
import { CartService } from './app/features/cart/cart.service';
import { DocsService } from './app/features/docs/services/docs.service';
import { PartDetailService } from './app/features/device-catalog/services/part-detail.service';
import { DeviceLookupService } from './app/features/device-management/services/device-lookup.service';
import { DeviceRegistrationService } from './app/features/device-management/services/device-registration.service';
import { InterventionService } from './app/features/device-management/services/intervention.service';
import { AnnualServiceEligibilityService } from './app/features/device-management/services/annual-service-eligibility.service';

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
    { provide: CLEARABLE_SERVICES, useExisting: DeviceSearchService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: DeviceGroupsService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: DevicePartsService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: CartService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: DocsService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: PartDetailService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: DeviceLookupService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: DeviceRegistrationService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: InterventionService, multi: true },
    { provide: CLEARABLE_SERVICES, useExisting: AnnualServiceEligibilityService, multi: true },
  ],
});
