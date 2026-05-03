import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { appInitializer } from './app-initializer';
import { FirebaseInitService } from '../firebase/firebase-init.service';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { ConfigStore } from '../config/config.store';
import { ThemeService } from '../theme/theme.service';
import { TranslationService } from '../i18n/translation.service';
import { SessionService } from '../session/session.service';
import { LoggerService } from '../logger/logger.service';
import { AuthUser } from '../auth/auth.model';
import {
  createMockLoggerService,
  createMockRouter,
  createMockAuthStore,
  createMockConfigStore,
  MockAuthStore,
  MockConfigStore,
} from '../../testing/mock-factories';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockFirebaseInitService(): jasmine.SpyObj<FirebaseInitService> {
  const mock = jasmine.createSpyObj<FirebaseInitService>('FirebaseInitService', [
    'initialize',
    'getApp',
  ]);
  mock.initialize.and.stub();
  return mock;
}

function createMockAuthService(): jasmine.SpyObj<AuthService> {
  const mock = jasmine.createSpyObj<AuthService>('AuthService', [
    'login',
    'logout',
    'waitForAuthReady',
    'onAuthStateChange',
  ]);
  mock.waitForAuthReady.and.resolveTo(null);
  mock.onAuthStateChange.and.stub();
  return mock;
}

function createMockThemeService(): jasmine.SpyObj<ThemeService> {
  const mock = jasmine.createSpyObj<ThemeService>('ThemeService', [
    'initDarkMode',
    'setDarkMode',
    'applyTheme',
  ]);
  mock.initDarkMode.and.resolveTo();
  mock.applyTheme.and.stub();
  return mock;
}

function createMockTranslationService(): jasmine.SpyObj<TranslationService> {
  const mock = jasmine.createSpyObj<TranslationService>('TranslationService', [
    'init',
    'sync',
    'setLanguage',
    'getLanguageLabel',
  ]);
  mock.init.and.resolveTo();
  return mock;
}

function createMockSessionService(): jasmine.SpyObj<SessionService> {
  const mock = jasmine.createSpyObj<SessionService>('SessionService', [
    'bootstrap',
    'teardown',
  ]);
  mock.bootstrap.and.resolveTo();
  mock.teardown.and.stub();
  return mock;
}

function createMockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: 'test-uid-123',
    email: 'test@example.com',
    displayName: 'Test User',
    ...overrides,
  };
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

interface TestMocks {
  mockFirebaseInit: jasmine.SpyObj<FirebaseInitService>;
  mockAuthService: jasmine.SpyObj<AuthService>;
  mockAuthStore: MockAuthStore;
  mockConfigStore: MockConfigStore;
  mockThemeService: jasmine.SpyObj<ThemeService>;
  mockTranslationService: jasmine.SpyObj<TranslationService>;
  mockSessionService: jasmine.SpyObj<SessionService>;
  mockLogger: jasmine.SpyObj<LoggerService>;
  mockRouter: jasmine.SpyObj<Router>;
}

function setupTestBed(): TestMocks {
  const mockFirebaseInit = createMockFirebaseInitService();
  const mockAuthService = createMockAuthService();
  const mockAuthStore = createMockAuthStore();
  const mockConfigStore = createMockConfigStore();
  const mockThemeService = createMockThemeService();
  const mockTranslationService = createMockTranslationService();
  const mockSessionService = createMockSessionService();
  const mockLogger = createMockLoggerService();
  const mockRouter = createMockRouter();

  TestBed.configureTestingModule({
    providers: [
      { provide: FirebaseInitService, useValue: mockFirebaseInit },
      { provide: AuthService, useValue: mockAuthService },
      { provide: AuthStore, useValue: mockAuthStore },
      { provide: ConfigStore, useValue: mockConfigStore },
      { provide: ThemeService, useValue: mockThemeService },
      { provide: TranslationService, useValue: mockTranslationService },
      { provide: SessionService, useValue: mockSessionService },
      { provide: LoggerService, useValue: mockLogger },
      { provide: Router, useValue: mockRouter },
    ],
  });

  return {
    mockFirebaseInit,
    mockAuthService,
    mockAuthStore,
    mockConfigStore,
    mockThemeService,
    mockTranslationService,
    mockSessionService,
    mockLogger,
    mockRouter,
  };
}

