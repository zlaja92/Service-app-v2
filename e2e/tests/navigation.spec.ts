import { test, expect } from '@playwright/test';

test.describe('Navigation & Auth Guard', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/home');
    // Auth guard should redirect to /login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should redirect root path to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*login/);
  });

  test('should redirect protected device-catalog route to login', async ({ page }) => {
    await page.goto('/search-by-device');
    await expect(page).toHaveURL(/.*login/);
  });

  test('should redirect protected docs route to login', async ({ page }) => {
    await page.goto('/docs');
    await expect(page).toHaveURL(/.*login/);
  });

  test('should stay on login page when navigating to /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('app-login')).toBeVisible();
  });

  test('should not show side menu on login page', async ({ page }) => {
    await page.goto('/login');
    const menu = page.locator('ion-menu');
    // Menu should be disabled on login page
    if (await menu.count() > 0) {
      await expect(menu).toHaveAttribute('disabled', 'true');
    }
  });
});
