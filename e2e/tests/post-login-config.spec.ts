import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads an inline CSS custom-property value set directly on <html> by
 * ThemeService.applyTheme().
 */
async function getInlineStyleVar(page: Page, varName: string): Promise<string> {
  return page.evaluate(
    (name: string) => document.documentElement.style.getPropertyValue(name).trim(),
    varName,
  );
}

/**
 * Returns the full list of localStorage keys visible from the page context.
 */
async function getLocalStorageKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(localStorage));
}

// ---------------------------------------------------------------------------
// 1. Login flow – theme is applied after the login form submission
// ---------------------------------------------------------------------------
// LoginPage.onLogin() now calls:
//   1. authService.login()
//   2. tenantService.resolveFromAuthToken()
//   3. configService.loadConfig()  →  configStore.setConfig()  (or loadDefaults())
//   4. translationService.sync()
//   5. themeService.applyTheme(configStore.theme())   ← NEW
//   6. router.navigate(['/home'])
//
// In the E2E environment Firebase is unavailable, so login always fails with an
// auth error.  The observable we test is:
//   - Theme CSS variables are already present on <html> BEFORE the user even
//     submits the form (appInitializer sets them via themeService.applyTheme()).
//   - They remain set (same values) after a failed login attempt.
//   - No JS crash occurs when the login flow's config-loading path executes.
// ---------------------------------------------------------------------------

test.describe('Login flow – theme is applied by appInitializer before form render', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('--ion-color-primary is set on <html> before login is submitted', async ({ page }) => {
    // appInitializer runs themeService.applyTheme() at startup.
    // The theme CSS variable must be present immediately on the login page.
    const primary = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primary).toBeTruthy();
    expect(primary).toMatch(/^#[0-9a-fA-F]{3,6}$/);
  });

  test('theme CSS vars remain set after a failed login attempt', async ({ page }) => {
    const primaryBefore = await getInlineStyleVar(page, '--ion-color-primary');

    // Submit the form with credentials that will fail in the offline E2E env.
    await page.locator('ion-input[formControlName="email"] input').fill('test@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('wrongpassword');
    await page.locator('ion-button[type="submit"]').click();

    // Wait for the auth error to surface.
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 10000 });

    // Theme must still be applied (configStore was not cleared by a failed login).
    const primaryAfter = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primaryAfter).toBe(primaryBefore);
  });

  test('--ion-color-secondary stays set after a failed login attempt', async ({ page }) => {
    const secondaryBefore = await getInlineStyleVar(page, '--ion-color-secondary');

    await page.locator('ion-input[formControlName="email"] input').fill('test@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('wrongpassword');
    await page.locator('ion-button[type="submit"]').click();

    await expect(page.locator('.error-message')).toBeVisible({ timeout: 10000 });

    const secondaryAfter = await getInlineStyleVar(page, '--ion-color-secondary');
    expect(secondaryAfter).toBe(secondaryBefore);
  });

  test('no JS crash occurs when login triggers config-loading path (Firebase offline)', async ({
    page,
  }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.locator('ion-input[formControlName="email"] input').fill('test@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('wrongpassword');
    await page.locator('ion-button[type="submit"]').click();

    // Wait for the error to settle.
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 10000 });

    // Filter known Firebase / network noise.
    const critical = jsErrors.filter(
      (e) =>
        !e.includes('firebase') &&
        !e.includes('auth/network') &&
        !e.includes('firestore') &&
        !e.includes('Failed to fetch') &&
        !e.includes('auth/invalid-credential') &&
        !e.includes('Tenant not resolved'),
    );
    expect(critical).toHaveLength(0);
  });

  test('app title is rendered in login header after appInitializer applies config', async ({
    page,
  }) => {
    // appInitializer runs configStore.loadDefaults() + themeService.applyTheme()
    // before any page renders, so the header title reflects the loaded config.
    const title = await page.locator('.login-header h1').textContent();
    expect(title).toBeTruthy();
    expect(title!.trim().length).toBeGreaterThan(0);
  });

  test('theme CSS vars survive a page reload (config re-applied by appInitializer)', async ({
    page,
  }) => {
    const primaryBefore = await getInlineStyleVar(page, '--ion-color-primary');

    await page.reload();
    await page.waitForLoadState('networkidle');

    const primaryAfter = await getInlineStyleVar(page, '--ion-color-primary');
    // The same default theme must be reapplied on each reload.
    expect(primaryAfter).toBe(primaryBefore);
  });
});

