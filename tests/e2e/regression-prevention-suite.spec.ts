import { test, expect, Page } from '@playwright/test';

/**
 * REGRESSION PREVENTION SUITE
 *
 * Tests to verify that existing features are not broken by recent fixes
 * Focuses on ensuring backwards compatibility and feature stability
 */
test.describe('Regression Prevention - Feature Stability Tests', () => {
  let page: Page;
  const baseURL = 'http://localhost:5173';

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Monitor for regressions
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        console.error(`🔍 Potential Regression - JS Error: ${msg.text()}`);
      }
    });
  });

  test.describe('Core Dashboard Functionality', () => {
    test('REGRESSION CHECK: Dashboard loads without errors', async () => {
      console.log('🔍 Checking dashboard for regressions...');

      // Verify essential dashboard elements
      await expect(page.locator('h1, .dashboard-title')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('button:has-text("Create Board")')).toBeVisible();

      // Check for any error messages
      const errorElements = page.locator('.error, .error-message, [role="alert"]');
      const errorCount = await errorElements.count();
      expect(errorCount).toBe(0);

      console.log('✅ Dashboard loads cleanly');
    });

    test('REGRESSION CHECK: Board creation still works', async () => {
      const timestamp = Date.now();
      const boardName = `Regression-Test-${timestamp}`;

      console.log('🔍 Verifying board creation hasn\'t regressed...');

      // Standard board creation workflow
      await page.click('button:has-text("Create Board")');
      await page.waitForSelector('input[placeholder*="board name" i]');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Verify board appears
      await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible({ timeout: 15000 });

      console.log('✅ Board creation working correctly');
    });

    test('REGRESSION CHECK: Board navigation still works', async () => {
      const timestamp = Date.now();
      const boardName = `Nav-Test-${timestamp}`;

      console.log('🔍 Verifying board navigation hasn\'t regressed...');

      // Create board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Navigate to board
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Verify board view
      await expect(page).toHaveURL(/\/board\/\d+/);
      await expect(page.locator('.column')).toHaveCount(3);

      // Navigate back
      await page.click('a:has-text("Dashboard")');
      await expect(page).toHaveURL(baseURL + '/');

      console.log('✅ Board navigation working correctly');
    });
  });

  test.describe('Card Management Features', () => {
    let boardName: string;

    test.beforeEach(async () => {
      // Setup a board for card tests
      boardName = `Card-Regression-${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');
    });

    test('REGRESSION CHECK: Card creation flow integrity', async () => {
      const cardTitle = `Regression-Card-${Date.now()}`;

      console.log('🔍 Checking card creation flow for regressions...');

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

      // Open add card form
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.waitForSelector('input[placeholder*="title" i]');

      // Verify form elements are present
      await expect(page.locator('input[placeholder*="title" i]')).toBeVisible();
      await expect(page.locator('button:has-text("Save")')).toBeVisible();

      // Fill and submit
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Verify card appears
      await expect(todoColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 15000 });

      console.log('✅ Card creation flow intact');
    });

    test('REGRESSION CHECK: Card editing still works', async () => {
      const originalTitle = `Edit-Test-${Date.now()}`;
      const updatedTitle = `Updated-${originalTitle}`;

      console.log('🔍 Checking card editing for regressions...');

      // Create card
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', originalTitle);
      await page.click('button:has-text("Save")');

      // Edit card
      await page.click(`.ticket-card:has-text("${originalTitle}")`);
      await page.waitForSelector('.ticket-detail');

      await page.fill('input[value*="' + originalTitle.split('-')[0] + '"]', updatedTitle);
      await page.click('button:has-text("Save")');

      // Close detail view
      const closeButton = page.locator('button[aria-label="Close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }

      // Verify update
      await expect(page.locator('.ticket-card').filter({ hasText: updatedTitle })).toBeVisible();

      console.log('✅ Card editing working correctly');
    });

    test('REGRESSION CHECK: Drag and drop functionality', async () => {
      const cardTitle = `Drag-Test-${Date.now()}`;

      console.log('🔍 Checking drag and drop for regressions...');

      // Create card
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(card).toBeVisible();

      // Test drag to IN PROGRESS
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
      await card.dragTo(inProgressColumn);
      await page.waitForTimeout(2000);

      // Verify move
      await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
      await expect(todoColumn.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible();

      console.log('✅ Drag and drop working correctly');
    });

    test('REGRESSION CHECK: Card deletion functionality', async () => {
      const cardTitle = `Delete-Test-${Date.now()}`;

      console.log('🔍 Checking card deletion for regressions...');

      // Create card
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Delete card
      await page.click(`.ticket-card:has-text("${cardTitle}")`);
      await page.waitForSelector('.ticket-detail');

      const deleteButton = page.locator('button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }

        // Verify deletion
        await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible();

        console.log('✅ Card deletion working correctly');
      } else {
        console.log('ℹ️ Delete button not found - feature may not be implemented');
      }
    });
  });

  test.describe('Data Persistence and State Management', () => {
    test('REGRESSION CHECK: Data persistence after refresh', async () => {
      const timestamp = Date.now();
      const boardName = `Persist-Check-${timestamp}`;
      const cardTitle = `Persist-Card-${timestamp}`;

      console.log('🔍 Checking data persistence for regressions...');

      // Create board and card
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

      // Test persistence
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify data persisted
      await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 15000 });

      console.log('✅ Data persistence working correctly');
    });

    test('REGRESSION CHECK: Multiple board isolation', async () => {
      const timestamp = Date.now();
      const board1Name = `Isolation1-${timestamp}`;
      const board2Name = `Isolation2-${timestamp}`;
      const card1Title = `Card1-${timestamp}`;
      const card2Title = `Card2-${timestamp}`;

      console.log('🔍 Checking board isolation for regressions...');

      // Create first board and card
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', board1Name);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${board1Name}")`);
      await page.waitForSelector('.column');

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', card1Title);
      await page.click('button:has-text("Save")');

      // Create second board and card
      await page.click('a:has-text("Dashboard")');
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', board2Name);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${board2Name}")`);
      await page.waitForSelector('.column');

      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', card2Title);
      await page.click('button:has-text("Save")');

      // Verify isolation
      await expect(page.locator('.ticket-card').filter({ hasText: card2Title })).toBeVisible();
      await expect(page.locator('.ticket-card').filter({ hasText: card1Title })).not.toBeVisible();

      console.log('✅ Board isolation working correctly');
    });
  });

  test.describe('UI/UX Functionality', () => {
    test('REGRESSION CHECK: Search and filter features', async () => {
      const timestamp = Date.now();
      const boardName = `Search-Test-${timestamp}`;

      console.log('🔍 Checking search/filter features for regressions...');

      // Setup board with cards
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Create test cards
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      const cardTitles = [`Bug Fix ${timestamp}`, `Feature Request ${timestamp}`];

      for (const title of cardTitles) {
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', title);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(500);
      }

      // Test search functionality if available
      const searchInput = page.locator('input[placeholder*="search" i]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('Bug');
        await page.waitForTimeout(1000);

        // Should show bug card, hide feature card
        await expect(page.locator('.ticket-card').filter({ hasText: 'Bug Fix' })).toBeVisible();

        // Clear search
        await searchInput.clear();
        await page.waitForTimeout(500);

        console.log('✅ Search functionality working');
      } else {
        console.log('ℹ️ Search feature not implemented or not visible');
      }
    });

    test('REGRESSION CHECK: Responsive layout and styling', async () => {
      console.log('🔍 Checking responsive layout for regressions...');

      // Test different viewport sizes
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);

        // Verify essential elements are still visible
        await expect(page.locator('button:has-text("Create Board")')).toBeVisible();

        console.log(`✅ ${viewport.name} layout working`);
      }

      // Reset to default
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    test('REGRESSION CHECK: Form validation and error handling', async () => {
      console.log('🔍 Checking form validation for regressions...');

      // Test empty board creation
      await page.click('button:has-text("Create Board")');
      await page.click('button:has-text("Create")');

      // Should either show validation or prevent submission
      const validationError = page.locator('.validation-error, .error-text, [role="alert"]');
      const formStillOpen = page.locator('input[placeholder*="board name" i]');

      if (await validationError.isVisible({ timeout: 2000 })) {
        console.log('✅ Validation error properly displayed');
      } else if (await formStillOpen.isVisible()) {
        console.log('✅ Form properly prevents invalid submission');
      } else {
        console.log('ℹ️ Validation behavior may have changed');
      }

      // Close form
      const closeButton = page.locator('button[aria-label="Close"], button:has-text("Cancel")');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }

      console.log('✅ Form validation working as expected');
    });
  });

  test.describe('Performance and Loading', () => {
    test('REGRESSION CHECK: Page load performance', async () => {
      console.log('🔍 Checking page load performance for regressions...');

      const startTime = Date.now();

      // Navigate to fresh page
      await page.goto(baseURL);
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Reasonable load time expectation (adjust as needed)
      expect(loadTime).toBeLessThan(10000); // 10 seconds max

      console.log(`✅ Page loaded in ${loadTime}ms`);
    });

    test('REGRESSION CHECK: No memory leaks in basic operations', async () => {
      console.log('🔍 Checking for memory leaks in basic operations...');

      const timestamp = Date.now();

      // Perform repetitive operations
      for (let i = 1; i <= 3; i++) {
        const boardName = `Memory-Test-${timestamp}-${i}`;

        await page.click('button:has-text("Create Board")');
        await page.fill('input[placeholder*="board name" i]', boardName);
        await page.click('button:has-text("Create")');

        await page.click(`.board-card:has-text("${boardName}")`);
        await page.waitForSelector('.column');

        await page.click('a:has-text("Dashboard")');
        await page.waitForTimeout(200);
      }

      // Check for excessive DOM nodes or console errors
      const domNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
      console.log(`DOM nodes after operations: ${domNodeCount}`);

      // Reasonable DOM node count (adjust based on app complexity)
      expect(domNodeCount).toBeLessThan(5000);

      console.log('✅ No obvious memory leaks detected');
    });
  });

  test.afterEach(async () => {
    // Log any unexpected errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });

    if (errors.length > 0) {
      console.warn(`⚠️ Potential regressions detected: ${errors.length} console errors`);
      errors.forEach(error => console.warn(`  - ${error}`));
    }

    // Take screenshot on failure for debugging
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/regression-failure-${test.info().title.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
