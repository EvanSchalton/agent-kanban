import { test, expect, Page } from '@playwright/test';

test.describe('CRUD Operations - Critical Bug Tests', () => {
  let page: Page;
  const testBoardName = `Test Board ${Date.now()}`;
  const testCardTitle = `Test Card ${Date.now()}`;
  const editedCardTitle = `Edited Card ${Date.now()}`;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('BUG-001: Card edits should persist after page refresh', async () => {
    // Step 1: Create a new board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', testBoardName);
    await page.click('button:has-text("Create")');

    // Wait for board to be created
    await page.waitForSelector(`text="${testBoardName}"`, { timeout: 10000 });

    // Step 2: Create a new card in TODO column
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();

    // Fill in card details
    await page.fill('input[placeholder*="title"]', testCardTitle);
    await page.fill('textarea[placeholder*="description"]', 'Initial description');
    await page.click('button:has-text("Save")');

    // Verify card is created
    await expect(page.locator(`.ticket-card:has-text("${testCardTitle}")`)).toBeVisible();

    // Step 3: Edit the card
    await page.locator(`.ticket-card:has-text("${testCardTitle}")`).click();
    await page.waitForSelector('.ticket-detail', { timeout: 5000 });

    // Edit title and description
    await page.fill('input[value*="${testCardTitle}"]', editedCardTitle);
    await page.fill('textarea', 'Edited description - this should persist');
    await page.click('button:has-text("Save")');

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Step 4: Verify edit appears in history
    const historyButton = page.locator('button:has-text("History")');
    if (await historyButton.isVisible()) {
      await historyButton.click();
      await expect(page.locator('.history-entry')).toContainText(/edited|updated/i);
    }

    // Step 5: Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 6: Verify edited content persists
    const cardAfterRefresh = page.locator(`.ticket-card:has-text("${editedCardTitle}")`);

    // CRITICAL ASSERTION: This should pass but currently fails
    await expect(cardAfterRefresh).toBeVisible({ timeout: 10000 });

    // Click the card to verify description also persisted
    await cardAfterRefresh.click();
    await expect(page.locator('textarea')).toHaveValue('Edited description - this should persist');

    // Log the bug if it fails
    if (!(await cardAfterRefresh.isVisible())) {
      console.error('🐛 BUG CONFIRMED: Card edits do not persist after page refresh');
      console.error('Expected: Card title should be updated to:', editedCardTitle);
      console.error('Actual: Card reverts to original title or disappears');
    }
  });

  test('BUG-002: Delete option should be available for cards', async () => {
    // Create a board and card first
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', `Delete Test ${Date.now()}`);
    await page.click('button:has-text("Create")');

    await page.waitForSelector('.column', { timeout: 10000 });

    // Create a card
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title"]', 'Card to Delete');
    await page.click('button:has-text("Save")');

    // Open card details
    await page.locator('.ticket-card:has-text("Card to Delete")').click();
    await page.waitForSelector('.ticket-detail', { timeout: 5000 });

    // Look for delete button
    const deleteButton = page.locator('button:has-text("Delete")');

    // CRITICAL ASSERTION: Delete button should exist
    await expect(deleteButton).toBeVisible({ timeout: 5000 });

    // If delete button exists, test deletion
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion if dialog appears
      const confirmButton = page.locator('button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      // Verify card is deleted
      await expect(page.locator('.ticket-card:has-text("Card to Delete")')).not.toBeVisible();
    } else {
      console.error('🐛 BUG CONFIRMED: No delete option available for cards');
    }
  });

  test('BUG-003: Card moves between columns should persist after refresh', async () => {
    // Create board and card
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', `Move Test ${Date.now()}`);
    await page.click('button:has-text("Create")');

    await page.waitForSelector('.column', { timeout: 10000 });

    // Create card in TODO column
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title"]', 'Card to Move');
    await page.click('button:has-text("Save")');

    // Wait for card to appear
    const cardToMove = page.locator('.ticket-card:has-text("Card to Move")');
    await expect(cardToMove).toBeVisible();

    // Drag card from TODO to IN_PROGRESS
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

    // Perform drag and drop
    await cardToMove.dragTo(inProgressColumn);

    // Wait for the move to complete
    await page.waitForTimeout(2000);

    // Verify card is now in IN_PROGRESS column
    const cardInProgress = inProgressColumn.locator('.ticket-card:has-text("Card to Move")');
    await expect(cardInProgress).toBeVisible();

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // CRITICAL ASSERTION: Card should still be in IN_PROGRESS column
    const cardAfterRefresh = page.locator('.column').filter({ hasText: 'IN PROGRESS' })
      .locator('.ticket-card:has-text("Card to Move")');

    await expect(cardAfterRefresh).toBeVisible({ timeout: 10000 });

    // Verify card is NOT in TODO column
    const cardInTodoAfterRefresh = page.locator('.column').filter({ hasText: 'TODO' })
      .locator('.ticket-card:has-text("Card to Move")');
    await expect(cardInTodoAfterRefresh).not.toBeVisible();

    if (!(await cardAfterRefresh.isVisible())) {
      console.error('🐛 BUG CONFIRMED: Card moves do not persist after page refresh');
      console.error('Expected: Card should remain in IN_PROGRESS column');
      console.error('Actual: Card reverts to original TODO column');
    }
  });

  test('Create operation should work correctly', async () => {
    // Test basic card creation
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', `CRUD Test ${Date.now()}`);
    await page.click('button:has-text("Create")');

    await page.waitForSelector('.column', { timeout: 10000 });

    // Create multiple cards
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    for (let i = 1; i <= 3; i++) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title"]', `Test Card ${i}`);
      await page.fill('textarea[placeholder*="description"]', `Description for card ${i}`);
      await page.click('button:has-text("Save")');

      // Verify card is created
      await expect(page.locator(`.ticket-card:has-text("Test Card ${i}")`)).toBeVisible();
    }

    // Verify all cards are present
    await expect(page.locator('.ticket-card')).toHaveCount(3);
  });

  test('Read operation should display card details correctly', async () => {
    // Create a board and card
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name"]', `Read Test ${Date.now()}`);
    await page.click('button:has-text("Create")');

    await page.waitForSelector('.column', { timeout: 10000 });

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();

    const cardData = {
      title: 'Detailed Card',
      description: 'This is a detailed description for testing read operation'
    };

    await page.fill('input[placeholder*="title"]', cardData.title);
    await page.fill('textarea[placeholder*="description"]', cardData.description);
    await page.click('button:has-text("Save")');

    // Open card details
    await page.locator(`.ticket-card:has-text("${cardData.title}")`).click();
    await page.waitForSelector('.ticket-detail', { timeout: 5000 });

    // Verify all details are displayed correctly
    await expect(page.locator('input[value*="Detailed Card"]')).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue(cardData.description);

    // Check for metadata (created date, status, etc.)
    await expect(page.locator('.ticket-detail')).toContainText(/TODO|In Progress|Done/);
  });
});