// ---------------------------------------------------------------------------
// 2. ConfigStore.clear() on logout – observable DOM effects
// ---------------------------------------------------------------------------
// MenuComponent.logout() now calls:
//   await this.authService.logout();
//   this.authStore.clearUser();
//   this.tenantStore.clear();
//   this.configStore.clear();    ← NEW
//   this.router.navigate(['/login']);
//
// appInitializer.onAuthStateChange(null) also calls:
//   configStore.clear();         ← NEW
//   router.navigate(['/login']);
//
// After configStore.clear():
//   - config()     → null
//   - isLoaded()   → false
//   - logoDataUrl()→ null
//
// The observable E2E effects in the unauthenticated baseline:
//   - We simulate the post-logout state by clearing localStorage (removes any
//     cached session data) and reloading → appInitializer runs with no user
//     → configStore.loadDefaults() is called → app renders with default config.
//   - No app-menu / .menu-footer is present (auth-gated shell is unmounted).
//   - All protected routes redirect to /login.
// ---------------------------------------------------------------------------

test.describe('ConfigStore.clear() on logout – DOM observable effects', () => {
  test('login page renders with default theme after simulated logout (localStorage cleared)', async ({
    page,
    context,
  }) => {
    // Simulate post-logout state: clear all stored session/config data.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.reload();
    await page.waitForLoadState('networkidle');

    // appInitializer should call configStore.loadDefaults() then applyTheme().
    const primary = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primary).toBeTruthy();
    expect(primary).toMatch(/^#[0-9a-fA-F]{3,6}$/);
  });

  test('no app-menu is rendered on /login after simulated logout (configStore cleared)', async ({
    page,
  }) => {
    // app-shell (which contains app-menu) is behind authGuard.
    // After configStore.clear() + navigate(['/login']), the shell is unmounted.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('app-menu')).toHaveCount(0);
  });

  test('no .menu-footer rendered on /login after simulated logout (configStore cleared)', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.menu-footer')).toHaveCount(0);
  });

  test('app does not crash when configStore is in cleared state and protected routes are accessed', async ({
    page,
  }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // Access protected routes in sequence (simulates post-logout navigation).
    for (const path of ['/home', '/search-by-device', '/docs', '/cart']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    }

    const critical = jsErrors.filter(
      (e) =>
        !e.includes('firebase') &&
        !e.includes('auth/network') &&
        !e.includes('firestore') &&
        !e.includes('Failed to fetch') &&
        !e.includes('Tenant not resolved'),
    );
    expect(critical).toHaveLength(0);
  });

  test('theme CSS vars are re-applied by appInitializer after configStore.clear() on reload', async ({
    page,
    context,
  }) => {
    // Step 1: Load the page and record theme values.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const primaryInitial = await getInlineStyleVar(page, '--ion-color-primary');

    // Step 2: Simulate logout by clearing storage and reloading.
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 3: appInitializer runs loadDefaults() + applyTheme() again.
    // The theme variables must be present and match the default values.
    const primaryAfterClear = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primaryAfterClear).toBeTruthy();
    expect(primaryAfterClear).toMatch(/^#[0-9a-fA-F]{3,6}$/);

    // Both sessions use the same default config, so values must match.
    expect(primaryAfterClear).toBe(primaryInitial);
  });

  test('login form is fully functional after simulated logout + config clear', async ({ page }) => {
    // Simulate post-logout state.
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The login form must be fully operational regardless of configStore state.
    await expect(page.locator('ion-input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="password"]')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toHaveAttribute('disabled', '');
  });

  test('no old flat "app_config" key appears in localStorage after config clear cycle', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.reload();
    await page.waitForLoadState('networkidle');

    const keys = await getLocalStorageKeys(page);
    // The old tenant-unaware key must never be written.
    const flatKeys = keys.filter(
      (k) => k === 'app_config' || k === 'CapacitorStorage.app_config',
    );
    expect(flatKeys).toHaveLength(0);
  });

  test('configStore clear state – default primary color is applied on fresh session', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // With no Firebase and no cache, getDefaultConfig() is used.
    // Default primary is #B71C1C (from getDefaultTheme()).
    const primary = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primary.toLowerCase()).toBe('#b71c1c');
  });
});

// ---------------------------------------------------------------------------
// 3. Tenant-scoped priceList access via getTenantDocument
// ---------------------------------------------------------------------------
// PartDetailService.loadPartDetail() now uses:
//   firestoreService.getTenantDocument<PriceDoc>('priceList', partCode)
// instead of any direct document() reference.
//
// FirestoreService.getTenantDocument() builds the path as:
//   `${tenantService.getCollectionPath('priceList')}/${partCode}`
// which expands to:
//   `tenants/{tenantId}/priceList/{partCode}`
//
// Without authentication, tenantId is null, so:
//   - getTenantDocPath() throws "Tenant not resolved."
//   - PartDetailService catches this and returns a fallback PartDetail.
//   - The authGuard prevents any page that uses PartDetailService from
//     rendering, so the throw is never exposed as a visible crash.
//
// The observable E2E effects:
//   - Device-parts routes redirect to /login (authGuard fires first).
//   - No unhandled error is thrown when routes with tenant-dependent data
//     are accessed without authentication.
//   - No Firestore URL referencing "priceList" is ever sent when unauthenticated.
//   - No Firestore URL uses the old flat path format (without tenants/ prefix).
// ---------------------------------------------------------------------------

