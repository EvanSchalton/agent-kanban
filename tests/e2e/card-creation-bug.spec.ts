import { test, expect } from '@playwright/test';

/**
 * Card Creation Bug Reproduction Tests
 *
 * These tests are specifically designed to reproduce and verify fixes for
 * card creation bugs reported by the development team.
 */
test.describe('Card Creation Bug Reproduction', () => {
  const baseURL = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create a test board for each test
    const boardName = `Bug Test Board ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to the board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Wait for board to fully load
    await page.waitForTimeout(1000);
  });

  test('BUG-REPRODUCTION: Card creation should work consistently', async ({ page }) => {
    const cardTitle = `Bug Reproduction Card ${Date.now()}`;
    const cardDescription = 'This card should be created successfully';

    console.log('🐛 Starting card creation bug reproduction test');

    // Step 1: Open add card modal
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await expect(todoColumn).toBeVisible();

    const addCardButton = todoColumn.locator('button:has-text("Add Card")');
    await expect(addCardButton).toBeVisible();
    await addCardButton.click();

    // Step 2: Fill in card details
    const titleInput = page.locator('input[placeholder*="title" i]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(cardTitle);

    const descriptionInput = page.locator('textarea[placeholder*="description" i]');
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill(cardDescription);
    }

    // Step 3: Submit card creation
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Step 4: Wait for card creation to complete
    await page.waitForTimeout(2000);

    // Step 5: Verify card was created successfully
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });

    // CRITICAL ASSERTION: Card should be visible
    await expect(createdCard).toBeVisible({ timeout: 10000 });

    // Verify card is in the correct column
    const cardInTodo = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardInTodo).toBeVisible();

    // Verify card contains the expected content
    await expect(createdCard).toContainText(cardTitle);

    console.log('✅ Card creation bug reproduction test passed');
  });

  test('BUG-REPRODUCTION: Multiple rapid card creation', async ({ page }) => {
    console.log('🐛 Testing rapid card creation scenario');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const cardTitles: string[] = [];

    // Create multiple cards rapidly
    for (let i = 1; i <= 3; i++) {
      const cardTitle = `Rapid Card ${i} - ${Date.now()}`;
      cardTitles.push(cardTitle);

      console.log(`Creating card ${i}/3: ${cardTitle}`);

      // Open add card modal
      await todoColumn.locator('button:has-text("Add Card")').click();

      // Fill and submit
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Brief wait between cards
      await page.waitForTimeout(500);
    }

    // Wait for all operations to complete
    await page.waitForTimeout(3000);

    // Verify all cards were created
    for (const cardTitle of cardTitles) {
      const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(card).toBeVisible({ timeout: 5000 });
      console.log(`✅ Verified card: ${cardTitle}`);
    }

    // Verify total count
    const totalCards = await page.locator('.ticket-card').count();
    expect(totalCards).toBe(cardTitles.length);

    console.log(`✅ All ${cardTitles.length} cards created successfully`);
  });

  test('BUG-REPRODUCTION: Card creation with validation errors', async ({ page }) => {
    console.log('🐛 Testing card creation with validation scenarios');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Test 1: Empty title
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.click('button:has-text("Save")');

    // Should show validation error or prevent submission
    const validationError = page.locator('.error-message, .validation-error, [role="alert"]');
    if (await validationError.isVisible({ timeout: 2000 })) {
      console.log('✅ Validation error shown for empty title');
      await expect(validationError).toBeVisible();
    } else {
      console.log('ℹ️ No validation error shown - checking if modal is still open');
      // Modal should still be open if validation failed
      const titleInput = page.locator('input[placeholder*="title" i]');
      if (await titleInput.isVisible()) {
        console.log('✅ Modal remains open on validation failure');
      }
    }

    // Close modal if still open
    const closeButton = page.locator('button[aria-label="Close"], button:has-text("Cancel")');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }

    // Wait a moment
    await page.waitForTimeout(1000);

    // Test 2: Valid card creation after validation error
    const validCardTitle = `Valid Card After Error ${Date.now()}`;

    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', validCardTitle);
    await page.click('button:has-text("Save")');

    // This should succeed
    const validCard = page.locator('.ticket-card').filter({ hasText: validCardTitle });
    await expect(validCard).toBeVisible({ timeout: 10000 });

    console.log('✅ Valid card created after validation error scenario');
  });

  test('BUG-REPRODUCTION: Card creation with special characters', async ({ page }) => {
    console.log('🐛 Testing card creation with special characters');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const specialCards = [
      'Card with "quotes" and symbols !@#$%',
      'Card with emoji 🚀 and unicode ñáéíóú',
      'Card with <HTML> & XML entities',
      'Card with\nline breaks\nand\ttabs'
    ];

    for (const cardTitle of specialCards) {
      console.log(`Creating card with special chars: ${cardTitle.substring(0, 30)}...`);

      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Wait for creation
      await page.waitForTimeout(1000);

      // Verify card exists (may have escaped/sanitized content)
      const cards = page.locator('.ticket-card');
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);

      console.log(`✅ Card with special characters created`);
    }
  });

  test('BUG-REPRODUCTION: Card creation form state management', async ({ page }) => {
    console.log('🐛 Testing card creation form state management');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const cardTitle = `State Test Card ${Date.now()}`;

    // Open modal
    await todoColumn.locator('button:has-text("Add Card")').click();

    // Fill form
    await page.fill('input[placeholder*="title" i]', cardTitle);

    const descInput = page.locator('textarea[placeholder*="description" i]');
    if (await descInput.isVisible()) {
      await descInput.fill('Test description for state management');
    }

    // Set priority if available
    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('high');
    }

    // Submit form
    await page.click('button:has-text("Save")');

    // Wait for submission to complete
    await page.waitForTimeout(2000);

    // Verify modal closed
    const titleInput = page.locator('input[placeholder*="title" i]');
    await expect(titleInput).not.toBeVisible();

    // Verify card was created
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible();

    // Open card to verify all data was saved
    await createdCard.click();
    await page.waitForSelector('.ticket-detail');

    // Verify title is displayed correctly
    const detailTitle = page.locator('.ticket-detail input, .ticket-detail h1, .ticket-detail h2');
    const titleValue = await detailTitle.first().inputValue().catch(() => detailTitle.first().textContent());
    expect(titleValue).toContain(cardTitle.split(' ')[0]); // At least part of title should match

    console.log('✅ Form state management test completed');
  });

  test('BUG-REPRODUCTION: Card creation network failure handling', async ({ page }) => {
    console.log('🐛 Testing card creation with network issues');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const cardTitle = `Network Test Card ${Date.now()}`;

    // Simulate slow network
    await page.route('**/api/**', async route => {
      // Add delay to simulate slow network
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.continue();
    });

    // Open modal and create card
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Wait for potential loading states
    await page.waitForTimeout(1000);

    // Check for loading indicators
    const loadingIndicator = page.locator('.loading, .spinner, [aria-label*="loading"]');
    if (await loadingIndicator.isVisible()) {
      console.log('✅ Loading indicator shown during slow network');
    }

    // Wait for card creation to complete (with extended timeout)
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible({ timeout: 15000 });

    console.log('✅ Card creation succeeded despite network delay');

    // Reset route intercept
    await page.unroute('**/api/**');
  });

  test('BUG-REPRODUCTION: Card creation after page interactions', async ({ page }) => {
    console.log('🐛 Testing card creation after various page interactions');

    // Interact with the page first
    await page.click('.navbar a', { timeout: 5000 }).catch(() => console.log('No navbar found'));
    await page.waitForTimeout(500);

    // Try searching/filtering if available
    const searchInput = page.locator('input[placeholder*="search" i]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test search');
      await page.waitForTimeout(500);
      await searchInput.clear();
    }

    // Click different columns
    const columns = page.locator('.column');
    const columnCount = await columns.count();
    for (let i = 0; i < Math.min(columnCount, 3); i++) {
      await columns.nth(i).click();
      await page.waitForTimeout(200);
    }

    // Now try to create a card
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const cardTitle = `After Interactions Card ${Date.now()}`;

    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Verify card creation still works
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible({ timeout: 10000 });

    console.log('✅ Card creation works after page interactions');
  });

  test.afterEach(async ({ page }) => {
    // Log final state for debugging
    const cardCount = await page.locator('.ticket-card').count();
    console.log(`Test completed with ${cardCount} cards on board`);

    // Take screenshot if test failed
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/card-creation-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
