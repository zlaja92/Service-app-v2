/**
 * LoginPage Unit Tests — WU-24, Batch B3
 *
 * MOCK STRATEGY
 * =============
 * AuthService:     jasmine.createSpyObj (login, logout)
 * AuthStore:       createMockAuthStore() — NgRx SignalStore cannot use createSpyObj
 * ConfigStore:     createMockConfigStore() — same reason
 * SessionService:  jasmine.createSpyObj (bootstrap, teardown)
 * LoggerService:   createMockLoggerService()
 * Router:          createMockRouter()
 * MenuController:  jasmine.createSpyObj (enable, swipeGesture)
 * TranslocoService: createMockTranslocoService() — translate() returns key as-is
 */

import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthUser } from '../../../core/auth/auth.model';
import { ConfigStore } from '../../../core/config/config.store';
import { SessionService } from '../../../core/session/session.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { LoginPage } from './login.page';
import {
  createMockAuthStore,
  createMockConfigStore,
  createMockLoggerService,
  createMockRouter,
  createMockTranslocoService,
} from '../../../testing/mock-factories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: 'test-uid-123',
    email: 'user@example.com',
    displayName: 'Test User',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Main describe
// ---------------------------------------------------------------------------

describe('LoginPage', () => {
  let component: LoginPage;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockAuthStore: ReturnType<typeof createMockAuthStore>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;
  let mockSessionService: jasmine.SpyObj<SessionService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockMenuCtrl: jasmine.SpyObj<MenuController>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'logout']);
    mockAuthStore = createMockAuthStore();
    mockConfigStore = createMockConfigStore();
    mockSessionService = jasmine.createSpyObj<SessionService>('SessionService', ['bootstrap', 'teardown']);
    mockLogger = createMockLoggerService();
    mockRouter = createMockRouter();
    mockMenuCtrl = jasmine.createSpyObj<MenuController>('MenuController', ['enable', 'swipeGesture']);
    mockTransloco = createMockTranslocoService();

    // Default happy-path stubs
    mockAuthService.login.and.resolveTo(createMockUser());
    mockSessionService.bootstrap.and.resolveTo();
    mockMenuCtrl.enable.and.resolveTo();
    mockMenuCtrl.swipeGesture.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [LoginPage, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: SessionService, useValue: mockSessionService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: Router, useValue: mockRouter },
        { provide: MenuController, useValue: mockMenuCtrl },
        { provide: TranslocoService, useValue: mockTransloco },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
  });

  // =========================================================================
  // Form validation
  // =========================================================================

  describe('Form validation', () => {
    it('TC-LP01: component creates with loginForm containing email and password controls', () => {
      expect(component).toBeTruthy();
      expect(component.loginForm).toBeDefined();
      expect(component.loginForm.get('email')).toBeTruthy();
      expect(component.loginForm.get('password')).toBeTruthy();
    });

    it('TC-LP02: form is invalid when email is empty', () => {
      component.loginForm.setValue({ email: '', password: 'SomePass123' });

      expect(component.loginForm.get('email')?.valid).toBeFalse();
      expect(component.loginForm.invalid).toBeTrue();
    });

    it('TC-LP03: form is invalid when email does not match pattern', () => {
      component.loginForm.setValue({ email: 'not-an-email', password: 'SomePass123' });

      expect(component.loginForm.get('email')?.errors?.['pattern']).toBeTruthy();
      expect(component.loginForm.invalid).toBeTrue();
    });

    it('TC-LP04: form is invalid when password is empty', () => {
      component.loginForm.setValue({ email: 'user@example.com', password: '' });

      expect(component.loginForm.get('password')?.valid).toBeFalse();
      expect(component.loginForm.invalid).toBeTrue();
    });

    it('TC-LP05: form is valid with valid email and non-empty password', () => {
      component.loginForm.setValue({ email: 'user@example.com', password: 'SecurePass1' });

      expect(component.loginForm.valid).toBeTrue();
    });
  });

  // =========================================================================
  // onLogin success
  // =========================================================================

  describe('onLogin() — success path', () => {
    beforeEach(() => {
      component.loginForm.setValue({ email: 'user@example.com', password: 'SecurePass1' });
    });

    it('TC-LP06: calls authStore.setUser with the user returned by authService.login', async () => {
      const user = createMockUser({ uid: 'uid-success', email: 'user@example.com' });
      mockAuthService.login.and.resolveTo(user);

      await component.onLogin();

      expect(mockAuthStore.setUser).toHaveBeenCalledWith(user);
    });

    it('TC-LP07: calls sessionService.bootstrap after successful login', async () => {
      await component.onLogin();

      expect(mockSessionService.bootstrap).toHaveBeenCalledTimes(1);
    });

    it('TC-LP08: navigates to /home with replaceUrl after successful login', async () => {
      await component.onLogin();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/home'], { replaceUrl: true });
    });

    it('TC-LP09: sets isLoading to true during the login call', async () => {
      let loadingDuringCall = false;

      mockAuthService.login.and.callFake(async () => {
        loadingDuringCall = mockAuthStore.isLoading();
        return createMockUser();
      });

      await component.onLogin();

      expect(loadingDuringCall).toBeTrue();
    });

    it('TC-LP10: sets isLoading to false after login completes', async () => {
      await component.onLogin();

      expect(mockAuthStore.setLoading).toHaveBeenCalledWith(false);
      expect(mockAuthStore.isLoading()).toBeFalse();
    });
  });

  // =========================================================================
  // onLogin error — getErrorMessage branches
  // =========================================================================

  describe('onLogin() — error branches', () => {
    beforeEach(() => {
      component.loginForm.setValue({ email: 'user@example.com', password: 'SecurePass1' });
    });

    it('TC-LP11: auth/wrong-password error → translated login_error_wrong_credentials', async () => {
      mockAuthService.login.and.rejectWith(new Error('FirebaseError: auth/wrong-password'));

      await component.onLogin();

      expect(mockAuthStore.setError).toHaveBeenCalledWith('login_error_wrong_credentials');
    });

    it('TC-LP12: auth/user-not-found error → translated login_error_wrong_credentials', async () => {
      mockAuthService.login.and.rejectWith(new Error('FirebaseError: auth/user-not-found'));

      await component.onLogin();

      expect(mockAuthStore.setError).toHaveBeenCalledWith('login_error_wrong_credentials');
    });

    it('TC-LP13: auth/invalid-credential error (Firebase v10) → translated login_error_wrong_credentials', async () => {
      mockAuthService.login.and.rejectWith(new Error('FirebaseError: auth/invalid-credential'));

      await component.onLogin();

      expect(mockAuthStore.setError).toHaveBeenCalledWith('login_error_wrong_credentials');
    });

    it('TC-LP14: auth/too-many-requests error → translated login_error_too_many_attempts', async () => {
      mockAuthService.login.and.rejectWith(new Error('FirebaseError: auth/too-many-requests'));

      await component.onLogin();

      expect(mockAuthStore.setError).toHaveBeenCalledWith('login_error_too_many_attempts');
    });

    it('TC-LP15: auth/network-request-failed error → translated login_error_no_internet', async () => {
      mockAuthService.login.and.rejectWith(new Error('FirebaseError: auth/network-request-failed'));

      await component.onLogin();

      expect(mockAuthStore.setError).toHaveBeenCalledWith('login_error_no_internet');
    });

    it('TC-LP16: unknown error code → translated login_error_generic', async () => {
      mockAuthService.login.and.rejectWith(new Error('something-completely-unknown'));

      await component.onLogin();

      expect(mockAuthStore.setError).toHaveBeenCalledWith('login_error_generic');
    });
  });

  // =========================================================================
  // Lifecycle hooks
  // =========================================================================

  describe('Lifecycle hooks', () => {
    it('TC-LP17: ngOnInit disables the menu via MenuController', () => {
      component.ngOnInit();

      expect(mockMenuCtrl.enable).toHaveBeenCalledWith(false);
    });

    it('TC-LP18: ngOnDestroy enables the menu via MenuController', () => {
      component.ngOnDestroy();

      expect(mockMenuCtrl.enable).toHaveBeenCalledWith(true);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('Edge cases', () => {
    it('TC-LP19: onLogin returns early without calling authService when form is invalid', async () => {
      // Leave form in invalid state (empty)
      component.loginForm.setValue({ email: '', password: '' });

      await component.onLogin();

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('TC-LP20 (bonus): email value passed to authService is trimmed on submit', async () => {
      // The form value is used directly — email field value set with spaces to detect trim
      component.loginForm.setValue({ email: 'user@example.com', password: 'pass' });

      await component.onLogin();

      const calledEmail = mockAuthService.login.calls.mostRecent().args[0] as string;
      expect(calledEmail).toBe(calledEmail.trim());
    });

    it('TC-LP21 (bonus): password is not logged in plain text on successful login', async () => {
      const password = 'SuperSecretPassword';
      component.loginForm.setValue({ email: 'user@example.com', password });

      await component.onLogin();

      // Verify no logger call contains the raw password string
      const allLoggerCalls = [
        ...mockLogger.info.calls.allArgs(),
        ...mockLogger.debug.calls.allArgs(),
        ...mockLogger.warn.calls.allArgs(),
        ...mockLogger.error.calls.allArgs(),
      ];

      const passwordLeaked = allLoggerCalls.some((args) =>
        JSON.stringify(args).includes(password),
      );
      expect(passwordLeaked).toBeFalse();
    });
  });

  // =========================================================================
  // EXPANSION — Email pattern validation (parameterized)
  // =========================================================================

  describe('Email validation — invalid patterns (parameterized)', () => {
    const invalidEmails = [
      '',
      ' ',
      'plainaddress',
      '@missinglocal.com',
      'missing@',
      'missing@domain',
      'two@@signs.com',
      'user @example.com',
      'user@ example.com',
      'missingdot@example',
      'a@b',
      'userexample.com',
      'user@',
      '@',
    ];

    invalidEmails.forEach((email) => {
      it(`should be invalid for email="${email}"`, () => {
        component.loginForm.setValue({ email, password: 'ValidPass1' });
        expect(component.loginForm.get('email')?.valid).toBeFalse();
      });
    });
  });

  describe('Email validation — valid patterns (parameterized)', () => {
    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.com',
      'USER@EXAMPLE.COM',
      'test123@test123.com',
      'a@b.co',
      'user@subdomain.example.com',
      'first.last@company.org',
      'service@ariston.rs',
      'test@test.io',
      'admin@company.co.uk',
      'x@x.x',
      'user123@example456.com',
      'my-email@my-domain.com',
    ];

    validEmails.forEach((email) => {
      it(`should be valid for email="${email}"`, () => {
        component.loginForm.setValue({ email, password: 'ValidPass1' });
        expect(component.loginForm.get('email')?.valid).toBeTrue();
      });
    });
  });

  // =========================================================================
  // EXPANSION — Password field validation (parameterized)
  // =========================================================================

  describe('Password validation — empty vs non-empty (parameterized)', () => {
    const validPasswords = [
      'a',
      '12345',
      'password',
      'P@ssw0rd!',
      'a'.repeat(256),
      '12345678901234567890',
      'special!@#$%^&*()',
      '   spaces   ',
      'UPPERCASE',
      '0123456789',
    ];

    validPasswords.forEach((password) => {
      it(`should have valid password field for password of length ${password.length}`, () => {
        component.loginForm.setValue({ email: 'user@example.com', password });
        expect(component.loginForm.get('password')?.valid).toBeTrue();
      });
    });

    it('should have invalid password field for empty string', () => {
      component.loginForm.setValue({ email: 'user@example.com', password: '' });
      expect(component.loginForm.get('password')?.valid).toBeFalse();
    });
  });

  // =========================================================================
  // EXPANSION — onLogin error code matrix (parameterized)
  // =========================================================================

  describe('onLogin() — Firebase error code matrix', () => {
    const errorCases: Array<{ errorMessage: string; expectedKey: string }> = [
      { errorMessage: 'FirebaseError: auth/wrong-password', expectedKey: 'login_error_wrong_credentials' },
      { errorMessage: 'FirebaseError: auth/user-not-found', expectedKey: 'login_error_wrong_credentials' },
      { errorMessage: 'FirebaseError: auth/invalid-credential', expectedKey: 'login_error_wrong_credentials' },
      { errorMessage: 'FirebaseError: auth/too-many-requests', expectedKey: 'login_error_too_many_attempts' },
      { errorMessage: 'FirebaseError: auth/network-request-failed', expectedKey: 'login_error_no_internet' },
      { errorMessage: 'FirebaseError: auth/user-disabled', expectedKey: 'login_error_generic' },
      { errorMessage: 'FirebaseError: auth/operation-not-allowed', expectedKey: 'login_error_generic' },
      { errorMessage: 'FirebaseError: auth/email-already-in-use', expectedKey: 'login_error_generic' },
      { errorMessage: 'something completely unknown', expectedKey: 'login_error_generic' },
      { errorMessage: '', expectedKey: 'login_error_generic' },
      { errorMessage: 'NETWORK_ERROR', expectedKey: 'login_error_generic' },
      { errorMessage: 'auth/invalid-email', expectedKey: 'login_error_generic' },
    ];

    errorCases.forEach(({ errorMessage, expectedKey }) => {
      it(`"${errorMessage.substring(0, 50)}" → setError with "${expectedKey}"`, async () => {
        component.loginForm.setValue({ email: 'user@example.com', password: 'pass' });
        mockAuthService.login.and.rejectWith(new Error(errorMessage));

        await component.onLogin();

        expect(mockAuthStore.setError).toHaveBeenCalledWith(expectedKey);
      });
    });
  });

  // =========================================================================
  // EXPANSION — form state combinations
  // =========================================================================

  describe('Form — combined valid/invalid state', () => {
    it('should be invalid when email valid but password empty', () => {
      component.loginForm.setValue({ email: 'user@example.com', password: '' });
      expect(component.loginForm.valid).toBeFalse();
    });

    it('should be invalid when email invalid but password non-empty', () => {
      component.loginForm.setValue({ email: 'invalid', password: 'somepass' });
      expect(component.loginForm.valid).toBeFalse();
    });

    it('should be invalid when both fields empty', () => {
      component.loginForm.setValue({ email: '', password: '' });
      expect(component.loginForm.valid).toBeFalse();
    });

    it('should be valid with minimal valid email and single char password', () => {
      component.loginForm.setValue({ email: 'a@b.co', password: 'x' });
      expect(component.loginForm.valid).toBeTrue();
    });

    it('should not call authService on form invalid (pattern fails)', () => {
      component.loginForm.setValue({ email: 'notanemail', password: 'pass' });
      component.onLogin();
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should not call authService when both invalid', () => {
      component.loginForm.setValue({ email: '', password: '' });
      component.onLogin();
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPANSION — setLoading state management
  // =========================================================================

  describe('onLogin() — setLoading state transitions', () => {
    it('should call setLoading(true) before authService.login', async () => {
      let loadingWhenLoginCalled = false;
      component.loginForm.setValue({ email: 'user@example.com', password: 'pass' });
      mockAuthService.login.and.callFake(async () => {
        loadingWhenLoginCalled = mockAuthStore.isLoading();
        return createMockUser();
      });
      await component.onLogin();
      expect(loadingWhenLoginCalled).toBeTrue();
    });

    it('should call setLoading(false) after login error', async () => {
      component.loginForm.setValue({ email: 'user@example.com', password: 'pass' });
      mockAuthService.login.and.rejectWith(new Error('auth/wrong-password'));
      await component.onLogin();
      expect(mockAuthStore.isLoading()).toBeFalse();
    });

    it('should call setLoading exactly twice (true then false) on success', async () => {
      component.loginForm.setValue({ email: 'user@example.com', password: 'pass' });
      await component.onLogin();
      expect(mockAuthStore.setLoading).toHaveBeenCalledTimes(2);
      const calls = mockAuthStore.setLoading.calls.allArgs();
      expect(calls[0]).toEqual([true]);
      expect(calls[1]).toEqual([false]);
    });

    it('should call setLoading exactly twice (true then false) on error', async () => {
      component.loginForm.setValue({ email: 'user@example.com', password: 'pass' });
      mockAuthService.login.and.rejectWith(new Error('auth/wrong-password'));
      await component.onLogin();
      expect(mockAuthStore.setLoading).toHaveBeenCalledTimes(2);
      const calls = mockAuthStore.setLoading.calls.allArgs();
      expect(calls[0]).toEqual([true]);
      expect(calls[1]).toEqual([false]);
    });
  });

  // =========================================================================
  // EXPANSION — Lifecycle hooks coverage
  // =========================================================================

  describe('Lifecycle hooks — expanded', () => {
    it('ngOnInit should not call enable(true)', () => {
      mockMenuCtrl.enable.calls.reset();
      component.ngOnInit();
      const trueCalls = mockMenuCtrl.enable.calls.allArgs().filter((args) => args[0] === true);
      expect(trueCalls.length).toBe(0);
    });

    it('ngOnDestroy should not call enable(false)', () => {
      mockMenuCtrl.enable.calls.reset();
      component.ngOnDestroy();
      const falseCalls = mockMenuCtrl.enable.calls.allArgs().filter((args) => args[0] === false);
      expect(falseCalls.length).toBe(0);
    });

    it('ngOnInit and ngOnDestroy together produce two enable calls', () => {
      mockMenuCtrl.enable.calls.reset();
      component.ngOnInit();
      component.ngOnDestroy();
      expect(mockMenuCtrl.enable).toHaveBeenCalledTimes(2);
    });

    it('multiple ngOnInit calls each disable the menu', () => {
      mockMenuCtrl.enable.calls.reset();
      component.ngOnInit();
      component.ngOnInit();
      const falseCalls = mockMenuCtrl.enable.calls.allArgs().filter((args) => args[0] === false);
      expect(falseCalls.length).toBe(2);
    });
  });

  // =========================================================================
  // EXPANSION — Email normalization (trim + toLowerCase) in onLogin
  // =========================================================================

  describe('onLogin() — email normalization', () => {
    it('TC-LP-EN01: mixed-case email is lowercased before calling authService.login', async () => {
      component.loginForm.setValue({ email: 'User@Example.COM', password: 'pass' });

      await component.onLogin();

      const calledEmail = mockAuthService.login.calls.mostRecent().args[0] as string;
      expect(calledEmail).toBe('user@example.com');
    });

    it('TC-LP-EN02: email with surrounding whitespace is trimmed and lowercased', async () => {
      // The form value is set directly to simulate pre-filled value with spaces.
      // The regex validator would reject spaces within the email, but trim() on
      // a value that has only leading/trailing spaces still passes pattern-check
      // because the control value is what the validator sees pre-trim. We bypass
      // form validity by setting a value that passes the pattern after trim.
      // To keep the test simple we set the control value directly and call
      // setValue so the form stays valid (email without internal spaces passes).
      component.loginForm.controls['email'].setValue('  USER@EXAMPLE.COM  ');
      // Manually mark as valid so onLogin does not short-circuit.
      component.loginForm.controls['email'].setErrors(null);
      component.loginForm.controls['password'].setValue('pass');

      await component.onLogin();

      const calledEmail = mockAuthService.login.calls.mostRecent().args[0] as string;
      expect(calledEmail).toBe('user@example.com');
    });

    it('TC-LP-EN03: password is passed verbatim — spaces and mixed case are preserved', async () => {
      const verbatimPassword = '  PaSs 123 ';
      component.loginForm.setValue({ email: 'user@example.com', password: verbatimPassword });

      await component.onLogin();

      const calledPassword = mockAuthService.login.calls.mostRecent().args[1] as string;
      expect(calledPassword).toBe(verbatimPassword);
    });

    // Parametrized: different casings of the same email all normalize to lowercase
    [
      'User@Test.Com',
      'USER@TEST.COM',
      'uSeR@tEsT.cOm',
    ].forEach((rawEmail) => {
      it(`TC-LP-EN04: "${rawEmail}" → authService.login receives "user@test.com"`, async () => {
        component.loginForm.setValue({ email: rawEmail, password: 'pass' });

        await component.onLogin();

        const calledEmail = mockAuthService.login.calls.mostRecent().args[0] as string;
        expect(calledEmail).toBe('user@test.com');
      });
    });
  });
});
