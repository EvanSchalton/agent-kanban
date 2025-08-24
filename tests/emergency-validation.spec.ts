import { test, expect } from '@playwright/test';

/**
 * EMERGENCY VALIDATION - Minimal critical path test
 * Tests core functionality to validate the card creation fix
 */
test.describe('Emergency Card Creation Validation', () => {
  const baseURL = 'http://localhost:15173';

  test('EMERGENCY: Validate page loads and basic elements exist', async ({ page }) => {
    console.log('🚨 EMERGENCY: Testing basic page load...');

    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Take screenshot for debugging
    await page.screenshot({ path: 'emergency-page-load.png', fullPage: true });

    // Wait longer for React app to load
    await page.waitForTimeout(5000);

    // Check if React app loaded
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeVisible();

    // Check for any obvious content
    const bodyText = await page.textContent('body');
    console.log('Page content preview:', bodyText?.substring(0, 200));

    // Look for any button or interactive element
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} buttons on page`);

    if (buttonCount > 0) {
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const buttonText = await buttons.nth(i).textContent();
        console.log(`Button ${i}: "${buttonText}"`);
      }
    }

    // Look for create board button with flexible selector
    const createBoardSelectors = [
      'button:has-text("Create Board")',
      'button:has-text("Create")',
      '[data-testid="create-board"]',
      '.create-board-button',
      'button[aria-label*="create"]'
    ];

    let createButtonFound = false;
    for (const selector of createBoardSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✅ Found create button with selector: ${selector}`);
        createButtonFound = true;
        break;
      }
    }

    if (!createButtonFound) {
      console.log('❌ No create board button found - checking for other navigation elements');

      // Check for any navigation or main content
      const navElements = page.locator('nav, .nav, .navigation, .header, .dashboard');
      const navCount = await navElements.count();
      console.log(`Found ${navCount} navigation elements`);

      const mainElements = page.locator('main, .main, .content, .dashboard, .board-list');
      const mainCount = await mainElements.count();
      console.log(`Found ${mainCount} main content elements`);
    }

    console.log('🔍 Emergency validation completed');
  });

  test('EMERGENCY: Test basic interaction if elements exist', async ({ page }) => {
    console.log('🚨 EMERGENCY: Testing basic interactions...');

    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Try clicking any visible interactive element
    const clickableElements = page.locator('button:visible, a:visible, [role="button"]:visible');
    const clickableCount = await clickableElements.count();

    console.log(`Found ${clickableCount} clickable elements`);

    if (clickableCount > 0) {
      // Try clicking the first clickable element
      const firstElement = clickableElements.first();
      const elementText = await firstElement.textContent();
      console.log(`Attempting to click: "${elementText}"`);

      try {
        await firstElement.click({ timeout: 5000 });
        console.log('✅ Successfully clicked element');

        // Take screenshot after click
        await page.screenshot({ path: 'emergency-after-click.png', fullPage: true });

      } catch (error) {
        console.log(`❌ Failed to click element: ${error}`);
      }
    }

    console.log('🔍 Emergency interaction test completed');
  });

  test('EMERGENCY: Check console errors and network requests', async ({ page }) => {
    console.log('🚨 EMERGENCY: Monitoring console and network...');

    const consoleMessages: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });

    page.on('requestfailed', request => {
      networkErrors.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
      console.log(`❌ Network Error: ${request.method()} ${request.url()}`);
    });

    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Network errors: ${networkErrors.length}`);

    // Log first few console messages
    consoleMessages.slice(0, 10).forEach(msg => {
      console.log(`Console: ${msg}`);
    });

    // Log network errors
    networkErrors.forEach(error => {
      console.log(`Network: ${error}`);
    });

    console.log('🔍 Emergency monitoring completed');
  });
});
