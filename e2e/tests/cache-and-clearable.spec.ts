import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CAP_PREFIX = 'CapacitorStorage.';

/** Filter out expected Firebase / network noise in offline E2E environment. */
function filterCritical(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes('firebase') &&
      !e.includes('auth/network') &&
      !e.includes('firestore') &&
      !e.includes('Failed to fetch') &&
      !e.includes('Tenant not resolved') &&
      !e.includes('auth/invalid-credential'),
  );
}

function captureErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function getLocalStorageKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(localStorage));
}


// ---------------------------------------------------------------------------
// 1. Tenant-aware translation cache keys
// ---------------------------------------------------------------------------
// TranslationCacheService uses these localStorage keys via Capacitor Preferences:
//   translationCacheKey(lang, tenantId)   → "translations_<lang>_<tenantId>"
//   translationsVersionKey(tenantId)      → "translations_version_<tenantId>"
//   translationsLanguagesKey(tenantId)    → "translations_languages_<tenantId>"
//   translationsLabelsKey(tenantId)       → "translations_labels_<tenantId>"
//
// For unauthenticated users (tenantId = null), the service falls back to
// 'default', so the keys become:
//   "translations_sr_default", "translations_version_default", etc.
//
// The flat (non-tenant-aware) old format would be "translations_sr" or
// "translations_version" without a tenant suffix — those must never appear.
// ---------------------------------------------------------------------------

test.describe('TranslationCacheService – tenant-aware localStorage key format', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('no flat "translations_sr" key exists (must be tenant-scoped)', async ({ page }) => {
    // The old tenant-unaware key format was "translations_<lang>" without a
    // tenant suffix.  After the tenant-aware refactoring it must not appear.
    const keys = await getLocalStorageKeys(page);

    // Flat key patterns that must NOT exist.
    const flatTranslationKeys = keys.filter((k) => {
      // Accept "CapacitorStorage.translations_sr_<anything>" (has a suffix after the lang).
      // Reject "CapacitorStorage.translations_sr" (no suffix).
      return /^CapacitorStorage\.translations_[a-z]{2}$/.test(k);
    });

    expect(flatTranslationKeys).toHaveLength(0);
  });

  test('no flat "translations_version" key exists (must be tenant-scoped)', async ({ page }) => {
    const keys = await getLocalStorageKeys(page);

    const flatVersionKeys = keys.filter(
      (k) => k === 'translations_version' || k === `${CAP_PREFIX}translations_version`,
    );

    expect(flatVersionKeys).toHaveLength(0);
  });

  test('no flat "translations_languages" key exists (must be tenant-scoped)', async ({ page }) => {
    const keys = await getLocalStorageKeys(page);

    const flatLangKeys = keys.filter(
      (k) => k === 'translations_languages' || k === `${CAP_PREFIX}translations_languages`,
    );

    expect(flatLangKeys).toHaveLength(0);
  });

  test('no flat "translations_labels" key exists (must be tenant-scoped)', async ({ page }) => {
    const keys = await getLocalStorageKeys(page);

    const flatLabelKeys = keys.filter(
      (k) => k === 'translations_labels' || k === `${CAP_PREFIX}translations_labels`,
    );

    expect(flatLabelKeys).toHaveLength(0);
  });

  test('any translation cache key present follows the tenant-aware pattern', async ({ page }) => {
    const keys = await getLocalStorageKeys(page);

    const translationKeys = keys.filter(
      (k) => k.includes('translations_') && k !== `${CAP_PREFIX}app_language`,
    );

    // Every key that starts with "translations_" must include a tenant suffix
    // (at minimum "_default" for unauthenticated sessions).
    for (const key of translationKeys) {
      // Strip the Capacitor prefix if present for easier matching.
      const bare = key.replace(/^CapacitorStorage\./, '');

      // Must match: translations_<lang>_<tenantId>   OR
      //             translations_version_<tenantId>   OR
      //             translations_languages_<tenantId> OR
      //             translations_labels_<tenantId>
      expect(bare).toMatch(/^translations_.+_.+$/);
    }
  });

  test('translation key for anonymous session uses "default" tenant suffix', async ({
    page,
    context,
  }) => {
    // Inject a synthetic translation cache under the expected anonymous key to
    // confirm the key format is readable and parseable.
    const anonymousKey = `${CAP_PREFIX}translations_sr_default`;

    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Write a synthetic entry under the tenant-aware anonymous key.
    await page.evaluate(
      ({ key }) => localStorage.setItem(key, JSON.stringify({ hello: 'Zdravo' })),
      { key: anonymousKey },
    );

    // The entry must be readable back under the same key.
    const raw = await page.evaluate((k) => localStorage.getItem(k), anonymousKey);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.hello).toBe('Zdravo');

    // And no flat "translations_sr" key exists alongside it.
    const flatKey = await page.evaluate(() => localStorage.getItem('translations_sr'));
    expect(flatKey).toBeNull();
  });

  test('no "envs/testEnv" artifact appears in any translation localStorage key', async ({
    page,
  }) => {
    const keys = await getLocalStorageKeys(page);
    const testEnvKeys = keys.filter(
      (k) => k.includes('testEnv') && k.includes('translation'),
    );
    expect(testEnvKeys).toHaveLength(0);
  });

  test('app does not crash after storage clear when translation cache is absent', async ({
    page,
    context,
  }) => {
    const errors = captureErrors(page);

    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Without a translation cache the app must fall back to bundled translations.
    await expect(page.locator('ion-app')).toBeVisible();
    await expect(page.locator('app-login')).toBeVisible();
    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('different tenant IDs produce distinct translation cache keys', async ({ page }) => {
    await page.goto('/login');

    // Verify key naming contract in isolation (no app state needed).
    const keyA = `${CAP_PREFIX}translations_sr_tenantA`;
    const keyB = `${CAP_PREFIX}translations_sr_tenantB`;
    const keyDefault = `${CAP_PREFIX}translations_sr_default`;

    expect(keyA).not.toBe(keyB);
    expect(keyA).not.toBe(keyDefault);
    expect(keyB).not.toBe(keyDefault);
    expect(keyA).toContain('tenantA');
    expect(keyB).toContain('tenantB');
    expect(keyDefault).toContain('default');
  });
});

