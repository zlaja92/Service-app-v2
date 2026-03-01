import { test, expect } from '@playwright/test';

/**
 * Home page tests require an authenticated session.
 * These tests verify the home page structure and navigation
 * assuming the user bypasses auth (e.g., via Firebase Emulator or mocked auth).
 *
 * For now, these tests verify what an unauthenticated user sees
 * (redirect to login) and serve as a template for when auth mocking is set up.
 */
test.describe('Home Page (unauthenticated)', () => {
  test('should redirect to login when accessing home', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe('Home Page UI structure', () => {
  // This test navigates through the login form to verify the structure is correct.
  // It won't actually log in without Firebase Emulator, but validates the form exists.
  test('login page has correct form structure for authentication', async ({ page }) => {
    await page.goto('/login');

    // Verify login form elements exist
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Email input
    const emailInput = page.locator('ion-input[formControlName="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Password input
    const passwordInput = page.locator('ion-input[formControlName="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Submit button
    const submitButton = page.locator('ion-button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('login page displays subtitle text', async ({ page }) => {
    await page.goto('/login');
    const subtitle = page.locator('.login-header p');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).not.toBeEmpty();
  });
});

test.describe('App-level checks', () => {
  test('should load the app without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors (e.g., Firebase network errors in test env)
    const criticalErrors = errors.filter(
      (e) => !e.includes('auth/network') && !e.includes('firebase')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/login');
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should be responsive - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto('/login');

    const loginContainer = page.locator('.login-container');
    await expect(loginContainer).toBeVisible();
  });

  test('should be responsive - tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/login');

    const loginContainer = page.locator('.login-container');
    await expect(loginContainer).toBeVisible();
  });
});
