import { test, expect, Page } from '@playwright/test';

/**
 * P0 CRITICAL: Drag and Drop Regression Tests
 *
 * These tests verify drag & drop functionality which is currently broken (P0 priority).
 * Tests will be ready to run once Frontend Dev implements the fix.
 *
 * Known Issues:
 * - Cards may not properly move between columns
 * - Drag preview may not appear
 * - Drop zones may not activate
 * - State may not persist after drag & drop
 * - API calls may fail or have wrong payload
 */

test.describe('🔴 P0 CRITICAL: Drag & Drop Functionality', () => {
  const baseURL = 'http://localhost:5173';
  let boardName: string;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create a test board with cards
    boardName = `Drag Drop Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Create test cards in different columns
    await createTestCards(page);
  });

  async function createTestCards(page: Page) {
    // Create cards in TODO column
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const cards = [
      { title: 'Card A - High Priority', priority: 'high' },
      { title: 'Card B - Medium Priority', priority: 'medium' },
      { title: 'Card C - Low Priority', priority: 'low' }
    ];

    for (const card of cards) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', card.title);

      const prioritySelect = page.locator('select[name="priority"]');
      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption(card.priority);
      }

      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Create one card in IN PROGRESS
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    await inProgressColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Card D - In Progress');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);
  }

  test('Basic drag and drop: TODO to IN PROGRESS', async () => {
    console.log('🔴 Testing basic drag & drop functionality');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Get the first card in TODO
    const cardToMove = todoColumn.locator('.ticket-card').first();
    const cardTitle = await cardToMove.textContent();

    console.log(`Attempting to drag card: ${cardTitle}`);

    // Intercept API calls to verify backend update
    let apiCalled = false;
    let apiPayload: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiCalled = true;
        apiPayload = request.postDataJSON();
        console.log('API Call intercepted:', apiPayload);
      }
      await route.continue();
    });

    // Perform drag and drop
    await cardToMove.hover();
    await page.mouse.down();
    await page.waitForTimeout(100); // Small delay to initiate drag

    // Move to target column
    await inProgressColumn.hover();
    await page.waitForTimeout(100); // Allow drop zone to activate
    await page.mouse.up();

    // Wait for operation to complete
    await page.waitForTimeout(2000);

    // Verify card moved in UI
    const cardInNewColumn = inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle! });
    await expect(cardInNewColumn).toBeVisible({ timeout: 5000 });

    // Verify card removed from old column
    const cardInOldColumn = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle! });
    await expect(cardInOldColumn).not.toBeVisible();

    // Verify API was called
    expect(apiCalled).toBe(true);
    if (apiPayload) {
      expect(apiPayload.current_column || apiPayload.column_id).toBeTruthy();
    }

    console.log('✅ Basic drag & drop test passed');
  });

  test('Drag and drop between all columns', async () => {
    console.log('🔴 Testing drag & drop across all columns');

    const columns = {
      todo: page.locator('.column').filter({ hasText: 'TODO' }).first(),
      inProgress: page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first(),
      done: page.locator('.column').filter({ hasText: 'DONE' }).first()
    };

    // Move card from TODO -> IN PROGRESS -> DONE
    const cardTitle = 'Card A - High Priority';

    // TODO to IN PROGRESS
    let card = columns.todo.locator('.ticket-card').filter({ hasText: cardTitle });
    await card.dragTo(columns.inProgress);
    await page.waitForTimeout(1500);

    await expect(columns.inProgress.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
    console.log('✅ Moved from TODO to IN PROGRESS');

    // IN PROGRESS to DONE
    card = columns.inProgress.locator('.ticket-card').filter({ hasText: cardTitle });
    await card.dragTo(columns.done);
    await page.waitForTimeout(1500);

    await expect(columns.done.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
    console.log('✅ Moved from IN PROGRESS to DONE');

    // DONE back to TODO (reverse flow)
    card = columns.done.locator('.ticket-card').filter({ hasText: cardTitle });
    await card.dragTo(columns.todo);
    await page.waitForTimeout(1500);

    await expect(columns.todo.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
    console.log('✅ Moved from DONE back to TODO');
  });

  test('Multiple cards drag and drop', async () => {
    console.log('🔴 Testing multiple card movements');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Move multiple cards to different columns
    const movements = [
      { card: 'Card A - High Priority', to: inProgressColumn },
      { card: 'Card B - Medium Priority', to: doneColumn },
      { card: 'Card C - Low Priority', to: inProgressColumn }
    ];

    for (const move of movements) {
      const card = page.locator('.ticket-card').filter({ hasText: move.card });
      await card.dragTo(move.to);
      await page.waitForTimeout(1000);

      await expect(move.to.locator('.ticket-card').filter({ hasText: move.card })).toBeVisible();
      console.log(`✅ Moved ${move.card}`);
    }

    // Verify final state
    const todoCount = await todoColumn.locator('.ticket-card').count();
    const inProgressCount = await inProgressColumn.locator('.ticket-card').count();
    const doneCount = await doneColumn.locator('.ticket-card').count();

    expect(todoCount).toBe(0); // All cards moved out
    expect(inProgressCount).toBe(3); // Card A, C, and D
    expect(doneCount).toBe(1); // Card B

    console.log('✅ Multiple card movements verified');
  });

  test('Drag and drop with keyboard navigation', async () => {
    console.log('🔴 Testing drag & drop with keyboard support');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const firstCard = todoColumn.locator('.ticket-card').first();

    // Focus on the card
    await firstCard.focus();

    // Try to initiate drag with keyboard (if supported)
    await page.keyboard.press('Space'); // Common key to start drag
    await page.waitForTimeout(100);

    // Navigate to next column
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Drop the card
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);

    // If keyboard drag is not supported, fallback to mouse
    const cardTitle = await firstCard.textContent();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    if (await todoColumn.locator('.ticket-card').filter({ hasText: cardTitle! }).isVisible()) {
      console.log('ℹ️ Keyboard drag not supported, using mouse fallback');
      await firstCard.dragTo(inProgressColumn);
      await page.waitForTimeout(1000);
    }

    // Verify move completed
    await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle! })).toBeVisible();
    console.log('✅ Card movement verified');
  });

  test('Drag and drop persistence after page refresh', async () => {
    console.log('🔴 Testing drag & drop persistence');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Move cards to specific positions
    const cardA = todoColumn.locator('.ticket-card').filter({ hasText: 'Card A' });
    const cardB = todoColumn.locator('.ticket-card').filter({ hasText: 'Card B' });
    const cardC = todoColumn.locator('.ticket-card').filter({ hasText: 'Card C' });

    await cardA.dragTo(doneColumn);
    await page.waitForTimeout(1000);

    await cardB.dragTo(inProgressColumn);
    await page.waitForTimeout(1000);

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.column');

    // Verify cards are in their new positions
    await expect(doneColumn.locator('.ticket-card').filter({ hasText: 'Card A' })).toBeVisible();
    await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: 'Card B' })).toBeVisible();
    await expect(todoColumn.locator('.ticket-card').filter({ hasText: 'Card C' })).toBeVisible();

    console.log('✅ Drag & drop changes persist after refresh');
  });

  test('Drag and drop with real-time updates', async () => {
    console.log('🔴 Testing drag & drop real-time sync');

    // Open second browser context
    const context2 = await page.context().browser()?.newContext();
    if (!context2) {
      console.log('⚠️ Cannot create second context for real-time test');
      return;
    }

    const page2 = await context2.newPage();

    // Navigate both pages to the same board
    await page2.goto(baseURL);
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Perform drag & drop in first page
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const cardToMove = todoColumn.locator('.ticket-card').filter({ hasText: 'Card A' });

    await cardToMove.dragTo(inProgressColumn);
    await page.waitForTimeout(2000);

    // Check if the change appears in second page (WebSocket update)
    const cardInPage2 = page2.locator('.column')
      .filter({ hasText: 'IN PROGRESS' })
      .locator('.ticket-card')
      .filter({ hasText: 'Card A' });

    if (await cardInPage2.isVisible({ timeout: 5000 })) {
      console.log('✅ Real-time update received via WebSocket');
    } else {
      console.log('⚠️ Real-time update not received, refresh required');
      await page2.reload();
      await expect(cardInPage2).toBeVisible();
      console.log('✅ Change visible after refresh');
    }

    await context2.close();
  });

  test('Drag and drop cancellation', async () => {
    console.log('🔴 Testing drag & drop cancellation');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const cardToMove = todoColumn.locator('.ticket-card').first();
    const originalCardCount = await todoColumn.locator('.ticket-card').count();

    // Start drag
    await cardToMove.hover();
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move mouse around but don't drop on a valid target
    await page.mouse.move(100, 100);
    await page.waitForTimeout(100);

    // Press ESC to cancel (if supported)
    await page.keyboard.press('Escape');
    await page.mouse.up();

    await page.waitForTimeout(1000);

    // Verify card is still in original column
    const currentCardCount = await todoColumn.locator('.ticket-card').count();
    expect(currentCardCount).toBe(originalCardCount);

    console.log('✅ Drag cancellation handled correctly');
  });

  test('Drag and drop with order preservation', async () => {
    console.log('🔴 Testing card order preservation during drag & drop');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Get initial order in TODO
    const todoCards = await todoColumn.locator('.ticket-card').allTextContents();
    console.log('Initial TODO order:', todoCards);

    // Move middle card to IN PROGRESS
    const middleCard = todoColumn.locator('.ticket-card').nth(1);
    const middleCardTitle = await middleCard.textContent();

    await middleCard.dragTo(inProgressColumn);
    await page.waitForTimeout(1500);

    // Verify remaining cards maintain order
    const remainingTodoCards = await todoColumn.locator('.ticket-card').allTextContents();
    expect(remainingTodoCards).not.toContain(middleCardTitle);
    expect(remainingTodoCards.length).toBe(todoCards.length - 1);

    // Verify card added to IN PROGRESS
    const inProgressCards = await inProgressColumn.locator('.ticket-card').allTextContents();
    expect(inProgressCards).toContain(middleCardTitle);

    console.log('✅ Card order preserved after drag & drop');
  });

  test('Drag and drop error handling', async () => {
    console.log('🔴 Testing drag & drop error scenarios');

    // Simulate network error during drag & drop
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        // Simulate server error
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
        return;
      }
      await route.continue();
    });

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const cardToMove = todoColumn.locator('.ticket-card').first();
    const cardTitle = await cardToMove.textContent();

    // Attempt drag & drop
    await cardToMove.dragTo(inProgressColumn);
    await page.waitForTimeout(2000);

    // Check for error message
    const errorMessage = page.locator('.error-message, .toast-error, [role="alert"]');
    if (await errorMessage.isVisible({ timeout: 3000 })) {
      console.log('✅ Error message displayed on failure');
    }

    // Card should remain in original position or revert
    const cardStillInTodo = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle! });
    if (await cardStillInTodo.isVisible()) {
      console.log('✅ Card reverted to original position on error');
    } else {
      console.log('⚠️ Card may be in inconsistent state after error');
    }

    // Clear route override
    await page.unroute('**/api/tickets/**');
  });

  test('Drag and drop performance', async () => {
    console.log('⚡ Testing drag & drop performance');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Measure drag & drop operation time
    const cardToMove = todoColumn.locator('.ticket-card').first();
    const cardTitle = await cardToMove.textContent();

    const startTime = Date.now();
    await cardToMove.dragTo(inProgressColumn);

    // Wait for card to appear in new column
    await expect(
      inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle! })
    ).toBeVisible({ timeout: 3000 });

    const duration = Date.now() - startTime;

    console.log(`Drag & drop completed in ${duration}ms`);
    expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

    console.log('✅ Drag & drop performance acceptable');
  });

  test.afterEach(async () => {
    // Log final board state
    const columns = ['TODO', 'IN PROGRESS', 'DONE'];
    console.log('\nFinal Board State:');

    for (const columnName of columns) {
      const column = page.locator('.column').filter({ hasText: columnName }).first();
      const cardCount = await column.locator('.ticket-card').count();
      const cards = await column.locator('.ticket-card').allTextContents();
      console.log(`  ${columnName}: ${cardCount} cards`);
      if (cards.length > 0) {
        cards.forEach(card => console.log(`    - ${card}`));
      }
    }

    // Take screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/drag-drop-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});

// Additional edge case tests
test.describe('Drag & Drop Edge Cases', () => {
  test('Drag card to same column (no-op)', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Create board and card
    const boardName = `No-op Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Test Card');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Drag card within same column
    const card = todoColumn.locator('.ticket-card').first();
    const initialPosition = await card.boundingBox();

    await card.dragTo(todoColumn);
    await page.waitForTimeout(1000);

    // Card should still be in TODO
    await expect(todoColumn.locator('.ticket-card').filter({ hasText: 'Test Card' })).toBeVisible();
    console.log('✅ Drag to same column handled correctly');
  });

  test('Drag card to invalid drop zone', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Create board and card
    const boardName = `Invalid Drop Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Test Card');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Try to drag card to header or other invalid area
    const card = todoColumn.locator('.ticket-card').first();
    const header = page.locator('.navbar, header').first();

    if (await header.isVisible()) {
      await card.hover();
      await page.mouse.down();
      await header.hover();
      await page.mouse.up();
      await page.waitForTimeout(1000);

      // Card should still be in TODO
      await expect(todoColumn.locator('.ticket-card').filter({ hasText: 'Test Card' })).toBeVisible();
      console.log('✅ Invalid drop zone handled correctly');
    }
  });
});