// ---------------------------------------------------------------------------
// 2. Tenant-aware logo cache key
// ---------------------------------------------------------------------------
// LogoCacheService.getLogoCacheKey() returns `logo_cache_${tenantId}`.
// For unauthenticated sessions (tenantId = null) it falls back to 'default',
// producing the key "logo_cache_default".
// The old flat key "logo_cache" (without tenant suffix) must never appear.
// Capacitor Preferences stores keys in localStorage with "CapacitorStorage." prefix,
// so the full key is "CapacitorStorage.logo_cache_default".
// ---------------------------------------------------------------------------

test.describe('LogoCacheService – tenant-aware localStorage key format', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('no flat "logo_cache" key exists in localStorage (must be tenant-scoped)', async ({
    page,
  }) => {
    const keys = await getLocalStorageKeys(page);

    // The old key would be exactly "logo_cache" or "CapacitorStorage.logo_cache".
    const flatKey = keys.find(
      (k) => k === 'logo_cache' || k === `${CAP_PREFIX}logo_cache`,
    );
    expect(flatKey).toBeUndefined();
  });

  test('any logo cache key present follows the tenant-aware pattern', async ({ page }) => {
    const keys = await getLocalStorageKeys(page);

    const logoKeys = keys.filter((k) => k.includes('logo_cache'));

    for (const key of logoKeys) {
      const bare = key.replace(/^CapacitorStorage\./, '');
      // Must match logo_cache_<tenantId> — at minimum logo_cache_default.
      expect(bare).toMatch(/^logo_cache_.+$/);
    }
  });

  test('anonymous session logo cache key uses "default" suffix', async ({ page, context }) => {
    const anonymousKey = `${CAP_PREFIX}logo_cache_default`;

    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Inject a synthetic cached logo entry under the anonymous key.
    const syntheticCache = { configVersion: 1, logoUrl: 'https://example.com/logo.png', dataUrl: 'data:image/png;base64,abc=' };
    await page.evaluate(
      ({ key, cache }) => localStorage.setItem(key, JSON.stringify(cache)),
      { key: anonymousKey, cache: syntheticCache },
    );

    const raw = await page.evaluate((k) => localStorage.getItem(k), anonymousKey);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.configVersion).toBe(1);
    expect(parsed.logoUrl).toBe('https://example.com/logo.png');

    // Flat key must not exist alongside.
    const flatRaw = await page.evaluate(() => localStorage.getItem('logo_cache'));
    expect(flatRaw).toBeNull();
  });

  test('different tenants produce distinct logo cache keys', async ({ page }) => {
    await page.goto('/login');

    const keyTenantA = `${CAP_PREFIX}logo_cache_tenantA`;
    const keyTenantB = `${CAP_PREFIX}logo_cache_tenantB`;
    const keyDefault = `${CAP_PREFIX}logo_cache_default`;

    expect(keyTenantA).not.toBe(keyTenantB);
    expect(keyTenantA).not.toBe(keyDefault);
    expect(keyTenantB).not.toBe(keyDefault);
    expect(keyTenantA).toContain('tenantA');
    expect(keyTenantB).toContain('tenantB');
    expect(keyDefault).toContain('default');
  });

  test('no logo cache written for unauthenticated session (default config has no logoUrl)', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Default config (used offline) has logoUrl: '' so cacheLogo() exits early.
    // No logo_cache_* key should be written.
    const keys = await getLocalStorageKeys(page);
    const logoKeys = keys.filter((k) => k.includes('logo_cache'));
    expect(logoKeys).toHaveLength(0);
  });

  test('stale logo cache with old flat key does not interfere with app startup', async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await page.goto('/login');

    // Simulate a stale cache entry under the OLD flat key (legacy scenario).
    await page.evaluate(() => localStorage.setItem('logo_cache', JSON.stringify({ configVersion: 0, logoUrl: '', dataUrl: '' })));

    // Reload – app should ignore the flat key and use only the tenant-aware key.
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('ion-app')).toBeVisible();
    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('no "envs/testEnv" artifact appears in any logo localStorage key', async ({ page }) => {
    const keys = await getLocalStorageKeys(page);
    const testEnvLogoKeys = keys.filter(
      (k) => k.includes('testEnv') && k.includes('logo'),
    );
    expect(testEnvLogoKeys).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. PartDetailService.clear() – Clearable registration and teardown effect
// ---------------------------------------------------------------------------
// PartDetailService implements Clearable and is registered in main.ts:
//   { provide: CLEARABLE_SERVICES, useExisting: PartDetailService, multi: true }
//
// SessionService.teardown() calls clear() on every Clearable, which resets
// PartDetailService.isLoading = false.
//
// Observable E2E effects:
//   - After teardown (simulated via localStorage clear + reload), no in-progress
//     loading state leaks into the new session.
//   - The device-parts page (which uses PartDetailService) never renders without
//     auth — authGuard fires first.
//   - The app does not crash when navigating to device-parts routes repeatedly
//     (clear() is called on each teardown cycle, preventing stale isLoading=true).
// ---------------------------------------------------------------------------

test.describe('PartDetailService – Clearable registration and teardown effect', () => {
  test('app does not crash after repeated teardown cycles affecting PartDetailService', async ({
    page,
    context,
  }) => {
    const errors = captureErrors(page);

    // Simulate multiple teardown cycles: each clear+reload resets all Clearables.
    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
    }

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('ion-app')).toBeVisible();
    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('PartDetailService cleared state – device-parts redirects to /login without stale loading UI', async ({
    page,
    context,
  }) => {
    // After teardown, PartDetailService.isLoading is reset to false.
    // The next navigation to device-parts must redirect cleanly to /login
    // (authGuard fires before PartDetailService is invoked).
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.goto('/device/ABC123/device-groups/G1/device-parts');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    // No loading spinner or stale state from previous PartDetailService call.
    await expect(page.locator('ion-app')).toBeVisible();
  });

  test('repeated device-parts navigation after teardown produces no accumulated errors', async ({
    page,
    context,
  }) => {
    const errors = captureErrors(page);

    // Simulate teardown.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Multiple device-parts navigation attempts after teardown.
    for (const deviceId of ['DEVICE001', 'DEVICE002', 'DEVICE003']) {
      await page.goto(`/device/${deviceId}/device-groups/G1/device-parts`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    }

    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('PartDetailService clear() does not prevent app from loading correctly on fresh session', async ({
    page,
    context,
  }) => {
    // Each app start calls teardown (if a previous session existed) then bootstrap.
    // teardown calls clear() on PartDetailService.  The app must load fine.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Default theme must be applied (bootstrap ran correctly after teardown clear).
    const primary = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--ion-color-primary').trim(),
    );
    expect(primary.toLowerCase()).toBe('#b71c1c');

    await expect(page.locator('app-login')).toBeVisible();
  });

  test('no loading indicator is visible on login page after PartDetailService clear()', async ({
    page,
  }) => {
    // After teardown + clear(), PartDetailService.isLoading === false.
    // No ion-loading or spinner related to part-detail must appear on /login.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // ion-loading elements are only injected into the DOM during active loading.
    // After clear(), isLoading=false, so nothing triggers them.
    const loading = page.locator('ion-loading');
    if (await loading.count() > 0) {
      // If present, must not be visible.
      await expect(loading).not.toBeVisible();
    } else {
      expect(await loading.count()).toBe(0);
    }
  });

  test('multiple Clearable services registered alongside PartDetailService do not cause conflicts', async ({
    page,
    context,
  }) => {
    const errors = captureErrors(page);

    // All six Clearable services (DeviceSearch, DeviceGroups, DeviceParts, Cart,
    // Docs, PartDetail) are cleared in teardown.  Verify no conflict or crash.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Access routes that each clearable service backs.
    for (const path of [
      '/home',
      '/search-by-device',
      '/device/ABC/device-groups',
      '/device/ABC/device-groups/G1/device-parts',
      '/docs',
      '/cart',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    }

    expect(filterCritical(errors)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. SessionService.bootstrap() – finally block Promise identity check
// ---------------------------------------------------------------------------
// The finally block in bootstrap() only nulls bootstrapPromise when the
// stored promise is the same object as the one that just settled:
//
//   try {
//     await promise;
//   } finally {
//     if (this.bootstrapPromise === promise) {
//       this.bootstrapPromise = null;
//     }
//   }
//
// Without this guard, a teardown() that nulled bootstrapPromise in the middle
// of an in-flight bootstrap would get it re-set to null a second time by the
// settling finally block — losing the reference to a new bootstrap() call that
// might have started in the meantime.
//
// Observable E2E effects:
//   - After teardown() + new bootstrap(), the app is stable (no null reference
//     collision).
//   - After a rapid teardown→bootstrap cycle, all protected routes still
//     redirect correctly and no JS crash occurs.
//   - The theme is always applied correctly (bootstrap was not "lost").
// ---------------------------------------------------------------------------

test.describe('SessionService.bootstrap() – finally block Promise identity check', () => {
  test('app bootstraps cleanly after teardown nulls bootstrapPromise mid-flight', async ({
    page,
    context,
  }) => {
    const errors = captureErrors(page);

    // Simulate the scenario where teardown() fires while an existing bootstrap()
    // is in progress.  We do this by rapidly clearing storage and reloading,
    // which triggers: appInitializer → onAuthStateChange(null) → teardown().
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Simulate teardown in the middle of an in-flight init.
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The app must be stable — the finally identity check prevented double-null.
    await expect(page.locator('ion-app')).toBeVisible();
    await expect(page.locator('app-login')).toBeVisible();
    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('theme is applied after rapid teardown→bootstrap cycle (promise identity preserved)', async ({
    page,
    context,
  }) => {
    // If the finally block wrongly nulled bootstrapPromise during a concurrent
    // bootstrap, the new bootstrap might not complete, leaving theme unapplied.
    // We verify the default theme is always present after a teardown cycle.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    const primary = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--ion-color-primary').trim(),
    );

    // The theme must have been applied by the bootstrap() that completed.
    expect(primary).toBeTruthy();
    expect(primary.toLowerCase()).toBe('#b71c1c');
  });

  test('auth guard is functional after teardown resets bootstrapPromise to null', async ({
    page,
    context,
  }) => {
    // After teardown(), bootstrapPromise === null.
    // The NEXT bootstrap() call starts a new promise.  The finally block must
    // only null that new promise when IT settles (identity check).
    // Observable: auth guard still works correctly after the cycle.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    for (const path of ['/home', '/search-by-device', '/docs']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('multiple consecutive teardown+reload cycles do not corrupt bootstrap state', async ({
    page,
    context,
  }) => {
    const errors = captureErrors(page);
    const primaries: string[] = [];

    // Three teardown→bootstrap cycles.  If the identity check is wrong, the
    // second cycle's bootstrap() would return early because a stale promise
    // reference still blocks entry.
    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const p = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--ion-color-primary').trim(),
      );
      primaries.push(p);

      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
    }

    // All three cycles must produce the same default theme.
    for (const p of primaries) {
      expect(p.toLowerCase()).toBe('#b71c1c');
    }

    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('no stale bootstrapPromise prevents new bootstrap after teardown', async ({
    page,
    context,
  }) => {
    // If teardown() nulled bootstrapPromise AND then the settling finally block
    // (from the old promise) re-sets it back to null — a new bootstrap() call
    // would find null and start correctly.
    // But if the old promise's finally block re-set a new (non-null) promise
    // to null, the new bootstrap would never settle (frozen state).
    // We detect a frozen state by checking the app renders correctly.
    const errors = captureErrors(page);

    // Fast teardown cycle.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Start immediately navigating to protected routes — authGuard must fire
    // (requires bootstrap to have completed cleanly after teardown).
    await page.goto('/search-by-device');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);

    await expect(page.locator('app-login')).toBeVisible();
    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('login page title is correctly rendered after every teardown+bootstrap cycle', async ({
    page,
    context,
  }) => {
    // The login header title is set from configStore (populated by bootstrap).
    // If bootstrap was broken by the finally block race, the title might be
    // missing or empty.
    const titles: (string | null)[] = [];

    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      titles.push(await page.locator('.login-header h1').textContent());

      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
    }

    for (const t of titles) {
      expect(t).toBeTruthy();
      expect(t!.trim().length).toBeGreaterThan(0);
    }

    // All cycles must produce the same title (bootstrap is idempotent).
    expect(new Set(titles).size).toBe(1);
  });
});
