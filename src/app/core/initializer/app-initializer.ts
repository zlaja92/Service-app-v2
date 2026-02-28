import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseInitService } from '../firebase/firebase-init.service';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { TenantService } from '../tenant/tenant.service';
import { ConfigService } from '../config/config.service';
import { ConfigStore } from '../config/config.store';
import { ThemeService } from '../theme/theme.service';
import { LogoCacheService } from '../theme/logo-cache.service';
import { LoggerService } from '../logger/logger.service';

async function loadAndCacheLogo(
  configStore: InstanceType<typeof ConfigStore>,
  logoCacheService: LogoCacheService,
): Promise<void> {
  const theme = configStore.theme();
  const version = configStore.config()?.version ?? 0;

  if (theme.logoUrl) {
    const logoDataUrl = await logoCacheService.getLogoDataUrl(theme.logoUrl, version);
    configStore.setLogoDataUrl(logoDataUrl);
  }
}

export async function appInitializer() {
  const firebaseInit = inject(FirebaseInitService);
  const authService = inject(AuthService);
  const authStore = inject(AuthStore);
  const tenantService = inject(TenantService);
  const configService = inject(ConfigService);
  const configStore = inject(ConfigStore);
  const themeService = inject(ThemeService);
  const logoCacheService = inject(LogoCacheService);
  const logger = inject(LoggerService);
  const router = inject(Router);

  logger.info('App initializer started');

  // Step 1: Initialize Firebase
  firebaseInit.initialize();

  // Step 2: Wait for Firebase to restore auth session from persistence
  // (On web this is IndexedDB, on native it's Keychain/EncryptedPrefs)
  try {
    const user = await authService.waitForAuthReady();

    if (user) {
      logger.info('Restored auth session', { uid: user.uid, email: user.email });
      authStore.setUser(user);

      // Step 3: Resolve tenant from custom claims
      await tenantService.resolveFromAuthToken();

      // Step 4: Load config from Firestore (with local caching)
      if (tenantService.getCurrentTenantId()) {
        const config = await configService.loadConfig();
        configStore.setConfig(config);
        logger.info('Config loaded from Firestore', { version: config.version });
      } else {
        logger.warn('No tenantId resolved, using default config');
        configStore.loadDefaults();
      }
      // Step 5: Apply theme
      const theme = configStore.theme();
      themeService.applyTheme(theme);

      // Step 6: Cache logo (non-blocking — app renders while logo downloads)
      loadAndCacheLogo(configStore, logoCacheService);

      logger.info('App initialized with authenticated user');
    } else {
      logger.info('No authenticated user, loading defaults');
      configStore.loadDefaults();
      themeService.applyTheme(configStore.theme());
    }
  } catch (error) {
    logger.error('App initializer error', { error: String(error) });
    configStore.loadDefaults();
    themeService.applyTheme(configStore.theme());
  }

  // Step 7: Listen for future auth state changes
  authService.onAuthStateChange(async (user) => {
    if (user) {
      authStore.setUser(user);
      await tenantService.resolveFromAuthToken();

      // Reload config on re-authentication (e.g. token refresh, different user)
      if (tenantService.getCurrentTenantId()) {
        const config = await configService.loadConfig();
        configStore.setConfig(config);
        themeService.applyTheme(configStore.theme());
        loadAndCacheLogo(configStore, logoCacheService);
      }
    } else {
      authStore.clearUser();
      router.navigate(['/login']);
    }
  });

  logger.info('App initializer completed');
}
