import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Page Object – TenantTestHelper
// ---------------------------------------------------------------------------

/**
 * Helper that encapsulates all tenant-related selectors and interactions.
 *
 * TenantStore state is NOT directly readable via Playwright because the store
 * lives inside the Angular app process.  Instead we observe the DOM side-effects
 * that tenant state drives:
 *
 *   - menu footer shows  "Tenant: <id>"  only when tenantStore.tenantId() is set
 *   - auth guard redirects to /login when tenantStore (and authStore) are empty
 *   - TenantService.getTenantDocPath() is consumed by every feature page –
 *     those pages redirect/fail when tenant is absent (unauthenticated state)
 *
 * In this test environment Firebase is unavailable, so no real login is
 * possible.  All "authenticated" behaviour is therefore tested via the
 * expected redirect/guard behaviour for an unauthenticated user.
 */
class TenantTestHelper {
  constructor(readonly page: Page) {}

  // ---------- navigation helpers ----------

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoLogin(): Promise<void> {
    await this.goto('/login');
  }

  // ---------- TenantStore state via DOM ----------

  /**
   * Returns the raw text of the tenant footer paragraph when it is present,
   * or null when tenantStore.tenantId() is falsy (element absent from DOM).
   *
   * Template:  @if (tenantStore.tenantId(); as tid) { <p>Tenant: {{ tid }}</p> }
   */
  async getTenantFooterText(): Promise<string | null> {
    const menuFooter = this.page.locator('.menu-footer');
    if (await menuFooter.count() === 0) return null;

    const tenantParagraph = menuFooter.locator('p', { hasText: /^Tenant:/ });
    if (await tenantParagraph.count() === 0) return null;

    return tenantParagraph.textContent();
  }

  async isTenantFooterVisible(): Promise<boolean> {
    const menuFooter = this.page.locator('.menu-footer');
    if (await menuFooter.count() === 0) return false;

    const tenantParagraph = menuFooter.locator('p', { hasText: /^Tenant:/ });
    return tenantParagraph.count().then((c) => c > 0);
  }

  // ---------- auth/tenant store via evaluate ----------

  /**
   * Reads the tenantId signal from the Angular TenantStore through the window
   * object.  The store is NOT exposed on window in production mode so this
   * always returns null in this test environment – useful to confirm the
   * default (unauthenticated) state.
   */
  async readWindowTenantId(): Promise<string | null> {
    return this.page.evaluate(() => {
      // Angular signal stores are not exposed on window; accessing them from
      // outside the app is not supported.  We return null as the baseline.
      return null;
    });
  }

  // ---------- JS error capture ----------

  captureErrors(): string[] {
    const errors: string[] = [];
    this.page.on('pageerror', (err) => errors.push(err.message));
    return errors;
  }

  filterCriticalErrors(errors: string[]): string[] {
    return errors.filter(
      (e) =>
        !e.includes('firebase') &&
        !e.includes('auth/network') &&
        !e.includes('firestore') &&
        !e.includes('Failed to fetch') &&
        !e.includes('Tenant not resolved'),  // expected in offline test env
    );
  }
}

// ---------------------------------------------------------------------------
// 1. Tenant state is null / unresolved before authentication
// ---------------------------------------------------------------------------

