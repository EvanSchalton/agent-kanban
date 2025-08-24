import { test, expect, Page } from '@playwright/test';

/**
 * CRITICAL P0 BUG TESTS - DATA LOSS DURING DRAG AND DROP
 * Cards are vanishing during drag-drop operations
 * Priority: CRITICAL - DATA LOSS
 */
test.describe('CRITICAL: Drag and Drop Data Loss Bug', () => {
  let page: Page;
  const baseURL = 'http://localhost:5173';

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create a test board
    const boardName = `DragDrop Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');
  });

  test('P0-BUG-001: Card should not vanish during drag from TODO to IN_PROGRESS', async () => {
    // Create a test card
    const cardTitle = `Critical Card ${Date.now()}`;
    const cardDescription = 'This card must not be lost';

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.fill('textarea[placeholder*="description" i]', cardDescription);
    await page.click('button:has-text("Save")');

    // Verify card exists in TODO
    const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(card).toBeVisible();

    // Get initial card count
    const initialCardCount = await page.locator('.ticket-card').count();
    console.log(`Initial card count: ${initialCardCount}`);

    // Perform drag operation
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

    // Log before drag
    console.log('Starting drag operation...');

    // Perform the drag with extra validation
    await card.hover();
    await page.mouse.down();
    await inProgressColumn.hover();
    await page.mouse.up();

    // Critical wait for DOM update
    await page.waitForTimeout(2000);

    // CRITICAL ASSERTION: Card must still exist somewhere
    const cardAfterDrag = page.locator('.ticket-card').filter({ hasText: cardTitle });
    const cardCountAfterDrag = await page.locator('.ticket-card').count();

    console.log(`Card count after drag: ${cardCountAfterDrag}`);

    // Card should exist
    await expect(cardAfterDrag).toBeVisible({ timeout: 5000 });

    // Total card count should remain the same
    expect(cardCountAfterDrag).toBe(initialCardCount);

    // Card should be in IN_PROGRESS column
    const cardInProgress = inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardInProgress).toBeVisible();

    // Card should NOT be in TODO column
    const cardInTodo = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardInTodo).not.toBeVisible();

    // Log if bug occurs
    if (cardCountAfterDrag < initialCardCount) {
      console.error('🔴 CRITICAL BUG CONFIRMED: Card vanished during drag operation!');
      console.error(`Expected ${initialCardCount} cards, found ${cardCountAfterDrag}`);
      console.error(`Missing card: "${cardTitle}"`);
    }
  });

  test('P0-BUG-002: Multiple cards should not lose data during rapid drag operations', async () => {
    const cards = [];

    // Create multiple cards
    for (let i = 1; i <= 3; i++) {
      const cardTitle = `Card ${i} - ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');
      cards.push(cardTitle);
      await page.waitForTimeout(500);
    }

    // Verify all cards exist
    for (const cardTitle of cards) {
      await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
    }

    const initialCount = await page.locator('.ticket-card').count();
    console.log(`Created ${initialCount} cards`);

    // Perform rapid drag operations
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' });

    // Move first card to IN_PROGRESS
    await page.locator('.ticket-card').filter({ hasText: cards[0] }).dragTo(inProgressColumn);
    await page.waitForTimeout(500);

    // Move second card to DONE
    await page.locator('.ticket-card').filter({ hasText: cards[1] }).dragTo(doneColumn);
    await page.waitForTimeout(500);

    // Move third card to IN_PROGRESS
    await page.locator('.ticket-card').filter({ hasText: cards[2] }).dragTo(inProgressColumn);
    await page.waitForTimeout(500);

    // CRITICAL: Verify no cards were lost
    const finalCount = await page.locator('.ticket-card').count();
    console.log(`Final card count: ${finalCount}`);

    expect(finalCount).toBe(initialCount);

    // Verify each card still exists
    for (const cardTitle of cards) {
      const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(card).toBeVisible({ timeout: 5000 });

      if (!(await card.isVisible())) {
        console.error(`🔴 CRITICAL: Card "${cardTitle}" vanished!`);
      }
    }
  });

  test('P0-BUG-003: Card data integrity during drag between all columns', async () => {
    const cardTitle = `Data Integrity ${Date.now()}`;
    const cardDescription = 'Important data that must persist';
    const cardPriority = 'high';

    // Create card with full data
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.fill('textarea[placeholder*="description" i]', cardDescription);

    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption(cardPriority);
    }

    await page.click('button:has-text("Save")');

    // Verify card creation
    const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(card).toBeVisible();

    // Move through all columns: TODO -> IN_PROGRESS -> DONE -> IN_PROGRESS -> TODO
    const moves = [
      { from: 'TODO', to: 'IN PROGRESS' },
      { from: 'IN PROGRESS', to: 'DONE' },
      { from: 'DONE', to: 'IN PROGRESS' },
      { from: 'IN PROGRESS', to: 'TODO' }
    ];

    for (const move of moves) {
      console.log(`Moving from ${move.from} to ${move.to}`);

      const fromColumn = page.locator('.column').filter({ hasText: move.from });
      const toColumn = page.locator('.column').filter({ hasText: move.to });

      // Verify card is in source column
      await expect(fromColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

      // Perform drag
      await fromColumn.locator('.ticket-card').filter({ hasText: cardTitle }).dragTo(toColumn);
      await page.waitForTimeout(1000);

      // Verify card moved to target column
      await expect(toColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

      // Verify card is NOT in source column
      await expect(fromColumn.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible();

      // Open card to verify data integrity
      await toColumn.locator('.ticket-card').filter({ hasText: cardTitle }).click();
      await page.waitForSelector('.ticket-detail');

      // Verify all data is intact
      await expect(page.locator('input').filter({ hasValue: cardTitle })).toBeVisible();
      await expect(page.locator('textarea')).toHaveValue(cardDescription);

      // Close detail view
      const closeButton = page.locator('button[aria-label="Close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }

      await page.waitForTimeout(500);
    }

    // Final verification - card should be back in TODO
    const finalCard = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(finalCard).toBeVisible();
  });

  test('P0-BUG-004: Drag operation should handle network latency without data loss', async () => {
    const cardTitle = `Network Test ${Date.now()}`;

    // Create card
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Simulate slow network
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      await route.continue();
    });

    // Perform drag with network delay
    const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

    await card.dragTo(inProgressColumn);

    // Wait for potential network request
    await page.waitForTimeout(3000);

    // Card should still exist
    await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 10000 });

    // Verify position
    await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
  });

  test('P0-BUG-005: Drag cancel should not cause data loss', async () => {
    const cardTitle = `Cancel Test ${Date.now()}`;

    // Create card
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(card).toBeVisible();

    // Start drag but cancel (drop outside valid zone)
    await card.hover();
    await page.mouse.down();

    // Move to invalid area (header or outside columns)
    await page.locator('header, .navbar').first().hover();
    await page.mouse.up();

    await page.waitForTimeout(1000);

    // Card should still exist in original column
    await expect(todoColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

    // Total card count should be unchanged
    const cardCount = await page.locator('.ticket-card').count();
    expect(cardCount).toBe(1);
  });

  test('P0-BUG-006: Verify drag-drop state persistence after page refresh', async () => {
    const cardTitle = `Persist Test ${Date.now()}`;

    // Create and move card
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Move to IN PROGRESS
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
    await page.locator('.ticket-card').filter({ hasText: cardTitle }).dragTo(inProgressColumn);

    await page.waitForTimeout(2000);

    // Verify card is in IN PROGRESS
    await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // CRITICAL: Card should still exist after refresh
    const cardAfterRefresh = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardAfterRefresh).toBeVisible({ timeout: 10000 });

    // Should still be in IN PROGRESS column
    const inProgressAfterRefresh = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
    await expect(inProgressAfterRefresh.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

    // Should NOT be in TODO
    const todoAfterRefresh = page.locator('.column').filter({ hasText: 'TODO' });
    await expect(todoAfterRefresh.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible();
  });

  test('P0-BUG-007: Concurrent drag operations should not cause data loss', async () => {
    // Create multiple cards
    const cards = [];
    for (let i = 1; i <= 5; i++) {
      const cardTitle = `Concurrent ${i} - ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');
      cards.push(cardTitle);
      await page.waitForTimeout(200);
    }

    const initialCount = await page.locator('.ticket-card').count();
    console.log(`Initial count: ${initialCount} cards`);

    // Simulate rapid/concurrent drags
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' });

    // Drag multiple cards quickly
    await page.locator('.ticket-card').filter({ hasText: cards[0] }).dragTo(inProgressColumn);
    await page.locator('.ticket-card').filter({ hasText: cards[1] }).dragTo(doneColumn);
    await page.locator('.ticket-card').filter({ hasText: cards[2] }).dragTo(inProgressColumn);
    await page.locator('.ticket-card').filter({ hasText: cards[3] }).dragTo(doneColumn);
    await page.locator('.ticket-card').filter({ hasText: cards[4] }).dragTo(inProgressColumn);

    // Wait for all operations to complete
    await page.waitForTimeout(3000);

    // CRITICAL: Verify no cards were lost
    const finalCount = await page.locator('.ticket-card').count();
    console.log(`Final count: ${finalCount} cards`);

    expect(finalCount).toBe(initialCount);

    // Verify each card still exists
    for (const cardTitle of cards) {
      const exists = await page.locator('.ticket-card').filter({ hasText: cardTitle }).isVisible();
      if (!exists) {
        console.error(`🔴 DATA LOSS: Card "${cardTitle}" vanished during concurrent operations!`);
      }
      await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
    }

    // Verify distribution
    const todoCount = await page.locator('.column').filter({ hasText: 'TODO' }).locator('.ticket-card').count();
    const inProgressCount = await page.locator('.column').filter({ hasText: 'IN PROGRESS' }).locator('.ticket-card').count();
    const doneCount = await page.locator('.column').filter({ hasText: 'DONE' }).locator('.ticket-card').count();

    console.log(`Distribution - TODO: ${todoCount}, IN PROGRESS: ${inProgressCount}, DONE: ${doneCount}`);
    expect(todoCount + inProgressCount + doneCount).toBe(initialCount);
  });

  test('P0-BUG-008: Edge case - Empty column drag target', async () => {
    // Create card in TODO
    const cardTitle = `Empty Column ${Date.now()}`;
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Ensure IN PROGRESS is empty
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
    const inProgressCards = await inProgressColumn.locator('.ticket-card').count();
    expect(inProgressCards).toBe(0);

    // Drag to empty column
    await page.locator('.ticket-card').filter({ hasText: cardTitle }).dragTo(inProgressColumn);
    await page.waitForTimeout(1000);

    // Card should exist in IN PROGRESS
    await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

    // Card should not be in TODO
    await expect(todoColumn.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible();

    // Total count should be 1
    const totalCards = await page.locator('.ticket-card').count();
    expect(totalCards).toBe(1);
  });

  test.afterEach(async () => {
    // Log final state for debugging
    const finalCardCount = await page.locator('.ticket-card').count();
    const columns = ['TODO', 'IN PROGRESS', 'DONE'];

    console.log('=== Test Complete - Final State ===');
    console.log(`Total cards: ${finalCardCount}`);

    for (const columnName of columns) {
      const column = page.locator('.column').filter({ hasText: columnName });
      const count = await column.locator('.ticket-card').count();
      console.log(`${columnName}: ${count} cards`);
    }
    console.log('===================================');
  });
});
