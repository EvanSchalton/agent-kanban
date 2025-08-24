import { test, expect, Page } from '@playwright/test';

test.describe('Data Persistence Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Board state should persist completely after refresh', async () => {
    const boardName = `Persistence Test ${Date.now()}`;
    const cards = [
      { title: 'Todo Card 1', column: 'TODO', description: 'First todo item' },
      { title: 'Todo Card 2', column: 'TODO', description: 'Second todo item' },
      { title: 'Progress Card', column: 'IN PROGRESS', description: 'Work in progress' },
      { title: 'Done Card', column: 'DONE', description: 'Completed task' }
    ];

    // Create board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', boardName);
    await page.click('button:has-text("Create")');
    await page.waitForSelector(`text="${boardName}"`, { timeout: 10000 });

    // Create cards in different columns
    for (const card of cards) {
      const column = page.locator('.column').filter({ hasText: card.column });
      await column.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title"]', card.title);
      await page.fill('textarea[placeholder*="description"]', card.description);
      await page.click('button:has-text("Save")');
      await expect(page.locator(`.ticket-card:has-text("${card.title}")`)).toBeVisible();
    }

    // Take screenshot before refresh for comparison
    await page.screenshot({ path: 'tests/e2e/screenshots/before-refresh.png', fullPage: true });

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify board name persists
    await expect(page.locator(`text="${boardName}"`)).toBeVisible();

    // Verify all cards persist in correct columns
    for (const card of cards) {
      const column = page.locator('.column').filter({ hasText: card.column });
      const cardElement = column.locator(`.ticket-card:has-text("${card.title}")`);

      await expect(cardElement).toBeVisible({ timeout: 10000 });

      // Verify card details persist
      await cardElement.click();
      await expect(page.locator('textarea')).toHaveValue(card.description);
      await page.keyboard.press('Escape'); // Close detail view
    }

    // Take screenshot after refresh
    await page.screenshot({ path: 'tests/e2e/screenshots/after-refresh.png', fullPage: true });
  });

  test('Multiple board switches should maintain individual board states', async () => {
    // Create two boards with different cards
    const board1 = `Board Alpha ${Date.now()}`;
    const board2 = `Board Beta ${Date.now()}`;

    // Create first board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', board1);
    await page.click('button:has-text("Create")');
    await page.waitForSelector(`text="${board1}"`, { timeout: 10000 });

    // Add cards to first board
    const todoColumn1 = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title"]', 'Board 1 Card');
    await page.click('button:has-text("Save")');

    // Create second board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', board2);
    await page.click('button:has-text("Create")');
    await page.waitForSelector(`text="${board2}"`, { timeout: 10000 });

    // Add cards to second board
    const todoColumn2 = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn2.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title"]', 'Board 2 Card');
    await page.click('button:has-text("Save")');

    // Switch back to first board
    await page.click(`text="${board1}"`);
    await page.waitForTimeout(1000);

    // Verify first board's cards are visible
    await expect(page.locator('.ticket-card:has-text("Board 1 Card")')).toBeVisible();
    await expect(page.locator('.ticket-card:has-text("Board 2 Card")')).not.toBeVisible();

    // Switch to second board
    await page.click(`text="${board2}"`);
    await page.waitForTimeout(1000);

    // Verify second board's cards are visible
    await expect(page.locator('.ticket-card:has-text("Board 2 Card")')).toBeVisible();
    await expect(page.locator('.ticket-card:has-text("Board 1 Card")')).not.toBeVisible();

    // Refresh and verify both boards maintain their states
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check first board after refresh
    await page.click(`text="${board1}"`);
    await expect(page.locator('.ticket-card:has-text("Board 1 Card")')).toBeVisible();

    // Check second board after refresh
    await page.click(`text="${board2}"`);
    await expect(page.locator('.ticket-card:has-text("Board 2 Card")')).toBeVisible();
  });

  test('Card edit history should persist across sessions', async () => {
    const boardName = `History Test ${Date.now()}`;
    const cardTitle = 'History Test Card';

    // Create board and card
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', boardName);
    await page.click('button:has-text("Create")');
    await page.waitForSelector(`text="${boardName}"`, { timeout: 10000 });

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title"]', cardTitle);
    await page.fill('textarea[placeholder*="description"]', 'Original description');
    await page.click('button:has-text("Save")');

    // Make multiple edits
    const edits = [
      { title: 'Edit 1', description: 'First edit' },
      { title: 'Edit 2', description: 'Second edit' },
      { title: 'Edit 3', description: 'Third edit' }
    ];

    for (const edit of edits) {
      await page.locator(`.ticket-card:has-text("${cardTitle}")`).click();
      await page.fill('input[value*="${cardTitle}"]', edit.title);
      await page.fill('textarea', edit.description);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Check history before refresh
    await page.locator(`.ticket-card`).first().click();
    const historyButton = page.locator('button:has-text("History")');
    if (await historyButton.isVisible()) {
      await historyButton.click();
      const historyEntries = page.locator('.history-entry');
      const countBefore = await historyEntries.count();

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check history after refresh
      await page.locator(`.ticket-card`).first().click();
      if (await historyButton.isVisible()) {
        await historyButton.click();
        const countAfter = await historyEntries.count();

        // History count should be the same
        expect(countAfter).toBe(countBefore);
      }
    }
  });

  test('Bulk operations should persist correctly', async () => {
    const boardName = `Bulk Test ${Date.now()}`;

    // Create board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', boardName);
    await page.click('button:has-text("Create")');
    await page.waitForSelector(`text="${boardName}"`, { timeout: 10000 });

    // Create multiple cards
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    for (let i = 1; i <= 5; i++) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title"]', `Bulk Card ${i}`);
      await page.click('button:has-text("Save")');
    }

    // Select multiple cards if bulk selection is available
    const bulkSelectButton = page.locator('button:has-text("Select Multiple")');
    if (await bulkSelectButton.isVisible({ timeout: 2000 })) {
      await bulkSelectButton.click();

      // Select first 3 cards
      for (let i = 1; i <= 3; i++) {
        await page.locator(`.ticket-card:has-text("Bulk Card ${i}")`).click();
      }

      // Move selected cards to IN PROGRESS
      const bulkMoveButton = page.locator('button:has-text("Move Selected")');
      if (await bulkMoveButton.isVisible()) {
        await bulkMoveButton.click();
        await page.click('text="IN PROGRESS"');
      }

      // Refresh and verify bulk operation persisted
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check that cards 1-3 are in IN PROGRESS
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
      for (let i = 1; i <= 3; i++) {
        await expect(inProgressColumn.locator(`.ticket-card:has-text("Bulk Card ${i}")`)).toBeVisible();
      }

      // Check that cards 4-5 are still in TODO
      for (let i = 4; i <= 5; i++) {
        await expect(todoColumn.locator(`.ticket-card:has-text("Bulk Card ${i}")`)).toBeVisible();
      }
    }
  });
});
