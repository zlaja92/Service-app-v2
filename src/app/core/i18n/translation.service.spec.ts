import { TestBed } from '@angular/core/testing';
import { TranslocoService, Translation } from '@jsverse/transloco';

import { TranslationService } from './translation.service';
import { FirestoreService } from '../firebase/firestore.service';
import { LoggerService } from '../logger/logger.service';
import { TranslationCacheService } from './translation-cache.service';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_LABELS,
  TranslationVersionDoc,
} from './i18n.model';
import {
  createMockTranslocoService,
  createMockFirestoreService,
  createMockLoggerService,
} from '../../testing/mock-factories';

describe('TranslationService', () => {
  let service: TranslationService;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockCache: jasmine.SpyObj<TranslationCacheService>;

  function createMockCacheService(): jasmine.SpyObj<TranslationCacheService> {
    const mock = jasmine.createSpyObj<TranslationCacheService>('TranslationCacheService', [
      'getStoredLanguage',
      'storeLanguage',
      'getCachedLanguages',
      'cacheLanguages',
      'getCachedVersions',
      'cacheVersion',
      'getCachedTranslation',
      'cacheTranslation',
      'getBundledTranslation',
      'getCachedLabels',
      'cacheLabels',
    ]);

    // Sensible defaults — empty / null cache
    mock.getStoredLanguage.and.resolveTo(null);
    mock.storeLanguage.and.resolveTo();
    mock.getCachedLanguages.and.resolveTo(null);
    mock.cacheLanguages.and.resolveTo();
    mock.getCachedVersions.and.resolveTo({});
    mock.cacheVersion.and.resolveTo();
    mock.getCachedTranslation.and.resolveTo(null);
    mock.cacheTranslation.and.resolveTo();
    mock.getBundledTranslation.and.returnValue(null);
    mock.getCachedLabels.and.resolveTo({});
    mock.cacheLabels.and.resolveTo();

    return mock;
  }

  beforeEach(() => {
    mockTransloco = createMockTranslocoService();
    mockFirestore = createMockFirestoreService();
    mockLogger = createMockLoggerService();
    mockCache = createMockCacheService();

    TestBed.configureTestingModule({
      providers: [
        TranslationService,
        { provide: TranslocoService, useValue: mockTransloco },
        { provide: FirestoreService, useValue: mockFirestore },
        { provide: LoggerService, useValue: mockLogger },
        { provide: TranslationCacheService, useValue: mockCache },
      ],
    });

    service = TestBed.inject(TranslationService);
  });

  // ─── init() ───────────────────────────────────────────────────────────────

  describe('init()', () => {
    // TC-TS-01: Reads stored language from cache
    it('TC-TS-01: should read stored language from cache and set it as active lang', async () => {
      mockCache.getStoredLanguage.and.resolveTo('en');

      await service.init();

      expect(mockCache.getStoredLanguage).toHaveBeenCalledTimes(1);
      expect(mockTransloco.setActiveLang).toHaveBeenCalledWith('en');
      expect(service.currentLanguage()).toBe('en');
    });

    // TC-TS-02: Falls back to DEFAULT_LANGUAGE when no stored language
    it('TC-TS-02: should fall back to DEFAULT_LANGUAGE when no stored language exists', async () => {
      mockCache.getStoredLanguage.and.resolveTo(null);

      await service.init();

      expect(service.currentLanguage()).toBe(DEFAULT_LANGUAGE);
      // setActiveLang should NOT be called when falling back to default
      expect(mockTransloco.setActiveLang).not.toHaveBeenCalled();
    });

    // TC-TS-03: Sets active language on TranslocoService
    it('TC-TS-03: should set active language on TranslocoService when stored language exists', async () => {
      mockCache.getStoredLanguage.and.resolveTo('mk');

      await service.init();

      expect(mockTransloco.setActiveLang).toHaveBeenCalledWith('mk');
    });

    // TC-TS-16: Multiple init() calls are idempotent
    it('TC-TS-16: should be idempotent — calling init() multiple times does not accumulate side effects', async () => {
      mockCache.getStoredLanguage.and.resolveTo('en');

      await service.init();
      await service.init();
      await service.init();

      // setActiveLang should be called once per init() invocation with stored lang
      expect(mockTransloco.setActiveLang).toHaveBeenCalledTimes(3);
      // Final state should reflect last call
      expect(service.currentLanguage()).toBe('en');
    });

    it('should restore cached available languages list during init()', async () => {
      const cachedLangs = ['sr', 'en', 'mk'];
      mockCache.getCachedLanguages.and.resolveTo(cachedLangs);

      await service.init();

      expect(mockTransloco.setAvailableLangs).toHaveBeenCalledWith(cachedLangs);
      expect(service.availableLanguages()).toEqual(cachedLangs);
    });

    it('should restore cached language labels during init()', async () => {
      const cachedLabels = { sr: 'Srpski', en: 'English', mk: 'Makedonski' };
      mockCache.getCachedLabels.and.resolveTo(cachedLabels);

      await service.init();

      expect(service.getLanguageLabel('mk')).toBe('Makedonski');
    });
  });

  // ─── sync() ───────────────────────────────────────────────────────────────

  describe('sync()', () => {
    const remoteVersionDoc: TranslationVersionDoc = {
      sr: { version: 2, label: 'Srpski' },
      en: { version: 3, label: 'English' },
    };

    // TC-TS-04: Compares cached version with Firestore version
    it('TC-TS-04: should compare cached versions with Firestore versions for each language', async () => {
      mockFirestore.getTenantDocument.and.resolveTo(remoteVersionDoc);
      mockCache.getCachedVersions.and.resolveTo({ sr: 2, en: 3 });

      await service.sync();

      expect(mockCache.getCachedVersions).toHaveBeenCalledTimes(1);
      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('translations', 'version');
    });

    // TC-TS-05: Skips sync when cached version === Firestore version
    it('TC-TS-05: should skip downloading languages whose cached version is up to date', async () => {
      mockFirestore.getTenantDocument.and.resolveTo(remoteVersionDoc);
      // Both languages are up to date
      mockCache.getCachedVersions.and.resolveTo({ sr: 2, en: 3 });

      await service.sync();

      // getTenantDocument called only once for the version doc, not for individual langs
      expect(mockFirestore.getTenantDocument).toHaveBeenCalledTimes(1);
      expect(mockCache.cacheTranslation).not.toHaveBeenCalled();
    });

    // TC-TS-06: Downloads only changed languages
    it('TC-TS-06: should download only languages whose version changed', async () => {
      const translation: Translation = { greeting: 'Hello' };
      mockCache.getCachedVersions.and.resolveTo({ sr: 2, en: 1 }); // en is outdated
      mockFirestore.getTenantDocument.and.callFake(
        ((_col: string, doc: string) => {
          if (doc === 'version') return Promise.resolve(remoteVersionDoc);
          if (doc === 'en') return Promise.resolve(translation);
          return Promise.resolve(null);
        }) as any,
      );

      await service.sync();

      // Should download en (version 1 < 3) but not sr (version 2 === 2)
      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('translations', 'en');
      expect(mockFirestore.getTenantDocument).not.toHaveBeenCalledWith('translations', 'sr');
      expect(mockCache.cacheTranslation).toHaveBeenCalledWith('en', translation);
    });

    // TC-TS-07: Downloads ALL when no cache exists
    it('TC-TS-07: should download all languages when no cached versions exist', async () => {
      const srTranslation: Translation = { greeting: 'Zdravo' };
      const enTranslation: Translation = { greeting: 'Hello' };
      mockCache.getCachedVersions.and.resolveTo({}); // empty cache
      mockFirestore.getTenantDocument.and.callFake(
        ((_col: string, doc: string) => {
          if (doc === 'version') return Promise.resolve(remoteVersionDoc);
          if (doc === 'sr') return Promise.resolve(srTranslation);
          if (doc === 'en') return Promise.resolve(enTranslation);
          return Promise.resolve(null);
        }) as any,
      );

      await service.sync();

      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('translations', 'sr');
      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('translations', 'en');
      expect(mockCache.cacheTranslation).toHaveBeenCalledWith('sr', srTranslation);
      expect(mockCache.cacheTranslation).toHaveBeenCalledWith('en', enTranslation);
    });

    // TC-TS-08: Logs sync results
    it('TC-TS-08: should log sync completion after successful sync', async () => {
      mockFirestore.getTenantDocument.and.resolveTo(remoteVersionDoc);
      mockCache.getCachedVersions.and.resolveTo({ sr: 2, en: 3 });

      await service.sync();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Translation sync completed',
        jasmine.objectContaining({ languages: jasmine.arrayContaining(['sr', 'en']) }),
      );
    });

    // TC-TS-09: Handles Firestore error gracefully (uses bundled)
    it('TC-TS-09: should handle Firestore error gracefully without throwing', async () => {
      mockFirestore.getTenantDocument.and.rejectWith(new Error('Firestore unavailable'));

      await expectAsync(service.sync()).toBeResolved();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Translation sync failed, using cached/bundled translations',
        jasmine.objectContaining({ error: jasmine.stringContaining('Firestore unavailable') }),
      );
    });

    it('should skip sync and log debug when Firestore returns no version document', async () => {
      mockFirestore.getTenantDocument.and.resolveTo(null);

      await service.sync();

      expect(mockLogger.debug).toHaveBeenCalledWith('No translation version document found in Firestore');
      expect(mockCache.cacheTranslation).not.toHaveBeenCalled();
    });

    it('should update available languages from Firestore version document', async () => {
      const versionDocWithMk: TranslationVersionDoc = {
        sr: { version: 1, label: 'Srpski' },
        en: { version: 1, label: 'English' },
        mk: { version: 1, label: 'Makedonski' },
      };
      mockFirestore.getTenantDocument.and.resolveTo(versionDocWithMk);
      mockCache.getCachedVersions.and.resolveTo({ sr: 1, en: 1, mk: 1 });

      await service.sync();

      expect(service.availableLanguages()).toEqual(['sr', 'en', 'mk']);
      expect(mockTransloco.setAvailableLangs).toHaveBeenCalledWith(['sr', 'en', 'mk']);
    });

    it('should cache language labels extracted from Firestore version document', async () => {
      mockFirestore.getTenantDocument.and.resolveTo(remoteVersionDoc);
      mockCache.getCachedVersions.and.resolveTo({ sr: 2, en: 3 });

      await service.sync();

      expect(mockCache.cacheLabels).toHaveBeenCalledWith({ sr: 'Srpski', en: 'English' });
    });

    it('should update Transloco translation cache when a language is downloaded', async () => {
      const enTranslation: Translation = { greeting: 'Hello' };
      mockCache.getCachedVersions.and.resolveTo({ sr: 2, en: 0 }); // en outdated
      mockFirestore.getTenantDocument.and.callFake(
        ((_col: string, doc: string) => {
          if (doc === 'version') return Promise.resolve(remoteVersionDoc);
          if (doc === 'en') return Promise.resolve(enTranslation);
          return Promise.resolve(null);
        }) as any,
      );

      await service.sync();

      expect(mockTransloco.setTranslation).toHaveBeenCalledWith(enTranslation, 'en');
    });
  });

  // ─── setLanguage(lang) ────────────────────────────────────────────────────

  describe('setLanguage(lang)', () => {
    // TC-TS-10: Sets active language on TranslocoService
    it('TC-TS-10: should set active language on TranslocoService', async () => {
      await service.setLanguage('en');

      expect(mockTransloco.setActiveLang).toHaveBeenCalledWith('en');
    });

    // TC-TS-11: Stores language in cache (via TranslationCacheService)
    it('TC-TS-11: should store language preference in cache via TranslationCacheService', async () => {
      await service.setLanguage('mk');

      expect(mockCache.storeLanguage).toHaveBeenCalledWith('mk');
    });

    // TC-TS-12: Updates internal signal
    it('TC-TS-12: should update currentLanguage signal after setLanguage()', async () => {
      expect(service.currentLanguage()).toBe(DEFAULT_LANGUAGE);

      await service.setLanguage('en');

      expect(service.currentLanguage()).toBe('en');
    });

    it('should log language change after setLanguage()', async () => {
      await service.setLanguage('en');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Language changed',
        jasmine.objectContaining({ language: 'en' }),
      );
    });
  });

  // ─── getLanguageLabel(code) ───────────────────────────────────────────────

  describe('getLanguageLabel(code)', () => {
    // TC-TS-13: Returns label for known language
    it('TC-TS-13: should return label for a known language (from LANGUAGE_LABELS)', () => {
      // Default languageLabels signal is seeded with LANGUAGE_LABELS (sr, en)
      expect(service.getLanguageLabel('sr')).toBe(LANGUAGE_LABELS['sr']);
      expect(service.getLanguageLabel('en')).toBe(LANGUAGE_LABELS['en']);
    });

    // TC-TS-14: Returns code itself for unknown language
    it('TC-TS-14: should return language code itself when no label is defined', () => {
      expect(service.getLanguageLabel('zh-CN')).toBe('zh-CN');
      expect(service.getLanguageLabel('fr')).toBe('fr');
    });

    // TC-TS-15: Falls back to bundled labels when no cache — label from sync
    it('TC-TS-15: should return updated label after sync populates labels from Firestore', async () => {
      const versionDocWithMk: TranslationVersionDoc = {
        sr: { version: 1, label: 'Srpski' },
        en: { version: 1, label: 'English' },
        mk: { version: 1, label: 'Makedonski' },
      };
      mockFirestore.getTenantDocument.and.resolveTo(versionDocWithMk);
      mockCache.getCachedVersions.and.resolveTo({ sr: 1, en: 1, mk: 1 });

      // Before sync — unknown code returns the code itself
      expect(service.getLanguageLabel('mk')).toBe('mk');

      await service.sync();

      // After sync — label populated from Firestore version doc
      expect(service.getLanguageLabel('mk')).toBe('Makedonski');
    });

    it('should return label populated from init() cached labels', async () => {
      mockCache.getCachedLabels.and.resolveTo({ sr: 'Srpski', en: 'English', mk: 'Makedonski' });

      await service.init();

      expect(service.getLanguageLabel('mk')).toBe('Makedonski');
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    // TC-TS-17 (bonus): Empty translations object handled
    it('TC-TS-17: should handle empty translations object returned from Firestore without error', async () => {
      const emptyTranslation: Translation = {};
      mockCache.getCachedVersions.and.resolveTo({ sr: 0 });
      mockFirestore.getTenantDocument.and.callFake(
        ((_col: string, doc: string) => {
          if (doc === 'version') {
            return Promise.resolve({ sr: { version: 1, label: 'Srpski' } } as TranslationVersionDoc);
          }
          if (doc === 'sr') return Promise.resolve(emptyTranslation);
          return Promise.resolve(null);
        }) as any,
      );

      await expectAsync(service.sync()).toBeResolved();

      expect(mockCache.cacheTranslation).toHaveBeenCalledWith('sr', emptyTranslation);
      expect(mockTransloco.setTranslation).toHaveBeenCalledWith(emptyTranslation, 'sr');
    });

    // TC-TS-18 (bonus): Concurrent setLanguage calls — last write wins
    it('TC-TS-18: should handle concurrent setLanguage calls — last call wins', async () => {
      const first = service.setLanguage('en');
      const second = service.setLanguage('mk');

      await Promise.all([first, second]);

      // The signal and Transloco should reflect both calls; last invocation determines final state
      expect(mockTransloco.setActiveLang).toHaveBeenCalledWith('en');
      expect(mockTransloco.setActiveLang).toHaveBeenCalledWith('mk');
      expect(mockCache.storeLanguage).toHaveBeenCalledWith('en');
      expect(mockCache.storeLanguage).toHaveBeenCalledWith('mk');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: setLanguage — all language codes × signal + transloco + cache
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setLanguage() — exhaustive language code matrix', () => {
    const languageCodes = ['sr', 'en', 'mk', 'de', 'fr', 'it', 'es', 'pt', 'zh-CN', 'ar'];

    languageCodes.forEach(lang => {
      it(`setLanguage("${lang}") updates currentLanguage signal to "${lang}"`, async () => {
        await service.setLanguage(lang);
        expect(service.currentLanguage()).toBe(lang);
      });

      it(`setLanguage("${lang}") calls TranslocoService.setActiveLang with "${lang}"`, async () => {
        mockTransloco.setActiveLang.calls.reset();
        await service.setLanguage(lang);
        expect(mockTransloco.setActiveLang).toHaveBeenCalledWith(lang);
      });

      it(`setLanguage("${lang}") calls TranslationCacheService.storeLanguage with "${lang}"`, async () => {
        mockCache.storeLanguage.calls.reset();
        await service.setLanguage(lang);
        expect(mockCache.storeLanguage).toHaveBeenCalledWith(lang);
      });

      it(`setLanguage("${lang}") logs info with language: "${lang}"`, async () => {
        mockLogger.info.calls.reset();
        await service.setLanguage(lang);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Language changed',
          jasmine.objectContaining({ language: lang }),
        );
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: init() — 3 languages as stored language
  // ═══════════════════════════════════════════════════════════════════════════

  describe('init() — stored language variations', () => {
    const storedLanguages = ['sr', 'en', 'mk', 'de', 'fr'];

    storedLanguages.forEach(lang => {
      it(`init() with stored "${lang}" sets currentLanguage to "${lang}"`, async () => {
        mockCache.getStoredLanguage.and.resolveTo(lang);
        await service.init();
        expect(service.currentLanguage()).toBe(lang);
      });

      it(`init() with stored "${lang}" calls setActiveLang with "${lang}"`, async () => {
        mockCache.getStoredLanguage.and.resolveTo(lang);
        mockTransloco.setActiveLang.calls.reset();
        await service.init();
        expect(mockTransloco.setActiveLang).toHaveBeenCalledWith(lang);
      });
    });

    it('init() with null stored language does NOT call setActiveLang', async () => {
      mockCache.getStoredLanguage.and.resolveTo(null);
      mockTransloco.setActiveLang.calls.reset();
      await service.init();
      expect(mockTransloco.setActiveLang).not.toHaveBeenCalled();
    });

    it('init() with null stored language keeps currentLanguage as DEFAULT_LANGUAGE', async () => {
      mockCache.getStoredLanguage.and.resolveTo(null);
      await service.init();
      expect(service.currentLanguage()).toBe(DEFAULT_LANGUAGE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: sync() — version mismatch matrix
  // ═══════════════════════════════════════════════════════════════════════════

  describe('sync() — version comparison matrix', () => {
    interface VersionCase {
      lang: string;
      cachedVersion: number;
      remoteVersion: number;
      shouldDownload: boolean;
    }

    const versionCases: VersionCase[] = [
      { lang: 'sr', cachedVersion: 0, remoteVersion: 1, shouldDownload: true },
      { lang: 'sr', cachedVersion: 1, remoteVersion: 1, shouldDownload: false },
      { lang: 'sr', cachedVersion: 1, remoteVersion: 2, shouldDownload: true },
      { lang: 'en', cachedVersion: 5, remoteVersion: 5, shouldDownload: false },
      { lang: 'en', cachedVersion: 5, remoteVersion: 6, shouldDownload: true },
      { lang: 'en', cachedVersion: 0, remoteVersion: 0, shouldDownload: false },
    ];

    versionCases.forEach(({ lang, cachedVersion, remoteVersion, shouldDownload }) => {
      it(`lang="${lang}" cached=${cachedVersion} remote=${remoteVersion} → ${shouldDownload ? 'download' : 'skip'}`, async () => {
        const versionDoc: TranslationVersionDoc = {
          [lang]: { version: remoteVersion, label: 'Label' },
        };
        const cachedVersions: Record<string, number> = { [lang]: cachedVersion };
        const translation: Translation = { key: 'value' };

        mockFirestore.getTenantDocument.and.callFake(
          ((_col: string, doc: string) => {
            if (doc === 'version') return Promise.resolve(versionDoc);
            return Promise.resolve(translation);
          }) as any,
        );
        mockCache.getCachedVersions.and.resolveTo(cachedVersions);

        await service.sync();

        if (shouldDownload) {
          expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('translations', lang);
          expect(mockCache.cacheTranslation).toHaveBeenCalledWith(lang, translation);
        } else {
          expect(mockFirestore.getTenantDocument).not.toHaveBeenCalledWith('translations', lang);
          expect(mockCache.cacheTranslation).not.toHaveBeenCalled();
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: getLanguageLabel — various unknown language codes
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getLanguageLabel() — unknown language codes return code itself', () => {
    const unknownCodes = ['de', 'fr', 'it', 'es', 'pt', 'zh-CN', 'ar', 'ja', 'ko', 'ru'];

    unknownCodes.forEach(code => {
      it(`getLanguageLabel("${code}") returns "${code}" when not in labels`, () => {
        expect(service.getLanguageLabel(code)).toBe(code);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: sequential setLanguage calls
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setLanguage() — sequential calls update signal correctly', () => {
    it('sr → en → mk — final state is mk', async () => {
      await service.setLanguage('sr');
      await service.setLanguage('en');
      await service.setLanguage('mk');
      expect(service.currentLanguage()).toBe('mk');
    });

    it('mk → en — final state is en', async () => {
      await service.setLanguage('mk');
      await service.setLanguage('en');
      expect(service.currentLanguage()).toBe('en');
    });

    it('same language twice — signal stays the same', async () => {
      await service.setLanguage('sr');
      await service.setLanguage('sr');
      expect(service.currentLanguage()).toBe('sr');
      expect(mockTransloco.setActiveLang).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: sync() — multi-language version doc (3 languages)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('sync() — multi-language version docs', () => {
    it('sync with sr+en+mk version doc updates availableLanguages to all 3', async () => {
      const versionDoc: TranslationVersionDoc = {
        sr: { version: 1, label: 'Srpski' },
        en: { version: 1, label: 'English' },
        mk: { version: 1, label: 'Makedonski' },
      };
      mockFirestore.getTenantDocument.and.resolveTo(versionDoc);
      mockCache.getCachedVersions.and.resolveTo({ sr: 1, en: 1, mk: 1 });

      await service.sync();

      expect(service.availableLanguages()).toContain('sr');
      expect(service.availableLanguages()).toContain('en');
      expect(service.availableLanguages()).toContain('mk');
    });

    it('sync with sr+en+mk downloads only outdated languages', async () => {
      const versionDoc: TranslationVersionDoc = {
        sr: { version: 2, label: 'Srpski' },
        en: { version: 3, label: 'English' },
        mk: { version: 1, label: 'Makedonski' },
      };
      mockCache.getCachedVersions.and.resolveTo({ sr: 2, en: 2, mk: 1 }); // only en is outdated

      const enTranslation: Translation = { key: 'en-value' };
      mockFirestore.getTenantDocument.and.callFake(
        ((_col: string, doc: string) => {
          if (doc === 'version') return Promise.resolve(versionDoc);
          if (doc === 'en') return Promise.resolve(enTranslation);
          return Promise.resolve(null);
        }) as any,
      );

      await service.sync();

      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('translations', 'en');
      expect(mockFirestore.getTenantDocument).not.toHaveBeenCalledWith('translations', 'sr');
      expect(mockFirestore.getTenantDocument).not.toHaveBeenCalledWith('translations', 'mk');
    });
  });
});