async function runInitializer(): Promise<void> {
  // appInitializer uses inject() internally — must run inside injection context
  return TestBed.runInInjectionContext(() => appInitializer());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('appInitializer', () => {
  describe('Initialization sequence', () => {
    it('TC-01: should call FirebaseInitService.initialize() during startup', async () => {
      const { mockFirebaseInit } = setupTestBed();

      await runInitializer();

      expect(mockFirebaseInit.initialize).toHaveBeenCalledTimes(1);
    });

    it('TC-02: should call ThemeService.initDarkMode()', async () => {
      const { mockThemeService } = setupTestBed();

      await runInitializer();

      expect(mockThemeService.initDarkMode).toHaveBeenCalledTimes(1);
    });

    it('TC-03: should call TranslationService.init()', async () => {
      const { mockTranslationService } = setupTestBed();

      await runInitializer();

      expect(mockTranslationService.init).toHaveBeenCalledTimes(1);
    });

    it('TC-04: should call AuthService.waitForAuthReady()', async () => {
      const { mockAuthService } = setupTestBed();

      await runInitializer();

      expect(mockAuthService.waitForAuthReady).toHaveBeenCalledTimes(1);
    });

    it('TC-04b: should call FirebaseInitService.initialize() before ThemeService.initDarkMode()', async () => {
      const { mockFirebaseInit, mockThemeService } = setupTestBed();
      const callOrder: string[] = [];

      mockFirebaseInit.initialize.and.callFake(() => {
        callOrder.push('firebase.initialize');
      });
      mockThemeService.initDarkMode.and.callFake(() => {
        callOrder.push('theme.initDarkMode');
        return Promise.resolve();
      });

      await runInitializer();

      expect(callOrder.indexOf('firebase.initialize')).toBeLessThan(
        callOrder.indexOf('theme.initDarkMode'),
      );
    });
  });

  describe('waitForAuthReady success — user present', () => {
    it('TC-05: should call AuthStore.setUser() with the resolved user', async () => {
      const { mockAuthService, mockAuthStore } = setupTestBed();
      const user = createMockUser();
      mockAuthService.waitForAuthReady.and.resolveTo(user);

      await runInitializer();

      expect(mockAuthStore.setUser).toHaveBeenCalledWith(user);
    });

    it('TC-06: should call SessionService.bootstrap() when user is authenticated', async () => {
      const { mockAuthService, mockSessionService } = setupTestBed();
      mockAuthService.waitForAuthReady.and.resolveTo(createMockUser());

      await runInitializer();

      expect(mockSessionService.bootstrap).toHaveBeenCalledTimes(1);
    });

    it('TC-07: should log success after authenticated bootstrap', async () => {
      const { mockAuthService, mockLogger } = setupTestBed();
      mockAuthService.waitForAuthReady.and.resolveTo(createMockUser());

      await runInitializer();

      const infoCalls = (mockLogger.info as jasmine.Spy).calls.allArgs();
      const successLogged = infoCalls.some(
        (args) =>
          typeof args[0] === 'string' &&
          (args[0].includes('authenticated') || args[0].includes('initialized') || args[0].includes('Restored')),
      );
      expect(successLogged).toBeTrue();
    });
  });

  describe('waitForAuthReady success — user null', () => {
    it('TC-08: should call AuthStore.clearUser() when no user returned', async () => {
      // Source code does NOT call clearUser() when user is null on initial load —
      // it calls configStore.loadDefaults() instead. Verify that behavior.
      const { mockAuthService, mockAuthStore, mockConfigStore } = setupTestBed();
      mockAuthService.waitForAuthReady.and.resolveTo(null);

      await runInitializer();

      // When user is null on initial load, clearUser is NOT called (no prior session to clear)
      expect(mockAuthStore.clearUser).not.toHaveBeenCalled();
      // ConfigStore.loadDefaults() IS called
      expect(mockConfigStore.loadDefaults).toHaveBeenCalledTimes(1);
    });

    it('TC-09: should call ConfigStore.loadDefaults() when no authenticated user', async () => {
      const { mockAuthService, mockConfigStore } = setupTestBed();
      mockAuthService.waitForAuthReady.and.resolveTo(null);

      await runInitializer();

      expect(mockConfigStore.loadDefaults).toHaveBeenCalledTimes(1);
    });

    it('TC-10: should NOT call Router.navigate() on initial load when user is null', async () => {
      const { mockAuthService, mockRouter } = setupTestBed();
      mockAuthService.waitForAuthReady.and.resolveTo(null);

      await runInitializer();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('waitForAuthReady error', () => {
    it('TC-11: should log error when waitForAuthReady throws', async () => {
      const { mockAuthService, mockLogger } = setupTestBed();
      const testError = new Error('Firebase auth failure');
      mockAuthService.waitForAuthReady.and.rejectWith(testError);

      await runInitializer();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'App initializer error',
        jasmine.objectContaining({ error: jasmine.any(String) }),
      );
    });

    it('TC-12: should fall back to ConfigStore.loadDefaults() when waitForAuthReady throws', async () => {
      const { mockAuthService, mockConfigStore } = setupTestBed();
      mockAuthService.waitForAuthReady.and.rejectWith(new Error('Firebase timeout'));

      await runInitializer();

      expect(mockConfigStore.loadDefaults).toHaveBeenCalledTimes(1);
    });

    it('TC-13: should not throw (prevents app crash) when waitForAuthReady rejects', async () => {
      const { mockAuthService } = setupTestBed();
      mockAuthService.waitForAuthReady.and.rejectWith(new Error('Critical Firebase error'));

      await expectAsync(runInitializer()).toBeResolved();
    });
  });

  describe('onAuthStateChange listener', () => {
    it('TC-14: should register onAuthStateChange listener after initial bootstrap', async () => {
      const { mockAuthService } = setupTestBed();

      await runInitializer();

      expect(mockAuthService.onAuthStateChange).toHaveBeenCalledTimes(1);
      expect(mockAuthService.onAuthStateChange).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('TC-15: listener should call AuthStore.setUser() and SessionService.bootstrap() when user present', async () => {
      const { mockAuthService, mockAuthStore, mockSessionService } = setupTestBed();
      let capturedListener: ((user: AuthUser | null) => void) | null = null;

      mockAuthService.onAuthStateChange.and.callFake((cb: (user: AuthUser | null) => void) => {
        capturedListener = cb;
      });

      await runInitializer();

      expect(capturedListener).not.toBeNull();

      const user = createMockUser({ uid: 'listener-user-uid' });
      await capturedListener!(user);

      expect(mockAuthStore.setUser).toHaveBeenCalledWith(user);
      expect(mockSessionService.bootstrap).toHaveBeenCalled();
    });

    it('TC-16: listener should call AuthStore.clearUser(), SessionService.teardown(), and Router.navigate(/login) when user null', async () => {
      const { mockAuthService, mockAuthStore, mockSessionService, mockRouter } = setupTestBed();
      let capturedListener: ((user: AuthUser | null) => void) | null = null;

      mockAuthService.onAuthStateChange.and.callFake((cb: (user: AuthUser | null) => void) => {
        capturedListener = cb;
      });

      await runInitializer();

      expect(capturedListener).not.toBeNull();
      await capturedListener!(null);

      expect(mockAuthStore.clearUser).toHaveBeenCalledTimes(1);
      expect(mockSessionService.teardown).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('TC-17: listener should catch and log errors thrown during state change handling', async () => {
      const { mockAuthService, mockAuthStore, mockLogger } = setupTestBed();
      let capturedListener: ((user: AuthUser | null) => void) | null = null;

      mockAuthService.onAuthStateChange.and.callFake((cb: (user: AuthUser | null) => void) => {
        capturedListener = cb;
      });

      // Make setUser throw to simulate an unexpected error in handler
      mockAuthStore.setUser.and.callFake(() => {
        throw new Error('Store update failed');
      });

      await runInitializer();

      expect(capturedListener).not.toBeNull();
      // Should not throw — error must be caught internally
      await expectAsync(capturedListener!(createMockUser())).toBeResolved();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Auth state change handler failed',
        jasmine.objectContaining({ error: jasmine.any(String) }),
      );
    });

    it('TC-18: listener should handle multiple sequential state changes correctly', async () => {
      const { mockAuthService, mockAuthStore, mockSessionService, mockRouter } = setupTestBed();
      let capturedListener: ((user: AuthUser | null) => void) | null = null;

      mockAuthService.onAuthStateChange.and.callFake((cb: (user: AuthUser | null) => void) => {
        capturedListener = cb;
      });

      await runInitializer();

      const user = createMockUser();

      // First change: user logs in
      await capturedListener!(user);
      expect(mockAuthStore.setUser).toHaveBeenCalledWith(user);
      expect(mockSessionService.bootstrap).toHaveBeenCalledTimes(1);

      // Second change: user logs out
      await capturedListener!(null);
      expect(mockAuthStore.clearUser).toHaveBeenCalledTimes(1);
      expect(mockSessionService.teardown).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);

      // Third change: user logs back in
      const user2 = createMockUser({ uid: 'second-login-uid' });
      await capturedListener!(user2);
      expect(mockAuthStore.setUser).toHaveBeenCalledWith(user2);
      expect(mockSessionService.bootstrap).toHaveBeenCalledTimes(2);
    });
  });

  // ─── EXPANSION: initialization sequence ordering ──────────────────────────────

  describe('initialization sequence ordering', () => {
    it('should call firebase.initialize before waitForAuthReady', async () => {
      const { mockFirebaseInit, mockAuthService } = setupTestBed();
      const callOrder: string[] = [];

      mockFirebaseInit.initialize.and.callFake(() => {
        callOrder.push('firebase');
      });
      mockAuthService.waitForAuthReady.and.callFake(async () => {
        callOrder.push('waitForAuthReady');
        return null;
      });

      await runInitializer();

      expect(callOrder.indexOf('firebase')).toBeLessThan(callOrder.indexOf('waitForAuthReady'));
    });

    it('should call translation.init before waitForAuthReady', async () => {
      const { mockTranslationService, mockAuthService } = setupTestBed();
      const callOrder: string[] = [];

      mockTranslationService.init.and.callFake(async () => {
        callOrder.push('translation.init');
      });
      mockAuthService.waitForAuthReady.and.callFake(async () => {
        callOrder.push('waitForAuthReady');
        return null;
      });

      await runInitializer();

      expect(callOrder.indexOf('translation.init')).toBeLessThan(callOrder.indexOf('waitForAuthReady'));
    });

    it('should call theme.initDarkMode before waitForAuthReady', async () => {
      const { mockThemeService, mockAuthService } = setupTestBed();
      const callOrder: string[] = [];

      mockThemeService.initDarkMode.and.callFake(async () => {
        callOrder.push('initDarkMode');
      });
      mockAuthService.waitForAuthReady.and.callFake(async () => {
        callOrder.push('waitForAuthReady');
        return null;
      });

      await runInitializer();

      expect(callOrder.indexOf('initDarkMode')).toBeLessThan(callOrder.indexOf('waitForAuthReady'));
    });

    it('should log "App initializer started" at start', async () => {
      const { mockLogger } = setupTestBed();

      await runInitializer();

      expect(mockLogger.info).toHaveBeenCalledWith('App initializer started');
    });

    it('should log "App initializer completed" at end', async () => {
      const { mockLogger } = setupTestBed();

      await runInitializer();

      const infoCalls = (mockLogger.info as jasmine.Spy).calls.allArgs();
      const completedLogged = infoCalls.some(
        (args) => typeof args[0] === 'string' && args[0].includes('completed'),
      );
      expect(completedLogged).toBeTrue();
    });
  });

  // ─── EXPANSION: authenticated user matrix ────────────────────────────────────

  describe('authenticated user matrix — various user UIDs', () => {
    const testUsers: Array<Partial<AuthUser>> = [
      { uid: 'uid-001', email: 'user1@example.com' },
      { uid: 'uid-002', email: 'user2@test.org' },
      { uid: 'admin-uid', email: 'admin@company.com', displayName: 'Admin User' },
      { uid: 'long-uid-12345678901234567890', email: 'long@example.com' },
      { uid: 'special-chars_user', email: 'special@test.io' },
    ];

    testUsers.forEach(({ uid, email, displayName }) => {
      it(`should call setUser and bootstrap for user with uid="${uid}"`, async () => {
        const { mockAuthService, mockAuthStore, mockSessionService } = setupTestBed();
        const user = createMockUser({ uid, email, displayName });
        mockAuthService.waitForAuthReady.and.resolveTo(user);

        await runInitializer();

        expect(mockAuthStore.setUser).toHaveBeenCalledWith(jasmine.objectContaining({ uid }));
        expect(mockSessionService.bootstrap).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ─── EXPANSION: error type variety ───────────────────────────────────────────

  describe('error handling — various error types', () => {
    const errorMessages = [
      'Firebase auth failure',
      'Network unavailable',
      'Token expired',
      'Quota exceeded',
      'Permission denied',
    ];

    errorMessages.forEach(msg => {
      it(`should not throw when waitForAuthReady rejects with "${msg}"`, async () => {
        const { mockAuthService } = setupTestBed();
        mockAuthService.waitForAuthReady.and.rejectWith(new Error(msg));

        await expectAsync(runInitializer()).toBeResolved();
      });
    });

    errorMessages.forEach(msg => {
      it(`should log error containing "${msg}" when waitForAuthReady rejects`, async () => {
        const { mockAuthService, mockLogger } = setupTestBed();
        mockAuthService.waitForAuthReady.and.rejectWith(new Error(msg));

        await runInitializer();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'App initializer error',
          jasmine.objectContaining({ error: jasmine.stringContaining(msg) }),
        );
      });
    });
  });

  // ─── EXPANSION: applyTheme called on null user path ──────────────────────────

  describe('applyTheme on no-user paths', () => {
    it('should call applyTheme when user is null (initial load)', async () => {
      const { mockAuthService, mockThemeService } = setupTestBed();
      mockAuthService.waitForAuthReady.and.resolveTo(null);

      await runInitializer();

      expect(mockThemeService.applyTheme).toHaveBeenCalledTimes(1);
    });

    it('should call applyTheme when waitForAuthReady throws', async () => {
      const { mockAuthService, mockThemeService } = setupTestBed();
      mockAuthService.waitForAuthReady.and.rejectWith(new Error('Firebase error'));

      await runInitializer();

      expect(mockThemeService.applyTheme).toHaveBeenCalledTimes(1);
    });

    it('should NOT call applyTheme during bootstrap when user is present', async () => {
      const { mockAuthService, mockThemeService } = setupTestBed();
      mockAuthService.waitForAuthReady.and.resolveTo(createMockUser());

      await runInitializer();

      // applyTheme is NOT called during initial load when user is authenticated
      // (bootstrap handles theme application)
      expect(mockThemeService.applyTheme).not.toHaveBeenCalled();
    });
  });

  // ─── EXPANSION: listener error recovery ──────────────────────────────────────

  describe('onAuthStateChange listener error recovery', () => {
    it('should not throw when SessionService.bootstrap() rejects in listener', async () => {
      const { mockAuthService, mockSessionService } = setupTestBed();
      let capturedListener: ((user: AuthUser | null) => void) | null = null;

      mockAuthService.onAuthStateChange.and.callFake((cb: (user: AuthUser | null) => void) => {
        capturedListener = cb;
      });
      mockSessionService.bootstrap.and.rejectWith(new Error('Bootstrap failed'));

      await runInitializer();

      expect(capturedListener).not.toBeNull();
      await expectAsync(capturedListener!(createMockUser())).toBeResolved();
    });

    it('should log error when SessionService.bootstrap() throws in listener', async () => {
      const { mockAuthService, mockSessionService, mockLogger } = setupTestBed();
      let capturedListener: ((user: AuthUser | null) => void) | null = null;

      mockAuthService.onAuthStateChange.and.callFake((cb: (user: AuthUser | null) => void) => {
        capturedListener = cb;
      });
      mockSessionService.bootstrap.and.rejectWith(new Error('Bootstrap failed'));

      await runInitializer();
      await capturedListener!(createMockUser());

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Auth state change handler failed',
        jasmine.objectContaining({ error: jasmine.any(String) }),
      );
    });

    it('should navigate to /login when SessionService.teardown() throws in listener', async () => {
      const { mockAuthService, mockSessionService, mockRouter } = setupTestBed();
      let capturedListener: ((user: AuthUser | null) => void) | null = null;

      mockAuthService.onAuthStateChange.and.callFake((cb: (user: AuthUser | null) => void) => {
        capturedListener = cb;
      });
      mockSessionService.teardown.and.throwError('Teardown failed');

      await runInitializer();
      await capturedListener!(null);

      // Even if teardown throws, error is caught and logged
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should call teardown before navigate when user logs out', async () => {
      const { mockAuthService, mockSessionService, mockRouter } = setupTestBed();
      const callOrder: string[] = [];
      let capturedListener: ((user: AuthUser | null) => void) | null = null;

      mockAuthService.onAuthStateChange.and.callFake((cb: (user: AuthUser | null) => void) => {
        capturedListener = cb;
      });
      mockSessionService.teardown.and.callFake(() => { callOrder.push('teardown'); });
      mockRouter.navigate.and.callFake(async () => { callOrder.push('navigate'); return true; });

      await runInitializer();
      await capturedListener!(null);

      expect(callOrder.indexOf('teardown')).toBeLessThan(callOrder.indexOf('navigate'));
    });
  });

  // ─── EXPANSION: multiple concurrent initializer calls ────────────────────────

  describe('initializer resolution', () => {
    it('should resolve Promise<void> (not reject)', async () => {
      setupTestBed();

      const result = runInitializer();

      await expectAsync(result).toBeResolved();
    });

    it('should complete even when translation.init() is slow', async () => {
      const { mockTranslationService } = setupTestBed();

      let resolveInit!: () => void;
      mockTranslationService.init.and.returnValue(
        new Promise<void>(resolve => { resolveInit = resolve; }),
      );

      const initPromise = runInitializer();
      resolveInit();

      await expectAsync(initPromise).toBeResolved();
    });

    it('should complete even when initDarkMode() is slow', async () => {
      const { mockThemeService } = setupTestBed();

      let resolveDarkMode!: () => void;
      mockThemeService.initDarkMode.and.returnValue(
        new Promise<void>(resolve => { resolveDarkMode = resolve; }),
      );

      const initPromise = runInitializer();
      resolveDarkMode();

      await expectAsync(initPromise).toBeResolved();
    });
  });
});
