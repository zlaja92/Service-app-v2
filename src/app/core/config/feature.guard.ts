import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { ConfigStore } from './config.store';
import { FeatureFlags } from './config.model';

export function featureGuard(featureName: keyof FeatureFlags): CanMatchFn {
  return () => {
    const configStore = inject(ConfigStore);
    const router = inject(Router);

    if (configStore.isFeatureEnabled(featureName)) {
      return true;
    }

    return router.createUrlTree(['/home']);
  };
}