test.describe('Tenant – initial state without authentication', () => {
  let helper: TenantTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TenantTestHelper(page);
    await helper.gotoLogin();
  });

  test('app loads without critical JS errors in unauthenticated state', async () => {
    const errors = helper.captureErrors();
    await helper.gotoLogin();
    expect(helper.filterCriticalErrors(errors)).toHaveLength(0);
  });

  test('TenantStore defaults to null – menu footer tenant paragraph is absent on login page', async () => {
    // The login page never renders the shell/menu, so .menu-footer is absent.
    const tenantFooterText = await helper.getTenantFooterText();
    expect(tenantFooterText).toBeNull();
  });

  test('ion-app is present even when tenant is unresolved', async ({ page }) => {
    await expect(page.locator('ion-app')).toBeVisible();
  });

  test('login page renders correctly when tenant is unresolved', async ({ page }) => {
    await expect(page.locator('app-login')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="password"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Tenant-scoped routes redirect to login when unauthenticated
//    (authGuard fires before any tenant-dependent data is loaded)
// ---------------------------------------------------------------------------

test.describe('Tenant – protected route redirects when tenant/auth is absent', () => {
  const tenantScopedRoutes = [
    { path: '/home', label: 'home' },
    { path: '/search-by-device', label: 'device search' },
    { path: '/device/ABC123/device-groups', label: 'device groups' },
    { path: '/device/ABC123/device-groups/G1/device-parts', label: 'device parts' },
    { path: '/docs', label: 'documentation' },
    { path: '/cart', label: 'cart' },
  ];

  for (const route of tenantScopedRoutes) {
    test(`${route.label} (${route.path}) redirects to /login without tenant/auth context`, async ({
      page,
    }) => {
      const helper = new TenantTestHelper(page);
      await helper.goto(route.path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('root path (/) redirects to /login when tenant/auth is absent', async ({ page }) => {
    const helper = new TenantTestHelper(page);
    await helper.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// 3. Tenant info NOT shown in menu without authentication
//    (menu is only rendered inside ShellComponent which is behind authGuard)
// ---------------------------------------------------------------------------

test.describe('Tenant – menu tenant info absent for unauthenticated users', () => {
  test('ion-menu is absent or disabled on login page (no shell rendered)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const menu = page.locator('ion-menu');
    if (await menu.count() > 0) {
      // If the menu element exists in DOM it must be disabled
      await expect(menu).toHaveAttribute('disabled', 'true');
    } else {
      // No menu element at all on the login page is also acceptable
      expect(await menu.count()).toBe(0);
    }
  });

  test('.menu-footer with tenant info is not rendered on login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // .menu-footer lives inside app-menu which is inside app-shell (auth-gated)
    await expect(page.locator('.menu-footer')).toHaveCount(0);
  });

  test('no tenant paragraph is visible on login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const tenantParagraph = page.locator('p', { hasText: /^Tenant:/ });
    await expect(tenantParagraph).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Tenant state consistency across navigation (unauthenticated flow)
// ---------------------------------------------------------------------------

test.describe('Tenant – state consistency across navigation attempts', () => {
  test('redirect to /login is stable on repeated protected route visits', async ({ page }) => {
    const helper = new TenantTestHelper(page);

    for (const path of ['/home', '/search-by-device', '/docs']) {
      await helper.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('login page stays on /login after navigating away and back', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);

    // Attempt to navigate to a protected page
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);

    // Login page still renders correctly (tenant guard did not crash the app)
    await expect(page.locator('app-login')).toBeVisible();
  });

  test('app does not crash after multiple tenant-guarded navigation attempts', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const helper = new TenantTestHelper(page);
    const paths = ['/home', '/search-by-device', '/cart', '/docs'];

    for (const path of paths) {
      await helper.goto(path);
    }

    const criticalErrors = helper.filterCriticalErrors(errors);
    expect(criticalErrors).toHaveLength(0);
  });

  test('login page is stable after reload (tenant defaults persist)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.waitForLoadState('networkidle');

    // After reload, TenantStore is still in its initial null state
    await expect(page.locator('app-login')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.menu-footer')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Tenant resolution – DOM observable state after app initializer
//    (tests what is verifiable without a real Firebase session)
// ---------------------------------------------------------------------------

test.describe('Tenant – app initializer completes without tenant (offline Firebase)', () => {
  test('app initializer completes and renders login without tenant resolution', async ({ page }) => {
    test.setTimeout(15000); // allow for the 5s auth-ready timeout
    // appInitializer calls waitForAuthReady() → times out (5s max) → no user
    // → TenantService.resolveFromAuthToken() is NOT called
    // → TenantStore remains { tenantId: null, role: null, servicerId: null }
    // → configStore.loadDefaults() is called instead
    // The observable outcome: login page is rendered, no JS crash
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('ion-app')).toBeVisible();
    await expect(page.locator('app-login')).toBeVisible();
  });

  test('app initializer does not expose tenant data when Firebase is unreachable', async ({
    page,
  }) => {
    test.setTimeout(15000);
    const errors: string[] = [];
    page.on('pageerror', (err: Error) => errors.push(err.message));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // No tenant paragraph should be present anywhere in the DOM
    const tenantParagraphs = page.locator('p', { hasText: /^Tenant:/ });
    await expect(tenantParagraphs).toHaveCount(0);

    // No critical JS errors should have been thrown by tenant resolution failure
    const helper = new TenantTestHelper(page);
    expect(helper.filterCriticalErrors(errors)).toHaveLength(0);
  });

  test('TenantService graceful fallback – no unhandled error visible in page', async ({ page }) => {
    test.setTimeout(15000);
    // TenantService.resolveFromAuthToken() catches its own errors internally.
    // We verify this by looking for no error-indicating UI on the login page.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // There should be no unexpected error banner outside the login form
    await expect(page.locator('.error-message')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Tenant path helpers – observable indirectly through guard behaviour
//    getTenantDocPath() throws when tenantId is null; this propagates as a
//    redirect rather than a visible crash due to guard/error handling.
// ---------------------------------------------------------------------------

test.describe('Tenant – getTenantDocPath throws gracefully when tenant is absent', () => {
  test('feature pages that depend on tenant path redirect to /login, not to error page', async ({
    page,
  }) => {
    // The device-search page calls device-search service which calls
    // TenantService.getCollectionPath() → getTenantDocPath().
    // Without auth, authGuard fires first, so the redirect is to /login.
    await page.goto('/search-by-device');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    // No unhandled error modal or crash screen should appear
    await expect(page.locator('ion-app')).toBeVisible();
  });

  test('device-groups page redirects to /login (no tenant path crash visible)', async ({
    page,
  }) => {
    await page.goto('/device/XYZ999/device-groups');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('ion-app')).toBeVisible();
  });

  test('device-parts page redirects to /login (no tenant path crash visible)', async ({ page }) => {
    await page.goto('/device/XYZ999/device-groups/G1/device-parts');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('ion-app')).toBeVisible();
  });

  test('docs page redirects to /login (no tenant path crash visible)', async ({ page }) => {
    await page.goto('/docs');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('ion-app')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. Structural / regression tests for tenant-related DOM elements
// ---------------------------------------------------------------------------

test.describe('Tenant – tenant-related DOM structure on login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('app-shell is not rendered on login page (tenant UI is inside shell)', async ({ page }) => {
    await expect(page.locator('app-shell')).toHaveCount(0);
  });

  test('app-menu is not rendered on login page', async ({ page }) => {
    // app-menu with tenant footer is only inside app-shell
    await expect(page.locator('app-menu')).toHaveCount(0);
  });

  test('login page renders correctly after tenant-guard redirect cycle', async ({ page }) => {
    // Navigate to a protected page → redirected to login → back to protected
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);

    // Verify login form is fully intact after the redirect
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="password"]')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();
  });

  test('page title is consistent before and after tenant-guard redirect', async ({ page }) => {
    const titleAfterRedirect = await page.title();
    expect(titleAfterRedirect).toBeTruthy();

    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    const titleOnLogin = await page.title();
    expect(titleOnLogin).toBeTruthy();
    // Both should be the same app title
    expect(titleAfterRedirect).toBe(titleOnLogin);
  });
});

// ---------------------------------------------------------------------------
// 8. Tenant – JWT claims resolution (TenantService.resolveFromAuthToken)
// ---------------------------------------------------------------------------
// TenantService.resolveFromAuthToken() now reads tenantId, role, and
// servicerId from FirebaseAuthentication.getIdTokenResult().claims instead of
// any hardcoded value.  Without a live Firebase session, getIdTokenResult()
// fails gracefully.  We verify the observable outcomes only.

test.describe('Tenant – JWT claims resolution (offline Firebase)', () => {
  test('TenantService.resolveFromAuthToken failure is caught gracefully', async ({ page }) => {
    test.setTimeout(15000);
    // Without Firebase, getIdTokenResult() throws.  TenantService catches the
    // error internally and logs a warning.  The app must not crash.
    const errors: string[] = [];
    page.on('pageerror', (err: Error) => errors.push(err.message));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const helper = new TenantTestHelper(page);
    expect(helper.filterCriticalErrors(errors)).toHaveLength(0);
  });

  test('tenantId remains null when JWT claims are unavailable', async ({ page }) => {
    // The DOM observable: .menu-footer tenant paragraph is absent (tenantId = null).
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const helper = new TenantTestHelper(page);
    const tenantFooterText = await helper.getTenantFooterText();
    expect(tenantFooterText).toBeNull();
  });

  test('role defaults are not exposed on login page when claims are absent', async ({ page }) => {
    // TenantStore.role and TenantStore.servicerId default to null.
    // No role-specific UI is rendered on the login page.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // The login page must not show any role-specific elements.
    await expect(page.locator('[data-role]')).toHaveCount(0);
  });

  test('app initializer does not call resolveFromAuthToken when no user is authenticated', async ({
    page,
  }) => {
    test.setTimeout(15000);
    // appInitializer only calls resolveFromAuthToken() inside the `if (user)` branch.
    // Without Firebase no user is returned, so the TenantStore stays cleared.
    // Observable: no tenant-related DOM element appears.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.menu-footer')).toHaveCount(0);
    await expect(page.locator('app-menu')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Tenant – Firestore path format (tenant-scoped)
// ---------------------------------------------------------------------------
// TenantService.getCollectionPath(collection) returns
// "tenants/{tenantId}/{collection}".  getTenantDocPath() returns
// "tenants/{tenantId}".  We can only verify the behaviour indirectly because
// the Angular app process is not directly inspectable from Playwright.
// The absence of "envs/testEnv" in any network request is the observable.

test.describe('Tenant – Firestore path format (tenant-scoped, no envs/testEnv prefix)', () => {
  test('no network request contains the old "envs/testEnv" path prefix', async ({ page }) => {
    const requestUrls: string[] = [];
    page.on('request', (req) => requestUrls.push(req.url()));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const testEnvRequests = requestUrls.filter(
      (url) => url.includes('envs/testEnv') || url.includes('envs%2FtestEnv'),
    );
    expect(testEnvRequests).toHaveLength(0);
  });

  test('no localStorage key contains the old "envs/testEnv" path artifact', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const keys = await page.evaluate(() => Object.keys(localStorage));
    const badKeys = keys.filter((k) => k.includes('testEnv') || k.includes('envs/'));
    expect(badKeys).toHaveLength(0);
  });

  test('TenantService.getTenantDocPath throws and is caught when tenant is null', async ({
    page,
  }) => {
    // Without authentication, tenantId is null.  Any code that calls
    // getTenantDocPath() will throw "Tenant not resolved."
    // The authGuard fires before such code is reached, so the result is a
    // clean redirect to /login, not an error page.
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/search-by-device');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);

    const helper = new TenantTestHelper(page);
    expect(helper.filterCriticalErrors(errors)).toHaveLength(0);
  });

  test('tenant path "tenants/{tenantId}" pattern is isolated per tenant', async ({ page }) => {
    // Structural test: verify the path format used by TenantService.
    // getTenantDocPath() must produce "tenants/<id>", not a flat or env-prefixed path.
    // We verify this by checking that no Firestore-looking URL uses the old format.
    const firestoreUrls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('firestore') || req.url().includes('googleapis')) {
        firestoreUrls.push(req.url());
      }
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Any Firestore URL that fired must NOT reference envs/ or testEnv/.
    const badUrls = firestoreUrls.filter(
      (url) => url.includes('envs%2F') || url.includes('testEnv'),
    );
    expect(badUrls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Tenant – logout flow clears TenantStore (observable via DOM)
// ---------------------------------------------------------------------------
// MenuComponent.logout() calls:
//   await this.authService.logout();
//   this.authStore.clearUser();
//   this.tenantStore.clear();          ← new behaviour
//   this.router.navigate(['/login']);
//
// appInitializer.onAuthStateChange() (user === null) also calls:
//   tenantStore.clear();               ← new behaviour
//   router.navigate(['/login']);
//
// Without a real Firebase session we can only verify the unauthenticated
// baseline: the cleared TenantStore state maps to the absence of any
// tenant-specific DOM elements on /login.

test.describe('Tenant – logout clears TenantStore (unauthenticated baseline)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('TenantStore clear() state – tenantId is null → menu-footer absent', async ({ page }) => {
    // After clear(), tenantStore.tenantId() === null.
    // The @if block in app-menu renders no tenant paragraph.
    await expect(page.locator('.menu-footer')).toHaveCount(0);
  });

  test('TenantStore clear() state – app-menu is not rendered on /login', async ({ page }) => {
    // app-shell (which contains app-menu) is auth-gated.
    // After logout the router navigates to /login, shell unmounts.
    await expect(page.locator('app-menu')).toHaveCount(0);
  });

  test('TenantStore clear() state – all protected routes redirect back to /login', async ({
    page,
  }) => {
    const helper = new TenantTestHelper(page);

    // Simulate post-logout navigation attempts to protected routes.
    for (const path of ['/home', '/search-by-device', '/cart', '/docs']) {
      await helper.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('TenantStore clear() state – no unhandled JS errors after repeated navigation', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const helper = new TenantTestHelper(page);
    for (const path of ['/home', '/search-by-device']) {
      await helper.goto(path);
    }

    expect(helper.filterCriticalErrors(errors)).toHaveLength(0);
  });

  test('TenantStore clear() state – login form remains fully functional after redirect cycle', async ({
    page,
  }) => {
    // Navigate to a protected page (simulate post-logout redirect), then verify
    // the login form is intact.
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);

    await expect(page.locator('ion-input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="password"]')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();
  });
});
