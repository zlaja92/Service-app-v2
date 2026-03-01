import { test, expect } from '@playwright/test';

test.describe('Login Form Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('should submit form with Enter key', async ({ page }) => {
    await page.locator('ion-input[formControlName="email"] input').fill('test@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('password123');

    await page.locator('ion-input[formControlName="password"] input').press('Enter');

    // Should attempt login (spinner or error appears)
    const spinner = page.locator('ion-button[type="submit"] ion-spinner');
    const error = page.locator('.error-message');
    await expect(spinner.or(error)).toBeVisible({ timeout: 10000 });
  });

  test('should clear email input and re-disable submit', async ({ page }) => {
    const emailInput = page.locator('ion-input[formControlName="email"] input');
    const passwordInput = page.locator('ion-input[formControlName="password"] input');
    const submitButton = page.locator('ion-button[type="submit"]');

    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    await expect(submitButton).not.toHaveAttribute('disabled', '');

    await emailInput.fill('');
    await expect(submitButton).toHaveAttribute('disabled', '');
  });

  test('should show validation errors only after field is touched', async ({ page }) => {
    // Initially no error messages
    await expect(page.locator('.error-text')).toHaveCount(0);

    // Touch email and leave empty
    const emailInput = page.locator('ion-input[formControlName="email"]');
    await emailInput.click();
    await page.locator('ion-input[formControlName="password"]').click();

    // Now error should be visible
    await expect(page.locator('.error-text').first()).toBeVisible();
  });

  test('should show invalid email error then clear it on valid input', async ({ page }) => {
    const emailInput = page.locator('ion-input[formControlName="email"] input');

    await emailInput.fill('invalid');
    await page.locator('ion-input[formControlName="password"]').click();
    await expect(page.locator('.error-text').first()).toBeVisible();

    // Fix the email
    await emailInput.fill('valid@example.com');
    // Email errors should disappear (only password required might remain)
    const emailErrors = page.locator('.error-text');
    const count = await emailErrors.count();
    // At most 1 error (password required), not the email error
    expect(count).toBeLessThanOrEqual(1);
  });

  test('should handle rapid form submission attempts', async ({ page }) => {
    await page.locator('ion-input[formControlName="email"] input').fill('test@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('password123');

    const submitButton = page.locator('ion-button[type="submit"]');

    // Click multiple times rapidly
    await submitButton.click();
    await submitButton.click();
    await submitButton.click();

    // App should handle gracefully - no crash, eventually shows error or redirects
    await page.waitForTimeout(2000);
    await expect(page.locator('app-login')).toBeVisible();
  });

  test('should handle special characters in password', async ({ page }) => {
    await page.locator('ion-input[formControlName="email"] input').fill('test@example.com');
    await page.locator('ion-input[formControlName="password"] input').fill('p@$$w0rd!#%^&*()');

    const submitButton = page.locator('ion-button[type="submit"]');
    await expect(submitButton).not.toHaveAttribute('disabled', '');
  });

  test('should handle long email input', async ({ page }) => {
    const longEmail = 'a'.repeat(100) + '@example.com';
    await page.locator('ion-input[formControlName="email"] input').fill(longEmail);
    await page.locator('ion-input[formControlName="password"] input').fill('password');

    // Form should still be valid (email format is correct)
    const submitButton = page.locator('ion-button[type="submit"]');
    await expect(submitButton).not.toHaveAttribute('disabled', '');
  });

  test('should preserve email value after failed login attempt', async ({ page }) => {
    const email = 'keepme@example.com';
    const emailInput = page.locator('ion-input[formControlName="email"] input');

    await emailInput.fill(email);
    await page.locator('ion-input[formControlName="password"] input').fill('wrong');
    await page.locator('ion-button[type="submit"]').click();

    // Wait for error
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 10000 });

    // Email should still be there
    await expect(emailInput).toHaveValue(email);
  });
});
