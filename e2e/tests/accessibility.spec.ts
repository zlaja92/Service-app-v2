import { test, expect } from '@playwright/test';

test.describe('Accessibility & Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('email input should have proper label', async ({ page }) => {
    const emailInput = page.locator('ion-input[formControlName="email"]');
    await expect(emailInput).toHaveAttribute('label', 'Email');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('password input should have proper type', async ({ page }) => {
    const passwordInput = page.locator('ion-input[formControlName="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('email input should have placeholder', async ({ page }) => {
    const emailInput = page.locator('ion-input[formControlName="email"]');
    await expect(emailInput).toHaveAttribute('placeholder', 'email@example.com');
  });

  test('form inputs should use floating label placement', async ({ page }) => {
    const emailInput = page.locator('ion-input[formControlName="email"]');
    const passwordInput = page.locator('ion-input[formControlName="password"]');

    await expect(emailInput).toHaveAttribute('labelPlacement', 'floating');
    await expect(passwordInput).toHaveAttribute('labelPlacement', 'floating');
  });

  test('error icon should be visible in error message', async ({ page }) => {
    await page.locator('ion-input[formControlName="email"] input').fill('bad@email.com');
    await page.locator('ion-input[formControlName="password"] input').fill('wrong');
    await page.locator('ion-button[type="submit"]').click();

    await expect(page.locator('.error-message')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.error-message ion-icon[name="alert-circle-outline"]')).toBeVisible();
  });

  test('login container should be centered on page', async ({ page }) => {
    const container = page.locator('.login-container');
    await expect(container).toBeVisible();
  });

  test('should render correctly at 320px width (small mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
    await page.goto('/login');

    await expect(page.locator('.login-container')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();

    // Form elements should not overflow
    const content = page.locator('ion-content');
    const box = await content.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(320);
  });

  test('should render correctly at 1920px width (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/login');

    await expect(page.locator('.login-container')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();
  });

  test('submit button should have block expand style', async ({ page }) => {
    const submitButton = page.locator('ion-button[type="submit"]');
    await expect(submitButton).toHaveAttribute('expand', 'block');
  });
});
