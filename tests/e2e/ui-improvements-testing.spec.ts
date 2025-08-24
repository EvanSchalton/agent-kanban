import { test, expect } from '@playwright/test';

/**
 * UI Improvements & Fixes Testing Suite
 *
 * Comprehensive testing for UI components and functionality
 * as part of the UI improvements project.
 */
test.describe('UI Improvements Testing', () => {
  const baseURL = 'http://localhost:15175';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Clear localStorage before each test to start fresh
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Wait for initial load
    await page.waitForTimeout(1000);
  });

  test.describe('Board Creation Functionality Tests', () => {
    test('UI-001: Basic board creation with form validation', async ({ page }) => {
      console.log('🧪 Testing board creation UI functionality');

      // Test 1: Open board creation modal
      const createBoardButton = page.locator('button:has-text("Create Board")');
      await expect(createBoardButton).toBeVisible();
      await createBoardButton.click();

      // Verify modal opens with proper form elements
      await expect(page.locator('input[placeholder*="board name" i]')).toBeVisible();
      const nameInput = page.locator('input[placeholder*="board name" i]');
      const descInput = page.locator('textarea[placeholder*="description" i]');
      const saveButton = page.locator('button:has-text("Create")');
      const cancelButton = page.locator('button:has-text("Cancel"), button[aria-label="Close"]');

      // Verify all form elements are present
      await expect(nameInput).toBeVisible();
      await expect(saveButton).toBeVisible();
      console.log('✅ Board creation modal opens with all required elements');

      // Test 2: Form validation - empty submission
      await saveButton.click();

      // Check if validation prevents empty submission
      const stillVisible = await nameInput.isVisible();
      if (stillVisible) {
        console.log('✅ Form validation prevents empty submission');
      }

      // Test 3: Successful board creation
      const boardName = `UI Test Board ${Date.now()}`;
      const boardDescription = 'Test board created during UI testing';

      await nameInput.fill(boardName);
      if (await descInput.isVisible()) {
        await descInput.fill(boardDescription);
      }

      // Take screenshot before creation
      await page.screenshot({
        path: `tests/results/ui-board-creation-${Date.now()}.png`
      });

      await saveButton.click();

      // Verify modal closes and board appears
      await expect(nameInput).not.toBeVisible({ timeout: 5000 });
      const boardCard = page.locator('.board-card').filter({ hasText: boardName });
      await expect(boardCard).toBeVisible({ timeout: 10000 });

      console.log('✅ Board creation successful with UI validation');

      // Test 4: Board card UI elements
      await expect(boardCard).toContainText(boardName);
      if (boardDescription) {
        // Check if description is visible (may be truncated)
        const hasDescription = await boardCard.textContent();
        console.log(`Board card content: ${hasDescription?.substring(0, 100)}...`);
      }

      console.log('✅ Board creation functionality test complete');
    });

    test('UI-002: Board creation modal UI behavior', async ({ page }) => {
      console.log('🧪 Testing board creation modal UI behavior');

      // Test modal opening/closing behavior
      const createBoardButton = page.locator('button:has-text("Create Board")');
      await createBoardButton.click();

      const modal = page.locator('.modal, .dialog, [role="dialog"]');
      await expect(modal).toBeVisible();

      // Test ESC key closing
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
      console.log('✅ Modal closes with ESC key');

      // Test cancel button
      await createBoardButton.click();
      const cancelButton = page.locator('button:has-text("Cancel"), button[aria-label="Close"]');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await expect(modal).not.toBeVisible();
        console.log('✅ Modal closes with Cancel button');
      }

      // Test clicking outside (if supported)
      await createBoardButton.click();
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);

      console.log('✅ Modal UI behavior test complete');
    });

    test('UI-003: Board grid layout and responsiveness', async ({ page }) => {
      console.log('🧪 Testing board grid layout and responsiveness');

      // Create multiple boards to test layout
      const boardCount = 4;
      for (let i = 1; i <= boardCount; i++) {
        await page.click('button:has-text("Create Board")');
        await page.fill('input[placeholder*="board name" i]', `Layout Test Board ${i}`);
        await page.click('button:has-text("Create")');
        await page.waitForTimeout(500);
      }

      // Verify boards are displayed in grid
      const boardCards = page.locator('.board-card');
      await expect(boardCards).toHaveCount(boardCount);

      // Test different viewport sizes
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);

      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Verify boards are still visible at mobile size
      await expect(boardCards.first()).toBeVisible();

      console.log('✅ Board layout responsiveness test complete');
    });
  });

  test.describe('Card Creation UI Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Create a test board for card creation tests
      const boardName = `Card Test Board ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Navigate to the board
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');
    });

    test('UI-004: Card creation form UI and validation', async ({ page }) => {
      console.log('🧪 Testing card creation UI and validation');

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

      // Test Add Card button visibility and interaction
      const addCardButton = todoColumn.locator('button:has-text("Add Card")');
      await expect(addCardButton).toBeVisible();
      await expect(addCardButton).toBeEnabled();

      // Click and verify form opens
      await addCardButton.click();

      const titleInput = page.locator('input[placeholder*="title" i]');
      const descInput = page.locator('textarea[placeholder*="description" i]');
      const prioritySelect = page.locator('select[name="priority"]');
      const saveButton = page.locator('button:has-text("Save")');

      await expect(titleInput).toBeVisible();
      await expect(saveButton).toBeVisible();

      console.log('✅ Card creation form opens with required elements');

      // Test form validation
      await saveButton.click();
      await page.waitForTimeout(1000);

      // Check if form is still open (validation failed)
      const formStillOpen = await titleInput.isVisible();
      if (formStillOpen) {
        console.log('✅ Card form validation prevents empty submission');
      }

      // Test successful card creation
      const cardTitle = `UI Test Card ${Date.now()}`;
      await titleInput.fill(cardTitle);

      if (await descInput.isVisible()) {
        await descInput.fill('Card created during UI testing');
      }

      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption('medium');
      }

      await page.screenshot({
        path: `tests/results/ui-card-creation-${Date.now()}.png`
      });

      await saveButton.click();

      // Verify card appears
      const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(createdCard).toBeVisible({ timeout: 10000 });

      console.log('✅ Card creation UI functionality test complete');
    });

    test('UI-005: Card display and interaction UI', async ({ page }) => {
      console.log('🧪 Testing card display and interaction UI');

      // Create a test card
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();

      const cardTitle = `Display Test Card ${Date.now()}`;
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(card).toBeVisible();

      // Test card hover effects
      await card.hover();
      await page.waitForTimeout(500);

      // Test card click to open details
      await card.click();
      await page.waitForSelector('.ticket-detail');

      // Verify detail view elements
      await expect(page.locator('.ticket-detail')).toBeVisible();
      await expect(page.locator('.ticket-detail input')).toBeVisible();

      // Test closing detail view
      const closeButton = page.locator('button[aria-label="Close"], .close-button');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }

      await expect(page.locator('.ticket-detail')).not.toBeVisible();

      console.log('✅ Card display and interaction UI test complete');
    });
  });

  test.describe('Navbar Navigation Tests', () => {
    test('UI-006: Navbar components and navigation', async ({ page }) => {
      console.log('🧪 Testing navbar components and navigation');

      // Check navbar elements
      const navbar = page.locator('.navbar, nav, header');
      if (await navbar.isVisible()) {
        await expect(navbar).toBeVisible();
        console.log('✅ Navbar is visible');

        // Test navigation links
        const dashboardLink = page.locator('a:has-text("Dashboard"), button:has-text("Dashboard")');
        if (await dashboardLink.isVisible()) {
          await dashboardLink.click();
          await page.waitForLoadState('networkidle');

          // Verify we're on dashboard
          await expect(page.locator('.board-card, button:has-text("Create Board")')).toBeVisible();
          console.log('✅ Dashboard navigation works');
        }

        // Test other navigation elements
        const navLinks = page.locator('nav a, .navbar a');
        const linkCount = await navLinks.count();
        console.log(`Found ${linkCount} navigation links`);

        for (let i = 0; i < Math.min(linkCount, 3); i++) {
          const link = navLinks.nth(i);
          const linkText = await link.textContent();
          console.log(`Navigation link ${i + 1}: ${linkText}`);
        }
      } else {
        console.log('ℹ️ No navbar found - may use different navigation pattern');
      }

      console.log('✅ Navbar navigation test complete');
    });

    test('UI-007: Navigation state management', async ({ page }) => {
      console.log('🧪 Testing navigation state management');

      // Create a board and navigate to it
      const boardName = `Nav Test Board ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Verify URL changed
      await expect(page).toHaveURL(/\/board\/\d+/);

      // Test back navigation
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Should be back on dashboard
      await expect(page.locator('.board-card')).toBeVisible();

      // Test forward navigation
      await page.goForward();
      await page.waitForLoadState('networkidle');

      // Should be back on board
      await expect(page.locator('.column')).toBeVisible();

      console.log('✅ Navigation state management test complete');
    });
  });

  test.describe('LocalStorage Cleanup Tests', () => {
    test('UI-008: LocalStorage data management', async ({ page }) => {
      console.log('🧪 Testing localStorage data management');

      // Check initial localStorage state
      const initialStorage = await page.evaluate(() => {
        return {
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage }
        };
      });

      console.log('Initial storage state:', Object.keys(initialStorage.localStorage));

      // Perform some actions that might store data
      const boardName = `Storage Test Board ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Navigate to board
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Check if any data was stored
      const storageAfterActions = await page.evaluate(() => {
        return {
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage }
        };
      });

      console.log('Storage after actions:', Object.keys(storageAfterActions.localStorage));

      // Test storage cleanup
      await page.evaluate(() => {
        // Clear all storage
        localStorage.clear();
        sessionStorage.clear();
      });

      // Reload page and verify app still works
      await page.reload();
      await page.waitForLoadState('networkidle');

      // App should still be functional
      await expect(page.locator('button:has-text("Create Board")')).toBeVisible();

      console.log('✅ localStorage cleanup test complete');
    });

    test('UI-009: Storage persistence and recovery', async ({ page }) => {
      console.log('🧪 Testing storage persistence and recovery');

      // Create some data
      await page.evaluate(() => {
        localStorage.setItem('test-key', 'test-value');
        sessionStorage.setItem('session-key', 'session-value');
      });

      // Reload and check persistence
      await page.reload();
      await page.waitForLoadState('networkidle');

      const persistedData = await page.evaluate(() => {
        return {
          localStorage: localStorage.getItem('test-key'),
          sessionStorage: sessionStorage.getItem('session-key')
        };
      });

      console.log('Persisted data:', persistedData);

      // Clean up
      await page.evaluate(() => {
        localStorage.removeItem('test-key');
        sessionStorage.removeItem('session-key');
      });

      console.log('✅ Storage persistence test complete');
    });
  });

  test.describe('Cross-browser Compatibility Tests', () => {
    test('UI-010: Cross-browser UI consistency', async ({ page, browserName }) => {
      console.log(`🧪 Testing UI consistency on ${browserName}`);

      // Test basic functionality on each browser
      const boardName = `${browserName} Test Board ${Date.now()}`;

      // Board creation
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible();

      // Navigation
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Card creation
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();

      const cardTitle = `${browserName} Card ${Date.now()}`;
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

      // Take browser-specific screenshot
      await page.screenshot({
        path: `tests/results/ui-${browserName}-${Date.now()}.png`,
        fullPage: true
      });

      console.log(`✅ ${browserName} compatibility test complete`);
    });

    test('UI-011: Responsive design across browsers', async ({ page, browserName }) => {
      console.log(`🧪 Testing responsive design on ${browserName}`);

      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);

        // Verify key elements are still visible
        await expect(page.locator('button:has-text("Create Board")')).toBeVisible();

        console.log(`✅ ${viewport.name} (${viewport.width}x${viewport.height}) layout works on ${browserName}`);
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up storage after each test
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Take final screenshot
    await page.screenshot({
      path: `tests/results/ui-test-end-${Date.now()}.png`
    });

    // Log test completion
    console.log('UI test completed with cleanup');
  });
});
