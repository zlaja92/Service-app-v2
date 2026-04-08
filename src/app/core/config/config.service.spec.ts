import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import { AppConfig, getDefaultConfig, getDefaultFeatures, getDefaultTheme } from './config.model';
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
      warrantyPeriodMonths: 60,
      serviceIntervalMonths: 19,
      maxPartsPerIntervention: 4,
      currency: 'EUR',
      partNote: '',
      partPhotoFolder: '',
      snModelStart: 0,
      snModelLength: 7,
      dynamicForm: [],
    },
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
});
