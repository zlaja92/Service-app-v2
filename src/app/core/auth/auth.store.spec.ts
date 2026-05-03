import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { AuthUser } from './auth.model';

function createMockAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: 'u1',
    email: 'test@test.com',
    displayName: 'Test User',
    ...overrides,
  };
}

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(AuthStore);
    store.clearUser();
    store.setLoading(false);
  });

  describe('Initial State', () => {
    it('TC-A01: should have null user on initialization', () => {
      expect(store.user()).toBeNull();
    });

    it('TC-A02: should have isLoading false on initialization', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('TC-A03: should have null error on initialization', () => {
      expect(store.error()).toBeNull();
    });
  });

  describe('Computed signals — initial state', () => {
    it('TC-A04: should have isAuthenticated false when user is null', () => {
      expect(store.isAuthenticated()).toBe(false);
    });

    it('TC-A05: should have userEmail as empty string when user is null', () => {
      expect(store.userEmail()).toBe('');
    });

    it('TC-A06: should have userId as empty string when user is null', () => {
      expect(store.userId()).toBe('');
    });
  });

  describe('setUser', () => {
    it('TC-A07: should set user and clear error', () => {
      store.setError('previous error');
      const user = createMockAuthUser();
      store.setUser(user);

      expect(store.user()).toEqual(user);
      expect(store.error()).toBeNull();
    });

    it('TC-A08: should accept user with null email and null displayName', () => {
      const user = createMockAuthUser({ email: null, displayName: null });
      store.setUser(user);

      expect(store.user()).toEqual({ uid: 'u1', email: null, displayName: null });
    });

    it('TC-A09: should set isAuthenticated to true after setUser', () => {
      store.setUser(createMockAuthUser());

      expect(store.isAuthenticated()).toBe(true);
    });

    it('TC-A10: should have userEmail reflect user.email', () => {
      store.setUser(createMockAuthUser({ email: 'user@example.com' }));

      expect(store.userEmail()).toBe('user@example.com');
    });

    it('TC-A11: should return empty string for userEmail when user.email is null', () => {
      store.setUser(createMockAuthUser({ email: null }));

      expect(store.userEmail()).toBe('');
    });

    it('TC-A12: should have userId reflect user.uid', () => {
      store.setUser(createMockAuthUser({ uid: 'uid-42' }));

      expect(store.userId()).toBe('uid-42');
    });
  });

  describe('clearUser', () => {
    it('TC-A13: should set user to null and error to null', () => {
      store.setUser(createMockAuthUser());
      store.setError('some error');
      store.clearUser();

      expect(store.user()).toBeNull();
      expect(store.error()).toBeNull();
    });

    it('TC-A14: should set isAuthenticated to false after clearUser', () => {
      store.setUser(createMockAuthUser());
      expect(store.isAuthenticated()).toBe(true);

      store.clearUser();

      expect(store.isAuthenticated()).toBe(false);
    });

    it('TC-A15: should set userEmail and userId to empty string after clearUser', () => {
      store.setUser(createMockAuthUser({ uid: 'uid-clear', email: 'clear@test.com' }));
      store.clearUser();

      expect(store.userEmail()).toBe('');
      expect(store.userId()).toBe('');
    });
  });

  describe('setLoading', () => {
    it('TC-A16: should set isLoading to true', () => {
      store.setLoading(true);

      expect(store.isLoading()).toBe(true);
    });

    it('TC-A17: should set isLoading back to false', () => {
      store.setLoading(true);
      store.setLoading(false);

      expect(store.isLoading()).toBe(false);
    });

    it('TC-A18: should not affect user or error', () => {
      const user = createMockAuthUser();
      store.setUser(user);
      store.setError('existing error');
      store.setLoading(true);

      expect(store.user()).toEqual(user);
      expect(store.error()).toBe('existing error');
    });
  });

  describe('setError', () => {
    it('TC-A19: should set error and set isLoading to false', () => {
      store.setLoading(true);
      store.setError('session expired');

      expect(store.error()).toBe('session expired');
      expect(store.isLoading()).toBe(false);
    });

    it('TC-A20: should not affect user', () => {
      const user = createMockAuthUser();
      store.setUser(user);
      store.setError('network error');

      expect(store.user()).toEqual(user);
    });
  });

  describe('Composite', () => {
    it('TC-A21: full lifecycle setLoading → setUser → setError → clearUser', () => {
      store.setLoading(true);
      expect(store.isLoading()).toBe(true);
      expect(store.user()).toBeNull();

      store.setUser({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
      expect(store.isLoading()).toBe(true); // setUser does NOT change isLoading
      expect(store.isAuthenticated()).toBe(true);

      store.setError('session expired');
      expect(store.isLoading()).toBe(false); // setError sets isLoading to false
      expect(store.user()).toEqual({ uid: 'u1', email: 'a@b.com', displayName: 'A' }); // user remains

      store.clearUser();
      expect(store.user()).toBeNull();
      expect(store.error()).toBeNull();
    });
  });
});
