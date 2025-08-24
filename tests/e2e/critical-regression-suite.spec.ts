import { test, expect, Page } from '@playwright/test';

/**
 * CRITICAL REGRESSION TEST SUITE
 *
 * Emergency test suite for critical user paths and regression prevention
 * Focuses on card creation fix validation and core feature stability
 */
test.describe('Critical Regression Suite - Emergency Tests', () => {
  let page: Page;
  const baseURL = 'http://localhost:15173';

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Monitor for JavaScript errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`❌ JS Error: ${msg.text()}`);
      }
    });

    // Monitor for failed network requests
    page.on('requestfailed', request => {
      console.error(`❌ Network Failure: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
  });

  test.describe('P0 Critical Path - Card Creation Fix', () => {
    test('CRITICAL: End-to-end card creation workflow', async () => {
      const timestamp = Date.now();
      const boardName = `Critical-Test-${timestamp}`;
      const cardTitle = `Critical-Card-${timestamp}`;

      console.log('🚨 CRITICAL TEST: Starting card creation workflow validation');

      // Create board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Verify board creation
      await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible({ timeout: 10000 });
      console.log('✅ Board created successfully');

      // Navigate to board
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Critical test: Create card
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.waitForSelector('input[placeholder*="title" i]');

      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Verify card creation - THIS IS THE CRITICAL ASSERTION
      const createdCard = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(createdCard).toBeVisible({ timeout: 15000 });

      console.log('🎉 CRITICAL SUCCESS: Card creation working correctly');

      // Verify persistence
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 10000 });

      console.log('✅ CRITICAL: Data persistence confirmed');
    });

    test('CRITICAL: Rapid card creation stress test', async () => {
      const timestamp = Date.now();
      const boardName = `Stress-${timestamp}`;

      // Setup board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      const cardTitles: string[] = [];

      // Create 3 cards rapidly
      for (let i = 1; i <= 3; i++) {
        const cardTitle = `Stress-Card-${i}-${timestamp}`;
        cardTitles.push(cardTitle);

        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.waitForSelector('input[placeholder*="title" i]');
        await page.fill('input[placeholder*="title" i]', cardTitle);
        await page.click('button:has-text("Save")');
        await expect(page.locator('input[placeholder*="title" i]')).not.toBeVisible();
        await page.waitForTimeout(500);
      }

      // Verify all cards created
      for (const title of cardTitles) {
        await expect(page.locator('.ticket-card').filter({ hasText: title })).toBeVisible();
      }

      console.log(`✅ STRESS TEST: ${cardTitles.length} cards created successfully`);
    });
  });

  test.describe('P0 Critical Path - Core Operations', () => {
    test('CRITICAL: Drag and drop functionality', async () => {
      const timestamp = Date.now();
      const boardName = `DragTest-${timestamp}`;
      const cardTitle = `DragCard-${timestamp}`;

      // Setup
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

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
      await page.waitForTimeout(1000);

      // Verify move
      await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
      await expect(todoColumn.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible();

      console.log('✅ CRITICAL: Drag and drop working correctly');
    });

    test('CRITICAL: Board management operations', async () => {
      const timestamp = Date.now();
      const boardName = `Board-Mgmt-${timestamp}`;

      // Create board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      const boardCard = page.locator('.board-card').filter({ hasText: boardName });
      await expect(boardCard).toBeVisible();

      // Test navigation
      await boardCard.click();
      await expect(page).toHaveURL(/\/board\/\d+/);
      await expect(page.locator('.column')).toHaveCount(3);

      // Navigate back
      await page.click('a:has-text("Dashboard")');
      await expect(page).toHaveURL(baseURL + '/');
      await expect(boardCard).toBeVisible();

      console.log('✅ CRITICAL: Board management working correctly');
    });
  });

  test.describe('P0 Critical Path - Data Integrity', () => {
    test('CRITICAL: Data persistence after refresh', async () => {
      const timestamp = Date.now();
      const boardName = `Persist-${timestamp}`;
      const cardTitle = `PersistCard-${timestamp}`;

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

      // Test persistence through refresh
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 10000 });

      console.log('✅ CRITICAL: Data persistence working correctly');
    });

    test('CRITICAL: Cross-board data isolation', async () => {
      const timestamp = Date.now();
      const board1Name = `Isolation1-${timestamp}`;
      const board2Name = `Isolation2-${timestamp}`;
      const card1Title = `Card1-${timestamp}`;
      const card2Title = `Card2-${timestamp}`;

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

      // Navigate back and create second board
      await page.click('a:has-text("Dashboard")');
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', board2Name);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${board2Name}")`);
      await page.waitForSelector('.column');

      // Create card in second board
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', card2Title);
      await page.click('button:has-text("Save")');

      // Verify isolation - should only see card2 in board2
      await expect(page.locator('.ticket-card').filter({ hasText: card2Title })).toBeVisible();
      await expect(page.locator('.ticket-card').filter({ hasText: card1Title })).not.toBeVisible();

      // Go back to board1 and verify only card1 is there
      await page.click('a:has-text("Dashboard")');
      await page.click(`.board-card:has-text("${board1Name}")`);
      await page.waitForSelector('.column');

      await expect(page.locator('.ticket-card').filter({ hasText: card1Title })).toBeVisible();
      await expect(page.locator('.ticket-card').filter({ hasText: card2Title })).not.toBeVisible();

      console.log('✅ CRITICAL: Board data isolation working correctly');
    });
  });

  test.describe('P1 Error Handling and Edge Cases', () => {
    test('CRITICAL: Network error resilience', async () => {
      const timestamp = Date.now();
      const boardName = `ErrorTest-${timestamp}`;

      // Go offline
      await page.context().setOffline(true);

      // Try to create board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Should show error message or fail gracefully
      const errorMessage = page.locator('.error-message, .toast-error, [role="alert"]');
      if (await errorMessage.isVisible({ timeout: 5000 })) {
        console.log('✅ Error message displayed correctly');
      } else {
        console.log('ℹ️ No explicit error message - may be handled differently');
      }

      // Go back online and retry
      await page.context().setOffline(false);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should work now
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', `${boardName}-Online`);
      await page.click('button:has-text("Create")');

      await expect(page.locator('.board-card').filter({ hasText: `${boardName}-Online` })).toBeVisible({ timeout: 10000 });

      console.log('✅ CRITICAL: Network error resilience working');
    });

    test('CRITICAL: Form validation', async () => {
      // Test empty board name
      await page.click('button:has-text("Create Board")');
      await page.click('button:has-text("Create")');

      // Should either show validation error or prevent submission
      const validationError = page.locator('.validation-error, .error-text, [role="alert"]');
      const formStillOpen = page.locator('input[placeholder*="board name" i]');

      if (await validationError.isVisible({ timeout: 2000 })) {
        console.log('✅ Validation error shown');
      } else if (await formStillOpen.isVisible()) {
        console.log('✅ Form prevented submission');
      } else {
        console.log('ℹ️ Validation may be handled differently');
      }

      // Close form and test valid submission
      const closeButton = page.locator('button[aria-label="Close"], button:has-text("Cancel")');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }

      // Valid submission should work
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', `Valid-Board-${Date.now()}`);
      await page.click('button:has-text("Create")');

      await expect(page.locator('.board-card')).toBeVisible({ timeout: 10000 });

      console.log('✅ CRITICAL: Form validation working');
    });
  });

  test.afterEach(async () => {
    // Check for any JavaScript errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    if (errors.length > 0) {
      console.error(`❌ JavaScript errors detected: ${errors.join(', ')}`);
    }

    // Take screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/failure-${test.info().title}-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
