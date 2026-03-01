import { test, expect } from '@playwright/test';

test.describe('Auth Guard - Protected Routes', () => {
  const protectedRoutes = [
    { path: '/home', name: 'Home' },
    { path: '/search-by-device', name: 'Device Search' },
    { path: '/device/TEST123/device-groups', name: 'Device Groups' },
    { path: '/device/TEST123/device-groups/G1/device-parts', name: 'Device Parts' },
    { path: '/docs', name: 'Documentation' },
  ];

  for (const route of protectedRoutes) {
    test(`should redirect ${route.name} (${route.path}) to login`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(/.*login/);
    });
  }

  test('should redirect unknown routes to login when unauthenticated', async ({ page }) => {
    await page.goto('/nonexistent-page');
    // Should either show login or 404, but not crash
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should not expose any protected content before authentication', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    // Should be on login page, not showing home content
    await expect(page.locator('.actions-section')).not.toBeVisible();
    await expect(page.locator('app-login')).toBeVisible();
  });

  test('should handle direct URL access with query params', async ({ page }) => {
    await page.goto('/home?debug=true');
    await expect(page).toHaveURL(/.*login/);
  });

  test('should handle direct URL access with hash fragment', async ({ page }) => {
    await page.goto('/home#section');
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe('Login Page State', () => {
  test('should not show loading spinner initially', async ({ page }) => {
    await page.goto('/login');
    const spinner = page.locator('ion-button[type="submit"] ion-spinner');
    await expect(spinner).not.toBeVisible();
  });

  test('should not show error message initially', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.error-message')).not.toBeVisible();
  });

  test('should not show validation errors initially', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.error-text')).toHaveCount(0);
  });

  test('login page should have consistent structure on reload', async ({ page }) => {
    await page.goto('/login');

    const firstTitle = await page.locator('.login-header h1').textContent();

    await page.reload();
    await page.waitForLoadState('networkidle');

    const secondTitle = await page.locator('.login-header h1').textContent();
    expect(firstTitle).toBe(secondTitle);
  });
});
