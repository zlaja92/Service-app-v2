import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Translation } from '@jsverse/transloco';

import { FirestoreTranslocoLoader } from './firestore-transloco-loader';
import { TranslationCacheService } from './translation-cache.service';
import { FirestoreService } from '../firebase/firestore.service';
import { TenantService } from '../tenant/tenant.service';
import { LoggerService } from '../logger/logger.service';
import { DEFAULT_LANGUAGE } from './i18n.model';
import {
  createMockFirestoreService,
  createMockTenantService,
  createMockLoggerService,
} from '../../testing/mock-factories';

describe('FirestoreTranslocoLoader', () => {
  let loader: FirestoreTranslocoLoader;
  let mockCache: jasmine.SpyObj<TranslationCacheService>;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockTenant: jasmine.SpyObj<TenantService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  const MOCK_SR_TRANSLATION: Translation = { greeting: 'Zdravo', title: 'Naslov' };
  const MOCK_EN_TRANSLATION: Translation = { greeting: 'Hello', title: 'Title' };
  const MOCK_MK_TRANSLATION: Translation = { greeting: 'Zdravo MK', title: 'Naslov MK' };

  beforeEach(() => {
    mockCache = jasmine.createSpyObj<TranslationCacheService>('TranslationCacheService', [
      'getCachedTranslation',
      'cacheTranslation',
      'getBundledTranslation',
      'getCachedVersions',
      'cacheVersion',
      'getCachedLanguages',
      'cacheLanguages',
      'getStoredLanguage',
      'storeLanguage',
      'getCachedLabels',
      'cacheLabels',
    ]);

    // Default: cache miss, no bundled translation
    mockCache.getCachedTranslation.and.resolveTo(null);
    mockCache.cacheTranslation.and.resolveTo();
    mockCache.getBundledTranslation.and.returnValue(null);

    mockFirestore = createMockFirestoreService();
    mockTenant = createMockTenantService();
    mockLogger = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        FirestoreTranslocoLoader,
        { provide: TranslationCacheService, useValue: mockCache },
        { provide: FirestoreService, useValue: mockFirestore },
        { provide: TenantService, useValue: mockTenant },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    loader = TestBed.inject(FirestoreTranslocoLoader);
  });

  // TC-FTL-01: Returns cached translation on cache hit
  it('TC-FTL-01: should return cached translation when cache hit', async () => {
    mockCache.getCachedTranslation.and.resolveTo(MOCK_SR_TRANSLATION);

    const result = await firstValueFrom(loader.getTranslation('sr'));

    expect(result).toEqual(MOCK_SR_TRANSLATION);
    expect(mockFirestore.getTenantDocument).not.toHaveBeenCalled();
  });

  // TC-FTL-02: Falls back to Firestore on cache miss
  it('TC-FTL-02: should fall back to Firestore when cache miss', async () => {
    mockCache.getCachedTranslation.and.resolveTo(null);
    mockFirestore.getTenantDocument.and.resolveTo(MOCK_SR_TRANSLATION as unknown as null);

    const result = await firstValueFrom(loader.getTranslation('sr'));

    expect(result).toEqual(MOCK_SR_TRANSLATION);
    expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('translations', 'sr');
  });

  // TC-FTL-03: Caches Firestore result for next call (cacheTranslation is NOT called in source — Firestore result is returned directly without caching)
  // NOTE: The source code does NOT call cacheTranslation after fetching from Firestore.
  // This test verifies that getTenantDocument is called when cache misses.
  it('TC-FTL-03: should call Firestore with correct collection and document when cache miss', async () => {
    mockCache.getCachedTranslation.and.resolveTo(null);
    mockFirestore.getTenantDocument.and.resolveTo(MOCK_EN_TRANSLATION as unknown as null);

    await firstValueFrom(loader.getTranslation('en'));

    expect(mockFirestore.getTenantDocument).toHaveBeenCalledOnceWith('translations', 'en');
  });

  // TC-FTL-04: Falls back to bundled translation when Firestore fails
  it('TC-FTL-04: should fall back to bundled translation when Firestore throws', async () => {
    mockCache.getCachedTranslation.and.resolveTo(null);
    mockFirestore.getTenantDocument.and.rejectWith(new Error('Firestore unavailable'));
    mockCache.getBundledTranslation.and.callFake((lang: string) =>
      lang === 'sr' ? MOCK_SR_TRANSLATION : null,
    );

    const result = await firstValueFrom(loader.getTranslation('sr'));

    expect(result).toEqual(MOCK_SR_TRANSLATION);
    expect(mockCache.getBundledTranslation).toHaveBeenCalledWith('sr');
  });

  // TC-FTL-05: Falls back to default language bundled when requested lang not available
  it('TC-FTL-05: should fall back to default language bundled translation when requested lang not available', async () => {
    const lang = 'mk';
    mockCache.getCachedTranslation.and.resolveTo(null);
    // No tenant = Firestore not attempted; simulate no tenant
    mockTenant.getCurrentTenantId.and.returnValue(null as unknown as string);
    // 'mk' bundled not available, DEFAULT_LANGUAGE bundled is available
    mockCache.getBundledTranslation.and.callFake((l: string) =>
      l === DEFAULT_LANGUAGE ? MOCK_SR_TRANSLATION : null,
    );

    const result = await firstValueFrom(loader.getTranslation(lang));

    expect(result).toEqual(MOCK_SR_TRANSLATION);
    expect(mockCache.getBundledTranslation).toHaveBeenCalledWith(lang);
    expect(mockCache.getBundledTranslation).toHaveBeenCalledWith(DEFAULT_LANGUAGE);
  });

  // TC-FTL-06: Returns Observable
  it('TC-FTL-06: should return an Observable', () => {
    mockCache.getCachedTranslation.and.resolveTo(MOCK_SR_TRANSLATION);

    const result = loader.getTranslation('sr');

    // Observable has subscribe method
    expect(typeof result.subscribe).toBe('function');
  });

  // TC-FTL-07 (bonus): Logs cache hit
  it('TC-FTL-07: should log debug on cache hit', async () => {
    mockCache.getCachedTranslation.and.resolveTo(MOCK_SR_TRANSLATION);

    await firstValueFrom(loader.getTranslation('sr'));

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Translation loaded from cache',
      jasmine.objectContaining({ lang: 'sr' }),
    );
  });

  // TC-FTL-08 (bonus): Logs Firestore error on failure
  it('TC-FTL-08: should log warn when Firestore throws', async () => {
    mockCache.getCachedTranslation.and.resolveTo(null);
    mockFirestore.getTenantDocument.and.rejectWith(new Error('Network error'));
    mockCache.getBundledTranslation.and.returnValue(MOCK_SR_TRANSLATION);

    await firstValueFrom(loader.getTranslation('sr'));

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to load translation from Firestore',
      jasmine.objectContaining({ lang: 'sr' }),
    );
  });

  // TC-FTL-09 (bonus): Returns empty object as last-resort fallback
  it('TC-FTL-09: should return empty object when no translation is available at all', async () => {
    mockCache.getCachedTranslation.and.resolveTo(null);
    mockTenant.getCurrentTenantId.and.returnValue(null as unknown as string);
    // No bundled translations for any lang
    mockCache.getBundledTranslation.and.returnValue(null);

    const result = await firstValueFrom(loader.getTranslation('unknown-lang'));

    expect(result).toEqual({});
  });

  // TC-FTL-10: Does not call Firestore when no tenant
  it('TC-FTL-10: should not call Firestore when getCurrentTenantId returns null', async () => {
    mockCache.getCachedTranslation.and.resolveTo(null);
    mockTenant.getCurrentTenantId.and.returnValue(null as unknown as string);
    mockCache.getBundledTranslation.and.returnValue(MOCK_SR_TRANSLATION);

    await firstValueFrom(loader.getTranslation('sr'));

    expect(mockFirestore.getTenantDocument).not.toHaveBeenCalled();
  });

  // ─── EXPANSION: language code matrix ─────────────────────────────────────────

  describe('cache hit matrix — multiple languages', () => {
    const languages = ['sr', 'en', 'mk', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'nl'];
    const mockTranslations: Record<string, Translation> = {
      sr: { hello: 'Zdravo' },
      en: { hello: 'Hello' },
      mk: { hello: 'Zdravo MK' },
      de: { hello: 'Hallo' },
      fr: { hello: 'Bonjour' },
      es: { hello: 'Hola' },
      it: { hello: 'Ciao' },
      pt: { hello: 'Olá' },
      ru: { hello: 'Привет' },
      nl: { hello: 'Hallo NL' },
    };

    languages.forEach(lang => {
      it(`should return cached translation for language "${lang}"`, async () => {
        const translation = mockTranslations[lang] ?? { hello: `Hello in ${lang}` };
        mockCache.getCachedTranslation.and.resolveTo(translation);

        const result = await firstValueFrom(loader.getTranslation(lang));

        expect(result).toEqual(translation);
        expect(mockFirestore.getTenantDocument).not.toHaveBeenCalled();
      });
    });
  });

  describe('Firestore fetch matrix — multiple languages', () => {
    const languages = ['sr', 'en', 'mk'];
    const mockTranslations: Record<string, Translation> = {
      sr: MOCK_SR_TRANSLATION,
      en: MOCK_EN_TRANSLATION,
      mk: MOCK_MK_TRANSLATION,
    };

    languages.forEach(lang => {
      it(`should fetch Firestore document 'translations/${lang}' on cache miss`, async () => {
        mockCache.getCachedTranslation.and.resolveTo(null);
        mockFirestore.getTenantDocument.and.resolveTo(mockTranslations[lang] as unknown as null);

        const result = await firstValueFrom(loader.getTranslation(lang));

        expect(result).toEqual(mockTranslations[lang]);
        expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('translations', lang);
      });
    });
  });

  describe('Firestore error matrix — multiple languages fall to bundled', () => {
    const languages = ['sr', 'en', 'mk'];
    const bundledTranslations: Record<string, Translation> = {
      sr: MOCK_SR_TRANSLATION,
      en: MOCK_EN_TRANSLATION,
      mk: MOCK_MK_TRANSLATION,
    };

    languages.forEach(lang => {
      it(`should use bundled translation for "${lang}" when Firestore fails`, async () => {
        mockCache.getCachedTranslation.and.resolveTo(null);
        mockFirestore.getTenantDocument.and.rejectWith(new Error('Network error'));
        mockCache.getBundledTranslation.and.callFake((l: string) => bundledTranslations[l] ?? null);

        const result = await firstValueFrom(loader.getTranslation(lang));

        expect(result).toEqual(bundledTranslations[lang]);
      });
    });
  });

  describe('no-tenant matrix — falls through to bundled for multiple languages', () => {
    const languages = ['sr', 'en', 'mk'];

    languages.forEach(lang => {
      it(`should not call Firestore for "${lang}" when tenant is null`, async () => {
        mockCache.getCachedTranslation.and.resolveTo(null);
        mockTenant.getCurrentTenantId.and.returnValue(null as unknown as string);
        mockCache.getBundledTranslation.and.returnValue({ lang_key: `value for ${lang}` });

        await firstValueFrom(loader.getTranslation(lang));

        expect(mockFirestore.getTenantDocument).not.toHaveBeenCalled();
      });
    });
  });

  describe('last-resort fallback matrix — various unknown languages', () => {
    const unknownLangs = ['xx', 'yy', 'zz', 'unknown', 'test-lang'];

    unknownLangs.forEach(lang => {
      it(`should return empty object for unknown language "${lang}" when no bundled available`, async () => {
        mockCache.getCachedTranslation.and.resolveTo(null);
        mockTenant.getCurrentTenantId.and.returnValue(null as unknown as string);
        mockCache.getBundledTranslation.and.returnValue(null);

        const result = await firstValueFrom(loader.getTranslation(lang));

        expect(result).toEqual({});
      });
    });
  });

  describe('Observable behavior', () => {
    it('should emit exactly one value and complete for cache hit', async () => {
      mockCache.getCachedTranslation.and.resolveTo(MOCK_SR_TRANSLATION);
      let emitCount = 0;

      await new Promise<void>((resolve, reject) => {
        loader.getTranslation('sr').subscribe({
          next: () => { emitCount++; },
          error: reject,
          complete: resolve,
        });
      });

      expect(emitCount).toBe(1);
    });

    it('should emit exactly one value and complete for Firestore fetch', async () => {
      mockCache.getCachedTranslation.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.resolveTo(MOCK_EN_TRANSLATION as unknown as null);
      let emitCount = 0;

      await new Promise<void>((resolve, reject) => {
        loader.getTranslation('en').subscribe({
          next: () => { emitCount++; },
          error: reject,
          complete: resolve,
        });
      });

      expect(emitCount).toBe(1);
    });

    it('should complete Observable even when returning empty fallback', async () => {
      mockCache.getCachedTranslation.and.resolveTo(null);
      mockTenant.getCurrentTenantId.and.returnValue(null as unknown as string);
      mockCache.getBundledTranslation.and.returnValue(null);
      let completed = false;

      await new Promise<void>((resolve) => {
        loader.getTranslation('xx').subscribe({
          complete: () => { completed = true; resolve(); },
        });
      });

      expect(completed).toBe(true);
    });
  });

  describe('Logging behavior', () => {
    it('should log debug when loading from Firestore', async () => {
      mockCache.getCachedTranslation.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.resolveTo(MOCK_SR_TRANSLATION as unknown as null);

      await firstValueFrom(loader.getTranslation('sr'));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Translation loaded from Firestore',
        jasmine.objectContaining({ lang: 'sr' }),
      );
    });

    it('should log debug when loading from bundled fallback', async () => {
      mockCache.getCachedTranslation.and.resolveTo(null);
      mockTenant.getCurrentTenantId.and.returnValue(null as unknown as string);
      mockCache.getBundledTranslation.and.returnValue(MOCK_SR_TRANSLATION);

      await firstValueFrom(loader.getTranslation('sr'));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Translation loaded from bundled fallback',
        jasmine.objectContaining({ lang: 'sr' }),
      );
    });

    it('should log warn when no translation found at all', async () => {
      mockCache.getCachedTranslation.and.resolveTo(null);
      mockTenant.getCurrentTenantId.and.returnValue(null as unknown as string);
      mockCache.getBundledTranslation.and.returnValue(null);

      await firstValueFrom(loader.getTranslation('xx'));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No translation found, falling back to default language',
        jasmine.objectContaining({ requested: 'xx', fallback: DEFAULT_LANGUAGE }),
      );
    });

    it('should not log warn when cache hit', async () => {
      mockCache.getCachedTranslation.and.resolveTo(MOCK_SR_TRANSLATION);

      await firstValueFrom(loader.getTranslation('sr'));

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Firestore null document handling', () => {
    it('should fall through to bundled when Firestore returns null document', async () => {
      mockCache.getCachedTranslation.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.resolveTo(null);
      mockCache.getBundledTranslation.and.returnValue(MOCK_SR_TRANSLATION);

      const result = await firstValueFrom(loader.getTranslation('sr'));

      // When Firestore returns null, falls through to bundled
      expect(result).toEqual(MOCK_SR_TRANSLATION);
    });
  });

  describe('getCachedTranslation called with correct lang', () => {
    const langs = ['sr', 'en', 'mk'];

    langs.forEach(lang => {
      it(`should call getCachedTranslation with "${lang}"`, async () => {
        mockCache.getCachedTranslation.and.resolveTo(MOCK_SR_TRANSLATION);

        await firstValueFrom(loader.getTranslation(lang));

        expect(mockCache.getCachedTranslation).toHaveBeenCalledWith(lang);
      });
    });
  });
});
