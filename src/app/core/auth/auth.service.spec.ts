/**
 * AuthService Unit Tests — WU-14, Batch B1, Phase C
 *
 * MOCK STRATEGY — IMPORTANT NOTES
 * ================================
 * FirebaseAuthentication from @capacitor-firebase/authentication is a Capacitor
 * Proxy object (empty {} target). Its get trap ALWAYS intercepts property access
 * and returns createPluginMethodWrapper(prop), which lazily loads jsImplementation
 * (FirebaseAuthenticationWeb). Therefore:
 *
 *  1. Object.defineProperty / spyOn on the Proxy does NOT work — the get trap
 *     overrides any own properties we set on the proxy target.
 *
 *  2. FirebaseAuthenticationWeb constructor calls getAuth() which requires a live
 *     Firebase app (throws "No Firebase App '[DEFAULT]'" otherwise).
 *
 * Solution used here:
 *   - Initialize Firebase App in beforeAll using environment credentials.
 *   - Spy on Firebase Auth SDK functions (signInWithEmailAndPassword, signOut, etc.)
 *     via direct property replacement on the CJS module object (writable exports).
 *   - Spy on FirebaseAuthenticationWeb.prototype methods to intercept AFTER the
 *     class is instantiated by Capacitor's lazy loader.
 *   - For addListener: override on FirebaseAuthenticationWeb.prototype so the
 *     loaded instance uses our mock.
 *
 * Tests that cannot be reliably mocked due to Proxy restrictions are marked
 * xit() with documented reasons.
 */

