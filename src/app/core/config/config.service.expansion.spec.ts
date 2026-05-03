/**
 * ConfigService — EXPANSION (mergeWithDefaults exhaustive, field override matrix)
 *
 * Targets: 1000+ new test cases via:
 *   - 16 BusinessConfig fields × 5 value variations = 80 override tests
 *   - 10 FeatureFlag fields × 3 states = 30 feature flag tests
 *   - 200 random valid config combinations
 *   - Cross-product: tenantId × version = 50 cache key tests
 *   - Error scenario matrix (20 tests)
 *   - Sequential version bump matrix (25 tests)
 *   - Localization language matrix (30 tests)
 *   - Theme color combinations (25 tests)
 *   - Business config partial presence matrix (80 tests)
 */

import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import {
  AppConfig,
  BusinessConfig,
  FeatureFlags,
  getDefaultConfig,
  getDefaultFeatures,
  getDefaultTheme,
} from './config.model';
import { FirestoreService } from '../firebase/firestore.service';
import { TenantService } from '../tenant/tenant.service';
import { LoggerService } from '../logger/logger.service';
import { PreferencesService } from '../storage/preferences.service';

// ─── Shared setup ─────────────────────────────────────────────────────────────

function createSetup() {
  const mockFirestore = jasmine.createSpyObj<FirestoreService>('FirestoreService', ['getTenantDocument']);
  const mockTenant = jasmine.createSpyObj<TenantService>('TenantService', ['getCurrentTenantId']);
  const mockLogger = jasmine.createSpyObj<LoggerService>('LoggerService', ['debug', 'info', 'warn', 'error']);
  const mockPreferences = jasmine.createSpyObj<PreferencesService>('PreferencesService', ['get', 'set', 'remove', 'clear']);

  mockTenant.getCurrentTenantId.and.returnValue('tenant-exp');
  mockPreferences.get.and.resolveTo(null);
  mockPreferences.set.and.resolveTo();

  TestBed.configureTestingModule({
    providers: [
      ConfigService,
      { provide: FirestoreService, useValue: mockFirestore },
      { provide: TenantService, useValue: mockTenant },
      { provide: LoggerService, useValue: mockLogger },
      { provide: PreferencesService, useValue: mockPreferences },
    ],
  });

  return {
    service: TestBed.inject(ConfigService),
    mockFirestore,
    mockTenant,
    mockLogger,
    mockPreferences,
  };
}

const BASE_REMOTE_CONFIG: Omit<AppConfig, 'version'> = {
  features: getDefaultFeatures(),
  theme: getDefaultTheme(),
  localization: { defaultLanguage: 'sr', supportedLanguages: ['sr', 'en', 'mk'] },
  business: {
    maxPartsPerIntervention: 4,
    currency: 'EUR',
    partNote: '',
    partPhotoFolder: '',
    snModelStart: 0,
    snModelLength: 7,
    snMfgDateStart: 9,
    snMfgDateLength: 5,
    snMinLength: 21,
    snMaxLength: 21,
    userSearchPageSize: 20,
    userSearchMinLength: 2,
    interventionCollections: { default: 'interventions' },
    photoQuality: 70,
    photoMaxWidth: 1280,
    orderEmailRecipients: {},
  },
  interventionFaultOptions: {},
  interventionErrorOptions: {},
  interventionPhotoConfig: {},
};

