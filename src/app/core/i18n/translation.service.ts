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

        // Bundled translation is the base: app-shipped keys are always present,
        // and a language declared in the version doc but WITHOUT a translation
        // document still resolves (falls back entirely to the bundle) instead of
        // rendering raw keys.
        const base = this.cacheService.getBundledTranslation(lang) ?? {};

        if (translation) {
          await this.cacheService.cacheTranslation(lang, translation);
          // Only cache the version once we have actually downloaded the remote
          // document, so a later upload of the doc at the SAME version is still
          // picked up on the next sync (the bundle-fallback path must not mark
          // the version as satisfied).
          await this.cacheService.cacheVersion(lang, remoteVersion);
          // Update Transloco's internal cache, merged over the bundled base so
          // app-shipped keys missing from the remote doc are still present.
          this.translocoService.setTranslation({ ...base, ...translation }, lang);
        } else if (Object.keys(base).length > 0) {
          // No remote document, but the language is bundled — use the bundle so
          // the active language is never left without translations after sync.
          // Do NOT cache the version: if the remote doc is added later at this
          // same version, the next sync must still download it.
          this.translocoService.setTranslation(base, lang);
        } else {
          this.logger.warn('No remote or bundled translation for language', { lang });
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
   * Get the language display label, shown in the CURRENTLY ACTIVE language via a
   * `language_<code>` translation key (so e.g. in English the list reads
   * "Serbian / English / Slovenian"). Falls back to the Firestore-provided label
   * (for languages added via the DB), then to the language code.
   */
  getLanguageLabel(lang: string): string {
    const key = `language_${lang}`;
    const translated = this.translocoService.translate(key);
    // translate() returns the key itself when there is no entry → use fallbacks.
    if (translated && translated !== key) return translated;
    return this.languageLabels()[lang] ?? lang;
  }
}
