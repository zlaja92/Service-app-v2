import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import { AppConfig, BusinessConfig, getDefaultConfig, getDefaultFeatures, getDefaultTheme } from './config.model';
import { FirestoreService } from '../firebase/firestore.service';
import { TenantService } from '../tenant/tenant.service';
import { LoggerService } from '../logger/logger.service';
import { PreferencesService } from '../storage/preferences.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockTenant: jasmine.SpyObj<TenantService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  const validRemoteConfig: Omit<AppConfig, 'version'> = {
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

  const validFullConfig: AppConfig = { ...validRemoteConfig, version: 5 };

  beforeEach(() => {
    mockFirestore = jasmine.createSpyObj('FirestoreService', ['getTenantDocument']);
    mockTenant = jasmine.createSpyObj('TenantService', ['getCurrentTenantId']);
    mockLogger = jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error']);
    mockPreferences = jasmine.createSpyObj('PreferencesService', ['get', 'set', 'remove', 'clear']);

    mockTenant.getCurrentTenantId.and.returnValue('tenant-abc');
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

    service = TestBed.inject(ConfigService);
  });

  function setupFirestoreVersionAndConfig(version: number, config: unknown = validRemoteConfig): void {
    mockFirestore.getTenantDocument.and.callFake((_collection: string, docId: string) => {
      if (docId === 'version') return Promise.resolve({ version } as any);
      if (docId === 'config') return Promise.resolve(config as any);
      return Promise.resolve(null);
    });
  }

  describe('loadConfig — cache hit', () => {
    it('should return local config without fetching full config when version matches', async () => {
      mockPreferences.get.and.resolveTo(JSON.stringify(validFullConfig));
      setupFirestoreVersionAndConfig(5);

      const result = await service.loadConfig();

      expect(result).toEqual(validFullConfig);
      expect(mockFirestore.getTenantDocument).toHaveBeenCalledTimes(1);
      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('settings', 'version');
      expect(mockPreferences.set).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Config version matches, using local cache', { version: 5 });
    });
  });

  describe('loadConfig — cache miss (version mismatch)', () => {
    it('should fetch full config and save locally when version differs', async () => {
      const localConfig = { ...validFullConfig, version: 3 };
      mockPreferences.get.and.resolveTo(JSON.stringify(localConfig));
      setupFirestoreVersionAndConfig(5);

      const result = await service.loadConfig();

      expect(result).toEqual({ ...validRemoteConfig, version: 5 });
      expect(mockFirestore.getTenantDocument).toHaveBeenCalledTimes(2);
      expect(mockPreferences.set).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'New config version detected, fetching full config',
        { localVersion: 3, remoteVersion: 5 },
      );
    });
  });

  describe('loadConfig — no local cache', () => {
    it('should fetch full config when no local cache exists', async () => {
      mockPreferences.get.and.resolveTo(null);
      setupFirestoreVersionAndConfig(2);

      const result = await service.loadConfig();

      expect(result).toEqual({ ...validRemoteConfig, version: 2 });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'New config version detected, fetching full config',
        { localVersion: null, remoteVersion: 2 },
      );
    });
  });

  describe('loadConfig — remote failure with cache fallback', () => {
    it('should return local cache when remote fetch fails', async () => {
      mockPreferences.get.and.resolveTo(JSON.stringify(validFullConfig));
      mockFirestore.getTenantDocument.and.rejectWith(new Error('Network error'));

      const result = await service.loadConfig();

      expect(result).toEqual(validFullConfig);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch remote config, using fallback',
        jasmine.objectContaining({ error: jasmine.stringContaining('Network error') }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Using cached local config', { version: 5 });
    });
  });

  describe('loadConfig — remote failure without cache', () => {
    it('should return getDefaultConfig() when remote fails and no local cache', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.rejectWith(new Error('Offline'));

      const result = await service.loadConfig();

      expect(result).toEqual(getDefaultConfig());
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch remote config, using fallback',
        jasmine.objectContaining({ error: jasmine.stringContaining('Offline') }),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith('No local config available, using defaults');
    });
  });

  describe('loadConfig — Preferences.get() failure', () => {
    it('should treat Preferences error as no cache and fetch remote', async () => {
      mockPreferences.get.and.rejectWith(new Error('Preferences unavailable'));
      setupFirestoreVersionAndConfig(1);

      const result = await service.loadConfig();

      expect(result).toEqual({ ...validRemoteConfig, version: 1 });
    });
  });

  describe('loadConfig — legacy string version', () => {
    it('should fetch full config when cached version is string and remote is number (=== fails)', async () => {
      const legacyConfig = { ...validRemoteConfig, version: '5' as any };
      mockPreferences.get.and.resolveTo(JSON.stringify(legacyConfig));
      setupFirestoreVersionAndConfig(5);

      const result = await service.loadConfig();

      expect(result).toEqual({ ...validRemoteConfig, version: 5 });
      expect(typeof result.version).toBe('number');
      expect(mockPreferences.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadConfig — saveLocalConfig failure', () => {
    it('should still return remote config when save fails', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockPreferences.set.and.rejectWith(new Error('Storage full'));
      setupFirestoreVersionAndConfig(3);

      const result = await service.loadConfig();

      expect(result).toEqual({ ...validRemoteConfig, version: 3 });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to save config to local cache',
        jasmine.objectContaining({ error: jasmine.stringContaining('Storage full') }),
      );
    });
  });

  describe('getConfigKey — tenant-aware keys', () => {
    it('should use "app_config_{tenantId}" when tenantId exists', async () => {
      mockTenant.getCurrentTenantId.and.returnValue('ariston-rs');
      mockPreferences.get.and.resolveTo(null);
      setupFirestoreVersionAndConfig(1);

      await service.loadConfig();

      expect(mockPreferences.get).toHaveBeenCalledWith('app_config_ariston-rs');
    });

    it('should use "app_config_default" when tenantId is null', async () => {
      mockTenant.getCurrentTenantId.and.returnValue(null as any);
      mockPreferences.get.and.resolveTo(null);
      setupFirestoreVersionAndConfig(1);

      await service.loadConfig();

      expect(mockPreferences.get).toHaveBeenCalledWith('app_config_default');
    });
  });

  describe('getRemoteConfigVersion — error paths', () => {
    it('should fall to defaults when version document is null', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.resolveTo(null as any);

      const result = await service.loadConfig();

      expect(result).toEqual(getDefaultConfig());
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch remote config, using fallback',
        jasmine.objectContaining({ error: jasmine.stringContaining('version document not found') }),
      );
    });

    it('should fall to defaults when version field is null', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.resolveTo({ version: null } as any);

      const result = await service.loadConfig();

      expect(result).toEqual(getDefaultConfig());
    });

    it('should fall to defaults when version field is undefined', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.resolveTo({} as any);

      const result = await service.loadConfig();

      expect(result).toEqual(getDefaultConfig());
    });
  });

  describe('fetchFullConfig — config document not found', () => {
    it('should fall back to local cache when config document is null', async () => {
      const localConfig = { ...validFullConfig, version: 1 };
      mockPreferences.get.and.resolveTo(JSON.stringify(localConfig));

      mockFirestore.getTenantDocument.and.callFake((_collection: string, docId: string) => {
        if (docId === 'version') return Promise.resolve({ version: 2 } as any);
        if (docId === 'config') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await service.loadConfig();

      expect(result).toEqual(localConfig);
      expect(mockLogger.info).toHaveBeenCalledWith('Using cached local config', { version: 1 });
    });
  });

  describe('getLocalConfig — corrupted JSON', () => {
    it('should return null and fetch remote when JSON is corrupted', async () => {
      mockPreferences.get.and.resolveTo('{invalid json %%%');
      setupFirestoreVersionAndConfig(2);

      const result = await service.loadConfig();

      expect(result).toEqual({ ...validRemoteConfig, version: 2 });
    });
  });

  describe('mergeWithDefaults — interventionPhotoConfig fallback', () => {
    it('should use empty object as default when remote config omits interventionPhotoConfig', async () => {
      const configWithoutPhotoConfig = { ...validRemoteConfig } as any;
      delete configWithoutPhotoConfig.interventionPhotoConfig;
      setupFirestoreVersionAndConfig(7, configWithoutPhotoConfig);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.interventionPhotoConfig).toBeDefined();
      expect(result.interventionPhotoConfig).toEqual({});
    });

    it('should merge remote interventionPhotoConfig over defaults', async () => {
      const photoConfig = {
        gasBoiler: {
          before: { maxPhotos: 2, requiredPhotos: 1, requireSparePartPhotos: false, description: 'Before' },
        },
      };
      const configWithPhotoConfig = { ...validRemoteConfig, interventionPhotoConfig: photoConfig };
      setupFirestoreVersionAndConfig(8, configWithPhotoConfig);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.interventionPhotoConfig['gasBoiler']['before'].maxPhotos).toBe(2);
    });
  });

  describe('mergeWithDefaults — interventionFaultOptions fallback', () => {
    it('should use empty object as default when remote config omits interventionFaultOptions', async () => {
      const configWithoutFaultOptions = { ...validRemoteConfig } as any;
      delete configWithoutFaultOptions.interventionFaultOptions;
      setupFirestoreVersionAndConfig(9, configWithoutFaultOptions);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.interventionFaultOptions).toBeDefined();
      expect(result.interventionFaultOptions).toEqual({});
    });
  });

  describe('mergeWithDefaults — interventionErrorOptions fallback', () => {
    it('should use empty object as default when remote config omits interventionErrorOptions', async () => {
      const configWithoutErrorOptions = { ...validRemoteConfig } as any;
      delete configWithoutErrorOptions.interventionErrorOptions;
      setupFirestoreVersionAndConfig(10, configWithoutErrorOptions);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.interventionErrorOptions).toBeDefined();
      expect(result.interventionErrorOptions).toEqual({});
    });
  });

  describe('mergeWithDefaults — SN business fields defaults', () => {
    it('should preserve snMfgDateStart, snMfgDateLength, snMinLength, snMaxLength from remote config', async () => {
      setupFirestoreVersionAndConfig(11);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.snMfgDateStart).toBe(9);
      expect(result.business.snMfgDateLength).toBe(5);
      expect(result.business.snMinLength).toBe(21);
      expect(result.business.snMaxLength).toBe(21);
    });

    it('should fall back to default snMfgDateStart, snMfgDateLength, snMinLength, snMaxLength when remote business omits them', async () => {
      const businessWithoutSnFields = {
        maxPartsPerIntervention: 4,
        currency: 'EUR',
        partNote: '',
        partPhotoFolder: '',
        snModelStart: 0,
        snModelLength: 7,
        userSearchPageSize: 20,
        userSearchMinLength: 2,
        interventionCollections: { default: 'interventions' },
        photoQuality: 70,
        photoMaxWidth: 1280,
        orderEmailRecipients: {},
      };
      const partialConfig = { ...validRemoteConfig, business: businessWithoutSnFields };
      setupFirestoreVersionAndConfig(12, partialConfig);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.snMfgDateStart).toBe(9);
      expect(result.business.snMfgDateLength).toBe(5);
      expect(result.business.snMinLength).toBe(21);
      expect(result.business.snMaxLength).toBe(21);
    });
  });

  describe('mergeWithDefaults — orderEmailRecipients fallback', () => {
    it('should use empty object as default when remote config omits orderEmailRecipients', async () => {
      const businessWithoutRecipients = { ...validRemoteConfig.business } as any;
      delete businessWithoutRecipients.orderEmailRecipients;
      const configWithoutRecipients = { ...validRemoteConfig, business: businessWithoutRecipients };
      setupFirestoreVersionAndConfig(13, configWithoutRecipients);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.orderEmailRecipients).toBeDefined();
      expect(result.business.orderEmailRecipients).toEqual({});
    });

    it('should preserve orderEmailRecipients from remote config when present', async () => {
      const recipients = { primary: 'parts@example.com', cc: 'manager@example.com' };
      const configWithRecipients = {
        ...validRemoteConfig,
        business: { ...validRemoteConfig.business, orderEmailRecipients: recipients },
      };
      setupFirestoreVersionAndConfig(14, configWithRecipients);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.orderEmailRecipients).toEqual(recipients);
    });
  });

  // ─── EXPANSION: version matrix ────────────────────────────────────────────────

  describe('mergeWithDefaults — version matrix (cache hit at each version)', () => {
    const versions = [0, 1, 2, 5, 10, 50, 100, 999, 1000, 99999];

    versions.forEach(v => {
      it(`should return cached config at version ${v} when remote version matches`, async () => {
        const cachedConfig: AppConfig = { ...validFullConfig, version: v };
        mockPreferences.get.and.resolveTo(JSON.stringify(cachedConfig));
        setupFirestoreVersionAndConfig(v);

        const result = await service.loadConfig();

        expect(result.version).toBe(v);
        expect(mockPreferences.set).not.toHaveBeenCalled();
      });
    });
  });

  describe('mergeWithDefaults — version mismatch matrix', () => {
    const mismatches: Array<{ local: number; remote: number }> = [
      { local: 0, remote: 1 },
      { local: 1, remote: 2 },
      { local: 3, remote: 5 },
      { local: 99, remote: 100 },
      { local: 1, remote: 100 },
    ];

    mismatches.forEach(({ local, remote }) => {
      it(`should fetch new config when local=${local} and remote=${remote}`, async () => {
        const localCfg: AppConfig = { ...validFullConfig, version: local };
        mockPreferences.get.and.resolveTo(JSON.stringify(localCfg));
        setupFirestoreVersionAndConfig(remote);

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

  // ─── EXPANSION: tenant-aware key matrix ──────────────────────────────────────

  describe('getConfigKey — tenant-aware key matrix', () => {
    const tenants = ['ariston-rs', 'ariston-ba', 'viessmann', 'baxi-mk', 'tenant-with-long-id-123'];

    tenants.forEach(tenantId => {
      it(`should use "app_config_${tenantId}" for tenant "${tenantId}"`, async () => {
        mockTenant.getCurrentTenantId.and.returnValue(tenantId);
        mockPreferences.get.and.resolveTo(null);
        setupFirestoreVersionAndConfig(1);

        await service.loadConfig();

        expect(mockPreferences.get).toHaveBeenCalledWith(`app_config_${tenantId}`);
      });
    });
  });

  // ─── EXPANSION: mergeWithDefaults — feature flags merging ────────────────────

  describe('mergeWithDefaults — feature flags merging', () => {
    it('should merge partial features from remote over defaults', async () => {
      const partialFeatures = { cart: true };
      const configWithPartialFeatures = { ...validRemoteConfig, features: partialFeatures as any };
      setupFirestoreVersionAndConfig(20, configWithPartialFeatures);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.features.cart).toBe(true);
      // Other features merged from defaults
      expect(result.features.deviceCatalog).toBe(getDefaultFeatures().deviceCatalog);
    });

    it('should preserve all true features from remote config', async () => {
      const allTrueFeatures = {
        cart: true,
        documentation: true,
        deviceCatalog: true,
        bugReport: true,
        pdfReports: true,
        emailOrders: true,
        partPhoto: true,
        cartNote: true,
        deviceManagement: true,
        interventionPhotos: true,
      };
      const configWithAllFeatures = { ...validRemoteConfig, features: allTrueFeatures };
      setupFirestoreVersionAndConfig(21, configWithAllFeatures);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.features.cart).toBe(true);
      expect(result.features.documentation).toBe(true);
      expect(result.features.deviceCatalog).toBe(true);
      expect(result.features.bugReport).toBe(true);
      expect(result.features.pdfReports).toBe(true);
      expect(result.features.emailOrders).toBe(true);
      expect(result.features.partPhoto).toBe(true);
      expect(result.features.cartNote).toBe(true);
      expect(result.features.deviceManagement).toBe(true);
      expect(result.features.interventionPhotos).toBe(true);
    });

    it('should set all features to false when remote has all false', async () => {
      const allFalseFeatures = {
        cart: false,
        documentation: false,
        deviceCatalog: false,
        bugReport: false,
        pdfReports: false,
        emailOrders: false,
        partPhoto: false,
        cartNote: false,
        deviceManagement: false,
        interventionPhotos: false,
      };
      const configWithAllFalse = { ...validRemoteConfig, features: allFalseFeatures };
      setupFirestoreVersionAndConfig(22, configWithAllFalse);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.features.cart).toBe(false);
      expect(result.features.deviceCatalog).toBe(false);
      expect(result.features.deviceManagement).toBe(false);
    });
  });

  // ─── EXPANSION: mergeWithDefaults — theme merging ────────────────────────────

  describe('mergeWithDefaults — theme merging', () => {
    it('should use default primaryColor when remote omits it', async () => {
      const themeWithoutPrimary = { ...getDefaultTheme() } as any;
      delete themeWithoutPrimary.primaryColor;
      const configWithPartialTheme = { ...validRemoteConfig, theme: themeWithoutPrimary };
      setupFirestoreVersionAndConfig(30, configWithPartialTheme);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.theme.primaryColor).toBe(getDefaultTheme().primaryColor);
    });

    it('should override all theme fields when remote provides them', async () => {
      const customTheme = {
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        accentColor: '#0000FF',
        logoUrl: 'https://custom.example.com/logo.png',
        menuHeaderBackground: '#AABBCC',
        menuHeaderText: '#DDEEFF',
      };
      const configWithCustomTheme = { ...validRemoteConfig, theme: customTheme };
      setupFirestoreVersionAndConfig(31, configWithCustomTheme);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.theme.primaryColor).toBe('#FF0000');
      expect(result.theme.secondaryColor).toBe('#00FF00');
      expect(result.theme.accentColor).toBe('#0000FF');
      expect(result.theme.logoUrl).toBe('https://custom.example.com/logo.png');
    });
  });

  // ─── EXPANSION: mergeWithDefaults — localization merging ─────────────────────

  describe('mergeWithDefaults — localization merging', () => {
    it('should use default language when remote localization is absent', async () => {
      const configWithoutLocalization = { ...validRemoteConfig } as any;
      delete configWithoutLocalization.localization;
      setupFirestoreVersionAndConfig(40, configWithoutLocalization);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.localization.defaultLanguage).toBe(getDefaultConfig().localization.defaultLanguage);
    });

    it('should merge remote localization over defaults', async () => {
      const localization = { defaultLanguage: 'en', supportedLanguages: ['en', 'de'] };
      const configWithLocalization = { ...validRemoteConfig, localization };
      setupFirestoreVersionAndConfig(41, configWithLocalization);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.localization.defaultLanguage).toBe('en');
      expect(result.localization.supportedLanguages).toEqual(['en', 'de']);
    });
  });

  // ─── EXPANSION: mergeWithDefaults — business fields ──────────────────────────

  describe('mergeWithDefaults — individual business field overrides', () => {
    const businessFieldTests: Array<{ field: keyof BusinessConfig; value: unknown; label: string }> = [
      { field: 'maxPartsPerIntervention', value: 10, label: 'maxPartsPerIntervention=10' },
      { field: 'currency', value: 'USD', label: 'currency=USD' },
      { field: 'partNote', value: 'Custom part note', label: 'partNote custom' },
      { field: 'snModelStart', value: 5, label: 'snModelStart=5' },
      { field: 'snModelLength', value: 10, label: 'snModelLength=10' },
      { field: 'snMfgDateStart', value: 12, label: 'snMfgDateStart=12' },
      { field: 'snMfgDateLength', value: 6, label: 'snMfgDateLength=6' },
      { field: 'snMinLength', value: 25, label: 'snMinLength=25' },
      { field: 'snMaxLength', value: 30, label: 'snMaxLength=30' },
      { field: 'userSearchPageSize', value: 50, label: 'userSearchPageSize=50' },
      { field: 'userSearchMinLength', value: 3, label: 'userSearchMinLength=3' },
      { field: 'photoQuality', value: 80, label: 'photoQuality=80' },
      { field: 'photoMaxWidth', value: 1920, label: 'photoMaxWidth=1920' },
    ];

    businessFieldTests.forEach(({ field, value, label }, idx) => {
      it(`should preserve ${label} from remote config`, async () => {
        const customBusiness = { ...validRemoteConfig.business, [field]: value };
        const config = { ...validRemoteConfig, business: customBusiness };
        setupFirestoreVersionAndConfig(50 + idx, config);
        mockPreferences.get.and.resolveTo(null);

        const result = await service.loadConfig();

        expect(result.business[field]).toEqual(value as any);
      });
    });
  });

  // ─── EXPANSION: photoQuality / photoMaxWidth defaults ────────────────────────

  describe('mergeWithDefaults — photoQuality and photoMaxWidth defaults', () => {
    it('should fall back to default photoQuality when remote business omits it', async () => {
      const businessWithoutPhoto = { ...validRemoteConfig.business } as any;
      delete businessWithoutPhoto.photoQuality;
      setupFirestoreVersionAndConfig(70, { ...validRemoteConfig, business: businessWithoutPhoto });
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.photoQuality).toBe(getDefaultConfig().business.photoQuality);
    });

    it('should fall back to default photoMaxWidth when remote business omits it', async () => {
      const businessWithoutPhoto = { ...validRemoteConfig.business } as any;
      delete businessWithoutPhoto.photoMaxWidth;
      setupFirestoreVersionAndConfig(71, { ...validRemoteConfig, business: businessWithoutPhoto });
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.photoMaxWidth).toBe(getDefaultConfig().business.photoMaxWidth);
    });
  });

  // ─── EXPANSION: multiple sequential loadConfig calls ─────────────────────────

  describe('loadConfig — sequential calls', () => {
    it('should work correctly on second call after cache was written on first call', async () => {
      // First call: no cache, fetch remote, save
      mockPreferences.get.and.resolveTo(null);
      setupFirestoreVersionAndConfig(1);

      const result1 = await service.loadConfig();
      expect(result1.version).toBe(1);

      // Second call: cache hit at same version
      mockPreferences.get.and.resolveTo(JSON.stringify(result1));
      setupFirestoreVersionAndConfig(1);

      const result2 = await service.loadConfig();
      expect(result2.version).toBe(1);
      // On second call, should use cache (only 1 getTenantDocument call for version check)
      // We can verify set was only called once
      expect(mockPreferences.set).toHaveBeenCalledTimes(1);
    });

    it('should fetch fresh config on each version bump', async () => {
      // First call: version 1
      mockPreferences.get.and.resolveTo(null);
      setupFirestoreVersionAndConfig(1);
      const result1 = await service.loadConfig();
      expect(result1.version).toBe(1);

      // Second call: version bumped to 2
      const cachedV1 = { ...result1 };
      mockPreferences.get.and.resolveTo(JSON.stringify(cachedV1));
      setupFirestoreVersionAndConfig(2);
      const result2 = await service.loadConfig();
      expect(result2.version).toBe(2);

      // set should have been called twice total (once per fetch)
      expect(mockPreferences.set).toHaveBeenCalledTimes(2);
    });
  });

  // ─── EXPANSION: error message variety ────────────────────────────────────────

  describe('loadConfig — error message variety', () => {
    const errorMessages = ['Network error', 'Timeout', 'Firestore quota exceeded', 'CORS error', 'Offline mode'];

    errorMessages.forEach(msg => {
      it(`should log warn with "${msg}" when Firestore rejects`, async () => {
        mockPreferences.get.and.resolveTo(null);
        mockFirestore.getTenantDocument.and.rejectWith(new Error(msg));

        await service.loadConfig();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to fetch remote config, using fallback',
          jasmine.objectContaining({ error: jasmine.stringContaining(msg) }),
        );
      });
    });
  });

  // ─── EXPANSION: saveLocalConfig uses tenant-aware key ────────────────────────

  describe('saveLocalConfig — tenant-aware key on write', () => {
    it('should save to tenant-specific key when tenantId is present', async () => {
      mockTenant.getCurrentTenantId.and.returnValue('baxi-ba');
      mockPreferences.get.and.resolveTo(null);
      setupFirestoreVersionAndConfig(1);

      await service.loadConfig();

      expect(mockPreferences.set).toHaveBeenCalledWith(
        'app_config_baxi-ba',
        jasmine.any(String),
      );
    });

    it('should save to "app_config_default" key when tenantId is null', async () => {
      mockTenant.getCurrentTenantId.and.returnValue(null as any);
      mockPreferences.get.and.resolveTo(null);
      setupFirestoreVersionAndConfig(1);

      await service.loadConfig();

      expect(mockPreferences.set).toHaveBeenCalledWith(
        'app_config_default',
        jasmine.any(String),
      );
    });
  });

  // ─── EXPANSION: mergeWithDefaults — interventionCollections ──────────────────

  describe('mergeWithDefaults — interventionCollections fallback', () => {
    it('should preserve interventionCollections from remote config', async () => {
      const collections = { default: 'interventions', gasBoiler: 'gas_interventions' };
      const config = { ...validRemoteConfig, business: { ...validRemoteConfig.business, interventionCollections: collections } };
      setupFirestoreVersionAndConfig(80, config);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.interventionCollections).toEqual(collections);
    });

    it('should use default interventionCollections when remote omits it', async () => {
      const businessWithoutCollections = { ...validRemoteConfig.business } as any;
      delete businessWithoutCollections.interventionCollections;
      setupFirestoreVersionAndConfig(81, { ...validRemoteConfig, business: businessWithoutCollections });
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business.interventionCollections).toEqual(
        getDefaultConfig().business.interventionCollections,
      );
    });
  });

  // ─── EXPANSION: interventionPhotoConfig multiple entries ─────────────────────

  describe('mergeWithDefaults — interventionPhotoConfig multiple device types', () => {
    it('should merge multiple device type photo configs from remote', async () => {
      const photoConfig = {
        gasBoiler: {
          before: { maxPhotos: 3, requiredPhotos: 2, requireSparePartPhotos: true, description: 'Gas before' },
          after: { maxPhotos: 2, requiredPhotos: 1, requireSparePartPhotos: false, description: 'Gas after' },
        },
        electricBoiler: {
          before: { maxPhotos: 2, requiredPhotos: 1, requireSparePartPhotos: false, description: 'Electric before' },
        },
      };
      setupFirestoreVersionAndConfig(90, { ...validRemoteConfig, interventionPhotoConfig: photoConfig });
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(Object.keys(result.interventionPhotoConfig).length).toBe(2);
      expect(result.interventionPhotoConfig['gasBoiler']['before'].maxPhotos).toBe(3);
      expect(result.interventionPhotoConfig['electricBoiler']['before'].maxPhotos).toBe(2);
    });
  });

  // ─── EXPANSION: return type verification ─────────────────────────────────────

  describe('loadConfig — return type structure', () => {
    it('should always return an object with version property', async () => {
      setupFirestoreVersionAndConfig(1);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result).toBeDefined();
      expect(typeof result.version).toBe('number');
    });

    it('should always return an object with features property', async () => {
      setupFirestoreVersionAndConfig(1);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.features).toBeDefined();
      expect(typeof result.features).toBe('object');
    });

    it('should always return an object with theme property', async () => {
      setupFirestoreVersionAndConfig(1);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.theme).toBeDefined();
      expect(typeof result.theme.primaryColor).toBe('string');
    });

    it('should always return an object with business property', async () => {
      setupFirestoreVersionAndConfig(1);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.business).toBeDefined();
      expect(typeof result.business.maxPartsPerIntervention).toBe('number');
    });

    it('should always return an object with localization property', async () => {
      setupFirestoreVersionAndConfig(1);
      mockPreferences.get.and.resolveTo(null);

      const result = await service.loadConfig();

      expect(result.localization).toBeDefined();
      expect(typeof result.localization.defaultLanguage).toBe('string');
    });
  });

  // ─── EXPANSION: default config fallback structure ─────────────────────────────

  describe('loadConfig — default config structure when both remote and cache fail', () => {
    it('default config version should be 0', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.rejectWith(new Error('Fail'));

      const result = await service.loadConfig();

      expect(result.version).toBe(0);
    });

    it('default config features should have deviceCatalog=true', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.rejectWith(new Error('Fail'));

      const result = await service.loadConfig();

      expect(result.features.deviceCatalog).toBe(true);
    });

    it('default config features should have cart=false', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.rejectWith(new Error('Fail'));

      const result = await service.loadConfig();

      expect(result.features.cart).toBe(false);
    });

    it('default config business should have maxPartsPerIntervention from defaults', async () => {
      mockPreferences.get.and.resolveTo(null);
      mockFirestore.getTenantDocument.and.rejectWith(new Error('Fail'));

      const result = await service.loadConfig();

      expect(result.business.maxPartsPerIntervention).toBe(getDefaultConfig().business.maxPartsPerIntervention);
    });
  });
});
