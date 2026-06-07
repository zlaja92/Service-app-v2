import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseInitService } from '../firebase/firebase-init.service';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { ConfigStore } from '../config/config.store';
import { ThemeService } from '../theme/theme.service';
import { TranslationService } from '../i18n/translation.service';
import { ReportPreferenceService } from '../../features/reports/services/report-preference.service';
import { SessionService } from '../session/session.service';
import { LoggerService } from '../logger/logger.service';

export async function appInitializer() {
  const firebaseInit = inject(FirebaseInitService);
  const authService = inject(AuthService);
  const authStore = inject(AuthStore);
  const configStore = inject(ConfigStore);
  const themeService = inject(ThemeService);
  const translationService = inject(TranslationService);
  const reportPreference = inject(ReportPreferenceService);
  const sessionService = inject(SessionService);
  const logger = inject(LoggerService);
  const router = inject(Router);

  logger.info('App initializer started');

  // Step 1: Initialize Firebase
  firebaseInit.initialize();

  // Step 1.5: Apply dark mode preference early (before auth, so login page is themed)
  await themeService.initDarkMode();

  // Step 1.55: Load the auto-open-report preference (read by the save flows)
  await reportPreference.init();

  // Step 1.6: Load language preference (before auth, so login page is translated)
  await translationService.init();

  // Step 2: Wait for Firebase to restore auth session from persistence
  try {
    const user = await authService.waitForAuthReady();

    if (user) {
      logger.info('Restored auth session', { uid: user.uid, email: user.email });
      authStore.setUser(user);
      await sessionService.bootstrap();
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

  // Step 3: Listen for future auth state changes
  authService.onAuthStateChange(async (user) => {
    try {
      if (user) {
        authStore.setUser(user);
        await sessionService.bootstrap();
      } else {
        authStore.clearUser();
        sessionService.teardown();
        router.navigate(['/login']);
      }
    } catch (error) {
      logger.error('Auth state change handler failed', { error: String(error) });
    }
  });

  logger.info('App initializer completed');
}
