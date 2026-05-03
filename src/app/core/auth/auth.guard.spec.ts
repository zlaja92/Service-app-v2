import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from './auth.store';
import {
  createMockAuthStore,
  createMockRouter,
  MockAuthStore,
} from '../../testing/mock-factories';

describe('authGuard', () => {
  let mockAuthStore: MockAuthStore;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockAuthStore = createMockAuthStore();
    mockRouter = createMockRouter();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any),
    ) as boolean | UrlTree;
  }

  it('TC-AG01: returns true when user is authenticated', () => {
    mockAuthStore.setUser({ uid: 'u1', email: 'a@b.com', displayName: 'Alice' });

    const result = runGuard();

    expect(result).toBe(true);
  });

  it('TC-AG02: returns UrlTree to /login when user is unauthenticated', () => {
    const fakeUrlTree = {} as UrlTree;
    mockRouter.createUrlTree.and.returnValue(fakeUrlTree);

    const result = runGuard();

    expect(result).toBe(fakeUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('TC-AG03: uses authStore.isAuthenticated signal to check authentication state', () => {
    // isAuthenticated is a computed signal on the mock — set user so it returns true
    mockAuthStore.setUser({ uid: 'u2', email: 'b@c.com', displayName: 'Bob' });

    const result = runGuard();

    // Guard returns true only when isAuthenticated() is truthy
    expect(result).toBe(true);
    expect(mockAuthStore.isAuthenticated()).toBe(true);
  });

  it('TC-AG04: calls router.createUrlTree with ["/login"] when unauthenticated', () => {
    const fakeUrlTree = { path: '/login' } as unknown as UrlTree;
    mockRouter.createUrlTree.and.returnValue(fakeUrlTree);

    runGuard();

    expect(mockRouter.createUrlTree).toHaveBeenCalledOnceWith(['/login']);
  });

  // =========================================================================
  // Parameterized: guard returns true for various authenticated user shapes
  // =========================================================================

  describe('authGuard — parameterized authenticated user variants', () => {
    const authenticatedUsers = [
      { uid: 'u1', email: 'simple@test.com', displayName: 'Alice' },
      { uid: 'u2', email: null, displayName: 'Bob' },
      { uid: 'u3', email: 'user@test.com', displayName: null },
      { uid: 'u4', email: null, displayName: null },
      { uid: '', email: 'empty-uid@test.com', displayName: 'User' },
      { uid: 'a'.repeat(128), email: 'long@test.com', displayName: 'LongUid' },
      { uid: 'uid-unicode', email: 'юзер@тест.рф', displayName: 'Иван' },
      { uid: 'uid-special', email: 'user+tag@sub.domain.co.uk', displayName: 'María' },
      { uid: 'uid-numeric', email: '123@456.789', displayName: '42' },
      { uid: 'uid-emoji', email: 'user@test.com', displayName: '🚀 Spaceman' },
    ];

    authenticatedUsers.forEach(({ uid, email, displayName }) => {
      it(`TC-AG-AUTH-${uid.slice(0, 20)}: returns true when user is authenticated (uid="${uid.slice(0, 20)}")`, () => {
        mockAuthStore.setUser({ uid, email, displayName });

        const result = runGuard();

        expect(result).toBe(true);
      });
    });
  });

  // =========================================================================
  // Parameterized: guard does NOT call router when authenticated
  // =========================================================================

  describe('authGuard — router.createUrlTree NOT called when authenticated', () => {
    const users = [
      { uid: 'u1', email: 'a@b.com', displayName: 'User A' },
      { uid: 'u2', email: null, displayName: null },
    ];

    users.forEach(({ uid, email, displayName }) => {
      it(`TC-AG-NOREDIR-${uid}: does NOT call router.createUrlTree when user "${uid}" is authenticated`, () => {
        mockAuthStore.setUser({ uid, email, displayName });

        runGuard();

        expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Guard returns UrlTree (not boolean false)
  // =========================================================================

  it('TC-AG05: returns UrlTree object (not boolean false) when unauthenticated', () => {
    const fakeUrlTree = { __type: 'UrlTree', segments: [] } as unknown as UrlTree;
    mockRouter.createUrlTree.and.returnValue(fakeUrlTree);

    const result = runGuard();

    expect(typeof result).not.toBe('boolean');
    expect(result).toBe(fakeUrlTree);
  });

  // =========================================================================
  // Guard is idempotent — same result on multiple calls with same state
  // =========================================================================

  describe('authGuard — idempotency', () => {
    it('TC-AG06: returns true on repeated calls when user stays authenticated', () => {
      mockAuthStore.setUser({ uid: 'u1', email: 'a@b.com', displayName: 'A' });

      const results = [runGuard(), runGuard(), runGuard()];

      results.forEach((r) => expect(r).toBe(true));
    });

    it('TC-AG07: returns UrlTree on repeated calls when user stays unauthenticated', () => {
      const fakeTree = {} as UrlTree;
      mockRouter.createUrlTree.and.returnValue(fakeTree);

      const results = [runGuard(), runGuard(), runGuard()];

      results.forEach((r) => expect(r).toBe(fakeTree));
      expect(mockRouter.createUrlTree).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // State transition: authenticated → unauthenticated
  // =========================================================================

  it('TC-AG08: returns true then UrlTree after user is cleared', () => {
    const fakeTree = {} as UrlTree;
    mockRouter.createUrlTree.and.returnValue(fakeTree);

    mockAuthStore.setUser({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
    expect(runGuard()).toBe(true);

    mockAuthStore.clearUser();
    expect(runGuard()).toBe(fakeTree);
  });

  // =========================================================================
  // State transition: unauthenticated → authenticated
  // =========================================================================

  it('TC-AG09: returns UrlTree then true after user is set', () => {
    const fakeTree = {} as UrlTree;
    mockRouter.createUrlTree.and.returnValue(fakeTree);

    expect(runGuard()).toBe(fakeTree);

    mockAuthStore.setUser({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
    expect(runGuard()).toBe(true);
  });

  // =========================================================================
  // isAuthenticated signal check
  // =========================================================================

  it('TC-AG10: isAuthenticated() reads false when no user', () => {
    runGuard();

    expect(mockAuthStore.isAuthenticated()).toBe(false);
  });

  it('TC-AG11: isAuthenticated() reads true when user set', () => {
    mockAuthStore.setUser({ uid: 'u99', email: 'x@y.com', displayName: null });

    runGuard();

    expect(mockAuthStore.isAuthenticated()).toBe(true);
  });
});