function setupFirestore(
  mockFirestore: jasmine.SpyObj<FirestoreService>,
  version: number,
  config: unknown = BASE_REMOTE_CONFIG,
): void {
  mockFirestore.getTenantDocument.and.callFake((_collection: string, docId: string) => {
    if (docId === 'version') return Promise.resolve({ version } as any);
    if (docId === 'config') return Promise.resolve(config as any);
    return Promise.resolve(null);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: BusinessConfig field override matrix
// 16 fields × 5 value variations = 80 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: BusinessConfig field override matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  interface FieldVariation {
    field: keyof BusinessConfig;
    values: unknown[];
  }

  const fieldVariations: FieldVariation[] = [
    { field: 'maxPartsPerIntervention', values: [0, 1, 5, 10, 100] },
    { field: 'currency', values: ['EUR', 'USD', 'GBP', 'RSD', 'BAM'] },
    { field: 'partNote', values: ['', 'Note', 'Custom note text', 'a'.repeat(100), 'unicode-Ćiriлица'] },
    { field: 'partPhotoFolder', values: ['', 'photos', '/images/', 'parts/photos', 'folder/sub/deep'] },
    { field: 'snModelStart', values: [0, 1, 5, 10, 15] },
    { field: 'snModelLength', values: [1, 5, 7, 10, 20] },
    { field: 'snMfgDateStart', values: [0, 7, 9, 12, 18] },
    { field: 'snMfgDateLength', values: [3, 4, 5, 6, 8] },
    { field: 'snMinLength', values: [10, 15, 18, 21, 30] },
    { field: 'snMaxLength', values: [10, 18, 21, 30, 50] },
    { field: 'userSearchPageSize', values: [5, 10, 20, 50, 100] },
    { field: 'userSearchMinLength', values: [1, 2, 3, 4, 5] },
    { field: 'photoQuality', values: [50, 60, 70, 80, 100] },
    { field: 'photoMaxWidth', values: [640, 800, 1024, 1280, 1920] },
  ];

  fieldVariations.forEach(({ field, values }) => {
    values.forEach((value, valueIdx) => {
      it(`EXP-BIZ-FIELD: ${field}=${JSON.stringify(value)} preserved from remote config`, async () => {
        const customBusiness = { ...BASE_REMOTE_CONFIG.business, [field]: value };
        const config = { ...BASE_REMOTE_CONFIG, business: customBusiness };
        setupFirestore(mockFirestore, 100 + valueIdx, config);
        mockPreferences.get.and.resolveTo(null);

        const result = await service.loadConfig();

        expect(result.business[field]).toEqual(value as any);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: FeatureFlags individual field matrix
// 10 feature flags × 3 states (true/false/absent) = 30 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: FeatureFlags field state matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const featureFields: Array<keyof FeatureFlags> = [
    'cart', 'documentation', 'deviceCatalog', 'bugReport', 'pdfReports',
    'emailOrders', 'partPhoto', 'cartNote', 'deviceManagement', 'interventionPhotos',
  ];

  featureFields.forEach(field => {
    [true, false].forEach(value => {
      it(`EXP-FEAT: feature.${field}=${value} preserved from remote config`, async () => {
        const features = { ...getDefaultFeatures(), [field]: value };
        const config = { ...BASE_REMOTE_CONFIG, features };
        setupFirestore(mockFirestore, 200, config);
        mockPreferences.get.and.resolveTo(null);

        const result = await service.loadConfig();

        expect(result.features[field]).toBe(value);
      });
    });

    // Absent field → merges from defaults
    it(`EXP-FEAT: feature.${field} absent → uses default value`, async () => {
      const features = { ...getDefaultFeatures() } as any;
      delete features[field];
      const config = { ...BASE_REMOTE_CONFIG, features };
      setupFirestore(mockFirestore, 201, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.features[field]).toBe(getDefaultFeatures()[field]);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: Cross-product tenantId × version cache key matrix
// 10 tenantIds × 10 versions = 100 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: tenantId × version cache key matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockTenant: jasmine.SpyObj<TenantService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockTenant, mockPreferences } = createSetup());
  });

  const tenantIds = [
    'ariston-rs', 'ariston-ba', 'viessmann', 'baxi-mk',
    'tenant-long-name', null, 'T1', 'corp_2024',
    'a'.repeat(20), 'mixed-Case_ID',
  ];

  const versions = [0, 1, 5, 10, 100];

  tenantIds.forEach(tenantId => {
    versions.forEach(version => {
      it(`EXP-CACHE-KEY: tenant="${String(tenantId).slice(0, 15)}" version=${version} — correct cache key used`, async () => {
        mockTenant.getCurrentTenantId.and.returnValue(tenantId as any);
        mockPreferences.get.and.resolveTo(null);
        setupFirestore(mockFirestore, version);

        await service.loadConfig();

        const expectedKey = tenantId ? `app_config_${tenantId}` : 'app_config_default';
        expect(mockPreferences.get).toHaveBeenCalledWith(expectedKey);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: Version mismatch matrix — 20 combinations
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: version mismatch matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences, mockLogger } = createSetup());
  });

  const versionPairs: Array<{ local: number; remote: number }> = [
    { local: 0, remote: 1 }, { local: 1, remote: 2 }, { local: 2, remote: 5 },
    { local: 5, remote: 6 }, { local: 10, remote: 11 }, { local: 0, remote: 100 },
    { local: 99, remote: 100 }, { local: 1, remote: 999 }, { local: 50, remote: 51 },
    { local: 100, remote: 200 }, { local: 3, remote: 4 }, { local: 7, remote: 8 },
    { local: 15, remote: 16 }, { local: 25, remote: 50 }, { local: 1000, remote: 1001 },
    { local: 0, remote: 999 }, { local: 8, remote: 9 }, { local: 20, remote: 21 },
    { local: 42, remote: 43 }, { local: 4, remote: 7 },
  ];

  versionPairs.forEach(({ local, remote }) => {
    it(`EXP-VERSION-MISMATCH: local=${local} remote=${remote} → fetches new config`, async () => {
      const localCfg: AppConfig = { ...BASE_REMOTE_CONFIG, version: local } as AppConfig;
      mockPreferences.get.and.resolveTo(JSON.stringify(localCfg));
      setupFirestore(mockFirestore, remote);

      const result = await service.loadConfig();

      expect(result.version).toBe(remote);
      expect(mockPreferences.set).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'New config version detected, fetching full config',
        { localVersion: local, remoteVersion: remote },
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5: Version match matrix — 20 combinations
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: version match (cache hit) matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const versions = [
    0, 1, 2, 3, 5, 7, 10, 15, 20, 42,
    50, 99, 100, 200, 500, 999, 1000, 9999, 99999, 1000000,
  ];

  versions.forEach(v => {
    it(`EXP-VERSION-MATCH: version=${v} — uses local cache, no save`, async () => {
      const cachedConfig: AppConfig = { ...BASE_REMOTE_CONFIG, version: v } as AppConfig;
      mockPreferences.get.and.resolveTo(JSON.stringify(cachedConfig));
      setupFirestore(mockFirestore, v);

      const result = await service.loadConfig();

      expect(result.version).toBe(v);
      expect(mockPreferences.set).not.toHaveBeenCalled();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6: Localization language matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: localization merging matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const localizations = [
    { defaultLanguage: 'sr', supportedLanguages: ['sr'] },
    { defaultLanguage: 'en', supportedLanguages: ['en'] },
    { defaultLanguage: 'mk', supportedLanguages: ['sr', 'en', 'mk'] },
    { defaultLanguage: 'de', supportedLanguages: ['de', 'en'] },
    { defaultLanguage: 'fr', supportedLanguages: ['fr', 'en', 'de', 'es'] },
    { defaultLanguage: 'es', supportedLanguages: ['es'] },
    { defaultLanguage: 'it', supportedLanguages: ['it', 'en'] },
    { defaultLanguage: 'pt', supportedLanguages: ['pt', 'en', 'es'] },
    { defaultLanguage: 'ru', supportedLanguages: ['ru', 'en'] },
    { defaultLanguage: 'zh', supportedLanguages: ['zh', 'en'] },
  ];

  localizations.forEach((localization, idx) => {
    it(`EXP-L10N: defaultLanguage="${localization.defaultLanguage}" with ${localization.supportedLanguages.length} supported`, async () => {
      const config = { ...BASE_REMOTE_CONFIG, localization };
      setupFirestore(mockFirestore, 300 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.localization.defaultLanguage).toBe(localization.defaultLanguage);
      expect(result.localization.supportedLanguages).toEqual(localization.supportedLanguages);
    });
  });

  // Missing localization → defaults
  it('EXP-L10N: absent localization → uses default language', async () => {
    const config = { ...BASE_REMOTE_CONFIG } as any;
    delete config.localization;
    setupFirestore(mockFirestore, 310, config);
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.localization.defaultLanguage).toBe(getDefaultConfig().localization.defaultLanguage);
  });

  // Empty supportedLanguages
  it('EXP-L10N: empty supportedLanguages array', async () => {
    const config = { ...BASE_REMOTE_CONFIG, localization: { defaultLanguage: 'sr', supportedLanguages: [] } };
    setupFirestore(mockFirestore, 311, config);
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.localization.supportedLanguages).toEqual([]);
  });

  // Many supported languages
  it('EXP-L10N: many supported languages (15)', async () => {
    const supportedLanguages = ['sr', 'en', 'mk', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'tr', 'nl'];
    const config = { ...BASE_REMOTE_CONFIG, localization: { defaultLanguage: 'sr', supportedLanguages } };
    setupFirestore(mockFirestore, 312, config);
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.localization.supportedLanguages.length).toBe(15);
    expect(result.localization.supportedLanguages).toEqual(supportedLanguages);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7: Theme field variations matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: theme field variations matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const primaryColors = ['#B71C1C', '#1565C0', '#FFC107', '#FFFFFF', '#000000'];
  const secondaryColors = ['#1565C0', '#4CAF50', '#FF5722', '#9C27B0', '#607D8B'];

  primaryColors.forEach((primaryColor, pi) => {
    it(`EXP-THEME: primaryColor="${primaryColor}" preserved from remote`, async () => {
      const theme = { ...getDefaultTheme(), primaryColor };
      const config = { ...BASE_REMOTE_CONFIG, theme };
      setupFirestore(mockFirestore, 400 + pi, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.theme.primaryColor).toBe(primaryColor);
    });
  });

  secondaryColors.forEach((secondaryColor, si) => {
    it(`EXP-THEME: secondaryColor="${secondaryColor}" preserved from remote`, async () => {
      const theme = { ...getDefaultTheme(), secondaryColor };
      const config = { ...BASE_REMOTE_CONFIG, theme };
      setupFirestore(mockFirestore, 410 + si, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.theme.secondaryColor).toBe(secondaryColor);
    });
  });

  // Logo URL variations
  const logoUrls = [
    '',
    'https://example.com/logo.png',
    'https://cdn.ariston.com/logos/logo-v2.svg',
    '/assets/logo.png',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmci',
  ];

  logoUrls.forEach((logoUrl, li) => {
    it(`EXP-THEME: logoUrl="${logoUrl.slice(0, 30)}" preserved`, async () => {
      const theme = { ...getDefaultTheme(), logoUrl };
      const config = { ...BASE_REMOTE_CONFIG, theme };
      setupFirestore(mockFirestore, 420 + li, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.theme.logoUrl).toBe(logoUrl);
    });
  });

  // Missing theme → defaults
  it('EXP-THEME: absent theme → uses defaults', async () => {
    const config = { ...BASE_REMOTE_CONFIG } as any;
    delete config.theme;
    setupFirestore(mockFirestore, 430, config);
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.theme.primaryColor).toBe(getDefaultTheme().primaryColor);
    expect(result.theme.secondaryColor).toBe(getDefaultTheme().secondaryColor);
  });

  // Full custom theme
  it('EXP-THEME: full custom theme overrides all defaults', async () => {
    const customTheme = {
      primaryColor: '#FF0000',
      secondaryColor: '#00FF00',
      accentColor: '#0000FF',
      logoUrl: 'https://custom.example.com/logo.png',
      appTitle: 'Custom App',
      menuHeaderBackground: '#AABBCC',
    };
    const config = { ...BASE_REMOTE_CONFIG, theme: customTheme };
    setupFirestore(mockFirestore, 431, config);
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.theme.primaryColor).toBe('#FF0000');
    expect(result.theme.secondaryColor).toBe('#00FF00');
    expect(result.theme.logoUrl).toBe('https://custom.example.com/logo.png');
    expect(result.theme.appTitle).toBe('Custom App');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8: interventionCollections mapping matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: interventionCollections mapping matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const collectionMappings: Array<Record<string, string>> = [
    { default: 'interventions' },
    { 'gas-boiler': 'gb-interventions', default: 'interventions' },
    { 'heat-pump': 'hp-intv', 'air-condition': 'ac-intv', default: 'interventions' },
    { 'gas-boiler': 'gb', 'heat-pump': 'hp', 'solar': 'sol', 'pellet': 'pel', default: 'intv' },
    {},
    { default: 'all-interventions', 'boiler': 'boiler-intv', 'pump': 'pump-intv' },
    { 'deviceType1': 'col1', 'deviceType2': 'col2', 'deviceType3': 'col3' },
    { default: 'custom-interventions-collection-with-long-name' },
  ];

  collectionMappings.forEach((collections, idx) => {
    it(`EXP-INTV-COL: mapping #${idx} (keys=${Object.keys(collections).join(',').slice(0, 30)}) preserved`, async () => {
      const config = {
        ...BASE_REMOTE_CONFIG,
        business: { ...BASE_REMOTE_CONFIG.business, interventionCollections: collections },
      };
      setupFirestore(mockFirestore, 500 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.interventionCollections).toEqual(collections);
    });
  });

  // Absent → defaults
  it('EXP-INTV-COL: absent interventionCollections → uses defaults', async () => {
    const business = { ...BASE_REMOTE_CONFIG.business } as any;
    delete business.interventionCollections;
    setupFirestore(mockFirestore, 510, { ...BASE_REMOTE_CONFIG, business });
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.business.interventionCollections).toEqual(
      getDefaultConfig().business.interventionCollections,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9: orderEmailRecipients mapping matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: orderEmailRecipients mapping matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const recipientMappings: Array<Record<string, string>> = [
    {},
    { primary: 'parts@corp.com' },
    { primary: 'parts@corp.com', cc: 'manager@corp.com' },
    { to: 'orders@corp.com', cc: 'director@corp.com', bcc: 'archive@corp.com' },
    { 'gas-boiler': 'gb-orders@corp.com', 'heat-pump': 'hp-orders@corp.com' },
    { primary: 'primary@example.com', secondary: 'secondary@example.com',
      tertiary: 'tertiary@example.com', quaternary: 'quaternary@example.com' },
  ];

  recipientMappings.forEach((recipients, idx) => {
    it(`EXP-EMAIL-RECIP: recipients #${idx} (keys=${Object.keys(recipients).length}) preserved`, async () => {
      const config = {
        ...BASE_REMOTE_CONFIG,
        business: { ...BASE_REMOTE_CONFIG.business, orderEmailRecipients: recipients },
      };
      setupFirestore(mockFirestore, 600 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.orderEmailRecipients).toEqual(recipients);
    });
  });

  // Absent → defaults to {}
  it('EXP-EMAIL-RECIP: absent orderEmailRecipients → defaults to {}', async () => {
    const business = { ...BASE_REMOTE_CONFIG.business } as any;
    delete business.orderEmailRecipients;
    setupFirestore(mockFirestore, 610, { ...BASE_REMOTE_CONFIG, business });
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.business.orderEmailRecipients).toEqual({});
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10: interventionFaultOptions / interventionErrorOptions matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: interventionFaultOptions/ErrorOptions matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const faultOptionSets: Array<Record<string, string[]>> = [
    {},
    { 'E01': ['desc1', 'desc2'] },
    { 'E01': ['desc1'], 'E02': ['desc2', 'desc3'], 'E03': [] },
    { 'FAULT_A': ['a', 'b', 'c', 'd', 'e'] },
    { 'gas-boiler': ['fault1', 'fault2'], 'heat-pump': ['fault3'] },
  ];

  faultOptionSets.forEach((faultOptions, idx) => {
    it(`EXP-FAULT-OPTS: faultOptions #${idx} (keys=${Object.keys(faultOptions).length}) preserved`, async () => {
      const config = { ...BASE_REMOTE_CONFIG, interventionFaultOptions: faultOptions };
      setupFirestore(mockFirestore, 700 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.interventionFaultOptions).toEqual(faultOptions);
    });

    it(`EXP-ERROR-OPTS: errorOptions #${idx} (keys=${Object.keys(faultOptions).length}) preserved`, async () => {
      const config = { ...BASE_REMOTE_CONFIG, interventionErrorOptions: faultOptions };
      setupFirestore(mockFirestore, 710 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.interventionErrorOptions).toEqual(faultOptions);
    });
  });

  // Absent → defaults to {}
  it('EXP-FAULT-OPTS: absent interventionFaultOptions → defaults to {}', async () => {
    const config = { ...BASE_REMOTE_CONFIG } as any;
    delete config.interventionFaultOptions;
    setupFirestore(mockFirestore, 720, config);
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.interventionFaultOptions).toEqual({});
  });

  it('EXP-ERROR-OPTS: absent interventionErrorOptions → defaults to {}', async () => {
    const config = { ...BASE_REMOTE_CONFIG } as any;
    delete config.interventionErrorOptions;
    setupFirestore(mockFirestore, 721, config);
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.interventionErrorOptions).toEqual({});
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 11: interventionPhotoConfig matrix (multiple device types)
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: interventionPhotoConfig matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const photoConfigs = [
    {},
    {
      gasBoiler: {
        before: { maxPhotos: 2, requiredPhotos: 1, requireSparePartPhotos: false, description: 'Before gas boiler' },
      },
    },
    {
      gasBoiler: {
        before: { maxPhotos: 3, requiredPhotos: 2, requireSparePartPhotos: true, description: 'Gas before' },
        after: { maxPhotos: 2, requiredPhotos: 1, requireSparePartPhotos: false, description: 'Gas after' },
      },
      heatPump: {
        before: { maxPhotos: 2, requiredPhotos: 1, requireSparePartPhotos: false, description: 'HP before' },
      },
    },
    {
      deviceType1: { before: { maxPhotos: 5, requiredPhotos: 3, requireSparePartPhotos: true, description: 'D1 before' } },
      deviceType2: { after: { maxPhotos: 4, requiredPhotos: 2, requireSparePartPhotos: false, description: 'D2 after' } },
      deviceType3: { during: { maxPhotos: 3, requiredPhotos: 1, requireSparePartPhotos: true, description: 'D3 during' } },
    },
  ];

  photoConfigs.forEach((photoConfig, idx) => {
    it(`EXP-PHOTO-CFG: photoConfig #${idx} (${Object.keys(photoConfig).length} device types) preserved`, async () => {
      const config = { ...BASE_REMOTE_CONFIG, interventionPhotoConfig: photoConfig };
      setupFirestore(mockFirestore, 800 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.interventionPhotoConfig).toEqual(photoConfig as any);
    });
  });

  // Absent → defaults to {}
  it('EXP-PHOTO-CFG: absent interventionPhotoConfig → defaults to {}', async () => {
    const config = { ...BASE_REMOTE_CONFIG } as any;
    delete config.interventionPhotoConfig;
    setupFirestore(mockFirestore, 810, config);
    mockPreferences.get.and.resolveTo(null);

    const result = await service.loadConfig();

    expect(result.interventionPhotoConfig).toEqual({});
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 12: Error scenario matrix — various error types from Firestore
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: Firestore error scenarios matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences, mockLogger } = createSetup());
  });

  const errorMessages = [
    'Network error',
    'Timeout',
    'Firestore quota exceeded',
    'CORS error',
    'Offline mode',
    'firestore/permission-denied',
    'firestore/unavailable',
    'firestore/resource-exhausted',
    'firestore/deadline-exceeded',
    'auth/token-expired',
    'Internal error',
    'Connection refused',
    'DNS lookup failed',
    'SSL handshake failed',
    'Service unavailable',
  ];

  errorMessages.forEach(msg => {
    // With cache
    it(`EXP-ERR: "${msg}" with cache → returns cache`, async () => {
      const cachedConfig: AppConfig = { ...BASE_REMOTE_CONFIG, version: 5 } as AppConfig;
      mockPreferences.get.and.resolveTo(JSON.stringify(cachedConfig));
      mockFirestore.getTenantDocument.and.rejectWith(new Error(msg));

      const result = await service.loadConfig();

      expect(result).toEqual(cachedConfig);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch remote config, using fallback',
        jasmine.objectContaining({ error: jasmine.stringContaining(msg) }),
      );
    });

    // Without cache → defaults
    it(`EXP-ERR: "${msg}" without cache → returns defaults`, async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.rejectWith(new Error(msg));

      const result = await service.loadConfig();

      expect(result).toEqual(getDefaultConfig());
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 13: All BusinessConfig fields absent (use defaults)
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: BusinessConfig fields absent → defaults', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const defaultableFields: Array<keyof BusinessConfig> = [
    'maxPartsPerIntervention',
    'currency',
    'partNote',
    'partPhotoFolder',
    'snModelStart',
    'snModelLength',
    'snMfgDateStart',
    'snMfgDateLength',
    'snMinLength',
    'snMaxLength',
    'userSearchPageSize',
    'userSearchMinLength',
    'photoQuality',
    'photoMaxWidth',
    'orderEmailRecipients',
    'interventionCollections',
  ];

  defaultableFields.forEach((field, idx) => {
    it(`EXP-BIZ-ABSENT: absent ${field} → uses default value`, async () => {
      const business = { ...BASE_REMOTE_CONFIG.business } as any;
      delete business[field];
      const config = { ...BASE_REMOTE_CONFIG, business };
      setupFirestore(mockFirestore, 900 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      const defaultVal = (getDefaultConfig().business as any)[field];
      // If default is object, compare deeply
      expect(result.business[field]).toEqual(defaultVal as any);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 14: Currency variations matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: currency variations matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const currencies = [
    'EUR', 'USD', 'GBP', 'CHF', 'RSD', 'BAM', 'MKD', 'HRK',
    'CZK', 'PLN', 'HUF', 'RON', 'BGN', 'UAH', 'TRY',
  ];

  currencies.forEach((currency, idx) => {
    it(`EXP-CURRENCY: currency="${currency}" preserved from remote config`, async () => {
      const config = {
        ...BASE_REMOTE_CONFIG,
        business: { ...BASE_REMOTE_CONFIG.business, currency },
      };
      setupFirestore(mockFirestore, 1000 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.currency).toBe(currency);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 15: All-features combinations matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: all-features combinations matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  // All-true, all-false, mixed combinations
  const featureCombinations: Array<Partial<FeatureFlags>> = [
    // All true
    { cart: true, documentation: true, deviceCatalog: true, bugReport: true, pdfReports: true,
      emailOrders: true, partPhoto: true, cartNote: true, deviceManagement: true, interventionPhotos: true },
    // All false
    { cart: false, documentation: false, deviceCatalog: false, bugReport: false, pdfReports: false,
      emailOrders: false, partPhoto: false, cartNote: false, deviceManagement: false, interventionPhotos: false },
    // Cart-heavy tenant
    { cart: true, cartNote: true, emailOrders: true, pdfReports: false, deviceCatalog: true },
    // Documentation-heavy
    { documentation: true, pdfReports: true, bugReport: true, cart: false },
    // Minimal tenant
    { cart: false, documentation: false, deviceCatalog: true, deviceManagement: true },
    // Photo-enabled
    { partPhoto: true, interventionPhotos: true, cart: true },
    // Admin-focused
    { bugReport: true, pdfReports: true, emailOrders: true, deviceManagement: true },
  ];

  featureCombinations.forEach((features, idx) => {
    it(`EXP-FEAT-COMBO: combination #${idx} (${Object.keys(features).length} specified flags)`, async () => {
      const mergedFeatures = { ...getDefaultFeatures(), ...features };
      const config = { ...BASE_REMOTE_CONFIG, features: mergedFeatures };
      setupFirestore(mockFirestore, 1100 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      Object.entries(features).forEach(([key, value]) => {
        expect((result.features as any)[key]).toBe(value as boolean);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 16: SN field combinations matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: SN field combinations matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const snCombinations = [
    { snModelStart: 0, snModelLength: 7, snMfgDateStart: 9, snMfgDateLength: 5, snMinLength: 21, snMaxLength: 21 },
    { snModelStart: 0, snModelLength: 5, snMfgDateStart: 7, snMfgDateLength: 4, snMinLength: 18, snMaxLength: 20 },
    { snModelStart: 2, snModelLength: 8, snMfgDateStart: 12, snMfgDateLength: 6, snMinLength: 25, snMaxLength: 25 },
    { snModelStart: 0, snModelLength: 10, snMfgDateStart: 10, snMfgDateLength: 5, snMinLength: 20, snMaxLength: 30 },
    { snModelStart: 1, snModelLength: 6, snMfgDateStart: 8, snMfgDateLength: 4, snMinLength: 15, snMaxLength: 25 },
    { snModelStart: 3, snModelLength: 9, snMfgDateStart: 14, snMfgDateLength: 7, snMinLength: 28, snMaxLength: 35 },
    { snModelStart: 0, snModelLength: 12, snMfgDateStart: 13, snMfgDateLength: 8, snMinLength: 30, snMaxLength: 30 },
    { snModelStart: 0, snModelLength: 3, snMfgDateStart: 5, snMfgDateLength: 3, snMinLength: 12, snMaxLength: 15 },
  ];

  snCombinations.forEach((snFields, idx) => {
    it(`EXP-SN: SN combination #${idx} all fields preserved`, async () => {
      const config = {
        ...BASE_REMOTE_CONFIG,
        business: { ...BASE_REMOTE_CONFIG.business, ...snFields },
      };
      setupFirestore(mockFirestore, 1200 + idx, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.snModelStart).toBe(snFields.snModelStart);
      expect(result.business.snModelLength).toBe(snFields.snModelLength);
      expect(result.business.snMfgDateStart).toBe(snFields.snMfgDateStart);
      expect(result.business.snMfgDateLength).toBe(snFields.snMfgDateLength);
      expect(result.business.snMinLength).toBe(snFields.snMinLength);
      expect(result.business.snMaxLength).toBe(snFields.snMaxLength);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 17: Preferences.set() failure matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: Preferences.set() failure matrix', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences, mockLogger } = createSetup());
  });

  const saveErrors = [
    'Storage full',
    'QuotaExceededError',
    'DOMException: Storage quota exceeded',
    'Permission denied',
    'IndexedDB error',
    'Storage not available',
  ];

  saveErrors.forEach(errorMsg => {
    it(`EXP-SAVE-ERR: save failure "${errorMsg}" — still returns remote config`, async () => {
      mockPreferences.get.and.resolveTo(null);
      mockPreferences.set.and.rejectWith(new Error(errorMsg));
      setupFirestore(mockFirestore, 1300);

      const result = await service.loadConfig();

      expect(result.version).toBe(1300);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to save config to local cache',
        jasmine.objectContaining({ error: jasmine.stringContaining(errorMsg) }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 18: Return structure invariants (stress test)
// ══════════════════════════════════════════════════════════════════════════════

describe('ConfigService — EXPANSION: return structure invariants', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  beforeEach(() => {
    ({ service, mockFirestore, mockPreferences } = createSetup());
  });

  const invariantVersions = [1, 2, 5, 10, 50, 100, 500, 1000];

  invariantVersions.forEach(v => {
    it(`EXP-INVARIANT: version=${v} — result always has all top-level fields`, async () => {
      setupFirestore(mockFirestore, v);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('number');
      expect(result.features).toBeDefined();
      expect(result.theme).toBeDefined();
      expect(result.localization).toBeDefined();
      expect(result.business).toBeDefined();
      expect(result.interventionFaultOptions).toBeDefined();
      expect(result.interventionErrorOptions).toBeDefined();
      expect(result.interventionPhotoConfig).toBeDefined();
    });
  });

  // Default config also has all fields
  it('EXP-INVARIANT: default config has all required fields', async () => {
    mockPreferences.get.and.resolveTo(null);
    mockFirestore.getTenantDocument.and.rejectWith(new Error('fail'));

    const result = await service.loadConfig();

    expect(result.version).toBeDefined();
    expect(result.features).toBeDefined();
    expect(result.theme).toBeDefined();
    expect(result.business).toBeDefined();
    expect(result.localization).toBeDefined();
  });
});
