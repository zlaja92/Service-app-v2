import { signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, ModalController, AlertController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';

import { FirestoreService } from '../core/firebase/firestore.service';
import { LoggerService } from '../core/logger/logger.service';
import { TenantService } from '../core/tenant/tenant.service';
import { AppConfig, FeatureFlags, getDefaultConfig, getDefaultFeatures, getDefaultTheme } from '../core/config/config.model';
import { AuthUser } from '../core/auth/auth.model';
import { ServicerService } from '../core/servicer/servicer.service';
import { StorageService } from '../core/firebase/storage.service';
import { ReportService } from '../features/reports/services/report.service';
import { InterventionReportService } from '../features/reports/services/intervention-report.service';
import { ReportPreferenceService } from '../features/reports/services/report-preference.service';
import { LoadingAlertService } from '../shared/services/loading-alert.service';

// ─── FirestoreService ─────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for FirestoreService with all public methods stubbed.
 * Default return values resolve to null / empty collection results.
 */
export function createMockFirestoreService(): jasmine.SpyObj<FirestoreService> {
  const mock = jasmine.createSpyObj<FirestoreService>('FirestoreService', [
    'getDocument',
    'getTenantDocument',
    'queryTenantCollection',
    'setDocument',
    'setTenantDocument',
    'addTenantDocument',
    'queryTenantSubcollection',
    'querySubcollection',
    'writeBatch',
    'buildTenantReference',
    'getInterventionDocument',
    'addInterventionDocument',
    'queryInterventionCollection',
    'buildInterventionReference',
    'generateId',
  ]);

  mock.getDocument.and.resolveTo(null);
  mock.getTenantDocument.and.resolveTo(null);
  mock.queryTenantCollection.and.resolveTo({ documents: [], lastDocumentPath: null });
  mock.setDocument.and.resolveTo();
  mock.setTenantDocument.and.resolveTo();
  mock.addTenantDocument.and.resolveTo('mock-doc-id');
  mock.queryTenantSubcollection.and.resolveTo({ documents: [], lastDocumentPath: null });
  mock.querySubcollection.and.resolveTo({ documents: [], lastDocumentPath: null });
  mock.writeBatch.and.resolveTo();
  mock.buildTenantReference.and.returnValue('tenants/mock-tenant/mock-collection/mock-id');
  mock.getInterventionDocument.and.resolveTo(null);
  mock.addInterventionDocument.and.resolveTo('mock-intervention-id');
  mock.queryInterventionCollection.and.resolveTo({ documents: [], lastDocumentPath: null });
  mock.buildInterventionReference.and.returnValue('tenants/mock-tenant/interventions/mock-id');
  mock.generateId.and.returnValue('mockGeneratedId12345678');

  return mock;
}

// ─── LoggerService ────────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for LoggerService with all log-level methods stubbed.
 * All stubs are no-ops — they absorb calls without side effects.
 */
export function createMockLoggerService(): jasmine.SpyObj<LoggerService> {
  const mock = jasmine.createSpyObj<LoggerService>('LoggerService', [
    'debug',
    'info',
    'warn',
    'error',
    'addTransport',
  ]);

  mock.debug.and.stub();
  mock.info.and.stub();
  mock.warn.and.stub();
  mock.error.and.stub();
  mock.addTransport.and.stub();

  return mock;
}

// ─── TenantService ────────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for TenantService with all public methods stubbed.
 * Default: tenantId is 'mock-tenant', role allows all device types.
 */
export function createMockTenantService(): jasmine.SpyObj<TenantService> {
  const mock = jasmine.createSpyObj<TenantService>('TenantService', [
    'resolveFromAuthToken',
    'getTenantDocPath',
    'getCollectionPath',
    'getCurrentTenantId',
    'getInterventionCollectionPath',
    'isDeviceTypeAllowed',
    'getAllowedDeviceTypes',
  ]);

  mock.resolveFromAuthToken.and.resolveTo();
  mock.getTenantDocPath.and.returnValue('tenants/mock-tenant');
  mock.getCollectionPath.and.callFake((collection: string) => `tenants/mock-tenant/${collection}`);
  mock.getCurrentTenantId.and.returnValue('mock-tenant');
  mock.getInterventionCollectionPath.and.callFake(
    (_deviceType: string) => 'tenants/mock-tenant/interventions',
  );
  mock.isDeviceTypeAllowed.and.returnValue(true);
  mock.getAllowedDeviceTypes.and.returnValue(['gas-boiler', 'heat-pump', 'boiler', 'air-condition']);

  return mock;
}

// ─── ConfigStore mock ─────────────────────────────────────────────────────────

/**
 * Type describing the shape of the ConfigStore mock object.
 * Mirrors the public API exposed by the NgRx SignalStore-based ConfigStore.
 */
export interface MockConfigStore {
  config: ReturnType<typeof signal<AppConfig | null>>;
  logoDataUrl: ReturnType<typeof signal<string | null>>;
  isLoaded: ReturnType<typeof signal<boolean>>;
  isLoading: ReturnType<typeof signal<boolean>>;
  error: ReturnType<typeof signal<string | null>>;
  features: ReturnType<typeof computed<FeatureFlags>>;
  theme: ReturnType<typeof computed<ReturnType<typeof getDefaultTheme>>>;
  localization: ReturnType<typeof computed<AppConfig['localization'] | undefined>>;
  appTitle: ReturnType<typeof computed<string>>;
  business: ReturnType<typeof computed<AppConfig['business'] | undefined>>;
  isFeatureEnabled: jasmine.Spy;
  setConfig: jasmine.Spy;
  setLogoDataUrl: jasmine.Spy;
  loadDefaults: jasmine.Spy;
  setLoading: jasmine.Spy;
  setError: jasmine.Spy;
  clear: jasmine.Spy;
}

/**
 * Creates a mock object for ConfigStore (NgRx SignalStore).
 *
 * Cannot use jasmine.createSpyObj because SignalStore exposes Angular signals,
 * not plain methods. Returns a plain object with writable signals and spy methods
 * that mirror the real store's public API.
 *
 * Usage in TestBed:
 *   { provide: ConfigStore, useValue: createMockConfigStore() }
 */
export function createMockConfigStore(): MockConfigStore {
  const config = signal<AppConfig | null>(null);
  const logoDataUrl = signal<string | null>(null);
  const isLoaded = signal<boolean>(false);
  const isLoading = signal<boolean>(false);
  const error = signal<string | null>(null);

  return {
    // State signals — tests can call .set() on these to drive state changes
    config,
    logoDataUrl,
    isLoaded,
    isLoading,
    error,

    // Computed signals derived from config — mirror real store behaviour
    features: computed(() => config()?.features ?? getDefaultFeatures()),
    theme: computed(() => config()?.theme ?? getDefaultTheme()),
    localization: computed(() => config()?.localization),
    appTitle: computed(() => config()?.theme?.appTitle ?? 'Ariston Service'),
    business: computed(() => config()?.business),

    // Method spies — default implementations mirror real store mutations
    isFeatureEnabled: jasmine.createSpy('isFeatureEnabled').and.callFake(
      (featureName: keyof FeatureFlags) => {
        const features = config()?.features ?? getDefaultFeatures();
        return features[featureName] ?? false;
      },
    ),

    setConfig: jasmine.createSpy('setConfig').and.callFake((cfg: AppConfig) => {
      config.set(cfg);
      isLoaded.set(true);
      isLoading.set(false);
      error.set(null);
    }),

    setLogoDataUrl: jasmine.createSpy('setLogoDataUrl').and.callFake(
      (url: string | null) => logoDataUrl.set(url),
    ),

    loadDefaults: jasmine.createSpy('loadDefaults').and.callFake(() => {
      config.set(getDefaultConfig());
      isLoaded.set(true);
      isLoading.set(false);
    }),

    setLoading: jasmine.createSpy('setLoading').and.callFake(
      (loading: boolean) => isLoading.set(loading),
    ),

    setError: jasmine.createSpy('setError').and.callFake((msg: string) => {
      error.set(msg);
      isLoading.set(false);
    }),

    clear: jasmine.createSpy('clear').and.callFake(() => {
      config.set(null);
      logoDataUrl.set(null);
      isLoaded.set(false);
      isLoading.set(false);
      error.set(null);
    }),
  };
}

// ─── AuthStore mock ───────────────────────────────────────────────────────────

/**
 * Type describing the shape of the AuthStore mock object.
 * Mirrors the public API exposed by the NgRx SignalStore-based AuthStore.
 */
export interface MockAuthStore {
  user: ReturnType<typeof signal<AuthUser | null>>;
  isLoading: ReturnType<typeof signal<boolean>>;
  error: ReturnType<typeof signal<string | null>>;
  isAuthenticated: ReturnType<typeof computed<boolean>>;
  userEmail: ReturnType<typeof computed<string>>;
  userId: ReturnType<typeof computed<string>>;
  setUser: jasmine.Spy;
  clearUser: jasmine.Spy;
  setLoading: jasmine.Spy;
  setError: jasmine.Spy;
}

/**
 * Creates a mock object for AuthStore (NgRx SignalStore).
 *
 * Cannot use jasmine.createSpyObj because SignalStore exposes Angular signals.
 * Returns a plain object with writable signals and spy methods that mirror
 * the real store's public API.
 *
 * Usage in TestBed:
 *   { provide: AuthStore, useValue: createMockAuthStore() }
 */
export function createMockAuthStore(): MockAuthStore {
  const user = signal<AuthUser | null>(null);
  const isLoading = signal<boolean>(false);
  const error = signal<string | null>(null);

  return {
    // State signals
    user,
    isLoading,
    error,

    // Computed signals — mirror real store behaviour
    isAuthenticated: computed(() => user() !== null),
    userEmail: computed(() => user()?.email ?? ''),
    userId: computed(() => user()?.uid ?? ''),

    // Method spies
    setUser: jasmine.createSpy('setUser').and.callFake((u: AuthUser) => {
      user.set(u);
      error.set(null);
    }),

    clearUser: jasmine.createSpy('clearUser').and.callFake(() => {
      user.set(null);
      error.set(null);
    }),

    setLoading: jasmine.createSpy('setLoading').and.callFake(
      (loading: boolean) => isLoading.set(loading),
    ),

    setError: jasmine.createSpy('setError').and.callFake((msg: string) => {
      error.set(msg);
      isLoading.set(false);
    }),
  };
}

// ─── Ionic controllers ────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for Ionic ToastController.
 * Default: create() resolves to a mock overlay with present/dismiss spies.
 */
export function createMockToastController(): jasmine.SpyObj<ToastController> {
  const mock = jasmine.createSpyObj<ToastController>('ToastController', ['create', 'dismiss', 'getTop']);

  mock.create.and.resolveTo({
    present: jasmine.createSpy('present').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
  } as unknown as HTMLIonToastElement);

  mock.dismiss.and.resolveTo(true);
  mock.getTop.and.resolveTo(undefined);

  return mock;
}

/**
 * Creates a jasmine.SpyObj for Ionic ModalController.
 * Default: create() resolves to a mock overlay with present/dismiss/onDidDismiss spies.
 */
export function createMockModalController(): jasmine.SpyObj<ModalController> {
  const mock = jasmine.createSpyObj<ModalController>('ModalController', ['create', 'dismiss', 'getTop']);

  mock.create.and.resolveTo({
    present: jasmine.createSpy('present').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
  } as unknown as HTMLIonModalElement);

  mock.dismiss.and.resolveTo(true);
  mock.getTop.and.resolveTo(undefined);

  return mock;
}

/**
 * Creates a jasmine.SpyObj for Ionic AlertController.
 * Default: create() resolves to a mock overlay with present/dismiss/onDidDismiss spies.
 */
export function createMockAlertController(): jasmine.SpyObj<AlertController> {
  const mock = jasmine.createSpyObj<AlertController>('AlertController', ['create', 'dismiss', 'getTop']);

  mock.create.and.resolveTo({
    present: jasmine.createSpy('present').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
  } as unknown as HTMLIonAlertElement);

  mock.dismiss.and.resolveTo(true);
  mock.getTop.and.resolveTo(undefined);

  return mock;
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for Angular Router.
 * Default: navigate() resolves to true (successful navigation).
 */
export function createMockRouter(): jasmine.SpyObj<Router> {
  const mock = jasmine.createSpyObj<Router>('Router', [
    'navigate',
    'navigateByUrl',
    'createUrlTree',
    'serializeUrl',
  ]);

  mock.navigate.and.resolveTo(true);
  mock.navigateByUrl.and.resolveTo(true);

  return mock;
}

// ─── TranslocoService ─────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for TranslocoService.
 * Default: translate() returns the key as-is (pass-through), selectTranslate()
 * returns an Observable that emits the key, getActiveLang() returns 'sr'.
 */
export function createMockTranslocoService(): jasmine.SpyObj<TranslocoService> {
  const mock = jasmine.createSpyObj<TranslocoService>('TranslocoService', [
    'translate',
    'selectTranslate',
    'translateObject',
    'selectTranslateObject',
    'getActiveLang',
    'setActiveLang',
    'getDefaultLang',
    'setDefaultLang',
    'getAvailableLangs',
    'setAvailableLangs',
    'load',
    'getTranslation',
    'setTranslation',
    'setTranslationKey',
    'isLang',
  ]);

  // translate() returns the key as-is so templates render predictably in tests
  // Cast required because the real signature uses generic overloads incompatible with callFake
  (mock.translate as jasmine.Spy).and.callFake((key: string | string[]) =>
    Array.isArray(key) ? key : key,
  );

  (mock.selectTranslate as jasmine.Spy).and.callFake((key: string) => of(key));
  (mock.selectTranslateObject as jasmine.Spy).and.callFake((key: string) => of(key));
  mock.getActiveLang.and.returnValue('sr');
  mock.getDefaultLang.and.returnValue('sr');
  mock.getAvailableLangs.and.returnValue(['sr', 'en', 'mk']);
  mock.isLang.and.callFake((lang: string) => ['sr', 'en', 'mk'].includes(lang));
  mock.load.and.returnValue(of({}));
  mock.getTranslation.and.returnValue({} as ReturnType<TranslocoService['getTranslation']>);
  mock.setActiveLang.and.returnValue(mock);

  return mock;
}

// ─── Capacitor Preferences ────────────────────────────────────────────────────

/**
 * Shape of the Capacitor Preferences mock returned by createMockPreferences().
 */
export interface MockPreferences {
  get: jasmine.Spy<(options: { key: string }) => Promise<{ value: string | null }>>;
  set: jasmine.Spy<(options: { key: string; value: string }) => Promise<void>>;
  remove: jasmine.Spy<(options: { key: string }) => Promise<void>>;
  clear: jasmine.Spy<() => Promise<void>>;
  /** Exposes internal Map for direct inspection in tests */
  _store: Map<string, string>;
}

/**
 * Creates an in-memory mock for the Capacitor Preferences plugin.
 *
 * Uses a backing Map to simulate persistence within a single test run.
 * Each call to createMockPreferences() produces an independent store —
 * use a fresh instance per test to avoid state leakage.
 *
 * Expose _store to assert stored values directly:
 *   expect(mock._store.get('my_key')).toBe('expected_value');
 */
export function createMockPreferences(): MockPreferences {
  const store = new Map<string, string>();

  return {
    get: jasmine.createSpy('get').and.callFake(({ key }: { key: string }) =>
      Promise.resolve({ value: store.get(key) ?? null }),
    ),

    set: jasmine.createSpy('set').and.callFake(({ key, value }: { key: string; value: string }) => {
      store.set(key, value);
      return Promise.resolve();
    }),

    remove: jasmine.createSpy('remove').and.callFake(({ key }: { key: string }) => {
      store.delete(key);
      return Promise.resolve();
    }),

    clear: jasmine.createSpy('clear').and.callFake(() => {
      store.clear();
      return Promise.resolve();
    }),

    _store: store,
  };
}

// ─── ServicerService ────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for ServicerService.
 * Default: getCurrent/getByEmail resolve to null.
 */
export function createMockServicerService(): jasmine.SpyObj<ServicerService> {
  const mock = jasmine.createSpyObj<ServicerService>('ServicerService', ['getCurrent', 'getByEmail']);
  mock.getCurrent.and.resolveTo(null);
  mock.getByEmail.and.resolveTo(null);
  return mock;
}

// ─── StorageService ─────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for StorageService.
 * Default: getFileUrl/resolveFileUrl resolve to empty/null, uploads resolve void.
 */
export function createMockStorageService(): jasmine.SpyObj<StorageService> {
  const mock = jasmine.createSpyObj<StorageService>('StorageService', [
    'getFileUrl', 'listFolder', 'uploadFile', 'uploadDataUrl', 'resolveFileUrl',
  ]);
  mock.getFileUrl.and.resolveTo(null);
  mock.listFolder.and.resolveTo({ folders: [], files: [] });
  mock.uploadFile.and.resolveTo();
  mock.uploadDataUrl.and.resolveTo();
  mock.resolveFileUrl.and.resolveTo('');
  return mock;
}

// ─── ReportService ──────────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for ReportService.
 * Default: generate resolves void.
 */
export function createMockReportService(): jasmine.SpyObj<ReportService> {
  const mock = jasmine.createSpyObj<ReportService>('ReportService', ['generate']);
  mock.generate.and.resolveTo();
  return mock;
}

// ─── LoadingAlertService ────────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for LoadingAlertService.
 * Default: show/hide resolve void; wrap() invokes the supplied operation and
 * returns its result (transparent pass-through, like the real implementation).
 */
export function createMockLoadingAlertService(): jasmine.SpyObj<LoadingAlertService> {
  const mock = jasmine.createSpyObj<LoadingAlertService>('LoadingAlertService', ['show', 'hide', 'wrap']);
  mock.show.and.resolveTo();
  mock.hide.and.resolveTo();
  mock.wrap.and.callFake(<T>(operation: () => Promise<T>) => operation());
  return mock;
}

// ─── InterventionReportService ────────────────────────────────────────────────

/**
 * Creates a jasmine.SpyObj for InterventionReportService.
 * Default: open() resolves void (no real report rendering).
 */
export function createMockInterventionReportService(): jasmine.SpyObj<InterventionReportService> {
  const mock = jasmine.createSpyObj<InterventionReportService>('InterventionReportService', ['open']);
  mock.open.and.resolveTo();
  return mock;
}

// ─── ReportPreferenceService ──────────────────────────────────────────────────

/**
 * Creates a mock ReportPreferenceService with a writable autoOpen signal.
 * Default: autoOpen() is false; setAutoOpen updates the signal and resolves.
 */
export function createMockReportPreferenceService(): Pick<ReportPreferenceService, 'autoOpen' | 'setAutoOpen' | 'init'> {
  const autoOpen = signal(false);
  return {
    autoOpen,
    setAutoOpen: jasmine.createSpy('setAutoOpen').and.callFake((enabled: boolean) => {
      autoOpen.set(enabled);
      return Promise.resolve();
    }),
    init: jasmine.createSpy('init').and.resolveTo(),
  } as unknown as Pick<ReportPreferenceService, 'autoOpen' | 'setAutoOpen' | 'init'>;
}
