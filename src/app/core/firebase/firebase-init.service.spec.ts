import { TestBed } from '@angular/core/testing';
import { FirebaseInitService } from './firebase-init.service';
import { LoggerService } from '../logger/logger.service';
import { createMockLoggerService } from '../../testing/mock-factories';
import { environment } from '../../../environments/environment';

// ─── INFRASTRUCTURE ISSUE ─────────────────────────────────────────────────────
// firebase/app and firebase/auth export non-configurable getters (configurable: false).
// jasmine.spyOn cannot redefine these properties and throws at runtime:
//   "Cannot redefine property: initializeApp" / "Cannot redefine property: getApps"
// As a result, TC-FI01 through TC-FI04 and TC-FI06 are pending (xit).
//
// Possible resolutions (requires ARCH decision):
//   1. Wrap firebase calls in an injectable adapter service that can be mocked.
//   2. Restructure FirebaseInitService to accept injectable firebase factory functions.
//   3. Switch test runner to Jest which supports module-level mocking (jest.mock).
// ─────────────────────────────────────────────────────────────────────────────

describe('FirebaseInitService', () => {
  let service: FirebaseInitService;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockLogger = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        FirebaseInitService,
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(FirebaseInitService);
  });

  // ─── initialize() ─────────────────────────────────────────────────────────

  xit('TC-FI01: calls initializeApp with env.firebase config when no apps exist', () => {
    // BLOCKED: firebase/app.initializeApp is non-configurable — cannot spyOn.
    // Infrastructure issue: frozen module exports prevent test isolation.
    //
    // Expected behaviour: when getApps() returns [], initializeApp is called
    // with environment.firebase config object.
    expect(environment.firebase).toBeDefined();
  });

  xit('TC-FI02: skips initializeApp and reuses existing app when apps already initialized', () => {
    // BLOCKED: firebase/app.getApps is non-configurable — cannot spyOn.
    // Expected behaviour: when getApps() returns a non-empty array,
    // initializeApp should NOT be called and existing app is reused.
    expect(true).toBe(true);
  });

  xit('TC-FI03: logs "Firebase already initialized" via debug when apps already exist', () => {
    // BLOCKED: firebase/app.getApps is non-configurable — cannot spyOn.
    // Expected behaviour: logger.debug('Firebase already initialized') is called.
    expect(true).toBe(true);
  });

  xit('TC-FI04: logs "Firebase initialized" with projectId via info on first init', () => {
    // BLOCKED: firebase/app.initializeApp is non-configurable — cannot spyOn.
    // Expected behaviour: logger.info('Firebase initialized', { projectId }) is called.
    expect(environment.firebase.projectId).toBeDefined();
  });

  // ─── getApp() ──────────────────────────────────────────────────────────────

  it('TC-FI05: throws "Firebase not initialized" when called before initialize()', () => {
    // No mocking needed — private app field is null by default before initialize()
    expect(() => service.getApp()).toThrowError('Firebase not initialized. Call initialize() first.');
  });

  xit('TC-FI06: returns FirebaseApp instance after initialize()', () => {
    // BLOCKED: firebase/app.initializeApp is non-configurable — cannot spyOn.
    // Expected behaviour: getApp() returns the FirebaseApp set by initialize().
    expect(true).toBe(true);
  });
});
