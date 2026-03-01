import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, from } from 'rxjs';
import { TranslationCacheService } from './translation-cache.service';
import { FirestoreService } from '../firebase/firestore.service';
import { TenantService } from '../tenant/tenant.service';
import { LoggerService } from '../logger/logger.service';
import { DEFAULT_LANGUAGE } from './i18n.model';

@Injectable({ providedIn: 'root' })
export class FirestoreTranslocoLoader implements TranslocoLoader {
  private cacheService = inject(TranslationCacheService);
  private firestoreService = inject(FirestoreService);
  private tenantService = inject(TenantService);
  private logger = inject(LoggerService);

  getTranslation(lang: string): Observable<Translation> {
    return from(this.loadTranslation(lang));
  }

  private async loadTranslation(lang: string): Promise<Translation> {
    // 1. Try local cache (Capacitor Preferences)
    const cached = await this.cacheService.getCachedTranslation(lang);
    if (cached) {
      this.logger.debug('Translation loaded from cache', { lang });
      return cached;
    }

    // 2. Try Firestore (only if authenticated with a tenant)
    if (this.tenantService.getCurrentTenantId()) {
      try {
        const remote = await this.firestoreService.getTenantDocument<Translation>(
          'translations',
          lang,
        );
        if (remote) {
          this.logger.debug('Translation loaded from Firestore', { lang });
          return remote;
        }
      } catch (error) {
        this.logger.warn('Failed to load translation from Firestore', {
          lang,
          error: String(error),
        });
      }
    }

    // 3. Bundled fallback
    const bundled = this.cacheService.getBundledTranslation(lang);
    if (bundled) {
      this.logger.debug('Translation loaded from bundled fallback', { lang });
      return bundled;
    }

    // 4. Last resort: return default language bundled translations
    this.logger.warn('No translation found, falling back to default language', {
      requested: lang,
      fallback: DEFAULT_LANGUAGE,
    });
    return this.cacheService.getBundledTranslation(DEFAULT_LANGUAGE) ?? {};
  }
}