import { TestBed } from '@angular/core/testing';
import { initializeApp, deleteApp, getApps, FirebaseApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { FirebaseAuthenticationWeb } from '@capacitor-firebase/authentication/dist/esm/web';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.model';
import { LoggerService } from '../logger/logger.service';
import { environment } from '../../../environments/environment';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function createMockLoggerService(): jasmine.SpyObj<LoggerService> {
  return jasmine.createSpyObj<LoggerService>('LoggerService', [
    'debug',
    'info',
    'warn',
    'error',
  ]);
}

function createMockFirebaseUser(overrides: Partial<{
  uid: string;
  email: string | null;
  displayName: string | null;
}> = {}): firebaseAuth.User {
  return {
    uid: overrides.uid ?? 'mock-uid-1',
    email: overrides.email !== undefined ? overrides.email : 'user@example.com',
    displayName: overrides.displayName !== undefined ? overrides.displayName : 'Test User',
  } as unknown as firebaseAuth.User;
}

// ---------------------------------------------------------------------------
// Firebase UserCredential mock
// ---------------------------------------------------------------------------

function createMockUserCredential(user: firebaseAuth.User): firebaseAuth.UserCredential {
  return { user } as firebaseAuth.UserCredential;
}

// ---------------------------------------------------------------------------
// Capacitor AuthStateChange mock shape
// ---------------------------------------------------------------------------

interface AuthChangeEvent {
  user: { uid: string; email: string | null; displayName: string | null } | null;
}

// ---------------------------------------------------------------------------
// Main describe
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let app: FirebaseApp;
  let service: AuthService;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  // ---------------------------------------------------------------------------
  // Firebase initialization — runs ONCE before any test so that
  // FirebaseAuthenticationWeb can be instantiated by Capacitor's lazy loader.
  // FirebaseAuthenticationWeb calls getAuth() in its constructor which needs the
  // DEFAULT (unnamed) Firebase app.
  // ---------------------------------------------------------------------------
  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase); // DEFAULT app — required by getAuth()
    } else {
      app = getApps()[0];
    }
  });

  afterAll(async () => {
    // Do NOT delete the default app here — it may be shared with other specs
    // running in the same Karma session. Leaving it avoids 'app/no-app' errors.
  });

  beforeEach(() => {
    mockLogger = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    // Restore any spied methods on prototype
    // jasmine auto-restores spyOn(), but we restore manual replacements
  });

  // =========================================================================
  // login()
  // =========================================================================

  describe('login()', () => {
    it('TC-A01: calls Firebase signInWithEmailAndPassword with correct args', async () => {
      const mockUser = createMockFirebaseUser({ uid: 'uid-1', email: 'a@b.com' });
      const signInSpy = spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.resolveTo({
          user: {
            uid: mockUser.uid,
            email: mockUser.email,
            emailVerified: false,
            displayName: null,
            isAnonymous: false,
            metadata: {} as firebaseAuth.UserMetadata,
            providerData: [],
            refreshToken: '',
            tenantId: null,
            delete: async () => {},
            getIdToken: async () => '',
            getIdTokenResult: async () => ({} as firebaseAuth.IdTokenResult),
            reload: async () => {},
            toJSON: () => ({}),
            phoneNumber: null,
            photoURL: null,
            providerId: 'firebase',
          },
        } as any);

      await service.login('a@b.com', 'password123');

      expect(signInSpy).toHaveBeenCalledOnceWith({ email: 'a@b.com', password: 'password123' });
    });

    it('TC-A02: returns AuthUser with correct shape on success', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.resolveTo({
          user: {
            uid: 'uid-42',
            email: 'alice@test.com',
            displayName: 'Alice',
          },
        } as any);

      const result: AuthUser = await service.login('alice@test.com', 'pass');

      expect(result).toEqual({
        uid: 'uid-42',
        email: 'alice@test.com',
        displayName: 'Alice',
      });
    });

    it('TC-A03: throws when login fails (wrong password)', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.rejectWith(new Error('auth/wrong-password'));

      await expectAsync(service.login('user@example.com', 'wrongpass'))
        .toBeRejectedWithError('auth/wrong-password');
    });

    it('TC-A04: throws on network error', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.rejectWith(new Error('auth/network-request-failed'));

      await expectAsync(service.login('user@example.com', 'pass'))
        .toBeRejectedWithError('auth/network-request-failed');
    });

    it('TC-A05: logs info before and after successful login', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.resolveTo({
          user: { uid: 'uid-log', email: 'log@test.com', displayName: null },
        } as any);

      await service.login('log@test.com', 'pass');

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Attempting login', { email: 'log@test.com' });
      expect(mockLogger.info).toHaveBeenCalledWith('Login successful', {
        uid: 'uid-log',
        email: 'log@test.com',
      });
    });

    it('TC-A06: does not log error via LoggerService when login fails (error propagates)', async () => {
      // AuthService.login() has no catch block — errors propagate without being logged
      spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.rejectWith(new Error('auth/too-many-requests'));

      try { await service.login('user@example.com', 'pass'); } catch { /* expected */ }

      // Only "Attempting login" info call — no error log
      expect(mockLogger.info).toHaveBeenCalledWith('Attempting login', { email: 'user@example.com' });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC-A07: throws when FirebaseAuthentication returns user:null', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.resolveTo({ user: null } as any);

      await expectAsync(service.login('user@example.com', 'pass'))
        .toBeRejectedWithError('Login failed: no user returned');
    });

    it('TC-A08: maps null email and displayName to null in AuthUser', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.resolveTo({
          user: { uid: 'uid-null', email: null, displayName: null },
        } as any);

      const result = await service.login('user@example.com', 'pass');

      expect(result.email).toBeNull();
      expect(result.displayName).toBeNull();
    });

    it('TC-A09: passes empty email and password to Firebase without modification', async () => {
      const spy = spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.resolveTo({ user: { uid: 'uid-1', email: '', displayName: null } } as any);

      await service.login('', '');

      expect(spy).toHaveBeenCalledOnceWith({ email: '', password: '' });
    });
  });

  // =========================================================================
  // logout()
  // =========================================================================

  describe('logout()', () => {
    it('TC-A10: calls FirebaseAuthentication.signOut', async () => {
      const signOutSpy = spyOn(FirebaseAuthenticationWeb.prototype, 'signOut').and.resolveTo();

      await service.logout();

      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });

    it('TC-A11: logs info before and after signOut', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'signOut').and.resolveTo();

      await service.logout();

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Logging out');
      expect(mockLogger.info).toHaveBeenCalledWith('Logout successful');
    });

    it('TC-A12: propagates error when signOut rejects', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'signOut')
        .and.rejectWith(new Error('auth/no-current-user'));

      await expectAsync(service.logout()).toBeRejectedWithError('auth/no-current-user');
    });
  });

  // =========================================================================
  // waitForAuthReady()
  // =========================================================================

  describe('waitForAuthReady()', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('TC-A13: resolves with AuthUser when authStateChange fires with a user', async () => {
      const firebaseUser = { uid: 'ready-uid', email: 'ready@test.com', displayName: 'Ready User' };

      spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake(
          (_eventName: string, cb: (change: AuthChangeEvent) => void) => {
            cb({ user: firebaseUser });
            return Promise.resolve({ remove: () => Promise.resolve() });
          }
        );

      const result = await service.waitForAuthReady();

      expect(result).toEqual({
        uid: 'ready-uid',
        email: 'ready@test.com',
        displayName: 'Ready User',
      });
    });

    it('TC-A14: resolves with null when authStateChange fires with null user (unauthenticated)', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake(
          (_eventName: string, cb: (change: AuthChangeEvent) => void) => {
            cb({ user: null });
            return Promise.resolve({ remove: () => Promise.resolve() });
          }
        );

      const result = await service.waitForAuthReady();

      expect(result).toBeNull();
    });

    it('TC-A15: resolves with null after 5000ms timeout when no auth event fires', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake(
          (_eventName: string, _cb: (change: AuthChangeEvent) => void) => {
            // Never invoke callback — simulate stalled auth
            return Promise.resolve({ remove: () => Promise.resolve() });
          }
        );

      let resolved = false;
      let resolvedValue: AuthUser | null | undefined;

      service.waitForAuthReady().then((val) => {
        resolved = true;
        resolvedValue = val;
      });

      jasmine.clock().tick(4999);
      await Promise.resolve();
      expect(resolved).toBeFalse();

      jasmine.clock().tick(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(resolved).toBeTrue();
      expect(resolvedValue).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Auth ready timeout - treating as not authenticated',
        { timeoutMs: 5000 }
      );
    });

    it('TC-A16: settled flag prevents double-resolve when listener fires after timeout', async () => {
      type AuthCb = (change: AuthChangeEvent) => void;
      let storedCallback: AuthCb = () => undefined;

      spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake((_eventName: string, cb: AuthCb) => {
          storedCallback = cb;
          return Promise.resolve({ remove: () => Promise.resolve() });
        });

      let callCount = 0;
      let resolvedValue: AuthUser | null | undefined;

      service.waitForAuthReady().then((val) => {
        callCount++;
        resolvedValue = val;
      });

      // Trigger timeout
      jasmine.clock().tick(5000);
      await Promise.resolve();
      await Promise.resolve();

      expect(callCount).toBe(1);
      expect(resolvedValue).toBeNull();

      // Fire listener AFTER timeout — settled flag must prevent second resolve
      storedCallback({ user: { uid: 'late-uid', email: 'late@test.com', displayName: null } });
      await Promise.resolve();

      expect(callCount).toBe(1); // still 1 — not resolved again
    });
  });

  // =========================================================================
  // onAuthStateChange()
  //
  // NOTE ON ASYNC FLUSHING:
  // FirebaseAuthentication.addListener() goes through Capacitor's Proxy wrapper
  // (createPluginMethodWrapper) which resolves the web implementation via a
  // Promise chain. The spy callFake is therefore invoked inside a microtask.
  // All onAuthStateChange tests must be async and flush microtasks with
  // multiple `await Promise.resolve()` calls before making assertions.
  // =========================================================================

  describe('onAuthStateChange()', () => {
    it('TC-A17: calls callback with AuthUser when auth state changes to authenticated', async () => {
      const firebaseUser = { uid: 'change-uid', email: 'change@test.com', displayName: 'Changed' };
      const callback = jasmine.createSpy('authCallback');

      spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake((_eventName: string, cb: (change: AuthChangeEvent) => void) => {
          cb({ user: firebaseUser });
          return Promise.resolve({ remove: () => Promise.resolve() });
        });

      service.onAuthStateChange(callback);

      // Flush Capacitor Proxy microtask chain before asserting
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledOnceWith({
        uid: 'change-uid',
        email: 'change@test.com',
        displayName: 'Changed',
      });
    });

    it('TC-A18: calls callback with null when auth state changes to signed-out', async () => {
      const callback = jasmine.createSpy('authCallback');

      spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake((_eventName: string, cb: (change: AuthChangeEvent) => void) => {
          cb({ user: null });
          return Promise.resolve({ remove: () => Promise.resolve() });
        });

      service.onAuthStateChange(callback);

      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledOnceWith(null);
    });

    it('TC-A19: registers addListener with event name "authStateChange"', async () => {
      const addListenerSpy = spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake((_eventName: string, _cb: unknown) =>
          Promise.resolve({ remove: () => Promise.resolve() })
        );

      service.onAuthStateChange(() => {});

      await Promise.resolve();
      await Promise.resolve();

      expect(addListenerSpy).toHaveBeenCalledWith('authStateChange', jasmine.any(Function));
    });

    it('TC-A20: maps firebase user fields correctly (null displayName → null in AuthUser)', async () => {
      const callback = jasmine.createSpy('authCallback');

      spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake((_eventName: string, cb: (change: AuthChangeEvent) => void) => {
          cb({ user: { uid: 'uid-map', email: 'map@test.com', displayName: null } });
          return Promise.resolve({ remove: () => Promise.resolve() });
        });

      service.onAuthStateChange(callback);

      await Promise.resolve();
      await Promise.resolve();

      const result: AuthUser | null = callback.calls.first().args[0];
      expect(result).not.toBeNull();
      expect((result as AuthUser).uid).toBe('uid-map');
      expect((result as AuthUser).displayName).toBeNull();
    });

    it('TC-A21: supports multiple sequential state change events (including special chars email)', async () => {
      const events: (AuthUser | null)[] = [];
      type AuthCb = (change: AuthChangeEvent) => void;
      let capturedCb: AuthCb = () => undefined;

      spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
        .and.callFake((_eventName: string, cb: AuthCb) => {
          capturedCb = cb;
          return Promise.resolve({ remove: () => Promise.resolve() });
        });

      service.onAuthStateChange((user) => events.push(user));

      // Flush microtasks so addListener spy is called and capturedCb is set
      await Promise.resolve();
      await Promise.resolve();

      capturedCb({ user: { uid: 'u1', email: 'test+special@example.co.uk', displayName: null } });
      capturedCb({ user: null });
      capturedCb({ user: { uid: 'u2', email: null, displayName: 'User Two' } });

      expect(events.length).toBe(3);
      expect(events[0]).toEqual({ uid: 'u1', email: 'test+special@example.co.uk', displayName: null });
      expect(events[1]).toBeNull();
      expect(events[2]).toEqual({ uid: 'u2', email: null, displayName: 'User Two' });
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('Edge cases', () => {
    it('TC-A22: concurrent login() calls both resolve independently', async () => {
      let callIndex = 0;
      spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.callFake(({ email }: { email: string }) => {
          callIndex++;
          return Promise.resolve({ user: { uid: `uid-${callIndex}`, email, displayName: null } } as any);
        });

      const [r1, r2] = await Promise.all([
        service.login('user1@test.com', 'pass1'),
        service.login('user2@test.com', 'pass2'),
      ]);

      expect(r1.email).toBe('user1@test.com');
      expect(r2.email).toBe('user2@test.com');
      expect(callIndex).toBe(2);
    });

    it('TC-A23: special chars in email are passed as-is to Firebase', async () => {
      const specialEmail = 'user+tag@sub.example.co.uk';
      const spy = spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
        .and.resolveTo({ user: { uid: 'uid-sp', email: specialEmail, displayName: null } } as any);

      const result = await service.login(specialEmail, 'pass');

      expect(result.email).toBe(specialEmail);
      expect(spy).toHaveBeenCalledWith({ email: specialEmail, password: 'pass' });
    });
  });

  // =========================================================================
  // Parameterized: login() — email variants passed as-is
  // =========================================================================

  describe('login() — parameterized email variants', () => {
    const emailVariants = [
      'simple@test.com',
      'user+tag@example.com',
      'user.name@sub.domain.co.uk',
      'UPPERCASE@EXAMPLE.COM',
      'user@example',
      '  spaces@example.com  ',
      '@nodomain.com',
      'nodomain@',
      '',
      'a@b.c',
      'user123@domain456.org',
      'user@domain.engineering',
      'very.long.email.address.that.is.valid@extremely-long-domain-name.co.uk',
      'user@[192.168.1.1]',
      '"quoted"@example.com',
      'user%20encoded@example.com',
      '用户@例子.广告',
      'юзер@пример.рф',
    ];

    emailVariants.forEach((email) => {
      it(`TC-AEML-"${email.slice(0, 30)}": login() passes email as-is to Firebase`, async () => {
        const spy = spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
          .and.resolveTo({ user: { uid: 'uid-1', email, displayName: null } } as any);

        await service.login(email, 'password123');

        expect(spy).toHaveBeenCalledWith({ email, password: 'password123' });
      });
    });
  });

  // =========================================================================
  // Parameterized: login() — password variants passed as-is
  // =========================================================================

  describe('login() — parameterized password variants', () => {
    const passwordVariants = [
      '',
      ' ',
      'a',
      'short',
      'password123',
      'P@$$w0rd!',
      'a'.repeat(128),
      'unicode_пароль_123',
      '🔐🔑🗝️',
      '\t\n\r',
      '<script>alert(1)</script>',
      '"; DROP TABLE users; --',
      '   leading spaces',
      'trailing spaces   ',
      '0',
      'null',
      'undefined',
    ];

    passwordVariants.forEach((password) => {
      it(`TC-APWD-"${password.slice(0, 20)}": login() passes password as-is to Firebase`, async () => {
        const spy = spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
          .and.resolveTo({ user: { uid: 'uid-1', email: 'test@test.com', displayName: null } } as any);

        await service.login('test@test.com', password);

        expect(spy).toHaveBeenCalledWith({ email: 'test@test.com', password });
      });
    });
  });

  // =========================================================================
  // Parameterized: login() — Firebase error types
  // =========================================================================

  describe('login() — parameterized Firebase error codes', () => {
    const firebaseErrors = [
      'auth/wrong-password',
      'auth/user-not-found',
      'auth/invalid-email',
      'auth/user-disabled',
      'auth/too-many-requests',
      'auth/network-request-failed',
      'auth/operation-not-allowed',
      'auth/email-already-in-use',
      'auth/weak-password',
      'auth/requires-recent-login',
      'auth/credential-already-in-use',
      'auth/account-exists-with-different-credential',
      'auth/invalid-credential',
      'auth/invalid-verification-code',
      'auth/session-expired',
    ];

    firebaseErrors.forEach((errorCode) => {
      it(`TC-AERR-${errorCode}: login() propagates ${errorCode} error`, async () => {
        spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
          .and.rejectWith(new Error(errorCode));

        await expectAsync(service.login('user@test.com', 'pass'))
          .toBeRejectedWithError(errorCode);
      });
    });
  });

  // =========================================================================
  // Parameterized: login() — AuthUser field mapping variants
  // =========================================================================

  describe('login() — AuthUser field mapping variants', () => {
    const userVariants: Array<{
      label: string;
      uid: string;
      email: string | null;
      displayName: string | null;
    }> = [
      { label: 'all fields present', uid: 'uid-1', email: 'a@b.com', displayName: 'Alice' },
      { label: 'null email', uid: 'uid-2', email: null, displayName: 'Bob' },
      { label: 'null displayName', uid: 'uid-3', email: 'c@d.com', displayName: null },
      { label: 'both null', uid: 'uid-4', email: null, displayName: null },
      { label: 'empty email string', uid: 'uid-5', email: '', displayName: 'User' },
      { label: 'empty displayName string', uid: 'uid-6', email: 'e@f.com', displayName: '' },
      { label: 'long uid', uid: 'a'.repeat(128), email: 'g@h.com', displayName: null },
      { label: 'special chars in displayName', uid: 'uid-7', email: 'i@j.com', displayName: 'María García-López' },
      { label: 'unicode displayName', uid: 'uid-8', email: 'k@l.com', displayName: 'Иван Иванович' },
      { label: 'emoji in displayName', uid: 'uid-9', email: 'm@n.com', displayName: '🚀 Spaceman' },
    ];

    userVariants.forEach(({ label, uid, email, displayName }) => {
      it(`TC-AUSR-${label}: login() maps AuthUser fields correctly`, async () => {
        spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
          .and.resolveTo({ user: { uid, email, displayName } } as any);

        const result = await service.login('test@test.com', 'pass');

        expect(result.uid).toBe(uid);
        expect(result.email).toBe(email);
        expect(result.displayName).toBe(displayName);
      });
    });
  });

  // =========================================================================
  // Parameterized: logout() — error scenarios
  // =========================================================================

  describe('logout() — parameterized error scenarios', () => {
    const logoutErrors = [
      'auth/no-current-user',
      'auth/network-request-failed',
      'auth/internal-error',
      'auth/too-many-requests',
      'auth/operation-not-allowed',
      'Firebase: Error (auth/token-refresh-failed)',
      'Network Error',
      'Service Unavailable',
    ];

    logoutErrors.forEach((errorMsg) => {
      it(`TC-ALGT-${errorMsg.slice(0, 30)}: logout() propagates "${errorMsg}"`, async () => {
        spyOn(FirebaseAuthenticationWeb.prototype, 'signOut')
          .and.rejectWith(new Error(errorMsg));

        await expectAsync(service.logout())
          .toBeRejectedWithError(errorMsg);
      });
    });
  });

  // =========================================================================
  // Parameterized: onAuthStateChange() — user field variants
  // =========================================================================

  describe('onAuthStateChange() — parameterized user variants', () => {
    interface UserVariant {
      label: string;
      user: { uid: string; email: string | null; displayName: string | null } | null;
      expectedResult: { uid: string; email: string | null; displayName: string | null } | null;
    }

    const variants: UserVariant[] = [
      {
        label: 'full user',
        user: { uid: 'u1', email: 'a@b.com', displayName: 'Alice' },
        expectedResult: { uid: 'u1', email: 'a@b.com', displayName: 'Alice' },
      },
      {
        label: 'null email',
        user: { uid: 'u2', email: null, displayName: 'Bob' },
        expectedResult: { uid: 'u2', email: null, displayName: 'Bob' },
      },
      {
        label: 'null displayName',
        user: { uid: 'u3', email: 'c@d.com', displayName: null },
        expectedResult: { uid: 'u3', email: 'c@d.com', displayName: null },
      },
      {
        label: 'null user (signed out)',
        user: null,
        expectedResult: null,
      },
      {
        label: 'both fields null',
        user: { uid: 'u4', email: null, displayName: null },
        expectedResult: { uid: 'u4', email: null, displayName: null },
      },
      {
        label: 'empty email string',
        user: { uid: 'u5', email: '', displayName: null },
        expectedResult: { uid: 'u5', email: '', displayName: null },
      },
      {
        label: 'unicode uid',
        user: { uid: 'uid-Привет', email: 'x@y.com', displayName: null },
        expectedResult: { uid: 'uid-Привет', email: 'x@y.com', displayName: null },
      },
    ];

    variants.forEach(({ label, user, expectedResult }) => {
      it(`TC-AOASC-${label}: onAuthStateChange() maps ${label} correctly`, async () => {
        const callback = jasmine.createSpy('authCallback');

        spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
          .and.callFake((_eventName: string, cb: (change: { user: typeof user }) => void) => {
            cb({ user });
            return Promise.resolve({ remove: () => Promise.resolve() });
          });

        service.onAuthStateChange(callback);

        await Promise.resolve();
        await Promise.resolve();

        expect(callback).toHaveBeenCalledOnceWith(expectedResult);
      });
    });
  });

  // =========================================================================
  // Parameterized: waitForAuthReady() — user state variants
  // =========================================================================

  describe('waitForAuthReady() — parameterized user variants', () => {
    interface WaitVariant {
      label: string;
      user: { uid: string; email: string | null; displayName: string | null } | null;
      expectedUid?: string;
      expectedNull?: boolean;
    }

    const variants: WaitVariant[] = [
      {
        label: 'authenticated user',
        user: { uid: 'ready-1', email: 'r1@test.com', displayName: 'R1' },
        expectedUid: 'ready-1',
      },
      {
        label: 'null user (unauthenticated)',
        user: null,
        expectedNull: true,
      },
      {
        label: 'user with null email',
        user: { uid: 'ready-2', email: null, displayName: null },
        expectedUid: 'ready-2',
      },
      {
        label: 'user with null displayName',
        user: { uid: 'ready-3', email: 'r3@test.com', displayName: null },
        expectedUid: 'ready-3',
      },
    ];

    variants.forEach(({ label, user, expectedUid, expectedNull }) => {
      it(`TC-AWAR-${label}: waitForAuthReady() resolves correctly for ${label}`, async () => {
        spyOn(FirebaseAuthenticationWeb.prototype, 'addListener')
          .and.callFake(
            (_eventName: string, cb: (change: { user: typeof user }) => void) => {
              cb({ user });
              return Promise.resolve({ remove: () => Promise.resolve() });
            }
          );

        const result = await service.waitForAuthReady();

        if (expectedNull) {
          expect(result).toBeNull();
        } else {
          expect(result?.uid).toBe(expectedUid!);
        }
      });
    });
  });

  // =========================================================================
  // login() — info log exact content parameterized
  // =========================================================================

  describe('login() — info log content for various emails', () => {
    const emails = [
      'simple@test.com',
      'with+plus@example.org',
      'dots.dots.dots@here.io',
      'user@longdomain.company.enterprise.com',
    ];

    emails.forEach((email) => {
      it(`TC-ALOG-${email}: info log contains exact email "${email}"`, async () => {
        spyOn(FirebaseAuthenticationWeb.prototype, 'signInWithEmailAndPassword')
          .and.resolveTo({ user: { uid: 'uid-log', email, displayName: null } } as any);

        await service.login(email, 'pass');

        expect(mockLogger.info).toHaveBeenCalledWith('Attempting login', { email });
        expect(mockLogger.info).toHaveBeenCalledWith('Login successful', {
          uid: 'uid-log',
          email,
        });
      });
    });
  });
});
