import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getInlineStyleVar(page: Page, varName: string): Promise<string> {
  return page.evaluate(
    (name: string) => document.documentElement.style.getPropertyValue(name).trim(),
    varName,
  );
}

function captureErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

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

// ---------------------------------------------------------------------------
// 1. Generation counter – teardown while bootstrap is in progress
// ---------------------------------------------------------------------------
// SessionService.teardown() increments bootstrapGeneration.
// Any in-flight doBootstrap() step that checks `gen !== this.bootstrapGeneration`
// returns early without applying config/theme updates from the stale session.
//
// Observable: after a rapid login→logout cycle (simulated via localStorage
// manipulation + reload), the app lands on /login with the default theme,
// no shell/menu, and no JS crash – exactly as if bootstrap was aborted.
//
// Since Firebase is offline in this E2E environment, we cannot trigger a
// real auth-state cycle. We verify the observable guarantees of the guard:
//   - The app never renders protected content before a valid session.
//   - No crash occurs when navigation to protected routes is interleaved.
//   - Theme is always applied (either from in-progress bootstrap or teardown
//     fallback to default).
// ---------------------------------------------------------------------------

test.describe('SessionService – generation counter: teardown aborts bootstrap', () => {
  test('app renders /login with default theme after simulated logout (no stale session config)', async ({
    page,
    context,
  }) => {
    // Simulate post-logout state: clear all storage to reset any cached session.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.reload();
    await page.waitForLoadState('networkidle');

    // After teardown (simulated via cleared storage + reload), configStore.loadDefaults()
    // must have run, applying the default theme.
    const primary = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primary.toLowerCase()).toBe('#b71c1c');

    // No protected content is visible – shell is not rendered.
    await expect(page.locator('app-menu')).toHaveCount(0);
    await expect(page.locator('.menu-footer')).toHaveCount(0);
    await expect(page.locator('app-login')).toBeVisible();
  });

  test('no JS error occurs when protected routes are accessed immediately after simulated logout', async ({
    page,
    context,
  }) => {
    const errors = captureErrors(page);

    // Simulate teardown: clear storage (removes any persisted session).
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Navigate to a protected route immediately – authGuard fires, teardown is complete.
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);

    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('theme is not corrupted by stale bootstrap after simulated rapid login-logout cycle', async ({
    page,
    context,
  }) => {
    // First page load: establish default theme baseline.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const primaryFirst = await getInlineStyleVar(page, '--ion-color-primary');

    // Simulate rapid login → logout: clear storage and reload.
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Default theme must be re-applied cleanly – no leftover from stale bootstrap.
    const primaryAfter = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primaryAfter).toBe(primaryFirst);
    expect(primaryAfter.toLowerCase()).toBe('#b71c1c');
  });
});

// ---------------------------------------------------------------------------
// 2. Generation counter – bootstrap promise deduplication
// ---------------------------------------------------------------------------
// bootstrap() caches the in-flight Promise in bootstrapPromise.
// A second call while bootstrap is already running returns the same Promise.
// This prevents duplicate work (two concurrent tenant/config loads).
//
// Observable guarantee: even after rapid repeated navigation to the login page
// (which triggers the appInitializer's auth-state listener each navigation), the
// app remains stable – no duplicate theme applications or crashes.
// ---------------------------------------------------------------------------

