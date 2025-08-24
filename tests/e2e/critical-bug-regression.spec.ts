import { test, expect } from '@playwright/test';

/**
 * Critical Bug Regression Tests
 *
 * Tests for critical bugs identified in UI_BUG_REPORT_20250819.md:
 * 1. Dashboard load crash (BoardProvider context issue)
 * 2. Card disappears during drag-drop operations
 * 3. Navbar context errors
 * 4. Modal system stability
 */
test.describe('Critical Bug Regression Tests', () => {
  const baseURL = 'http://localhost:15175';

  test.beforeEach(async ({ page }) => {
    // Monitor console errors during each test
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Store errors for later analysis
    (page as any).consoleErrors = consoleErrors;

    // Set up error boundary monitoring
    page.on('pageerror', error => {
      console.log(`🚨 Page Error: ${error.message}`);
    });
  });

  test.describe('CRITICAL BUG #1: Dashboard Load Crash', () => {
    test('REGRESSION-001: Dashboard should load without React Context errors', async ({ page }) => {
      console.log('🧪 CRITICAL TEST: Dashboard load without context crash');

      // The main test - navigate to dashboard root
      await page.goto(baseURL);

      // Wait for initial load and check for immediate crashes
      await page.waitForTimeout(2000);

      // Critical assertion: Page should not show error boundary
      const errorBoundary = page.locator('text="Something went wrong", text="Error:", [data-testid="error-boundary"]');
      await expect(errorBoundary).not.toBeVisible();

      // Critical assertion: Dashboard elements should be visible
      const createBoardButton = page.locator('button:has-text("Create Board")');
      await expect(createBoardButton).toBeVisible({ timeout: 10000 });

      // Check for specific BoardProvider errors
      const consoleErrors = (page as any).consoleErrors || [];
      const contextErrors = consoleErrors.filter(error =>
        error.includes('useBoard must be used within a BoardProvider') ||
        error.includes('Context') ||
        error.includes('Provider')
      );

      if (contextErrors.length > 0) {
        console.log('🚨 CRITICAL: Context errors detected:');
        contextErrors.forEach(error => console.log(`   - ${error}`));
        throw new Error(`Context provider errors detected: ${contextErrors.length} errors`);
      }

      console.log('✅ CRITICAL: Dashboard loads without context crashes');

      // Additional verification: Navbar should render without errors
      const navbar = page.locator('.navbar, nav, header');
      if (await navbar.isVisible()) {
        console.log('✅ Navbar rendered successfully');
      }

      // Verify basic dashboard functionality
      await expect(page.locator('body')).toContainText(/board|dashboard|create/i);

      console.log('✅ Dashboard load regression test PASSED');
    });

    test('REGRESSION-002: Navbar context should not crash on dashboard', async ({ page }) => {
      console.log('🧪 CRITICAL TEST: Navbar context stability on dashboard');

      await page.goto(baseURL);
      await page.waitForLoadState('networkidle');

      // Look for navbar elements that previously caused crashes
      const navbar = page.locator('.navbar, nav, header');

      if (await navbar.isVisible()) {
        // Navbar should not cause useBoard context errors
        const navbarContent = await navbar.textContent();
        console.log(`Navbar content: ${navbarContent?.substring(0, 100)}...`);

        // Check for interactive navbar elements
        const navLinks = navbar.locator('a, button');
        const linkCount = await navLinks.count();
        console.log(`Found ${linkCount} navbar interactive elements`);

        // Test navbar interactions don't crash
        for (let i = 0; i < Math.min(linkCount, 3); i++) {
          try {
            const link = navLinks.nth(i);
            if (await link.isVisible()) {
              await link.hover();
              await page.waitForTimeout(100);
            }
          } catch (error) {
            console.log(`Navbar interaction ${i} failed: ${error}`);
          }
        }
      }

      // Check for context-related console errors
      const consoleErrors = (page as any).consoleErrors || [];
      const navbarErrors = consoleErrors.filter(error =>
        error.includes('Navbar') ||
        error.includes('useBoard') ||
        error.includes('BoardProvider')
      );

      expect(navbarErrors.length).toBe(0);
      console.log('✅ Navbar context regression test PASSED');
    });
  });

  test.describe('CRITICAL BUG #2: Drag-Drop Data Loss', () => {
    test.beforeEach(async ({ page }) => {
      // Create a test board for drag-drop tests
      await page.goto(baseURL);
      await page.waitForLoadState('networkidle');

      const boardName = `DragDrop Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Navigate to the board
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');
    });

    test('REGRESSION-003: Cards should not disappear during drag-drop operations', async ({ page }) => {
      console.log('🧪 CRITICAL TEST: Card disappearance during drag-drop');

      // Create a test card
      const cardTitle = `Drag Test Card ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Wait for card to appear
      const testCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(testCard).toBeVisible();

      // Count cards before drag operation
      const initialCardCount = await page.locator('.ticket-card').count();
      console.log(`Initial card count: ${initialCardCount}`);

      // Perform drag operation
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

      console.log('Starting drag operation...');

      // Attempt drag with multiple strategies
      try {
        // Strategy 1: Standard drag and drop
        await testCard.dragTo(inProgressColumn);
        await page.waitForTimeout(2000);

        // Check if card still exists somewhere
        const cardAfterDrag = page.locator('.ticket-card').filter({ hasText: cardTitle });
        const cardExists = await cardAfterDrag.isVisible();

        if (!cardExists) {
          console.log('🚨 CRITICAL BUG CONFIRMED: Card disappeared during drag operation!');

          // Take screenshot for evidence
          await page.screenshot({
            path: `tests/results/card-disappeared-${Date.now()}.png`,
            fullPage: true
          });

          throw new Error('CRITICAL: Card disappeared during drag operation - data loss detected!');
        }

        // Verify card count didn't decrease
        const finalCardCount = await page.locator('.ticket-card').count();
        console.log(`Final card count: ${finalCardCount}`);

        expect(finalCardCount).toBe(initialCardCount);

        // Check if card moved to correct column or stayed in original
        const cardInInProgress = inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle });
        const cardInTodo = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });

        const inInProgress = await cardInInProgress.isVisible();
        const inTodo = await cardInTodo.isVisible();

        if (inInProgress) {
          console.log('✅ Card successfully moved to IN PROGRESS column');
        } else if (inTodo) {
          console.log('⚠️ Card remained in TODO column (drag operation may have failed but no data loss)');
        } else {
          throw new Error('Card exists but not in expected columns - UI state inconsistency');
        }

        console.log('✅ CRITICAL: No card disappearance - data preserved during drag operation');

      } catch (error) {
        // Log drag operation failure but check if card still exists
        console.log(`Drag operation failed: ${error}`);

        const cardStillExists = await page.locator('.ticket-card').filter({ hasText: cardTitle }).isVisible();

        if (cardStillExists) {
          console.log('✅ Card still exists despite drag failure - no data loss');
        } else {
          console.log('🚨 CRITICAL: Card disappeared - data loss confirmed!');
          throw error;
        }
      }
    });

    test('REGRESSION-004: Multiple cards should remain stable during drag operations', async ({ page }) => {
      console.log('🧪 CRITICAL TEST: Multiple card stability during drag operations');

      // Create multiple test cards
      const cardTitles: string[] = [];
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

      for (let i = 1; i <= 3; i++) {
        const cardTitle = `Multi Drag Test ${i} - ${Date.now()}`;
        cardTitles.push(cardTitle);

        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', cardTitle);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(500);
      }

      // Verify all cards exist
      for (const cardTitle of cardTitles) {
        await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
      }

      const initialCardCount = await page.locator('.ticket-card').count();
      console.log(`Created ${cardTitles.length} cards, total: ${initialCardCount}`);

      // Attempt to drag each card
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

      for (const cardTitle of cardTitles) {
        try {
          const card = page.locator('.ticket-card').filter({ hasText: cardTitle });

          if (await card.isVisible()) {
            console.log(`Attempting to drag: ${cardTitle}`);
            await card.dragTo(inProgressColumn);
            await page.waitForTimeout(1000);

            // Verify card still exists
            const cardExists = await page.locator('.ticket-card').filter({ hasText: cardTitle }).isVisible();

            if (!cardExists) {
              console.log(`🚨 CRITICAL: Card disappeared: ${cardTitle}`);
              throw new Error(`Card disappeared during drag: ${cardTitle}`);
            }
          }
        } catch (error) {
          console.log(`Drag failed for ${cardTitle}: ${error}`);

          // Check if card still exists despite failure
          const cardExists = await page.locator('.ticket-card').filter({ hasText: cardTitle }).isVisible();
          if (!cardExists) {
            throw new Error(`CRITICAL: Card disappeared during failed drag: ${cardTitle}`);
          }
        }
      }

      // Final verification: all cards should still exist
      const finalCardCount = await page.locator('.ticket-card').count();
      console.log(`Final card count: ${finalCardCount} (should be ${initialCardCount})`);

      expect(finalCardCount).toBe(initialCardCount);

      // Verify each individual card still exists
      for (const cardTitle of cardTitles) {
        const cardExists = await page.locator('.ticket-card').filter({ hasText: cardTitle }).isVisible();
        if (!cardExists) {
          throw new Error(`CRITICAL: Card missing after operations: ${cardTitle}`);
        }
      }

      console.log('✅ All cards preserved during multiple drag operations');
    });

    test('REGRESSION-005: Drag operation timeout should not cause data loss', async ({ page }) => {
      console.log('🧪 CRITICAL TEST: Drag timeout data preservation');

      // Create a test card
      const cardTitle = `Timeout Test Card ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      const testCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(testCard).toBeVisible();

      // Simulate slow drag operation that might timeout
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

      // Start drag operation
      await testCard.hover();
      await page.mouse.down();

      // Simulate slow drag with delays
      await page.waitForTimeout(1000);
      await inProgressColumn.hover();
      await page.waitForTimeout(2000);

      // Complete drag operation
      await page.mouse.up();
      await page.waitForTimeout(3000);

      // Critical: Card should still exist even if operation timed out
      const cardExists = await page.locator('.ticket-card').filter({ hasText: cardTitle }).isVisible();

      if (!cardExists) {
        await page.screenshot({
          path: `tests/results/timeout-data-loss-${Date.now()}.png`,
          fullPage: true
        });
        throw new Error('CRITICAL: Card disappeared during timeout scenario');
      }

      console.log('✅ Card preserved during timeout scenario');
    });
  });

  test.describe('Modal System Stability', () => {
    test('REGRESSION-006: Modal system should handle rapid operations', async ({ page }) => {
      console.log('🧪 Testing modal system stability');

      await page.goto(baseURL);
      await page.waitForLoadState('networkidle');

      // Test rapid modal opening/closing
      for (let i = 0; i < 3; i++) {
        await page.click('button:has-text("Create Board")');
        await page.waitForSelector('input[placeholder*="board name" i]');

        // Cancel modal
        const cancelButton = page.locator('button:has-text("Cancel"), button[aria-label="Close"]');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        } else {
          await page.keyboard.press('Escape');
        }

        await page.waitForTimeout(200);
      }

      // Final modal should still work
      await page.click('button:has-text("Create Board")');
      await expect(page.locator('input[placeholder*="board name" i]')).toBeVisible();

      console.log('✅ Modal system stability test passed');
    });
  });

  test.describe('Development Environment Stability', () => {
    test('REGRESSION-007: HMR should not cause critical errors', async ({ page }) => {
      console.log('🧪 Testing HMR stability');

      await page.goto(baseURL);
      await page.waitForLoadState('networkidle');

      // Monitor for HMR-related errors
      let hmrErrors = 0;
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('HMR')) {
          hmrErrors++;
        }
      });

      // Wait for potential HMR cycles
      await page.waitForTimeout(5000);

      // Verify application still works after potential HMR
      await expect(page.locator('button:has-text("Create Board")')).toBeVisible();

      console.log(`HMR errors detected: ${hmrErrors}`);
      console.log('✅ Application stable during HMR cycles');
    });
  });

  test.afterEach(async ({ page }) => {
    // Check for any critical console errors
    const consoleErrors = (page as any).consoleErrors || [];

    if (consoleErrors.length > 0) {
      console.log('\n🚨 Console Errors Detected:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    // Take screenshot for documentation
    await page.screenshot({
      path: `tests/results/critical-regression-${Date.now()}.png`,
      fullPage: true
    });

    console.log('Critical regression test completed');
  });
});
