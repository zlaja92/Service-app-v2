/**
 * TranslationCacheService Unit Tests — WU-18b, Batch B1, FAZA F + EXPANSION
 *
 * MOCK STRATEGY
 * =============
 * Preferences (from @capacitor/preferences) is a Proxy created by registerPlugin().
 * spyOn(Preferences, 'get') silently fails because the Proxy trap intercepts all
 * property access (BUG-03 pattern — same as CapacitorHttp and FirebaseAuthentication).
 *
 * In Karma/browser environment the Proxy delegates to PreferencesWeb which stores
 * values in window.localStorage with prefix 'CapacitorStorage.'.
 *
 * Strategy (identical to WU-06 PreferencesService):
 *   - Seed values via localStorage.setItem('CapacitorStorage.<key>', value) before the call.
 *   - Assert stored values via localStorage.getItem('CapacitorStorage.<key>') after the call.
 *   - Clear localStorage in beforeEach/afterEach to guarantee test isolation.
 *
 * TenantService is mocked via jasmine.createSpyObj — TranslationCacheService injects
 * it only to retrieve the current tenantId for key scoping.
 */

import { TestBed } from '@angular/core/testing';
import { TranslationCacheService } from './translation-cache.service';
import { TenantService } from '../tenant/tenant.service';
import {
  translationCacheKey,
  translationsVersionKey,
  translationsLanguagesKey,
  translationsLabelsKey,
  LANGUAGE_PREF_KEY,
} from './i18n.model';

/** Capacitor Preferences web implementation prefixes every key with 'CapacitorStorage.' */
const PREFIX = 'CapacitorStorage.';

function ls(key: string): string | null {
  return localStorage.getItem(`${PREFIX}${key}`);
}

function setLs(key: string, value: string): void {
  localStorage.setItem(`${PREFIX}${key}`, value);
}