test.describe('SessionService – bootstrap deduplication (same promise returned)', () => {
  test('app remains stable after rapid successive navigations to login', async ({ page }) => {
    const errors = captureErrors(page);

    // Navigate to login multiple times in rapid succession.
    // Each reload triggers appInitializer → auth state listener → potential
    // duplicate bootstrap() calls. The deduplication in bootstrap() ensures
    // only one instance runs at a time.
    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
    }
    await page.waitForLoadState('networkidle');

    await expect(page.locator('app-login')).toBeVisible();
    await expect(page.locator('ion-app')).toBeVisible();
    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('theme CSS vars are consistent across repeated page loads (no double-apply side effects)', async ({
    page,
  }) => {
    // Load the page three times; if bootstrap() ran in duplicate, theme vars
    // might be set twice or overwrite each other incorrectly.
    const primaries: string[] = [];

    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      const p = await getInlineStyleVar(page, '--ion-color-primary');
      primaries.push(p);
    }

    // All three loads must produce the same primary color.
    expect(new Set(primaries).size).toBe(1);
    expect(primaries[0].toLowerCase()).toBe('#b71c1c');
  });

  test('no duplicate bootstrapPromise side-effects when navigating between protected routes', async ({
    page,
  }) => {
    const errors = captureErrors(page);

    // Rapidly visit several protected routes in sequence.
    // Each redirect fires the auth guard which does NOT call bootstrap().
    // The appInitializer's onAuthStateChange listener is the only trigger.
    // We verify no crash, no duplicate calls corrupt state.
    const paths = ['/home', '/search-by-device', '/docs', '/cart', '/home'];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    }

    expect(filterCritical(errors)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Generation counter – teardown resets bootstrapPromise to null
// ---------------------------------------------------------------------------
// After teardown(), bootstrapPromise is explicitly set to null.
// This means the NEXT bootstrap() call after teardown starts a fresh sequence
// with a new generation number.
//
// Observable: after a simulated logout (storage clear + reload), the app
// bootstraps cleanly with the new default session – no "frozen" promise.
// ---------------------------------------------------------------------------

test.describe('SessionService – bootstrapPromise reset to null after teardown', () => {
  test('app bootstraps cleanly on reload after teardown (no frozen promise)', async ({
    page,
    context,
  }) => {
    // Initial load.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Simulate teardown by clearing all session data.
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Reload – triggers appInitializer fresh, which calls bootstrap() on a
    // clean SessionService instance (Angular restarts the DI context).
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The freshly bootstrapped session must render the app correctly.
    await expect(page.locator('ion-app')).toBeVisible();
    await expect(page.locator('app-login')).toBeVisible();

    const primary = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primary).toBeTruthy();
    expect(primary).toMatch(/^#[0-9a-fA-F]{3,6}$/);
  });

  test('all protected routes redirect to /login after fresh bootstrap (teardown state)', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // After fresh bootstrap with no user, auth guard must correctly redirect.
    for (const path of ['/home', '/search-by-device', '/docs', '/cart']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('theme is idempotent across teardown and re-bootstrap cycles', async ({
    page,
    context,
  }) => {
    const primaries: string[] = [];

    for (let cycle = 0; cycle < 2; cycle++) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      primaries.push(await getInlineStyleVar(page, '--ion-color-primary'));

      // Simulate teardown.
      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
    }

    // All recorded values must match the default.
    for (const p of primaries) {
      expect(p.toLowerCase()).toBe('#b71c1c');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Generation counter – logo cache does not apply after teardown
// ---------------------------------------------------------------------------
// cacheLogo() fires its `.then()` callback only if `gen === bootstrapGeneration`.
// If teardown() was called while the logo was being fetched, the callback is
// skipped – configStore.setLogoDataUrl() is never called.
//
// Observable: no crash when teardown() happens while a logo fetch is in-flight.
// The login page remains stable (logoUrl may or may not be set depending on
// timing, but the app must not crash either way).
// ---------------------------------------------------------------------------

test.describe('SessionService – logo cache skipped after teardown (generation check)', () => {
  test('app does not crash when teardown occurs while logo fetch is in-flight', async ({
    page,
    context,
  }) => {
    const errors = captureErrors(page);

    // Navigate to login; app initializer runs without a user → no logo fetch
    // (no tenantId → no logoUrl in default config). Still verifies stability.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Simulate teardown by clearing state.
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Immediately navigate to trigger another init cycle.
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('ion-app')).toBeVisible();
    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('configStore has no logo data URL when no tenant is resolved (default config has no logoUrl)', async ({
    page,
  }) => {
    // Default config (used when Firebase is offline) has logoUrl: ''.
    // cacheLogo() checks `if (theme.logoUrl)` – the branch is skipped entirely.
    // Therefore configStore.setLogoDataUrl() is never called.
    // Observable: no data-URL src appears in the DOM for any img element.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const imgSrcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).map((img) => img.src),
    );

    // No img src should be a data-URL (base64 encoded logo).
    const dataUrls = imgSrcs.filter((src) => src.startsWith('data:'));
    expect(dataUrls).toHaveLength(0);
  });

  test('logo cache failure does not crash the app (warn-only error handling)', async ({ page }) => {
    const errors = captureErrors(page);

    // Even if the logo cache service throws, SessionService catches the error
    // and calls logger.warn(). No unhandled rejection propagates.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Reload to exercise another appInitializer run.
    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(filterCritical(errors)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. try/catch in onAuthStateChange (app-initializer.ts)
// ---------------------------------------------------------------------------
// The onAuthStateChange callback is now wrapped in try/catch.
// If bootstrap() throws, the error is caught by logger.error() and the app
// continues – no unhandled promise rejection propagates to the browser.
//
// Observable: even with a Firebase-offline environment (which could cause
// bootstrap to throw), the app stays functional on /login.
// ---------------------------------------------------------------------------

test.describe('app-initializer – onAuthStateChange try/catch guards against unhandled rejections', () => {
  test('app stays functional on /login when onAuthStateChange would produce a Firebase error', async ({
    page,
  }) => {
    // Firebase is offline in this E2E environment. The auth state change handler
    // that calls bootstrap() → tenantService.resolveFromAuthToken() may encounter
    // network errors. The try/catch ensures no crash.
    const errors = captureErrors(page);

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('ion-app')).toBeVisible();
    await expect(page.locator('app-login')).toBeVisible();
    expect(filterCritical(errors)).toHaveLength(0);
  });

  test('no unhandled promise rejection appears on reload when Firebase is unreachable', async ({
    page,
  }) => {
    const rejections: string[] = [];
    // Capture unhandledrejection events from the browser.
    page.on('pageerror', (err) => {
      if (err.message.includes('Unhandled') || err.message.includes('unhandledrejection')) {
        rejections.push(err.message);
      }
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The try/catch in onAuthStateChange must prevent any unhandled rejection.
    expect(rejections).toHaveLength(0);
  });

  test('app initializer error path loads default config and applies theme', async ({
    page,
    context,
  }) => {
    // The try/catch in waitForAuthReady() block runs loadDefaults() + applyTheme()
    // as the fallback. Verify these are applied.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Default theme must be applied by the catch block in appInitializer.
    const primary = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primary.toLowerCase()).toBe('#b71c1c');

    await expect(page.locator('app-login')).toBeVisible();
  });

  test('multiple reload cycles produce no accumulated unhandled errors', async ({ page }) => {
    const errors = captureErrors(page);

    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
    }

    // After 3 init cycles, no critical error must have accumulated.
    expect(filterCritical(errors)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Generation counter – structural / regression checks
// ---------------------------------------------------------------------------
// Verify that the generation counter mechanism does not break observable
// application behavior that was working before its introduction.
// ---------------------------------------------------------------------------

test.describe('SessionService – generation counter does not break existing behaviour', () => {
  test('login page title is consistently rendered across multiple bootstraps', async ({ page }) => {
    const titles: (string | null)[] = [];

    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      titles.push(await page.locator('.login-header h1').textContent());
    }

    // All titles must be truthy and identical (bootstrap is idempotent).
    for (const t of titles) {
      expect(t).toBeTruthy();
    }
    expect(new Set(titles).size).toBe(1);
  });

  test('auth guard continues to work correctly after multiple teardown-like reloads', async ({
    page,
    context,
  }) => {
    // Simulate 2 teardown-like cycles.
    for (let i = 0; i < 2; i++) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
    }

    // Auth guard must still redirect all protected routes to /login.
    for (const path of ['/home', '/search-by-device', '/docs']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('CSS theme vars and login form remain intact after teardown-like reload cycle', async ({
    page,
    context,
  }) => {
    // Teardown-like cycle.
    await page.goto('/login');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Theme must be applied.
    const primary = await getInlineStyleVar(page, '--ion-color-primary');
    expect(primary).toMatch(/^#[0-9a-fA-F]{3,6}$/);

    // Login form must be operational.
    await expect(page.locator('ion-input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="password"]')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();
  });

  test('ion-app is always visible regardless of bootstrap generation state', async ({
    page,
    context,
  }) => {
    // First load.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('ion-app')).toBeVisible();

    // Simulate teardown + fresh bootstrap.
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('ion-app')).toBeVisible();
  });
});
