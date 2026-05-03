import {
  translationsVersionKey,
  translationsLanguagesKey,
  translationsLabelsKey,
  translationCacheKey,
  DEFAULT_LANGUAGE,
  BUNDLED_LANGUAGES,
  LANGUAGE_LABELS,
} from './i18n.model';

describe('i18n.model utility functions', () => {

  // ─── translationsVersionKey ───────────────────────────────────────────────

  describe('translationsVersionKey', () => {
    it('should return formatted version key with tenantId', () => {
      expect(translationsVersionKey('tenantA')).toBe('translations_version_tenantA');
    });

    it('should produce different keys for different tenants (tenant isolation)', () => {
      expect(translationsVersionKey('tenantA')).not.toBe(translationsVersionKey('tenantB'));
    });

    it('should produce the same key for the same tenantId (deterministic)', () => {
      expect(translationsVersionKey('acme')).toBe(translationsVersionKey('acme'));
    });

    it('should handle special characters in tenantId', () => {
      const key = translationsVersionKey('tenant-123_xyz');
      expect(key).toBe('translations_version_tenant-123_xyz');
    });

    it('should handle empty string tenantId', () => {
      expect(translationsVersionKey('')).toBe('translations_version_');
    });
  });

  // ─── translationsLanguagesKey ─────────────────────────────────────────────

  describe('translationsLanguagesKey', () => {
    it('should return formatted languages key with tenantId', () => {
      expect(translationsLanguagesKey('tenantA')).toBe('translations_languages_tenantA');
    });

    it('should produce different keys for different tenants (tenant isolation)', () => {
      expect(translationsLanguagesKey('tenantA')).not.toBe(translationsLanguagesKey('tenantB'));
    });

    it('should produce the same key for the same tenantId (deterministic)', () => {
      expect(translationsLanguagesKey('acme')).toBe(translationsLanguagesKey('acme'));
    });
  });

  // ─── translationsLabelsKey ────────────────────────────────────────────────

  describe('translationsLabelsKey', () => {
    it('should return formatted labels key with tenantId', () => {
      expect(translationsLabelsKey('tenantA')).toBe('translations_labels_tenantA');
    });

    it('should produce different keys for different tenants (tenant isolation)', () => {
      expect(translationsLabelsKey('tenantA')).not.toBe(translationsLabelsKey('tenantB'));
    });

    it('should produce the same key for the same tenantId (deterministic)', () => {
      expect(translationsLabelsKey('acme')).toBe(translationsLabelsKey('acme'));
    });
  });

  // ─── translationCacheKey ──────────────────────────────────────────────────

  describe('translationCacheKey', () => {
    it('should return formatted cache key with lang and tenantId', () => {
      // signature: translationCacheKey(lang, tenantId)
      expect(translationCacheKey('sr', 'tenantA')).toBe('translations_sr_tenantA');
    });

    it('should return different keys for different languages', () => {
      expect(translationCacheKey('sr', 'tenantA')).not.toBe(translationCacheKey('en', 'tenantA'));
    });

    it('should return different keys for different tenants (tenant isolation)', () => {
      expect(translationCacheKey('sr', 'tenantA')).not.toBe(translationCacheKey('sr', 'tenantB'));
    });

    it('should produce the same key for the same lang and tenantId (deterministic)', () => {
      expect(translationCacheKey('en', 'acme')).toBe(translationCacheKey('en', 'acme'));
    });

    it('should handle special characters in language code', () => {
      const key = translationCacheKey('zh-CN', 'tenantA');
      expect(key).toBe('translations_zh-CN_tenantA');
    });

    it('should handle empty string tenantId', () => {
      expect(translationCacheKey('sr', '')).toBe('translations_sr_');
    });
  });

  // ─── Exported constants ───────────────────────────────────────────────────

  describe('DEFAULT_LANGUAGE', () => {
    it('should be "sr"', () => {
      expect(DEFAULT_LANGUAGE).toBe('sr');
    });
  });

  describe('BUNDLED_LANGUAGES', () => {
    it('should contain "sr" and "en"', () => {
      expect(BUNDLED_LANGUAGES).toEqual(['sr', 'en']);
    });

    it('should have exactly 2 bundled languages', () => {
      expect(BUNDLED_LANGUAGES.length).toBe(2);
    });
  });

  describe('LANGUAGE_LABELS', () => {
    it('should map "sr" to "Srpski"', () => {
      expect(LANGUAGE_LABELS['sr']).toBe('Srpski');
    });

    it('should map "en" to "English"', () => {
      expect(LANGUAGE_LABELS['en']).toBe('English');
    });

    it('should contain labels for all bundled languages', () => {
      BUNDLED_LANGUAGES.forEach(lang => {
        expect(LANGUAGE_LABELS[lang]).toBeTruthy();
      });
    });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: key function cross-product: 5 tenants × 3 languages
// ═══════════════════════════════════════════════════════════════════════════

describe('i18n.model key functions — exhaustive cross-product (5 tenants × 3 languages)', () => {
  const tenants = ['tenant-alpha', 'tenant-beta', 'ariston-rs', 'ariston-mk', 'demo'];
  const languages = ['sr', 'en', 'mk'];

  tenants.forEach(tenantId => {
    describe(`tenant: "${tenantId}"`, () => {
      it(`translationsVersionKey includes tenantId`, () => {
        expect(translationsVersionKey(tenantId)).toContain(tenantId);
      });

      it(`translationsVersionKey starts with "translations_version_"`, () => {
        expect(translationsVersionKey(tenantId)).toMatch(/^translations_version_/);
      });

      it(`translationsLanguagesKey includes tenantId`, () => {
        expect(translationsLanguagesKey(tenantId)).toContain(tenantId);
      });

      it(`translationsLanguagesKey starts with "translations_languages_"`, () => {
        expect(translationsLanguagesKey(tenantId)).toMatch(/^translations_languages_/);
      });

      it(`translationsLabelsKey includes tenantId`, () => {
        expect(translationsLabelsKey(tenantId)).toContain(tenantId);
      });

      it(`translationsLabelsKey starts with "translations_labels_"`, () => {
        expect(translationsLabelsKey(tenantId)).toMatch(/^translations_labels_/);
      });

      languages.forEach(lang => {
        it(`translationCacheKey("${lang}", "${tenantId}") includes both lang and tenantId`, () => {
          const key = translationCacheKey(lang, tenantId);
          expect(key).toContain(lang);
          expect(key).toContain(tenantId);
        });

        it(`translationCacheKey("${lang}", "${tenantId}") starts with "translations_${lang}_"`, () => {
          expect(translationCacheKey(lang, tenantId)).toMatch(new RegExp(`^translations_${lang}_`));
        });

        it(`translationCacheKey("${lang}", "${tenantId}") ends with tenantId`, () => {
          expect(translationCacheKey(lang, tenantId)).toContain(tenantId);
        });
      });
    });
  });

  // Cross-tenant isolation: every key function produces unique keys for every tenant
  it('translationsVersionKey is unique across all 5 tenants', () => {
    const keys = tenants.map(t => translationsVersionKey(t));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(tenants.length);
  });

  it('translationsLanguagesKey is unique across all 5 tenants', () => {
    const keys = tenants.map(t => translationsLanguagesKey(t));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(tenants.length);
  });

  it('translationsLabelsKey is unique across all 5 tenants', () => {
    const keys = tenants.map(t => translationsLabelsKey(t));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(tenants.length);
  });

  it('translationCacheKey produces 15 unique keys (5 tenants × 3 languages)', () => {
    const keys: string[] = [];
    tenants.forEach(t => {
      languages.forEach(lang => {
        keys.push(translationCacheKey(lang, t));
      });
    });
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: key functions — determinism over 10 repeated calls
// ═══════════════════════════════════════════════════════════════════════════

describe('i18n.model key functions — determinism (10 repeated calls)', () => {
  const tenant = 'acme-corp';
  const lang = 'sr';

  it('translationsVersionKey returns same result on 10 calls', () => {
    const results = Array.from({ length: 10 }, () => translationsVersionKey(tenant));
    expect(new Set(results).size).toBe(1);
  });

  it('translationsLanguagesKey returns same result on 10 calls', () => {
    const results = Array.from({ length: 10 }, () => translationsLanguagesKey(tenant));
    expect(new Set(results).size).toBe(1);
  });

  it('translationsLabelsKey returns same result on 10 calls', () => {
    const results = Array.from({ length: 10 }, () => translationsLabelsKey(tenant));
    expect(new Set(results).size).toBe(1);
  });

  it('translationCacheKey returns same result on 10 calls', () => {
    const results = Array.from({ length: 10 }, () => translationCacheKey(lang, tenant));
    expect(new Set(results).size).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: cross-function key uniqueness (no collisions between functions)
// ═══════════════════════════════════════════════════════════════════════════

describe('i18n.model key functions — no collisions between different key types', () => {
  const tenant = 'shared-tenant';

  it('translationsVersionKey and translationsLanguagesKey produce different keys for same tenant', () => {
    expect(translationsVersionKey(tenant)).not.toBe(translationsLanguagesKey(tenant));
  });

  it('translationsVersionKey and translationsLabelsKey produce different keys for same tenant', () => {
    expect(translationsVersionKey(tenant)).not.toBe(translationsLabelsKey(tenant));
  });

  it('translationsLanguagesKey and translationsLabelsKey produce different keys for same tenant', () => {
    expect(translationsLanguagesKey(tenant)).not.toBe(translationsLabelsKey(tenant));
  });

  it('translationCacheKey("sr", tenant) differs from translationsVersionKey(tenant)', () => {
    expect(translationCacheKey('sr', tenant)).not.toBe(translationsVersionKey(tenant));
  });

  it('translationCacheKey("sr", tenant) differs from translationsLanguagesKey(tenant)', () => {
    expect(translationCacheKey('sr', tenant)).not.toBe(translationsLanguagesKey(tenant));
  });

  it('translationCacheKey("sr", tenant) differs from translationsLabelsKey(tenant)', () => {
    expect(translationCacheKey('sr', tenant)).not.toBe(translationsLabelsKey(tenant));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: LANGUAGE_LABELS — all bundled languages have non-empty labels
// ═══════════════════════════════════════════════════════════════════════════

describe('LANGUAGE_LABELS — value quality', () => {
  BUNDLED_LANGUAGES.forEach(lang => {
    it(`LANGUAGE_LABELS["${lang}"] is a non-empty string`, () => {
      expect(typeof LANGUAGE_LABELS[lang]).toBe('string');
      expect(LANGUAGE_LABELS[lang].length).toBeGreaterThan(0);
    });

    it(`LANGUAGE_LABELS["${lang}"] is not equal to the language code itself`, () => {
      // Labels should be human-readable names, not the code
      expect(LANGUAGE_LABELS[lang]).not.toBe(lang);
    });
  });

  it('unknown language key returns undefined from LANGUAGE_LABELS', () => {
    expect(LANGUAGE_LABELS['xyz-unknown']).toBeUndefined();
  });

  it('mk language is NOT in LANGUAGE_LABELS (not bundled)', () => {
    // mk is a supported language but not in BUNDLED_LANGUAGES
    expect(BUNDLED_LANGUAGES).not.toContain('mk');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANSION: DEFAULT_LANGUAGE is in BUNDLED_LANGUAGES
// ═══════════════════════════════════════════════════════════════════════════

describe('DEFAULT_LANGUAGE and BUNDLED_LANGUAGES consistency', () => {
  it('DEFAULT_LANGUAGE should be in BUNDLED_LANGUAGES', () => {
    expect(BUNDLED_LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });

  it('DEFAULT_LANGUAGE should be the first bundled language', () => {
    expect(BUNDLED_LANGUAGES[0]).toBe(DEFAULT_LANGUAGE);
  });

  it('translationCacheKey with DEFAULT_LANGUAGE produces valid key', () => {
    const key = translationCacheKey(DEFAULT_LANGUAGE, 'test-tenant');
    expect(key).toBeTruthy();
    expect(key).toContain(DEFAULT_LANGUAGE);
  });
});