describe('TranslationCacheService', () => {
  let service: TranslationCacheService;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  beforeEach(() => {
    // Clear all Capacitor-prefixed entries before each test
    localStorage.clear();

    mockTenantService = jasmine.createSpyObj<TenantService>('TenantService', [
      'getCurrentTenantId',
    ]);
    mockTenantService.getCurrentTenantId.and.returnValue('tenant-test');

    TestBed.configureTestingModule({
      providers: [
        TranslationCacheService,
        { provide: TenantService, useValue: mockTenantService },
      ],
    });

    service = TestBed.inject(TranslationCacheService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ===========================================================================
  // Cached translation (per tenant + language)
  // ===========================================================================

  describe('getCachedTranslation()', () => {
    it('TC-WU18b-01: returns parsed Translation object when entry is present', async () => {
      const lang = 'sr';
      const translation = { hello: 'Zdravo', goodbye: 'Dovidjenja' };
      const key = translationCacheKey(lang, 'tenant-test');
      setLs(key, JSON.stringify(translation));

      const result = await service.getCachedTranslation(lang);

      expect(result).toEqual(translation);
    });

    it('TC-WU18b-02: returns null when no entry is cached for that language', async () => {
      const result = await service.getCachedTranslation('en');

      expect(result).toBeNull();
    });
  });

  describe('cacheTranslation()', () => {
    it('TC-WU18b-03: stores stringified Translation object in Preferences', async () => {
      const lang = 'sr';
      const translation = { title: 'Naslov', save: 'Sacuvaj' };
      const key = translationCacheKey(lang, 'tenant-test');

      await service.cacheTranslation(lang, translation);

      expect(ls(key)).toBe(JSON.stringify(translation));
    });
  });

  // ===========================================================================
  // Version (per tenant, multi-language record)
  // ===========================================================================

  describe('getCachedVersions()', () => {
    it('TC-WU18b-04: returns Record<string, number> when versions entry is present', async () => {
      const versions = { sr: 3, en: 5 };
      const key = translationsVersionKey('tenant-test');
      setLs(key, JSON.stringify(versions));

      const result = await service.getCachedVersions();

      expect(result).toEqual(versions);
    });

    it('TC-WU18b-05: returns empty object when no versions entry is present', async () => {
      const result = await service.getCachedVersions();

      expect(result).toEqual({});
    });
  });

  describe('cacheVersion()', () => {
    it('TC-WU18b-06: stores version number for a language under the tenant versions key', async () => {
      const key = translationsVersionKey('tenant-test');

      await service.cacheVersion('sr', 7);

      const stored = JSON.parse(ls(key)!);
      expect(stored['sr']).toBe(7);
    });

    it('TC-WU18b-06b: preserves existing language versions when adding a new one', async () => {
      const key = translationsVersionKey('tenant-test');
      setLs(key, JSON.stringify({ en: 2 }));

      await service.cacheVersion('sr', 4);

      const stored = JSON.parse(ls(key)!);
      expect(stored['en']).toBe(2);
      expect(stored['sr']).toBe(4);
    });
  });

  // ===========================================================================
  // Languages
  // ===========================================================================

  describe('getCachedLanguages()', () => {
    it('TC-WU18b-07: returns string array when languages entry is present', async () => {
      const languages = ['sr', 'en', 'mk'];
      const key = translationsLanguagesKey('tenant-test');
      setLs(key, JSON.stringify(languages));

      const result = await service.getCachedLanguages();

      expect(result).toEqual(languages);
    });

    it('TC-WU18b-07b: returns null when no languages entry is present', async () => {
      const result = await service.getCachedLanguages();

      expect(result).toBeNull();
    });
  });

  describe('cacheLanguages()', () => {
    it('TC-WU18b-08: stores languages array in Preferences', async () => {
      const languages = ['sr', 'en'];
      const key = translationsLanguagesKey('tenant-test');

      await service.cacheLanguages(languages);

      expect(ls(key)).toBe(JSON.stringify(languages));
    });
  });

  // ===========================================================================
  // Labels
  // ===========================================================================

  describe('getCachedLabels()', () => {
    it('TC-WU18b-09: returns Record<string, string> when labels entry is present', async () => {
      const labels: Record<string, string> = { sr: 'Srpski', en: 'English' };
      const key = translationsLabelsKey('tenant-test');
      setLs(key, JSON.stringify(labels));

      const result = await service.getCachedLabels();

      expect(result).toEqual(labels);
    });

    it('TC-WU18b-09b: returns empty object when no labels entry is present', async () => {
      const result = await service.getCachedLabels();

      expect(result).toEqual({});
    });
  });

  describe('cacheLabels()', () => {
    it('TC-WU18b-10: stores labels Record in Preferences', async () => {
      const labels: Record<string, string> = { sr: 'Srpski', en: 'English', mk: 'Makedonski' };
      const key = translationsLabelsKey('tenant-test');

      await service.cacheLabels(labels);

      expect(ls(key)).toBe(JSON.stringify(labels));
    });
  });

  // ===========================================================================
  // Stored language (tenant-agnostic key)
  // ===========================================================================

  describe('getStoredLanguage()', () => {
    it('TC-WU18b-11: returns language code string when stored language is set', async () => {
      setLs(LANGUAGE_PREF_KEY, 'en');

      const result = await service.getStoredLanguage();

      expect(result).toBe('en');
    });

    it('TC-WU18b-11b: returns null when no language is stored', async () => {
      const result = await service.getStoredLanguage();

      expect(result).toBeNull();
    });
  });

  describe('storeLanguage()', () => {
    it('TC-WU18b-12: stores language code in Preferences under LANGUAGE_PREF_KEY', async () => {
      await service.storeLanguage('sr');

      expect(ls(LANGUAGE_PREF_KEY)).toBe('sr');
    });
  });

  // ===========================================================================
  // Tenant isolation (bonus)
  // ===========================================================================

  describe('Tenant isolation', () => {
    it('TC-WU18b-13: cache for tenantA does NOT leak into tenantB', async () => {
      // Seed data for tenantA
      const langA = translationCacheKey('sr', 'tenant-A');
      setLs(langA, JSON.stringify({ greeting: 'Zdravo' }));

      // Switch service to tenantB
      mockTenantService.getCurrentTenantId.and.returnValue('tenant-B');

      const result = await service.getCachedTranslation('sr');

      expect(result).toBeNull();
    });

    it('TC-WU18b-14: caching for tenantA uses correct key and does not touch tenantB key', async () => {
      mockTenantService.getCurrentTenantId.and.returnValue('tenant-A');
      const translationA = { hello: 'Zdravo A' };

      await service.cacheTranslation('sr', translationA);

      const keyA = translationCacheKey('sr', 'tenant-A');
      const keyB = translationCacheKey('sr', 'tenant-B');

      expect(ls(keyA)).toBe(JSON.stringify(translationA));
      expect(ls(keyB)).toBeNull();
    });
  });

  // ===========================================================================
  // Bonus — getBundledTranslation (synchronous, no Preferences)
  // ===========================================================================

  describe('getBundledTranslation()', () => {
    it('TC-WU18b-15: returns non-null object for bundled language "sr"', () => {
      const result = service.getBundledTranslation('sr');

      expect(result).not.toBeNull();
    });

    it('TC-WU18b-16: returns non-null object for bundled language "en"', () => {
      const result = service.getBundledTranslation('en');

      expect(result).not.toBeNull();
    });

    it('TC-WU18b-17: returns null for unknown language', () => {
      const result = service.getBundledTranslation('xx-unknown');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // Round-trip tests
  // ===========================================================================

  describe('Round-trip', () => {
    it('TC-WU18b-18: cacheTranslation then getCachedTranslation round-trip', async () => {
      const translation = { menu: 'Meni', settings: 'Podesavanja' };

      await service.cacheTranslation('sr', translation);
      const result = await service.getCachedTranslation('sr');

      expect(result).toEqual(translation);
    });

    it('TC-WU18b-19: storeLanguage then getStoredLanguage round-trip', async () => {
      await service.storeLanguage('mk');
      const result = await service.getStoredLanguage();

      expect(result).toBe('mk');
    });

    it('TC-WU18b-20: cacheLanguages then getCachedLanguages round-trip', async () => {
      const langs = ['sr', 'en', 'mk'];

      await service.cacheLanguages(langs);
      const result = await service.getCachedLanguages();

      expect(result).toEqual(langs);
    });

    it('TC-WU18b-21: cacheLabels then getCachedLabels round-trip', async () => {
      const labels = { sr: 'Srpski', en: 'English' };

      await service.cacheLabels(labels);
      const result = await service.getCachedLabels();

      expect(result).toEqual(labels);
    });

    it('TC-WU18b-22: cacheVersion then getCachedVersions round-trip', async () => {
      await service.cacheVersion('sr', 9);
      const result = await service.getCachedVersions();

      expect(result['sr']).toBe(9);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: 5 tenants × 3 languages × getCachedTranslation (null initially)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getCachedTranslation() — 5 tenants × 3 languages initially null', () => {
    const tenants = ['tenant-alpha', 'tenant-beta', 'ariston-rs', 'ariston-mk', 'demo'];
    const languages = ['sr', 'en', 'mk'];

    tenants.forEach(tenantId => {
      languages.forEach(lang => {
        it(`tenant "${tenantId}" lang "${lang}" returns null when nothing is cached`, async () => {
          mockTenantService.getCurrentTenantId.and.returnValue(tenantId);
          const result = await service.getCachedTranslation(lang);
          expect(result).toBeNull();
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: 5 tenants × 3 languages × cacheTranslation round-trip
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cacheTranslation() + getCachedTranslation() — 5 tenants × 3 languages round-trip', () => {
    const tenants = ['tenant-alpha', 'tenant-beta', 'ariston-rs', 'ariston-mk', 'demo'];
    const languages = ['sr', 'en', 'mk'];

    tenants.forEach(tenantId => {
      languages.forEach(lang => {
        it(`tenant "${tenantId}" lang "${lang}" — round-trip stores and retrieves correctly`, async () => {
          localStorage.clear();
          mockTenantService.getCurrentTenantId.and.returnValue(tenantId);

          const translation = { key1: `hello_${lang}_${tenantId}`, key2: `world_${lang}` };
          await service.cacheTranslation(lang, translation);

          const result = await service.getCachedTranslation(lang);
          expect(result).toEqual(translation);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: cacheVersion — multiple languages in sequence
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cacheVersion() — multiple languages accumulate correctly', () => {
    const versionCases: Array<{ lang: string; version: number }> = [
      { lang: 'sr', version: 1 },
      { lang: 'en', version: 2 },
      { lang: 'mk', version: 3 },
      { lang: 'de', version: 4 },
      { lang: 'fr', version: 5 },
    ];

    it('caching 5 different language versions preserves all of them', async () => {
      for (const { lang, version } of versionCases) {
        await service.cacheVersion(lang, version);
      }
      const result = await service.getCachedVersions();
      for (const { lang, version } of versionCases) {
        expect(result[lang]).toBe(version);
      }
    });

    it('updating sr version from 1 to 5 overwrites correctly', async () => {
      await service.cacheVersion('sr', 1);
      await service.cacheVersion('sr', 5);
      const result = await service.getCachedVersions();
      expect(result['sr']).toBe(5);
    });

    it('caching version 0 is valid', async () => {
      await service.cacheVersion('sr', 0);
      const result = await service.getCachedVersions();
      expect(result['sr']).toBe(0);
    });

    it('caching very large version number is valid', async () => {
      await service.cacheVersion('en', 99999);
      const result = await service.getCachedVersions();
      expect(result['en']).toBe(99999);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: storeLanguage — all supported languages
  // ═══════════════════════════════════════════════════════════════════════════

  describe('storeLanguage() — all language codes', () => {
    const languageCodes = ['sr', 'en', 'mk', 'de', 'fr', 'it', 'es', 'pt', 'zh-CN', 'ar'];

    languageCodes.forEach(code => {
      it(`should store and retrieve language code "${code}"`, async () => {
        await service.storeLanguage(code);
        const result = await service.getStoredLanguage();
        expect(result).toBe(code);
      });
    });

    it('should overwrite previously stored language', async () => {
      await service.storeLanguage('sr');
      await service.storeLanguage('en');
      await service.storeLanguage('mk');
      const result = await service.getStoredLanguage();
      expect(result).toBe('mk');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: cacheLabels — various label map sizes
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cacheLabels() — various label map sizes', () => {
    it('should cache labels for 1 language', async () => {
      await service.cacheLabels({ sr: 'Srpski' });
      const result = await service.getCachedLabels();
      expect(result).toEqual({ sr: 'Srpski' });
    });

    it('should cache labels for 3 languages', async () => {
      const labels = { sr: 'Srpski', en: 'English', mk: 'Makedonski' };
      await service.cacheLabels(labels);
      const result = await service.getCachedLabels();
      expect(result).toEqual(labels);
    });

    it('should cache labels for 5 languages', async () => {
      const labels = { sr: 'Srpski', en: 'English', mk: 'Makedonski', de: 'Deutsch', fr: 'Francais' };
      await service.cacheLabels(labels);
      const result = await service.getCachedLabels();
      expect(result).toEqual(labels);
    });

    it('should overwrite previously cached labels', async () => {
      await service.cacheLabels({ sr: 'Srpski' });
      await service.cacheLabels({ sr: 'Srpski', en: 'English' });
      const result = await service.getCachedLabels();
      expect(result['en']).toBe('English');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: cacheLanguages — various array sizes
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cacheLanguages() — various array sizes', () => {
    const languageArrays = [
      ['sr'],
      ['sr', 'en'],
      ['sr', 'en', 'mk'],
      ['sr', 'en', 'mk', 'de'],
      ['sr', 'en', 'mk', 'de', 'fr'],
    ];

    languageArrays.forEach(langs => {
      it(`should cache and retrieve ${langs.length} languages: [${langs.join(', ')}]`, async () => {
        await service.cacheLanguages(langs);
        const result = await service.getCachedLanguages();
        expect(result).toEqual(langs);
      });
    });

    it('should overwrite previously cached languages array', async () => {
      await service.cacheLanguages(['sr']);
      await service.cacheLanguages(['sr', 'en', 'mk']);
      const result = await service.getCachedLanguages();
      expect(result).toEqual(['sr', 'en', 'mk']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: Translation content variety
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cacheTranslation() — various translation object shapes', () => {
    it('should cache empty translation object', async () => {
      await service.cacheTranslation('sr', {});
      const result = await service.getCachedTranslation('sr');
      expect(result).toEqual({});
    });

    it('should cache translation with 1 key', async () => {
      await service.cacheTranslation('sr', { login: 'Prijava' });
      const result = await service.getCachedTranslation('sr');
      expect(result).toEqual({ login: 'Prijava' });
    });

    it('should cache translation with 50 keys', async () => {
      const translation: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        translation[`key_${i}`] = `value_${i}`;
      }
      await service.cacheTranslation('sr', translation);
      const result = await service.getCachedTranslation('sr');
      expect(Object.keys(result!).length).toBe(50);
    });

    it('should cache translation with special characters in values', async () => {
      const translation = { message: 'Pozdrav & <svet> "svima"' };
      await service.cacheTranslation('sr', translation);
      const result = await service.getCachedTranslation('sr');
      expect(result!['message']).toBe('Pozdrav & <svet> "svima"');
    });

    it('should cache translation with unicode values', async () => {
      const translation = { greeting: 'Hëllo Wörld — 你好世界' };
      await service.cacheTranslation('mk', translation);
      const result = await service.getCachedTranslation('mk');
      expect(result!['greeting']).toBe('Hëllo Wörld — 你好世界');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: 4 cache types × 5 tenants — stored under correct keys
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cache key correctness — 4 types × 5 tenants', () => {
    const tenants = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

    tenants.forEach(tenantId => {
      it(`translations version key for tenant "${tenantId}" is scoped correctly`, async () => {
        localStorage.clear();
        mockTenantService.getCurrentTenantId.and.returnValue(tenantId);
        await service.cacheVersion('sr', 3);
        const expectedKey = translationsVersionKey(tenantId);
        const stored = localStorage.getItem(`${PREFIX}${expectedKey}`);
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored!)['sr']).toBe(3);
      });

      it(`languages key for tenant "${tenantId}" is scoped correctly`, async () => {
        localStorage.clear();
        mockTenantService.getCurrentTenantId.and.returnValue(tenantId);
        await service.cacheLanguages(['sr', 'en']);
        const expectedKey = translationsLanguagesKey(tenantId);
        const stored = localStorage.getItem(`${PREFIX}${expectedKey}`);
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored!)).toEqual(['sr', 'en']);
      });

      it(`labels key for tenant "${tenantId}" is scoped correctly`, async () => {
        localStorage.clear();
        mockTenantService.getCurrentTenantId.and.returnValue(tenantId);
        await service.cacheLabels({ sr: 'Srpski' });
        const expectedKey = translationsLabelsKey(tenantId);
        const stored = localStorage.getItem(`${PREFIX}${expectedKey}`);
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored!)['sr']).toBe('Srpski');
      });
    });
  });
});