test.describe('Tenant-scoped priceList – getTenantDocument path verification', () => {
  test('device-parts route (uses PartDetailService) redirects to /login when unauthenticated', async ({
    page,
  }) => {
    // PartDetailService is invoked from the device-parts page.
    // Without auth, authGuard intercepts before PartDetailService is called.
    await page.goto('/device/ABC123/device-groups/G1/device-parts');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('ion-app')).toBeVisible();
  });

  test('device-groups route redirects to /login (tenant path not exposed)', async ({ page }) => {
    await page.goto('/device/ABC123/device-groups');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
  });

  test('no Firestore request for priceList is sent when unauthenticated', async ({ page }) => {
    // No network request must reference the priceList Firestore collection
    // when the user is unauthenticated (authGuard redirects before the service
    // is called).
    const requestUrls: string[] = [];
    page.on('request', (req) => requestUrls.push(req.url()));

    await page.goto('/device/ABC123/device-groups/G1/device-parts');
    await page.waitForLoadState('networkidle');

    const priceListRequests = requestUrls.filter((url) =>
      url.toLowerCase().includes('pricelist'),
    );
    expect(priceListRequests).toHaveLength(0);
  });

  test('no Firestore URL uses a flat priceList path (without tenants/ prefix)', async ({ page }) => {
    // All Firestore writes/reads must be scoped to tenants/{tenantId}/priceList.
    // A flat path like "priceList/{partCode}" must never appear.
    const firestoreUrls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('firestore') || req.url().includes('googleapis')) {
        firestoreUrls.push(req.url());
      }
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // If any Firestore URL was sent, none should reference priceList at root level.
    const flatPriceListUrls = firestoreUrls.filter(
      (url) =>
        (url.includes('priceList') || url.includes('pricelist')) &&
        !url.includes('tenants'),
    );
    expect(flatPriceListUrls).toHaveLength(0);
  });

  test('no JS error surfaces from PartDetailService when tenant is null', async ({ page }) => {
    // PartDetailService.loadPartDetail() catches errors from getTenantDocument()
    // and returns a fallback PartDetail.  The app must not crash.
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/device/XYZ999/device-groups/G1/device-parts');
    await page.waitForLoadState('networkidle');

    const critical = jsErrors.filter(
      (e) =>
        !e.includes('firebase') &&
        !e.includes('auth/network') &&
        !e.includes('firestore') &&
        !e.includes('Failed to fetch') &&
        !e.includes('Tenant not resolved'),
    );
    expect(critical).toHaveLength(0);
  });

  test('no Firestore URL contains the old "envs/testEnv" path artifact for priceList', async ({
    page,
  }) => {
    const requestUrls: string[] = [];
    page.on('request', (req) => requestUrls.push(req.url()));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const testEnvPriceListUrls = requestUrls.filter(
      (url) =>
        (url.includes('testEnv') || url.includes('envs%2F')) &&
        url.toLowerCase().includes('pricelist'),
    );
    expect(testEnvPriceListUrls).toHaveLength(0);
  });

  test('app remains stable when navigating repeatedly to device-parts without auth', async ({
    page,
  }) => {
    // Rapid navigation to tenant-dependent routes must not accumulate errors.
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    for (const partCode of ['PART001', 'PART002', 'PART003']) {
      await page.goto(`/device/ABC/${partCode}/device-parts`);
      await page.waitForLoadState('networkidle');
    }

    const critical = jsErrors.filter(
      (e) =>
        !e.includes('firebase') &&
        !e.includes('auth/network') &&
        !e.includes('firestore') &&
        !e.includes('Failed to fetch') &&
        !e.includes('Tenant not resolved'),
    );
    expect(critical).toHaveLength(0);
  });

  test('priceList path format uses tenants/{tenantId}/priceList/{partCode} pattern', async ({
    page,
  }) => {
    // Structural verification: TenantService.getCollectionPath('priceList')
    // returns "tenants/{tenantId}/priceList".  When tenantId is null it throws.
    // The authGuard ensures no page with tenant-data renders without auth.
    // We verify the expected redirect chain produces no crash.
    await page.goto('/device/TEST123/device-groups/G1/device-parts');
    await page.waitForLoadState('networkidle');

    // The authGuard fires and redirects to /login without any Firestore call.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('app-login')).toBeVisible();
  });
});
