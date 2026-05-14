import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService, Translation } from '@jsverse/transloco';
import { FirestoreService } from '../firebase/firestore.service';
import { LoggerService } from '../logger/logger.service';
import { TranslationCacheService } from './translation-cache.service';
import {
  DEFAULT_LANGUAGE,
  BUNDLED_LANGUAGES,
  LANGUAGE_LABELS,
  TranslationVersionDoc,
} from './i18n.model';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private translocoService = inject(TranslocoService);
  private firestoreService = inject(FirestoreService);
  private cacheService = inject(TranslationCacheService);
  private logger = inject(LoggerService);

  readonly currentLanguage = signal(DEFAULT_LANGUAGE);
  readonly availableLanguages = signal<string[]>(BUNDLED_LANGUAGES);
  private languageLabels = signal<Record<string, string>>(LANGUAGE_LABELS);

  /**
   * Step 1.6 in bootstrap: load stored language preference and set active lang.
   * Runs BEFORE auth — uses only Capacitor Preferences.
   */
  async init(): Promise<void> {
    const stored = await this.cacheService.getStoredLanguage();

    if (stored) {
      this.currentLanguage.set(stored);
      this.translocoService.setActiveLang(stored);
      this.logger.info('Language loaded from preferences', { language: stored });
    } else {
      this.currentLanguage.set(DEFAULT_LANGUAGE);
      this.logger.info('Using default language', { language: DEFAULT_LANGUAGE });
    }

    // Restore cached languages list
    const cachedLangs = await this.cacheService.getCachedLanguages();
    if (cachedLangs && cachedLangs.length > 0) {
      this.availableLanguages.set(cachedLangs);
      this.translocoService.setAvailableLangs(cachedLangs);
    }

    // Restore cached labels
    const cachedLabels = await this.cacheService.getCachedLabels();
    if (Object.keys(cachedLabels).length > 0) {
      this.languageLabels.set(cachedLabels);
    }
  }

  /**
   * Step 4.5 in bootstrap: sync translations with Firestore.
   * Compares per-language versions, downloads only changed languages.
   * Also detects newly added languages.
   */
  async sync(): Promise<void> {
    try {
      const remoteVersions = await this.firestoreService.getTenantDocument<TranslationVersionDoc>(
        'translations',
        'version',
      );

      if (!remoteVersions) {
        this.logger.debug('No translation version document found in Firestore');
        return;
      }

      const remoteLanguages = Object.keys(remoteVersions);
      const localVersions = await this.cacheService.getCachedVersions();

      this.logger.info('[DEBUG] Translation version check', {
        remoteVersions: JSON.stringify(remoteVersions),
        localVersions: JSON.stringify(localVersions),
      });

      // Update available languages
      this.availableLanguages.set(remoteLanguages);
      this.translocoService.setAvailableLangs(remoteLanguages);
      await this.cacheService.cacheLanguages(remoteLanguages);

      // Extract and cache labels from version doc
      const labels: Record<string, string> = {};
      for (const lang of remoteLanguages) {
        labels[lang] = remoteVersions[lang].label ?? lang;
      }
      this.languageLabels.set(labels);
      await this.cacheService.cacheLabels(labels);

      // Download only languages that changed or are new
      for (const lang of remoteLanguages) {
        const remoteVersion = remoteVersions[lang].version;
        const localVersion = localVersions[lang] ?? 0;

        if (localVersion >= remoteVersion) {
          continue;
        }

        this.logger.info('Downloading translation update', {
          lang,
          localVersion,
          remoteVersion,
        });

        const translation = await this.firestoreService.getTenantDocument<Translation>(
          'translations',
          lang,
        );

        if (translation) {
          this.logger.info('[DEBUG] Downloaded translation', {
            lang,
            keyCount: Object.keys(translation).length,
            hasPartNoteKey: 'part_note_price_disclaimer' in translation,
            partNoteValue: (translation as Record<string, unknown>)['part_note_price_disclaimer'],
          });

          await this.cacheService.cacheTranslation(lang, translation);
          await this.cacheService.cacheVersion(lang, remoteVersion);

          // Update Transloco's internal cache
          this.translocoService.setTranslation(translation, lang);
        } else {
          this.logger.warn('[DEBUG] Translation document is null/empty', { lang });
        }
      }

      this.logger.info('Translation sync completed', {
        languages: remoteLanguages,
      });
    } catch (error) {
      this.logger.warn('Translation sync failed, using cached/bundled translations', {
        error: String(error),
      });
    }
  }

  /**
   * Change language. Called from UI (menu selector).
   */
  async setLanguage(lang: string): Promise<void> {
    this.translocoService.setActiveLang(lang);
    this.currentLanguage.set(lang);
    await this.cacheService.storeLanguage(lang);
    this.logger.info('Language changed', { language: lang });
  }

  /**
   * Get language display label (native name).
   * Falls back to the language code if no label is defined.
   */
  getLanguageLabel(lang: string): string {
    return this.languageLabels()[lang] ?? lang;
  }
}
