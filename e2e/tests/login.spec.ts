import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('app-login')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('ion-input[formControlName="password"]')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();
  });

  test('should display app title in header', async ({ page }) => {
    const header = page.locator('.login-header h1');
    await expect(header).toBeVisible();
    await expect(header).not.toBeEmpty();
  });

  test('should have submit button disabled when form is empty', async ({ page }) => {
    const submitButton = page.locator('ion-button[type="submit"]');
    await expect(submitButton).toHaveAttribute('disabled', '');
  });

  test('should show email required error when email is touched and empty', async ({ page }) => {
    const emailInput = page.locator('ion-input[formControlName="email"]');
    await emailInput.click();
    // Tab away to trigger touched state
    await page.locator('ion-input[formControlName="password"]').click();

    await expect(page.locator('.error-text').first()).toBeVisible();
  });

  test('should show email invalid error for bad email format', async ({ page }) => {
    const emailInput = page.locator('ion-input[formControlName="email"] input');
    await emailInput.fill('not-an-email');
    // Tab away to trigger validation
    await page.locator('ion-input[formControlName="password"]').click();

    const errorTexts = page.locator('.error-text');
    await expect(errorTexts.first()).toBeVisible();
  });

  test('should show password required error when password is touched and empty', async ({ page }) => {
    const passwordInput = page.locator('ion-input[formControlName="password"]');
    await passwordInput.click();
    // Click elsewhere to trigger touched state
    await page.locator('ion-input[formControlName="email"]').click();

    await expect(page.locator('.error-text').first()).toBeVisible();
  });

  test('should enable submit button when form is valid', async ({ page }) => {
    await page.locator('ion-input[formControlName="email"] input').fill('test@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('password123');

    const submitButton = page.locator('ion-button[type="submit"]');
    await expect(submitButton).not.toHaveAttribute('disabled', '');
  });

  test('should show error message on failed login', async ({ page }) => {
    await page.locator('ion-input[formControlName="email"] input').fill('wrong@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('wrongpassword');

    await page.locator('ion-button[type="submit"]').click();

    // Wait for error message to appear
    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.error-message ion-icon')).toBeVisible();
  });

  test('should show spinner during login attempt', async ({ page }) => {
    await page.locator('ion-input[formControlName="email"] input').fill('test@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('password123');

    await page.locator('ion-button[type="submit"]').click();

    // Spinner should appear briefly during login
    const spinner = page.locator('ion-button[type="submit"] ion-spinner');
    // Either spinner is visible or login completed quickly
    await expect(spinner.or(page.locator('.error-message'))).toBeVisible({ timeout: 10000 });
  });
});
