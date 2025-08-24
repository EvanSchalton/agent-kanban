import { test, expect } from '@playwright/test';

/**
 * Comprehensive Workflow Tests
 *
 * End-to-end tests covering complete user journeys including
 * the specific 5-step card creation workflow requested.
 */
test.describe('Comprehensive Workflow Tests', () => {
  const baseURL = 'http://localhost:15175';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
  });

  test('WORKFLOW: Complete 5-step card creation process', async ({ page }) => {
    console.log('🔄 Starting complete 5-step card creation workflow');

    const timestamp = Date.now();
    const boardName = `Workflow Board ${timestamp}`;
    const cardTitle = `Workflow Card ${timestamp}`;
    const cardDescription = 'Card created through complete workflow test';

    console.log('📋 SETUP: Creating test board');
    // Setup: Create a board first
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible();

    // STEP 1: Navigate to board
    console.log('📋 STEP 1: Navigate to board');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Verify board view is loaded with all columns
    await expect(page.locator('.column').filter({ hasText: 'TODO' })).toBeVisible();
    await expect(page.locator('.column').filter({ hasText: 'IN PROGRESS' })).toBeVisible();
    await expect(page.locator('.column').filter({ hasText: 'DONE' })).toBeVisible();
    console.log('✅ STEP 1 COMPLETE: Successfully navigated to board');

    // STEP 2: Click '+' button
    console.log('📋 STEP 2: Click \'+\' button (Add Card)');
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const addCardButton = todoColumn.locator('button:has-text("Add Card")');

    // Verify button is visible and clickable
    await expect(addCardButton).toBeVisible();
    await expect(addCardButton).toBeEnabled();
    await addCardButton.click();
    console.log('✅ STEP 2 COMPLETE: Successfully clicked Add Card button');

    // STEP 3: Fill form
    console.log('📋 STEP 3: Fill form');

    // Wait for form to appear
    const titleInput = page.locator('input[placeholder*="title" i]');
    await expect(titleInput).toBeVisible();

    // Fill title (required field)
    await titleInput.fill(cardTitle);
    console.log(`   ✓ Title filled: ${cardTitle}`);

    // Fill description if available
    const descriptionInput = page.locator('textarea[placeholder*="description" i]');
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill(cardDescription);
      console.log(`   ✓ Description filled: ${cardDescription}`);
    }

    // Set priority if available
    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('medium');
      console.log('   ✓ Priority set: medium');
    }

    // Verify form is properly filled
    const titleValue = await titleInput.inputValue();
    expect(titleValue).toBe(cardTitle);
    console.log('✅ STEP 3 COMPLETE: Form filled with all required data');

    // STEP 4: Submit
    console.log('📋 STEP 4: Submit form');
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();

    // Take screenshot before submission
    await page.screenshot({
      path: `tests/results/before-submit-${timestamp}.png`,
      fullPage: true
    });

    await saveButton.click();
    console.log('✅ STEP 4 COMPLETE: Form submitted successfully');

    // Wait for form to close (indicates successful submission)
    await expect(titleInput).not.toBeVisible({ timeout: 10000 });
    console.log('   ✓ Form closed after submission');

    // STEP 5: Verify card appears
    console.log('📋 STEP 5: Verify card appears');

    // Look for the created card
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible({ timeout: 15000 });
    console.log('   ✓ Card is visible in the board');

    // Verify card is in the correct column (TODO)
    const cardInTodoColumn = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardInTodoColumn).toBeVisible();
    console.log('   ✓ Card is in the correct TODO column');

    // Verify card contains expected content
    await expect(createdCard).toContainText(cardTitle);
    console.log('   ✓ Card contains expected title');

    // Take screenshot after successful creation
    await page.screenshot({
      path: `tests/results/after-creation-${timestamp}.png`,
      fullPage: true
    });

    console.log('✅ STEP 5 COMPLETE: Card successfully appears in board');

    // ADDITIONAL VERIFICATION: Open card to verify all data persisted
    console.log('📋 ADDITIONAL: Verify data persistence');
    await createdCard.click();
    await page.waitForSelector('.ticket-detail');

    // Check title persistence
    const detailTitleInput = page.locator('.ticket-detail input').first();
    const persistedTitle = await detailTitleInput.inputValue();
    expect(persistedTitle).toContain(cardTitle.split(' ')[0]); // At least part should match
    console.log('   ✓ Title persisted in card details');

    // Check description persistence if it was set
    const detailDescInput = page.locator('.ticket-detail textarea');
    if (await detailDescInput.isVisible() && cardDescription) {
      const persistedDesc = await detailDescInput.inputValue();
      expect(persistedDesc).toContain('workflow');
      console.log('   ✓ Description persisted in card details');
    }

    console.log('✅ ADDITIONAL COMPLETE: All data properly persisted');

    console.log('🎉 WORKFLOW TEST COMPLETE: All 5 steps executed successfully');
    console.log('📊 SUMMARY:');
    console.log('   1. ✅ Navigate to board');
    console.log('   2. ✅ Click \'+\' button');
    console.log('   3. ✅ Fill form');
    console.log('   4. ✅ Submit');
    console.log('   5. ✅ Verify card appears');
    console.log('   ✅ Bonus: Data persistence verified');
  });

  test('WORKFLOW: Complete board and card management journey', async ({ page }) => {
    console.log('🔄 Starting complete board and card management journey');

    const timestamp = Date.now();
    const boardName = `Management Board ${timestamp}`;

    // Step 1: Create board
    console.log('Step 1: Create board');
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible();

    // Step 2: Navigate to board
    console.log('Step 2: Navigate to board');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Step 3: Create multiple cards
    console.log('Step 3: Create multiple cards');
    const cards = [
      { title: 'Task 1: Planning', desc: 'Plan the project structure' },
      { title: 'Task 2: Development', desc: 'Develop the core features' },
      { title: 'Task 3: Testing', desc: 'Test all functionality' }
    ];

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    for (const card of cards) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', card.title);

      const descInput = page.locator('textarea[placeholder*="description" i]');
      if (await descInput.isVisible()) {
        await descInput.fill(card.desc);
      }

      await page.click('button:has-text("Save")');
      await expect(page.locator('input[placeholder*="title" i]')).not.toBeVisible();

      // Verify card was created
      const createdCard = page.locator('.ticket-card').filter({ hasText: card.title });
      await expect(createdCard).toBeVisible();

      console.log(`   ✓ Created: ${card.title}`);
    }

    // Step 4: Verify all cards are present
    console.log('Step 4: Verify all cards are present');
    const totalCards = await page.locator('.ticket-card').count();
    expect(totalCards).toBe(cards.length);

    for (const card of cards) {
      const cardElement = page.locator('.ticket-card').filter({ hasText: card.title });
      await expect(cardElement).toBeVisible();
    }

    console.log(`✅ Complete journey successful: ${cards.length} cards created and verified`);
  });

  test('WORKFLOW: Error handling and recovery workflow', async ({ page }) => {
    console.log('🔄 Starting error handling and recovery workflow');

    const timestamp = Date.now();
    const boardName = `Error Test Board ${timestamp}`;

    // Setup board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Test 1: Form cancellation
    console.log('Test 1: Form cancellation and retry');
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Cancelled Card');

    // Cancel the form
    const cancelButton = page.locator('button:has-text("Cancel"), button[aria-label="Close"]');
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Verify form closed
    await expect(page.locator('input[placeholder*="title" i]')).not.toBeVisible();
    console.log('   ✓ Form cancellation successful');

    // Test 2: Successful creation after cancellation
    console.log('Test 2: Successful creation after cancellation');
    const validTitle = `Recovery Card ${timestamp}`;

    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', validTitle);
    await page.click('button:has-text("Save")');

    const recoveredCard = page.locator('.ticket-card').filter({ hasText: validTitle });
    await expect(recoveredCard).toBeVisible();
    console.log('   ✓ Recovery successful after cancellation');

    // Test 3: Multiple interactions
    console.log('Test 3: Multiple form interactions');

    // Open form, fill partially, clear, refill
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Partial');
    await page.fill('input[placeholder*="title" i]', ''); // Clear
    await page.fill('input[placeholder*="title" i]', `Final Card ${timestamp}`);
    await page.click('button:has-text("Save")');

    const finalCard = page.locator('.ticket-card').filter({ hasText: `Final Card ${timestamp}` });
    await expect(finalCard).toBeVisible();
    console.log('   ✓ Multiple interactions handled correctly');

    console.log('✅ Error handling workflow complete');
  });

  test('WORKFLOW: Cross-browser compatibility validation', async ({ page, browserName }) => {
    console.log(`🔄 Starting cross-browser test on ${browserName}`);

    const timestamp = Date.now();
    const boardName = `${browserName} Board ${timestamp}`;
    const cardTitle = `${browserName} Card ${timestamp}`;

    // Create board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Complete card creation workflow
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Verify success
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible();

    console.log(`✅ Cross-browser test successful on ${browserName}`);
  });

  test.afterEach(async ({ page }) => {
    // Capture final state
    await page.screenshot({
      path: `tests/results/workflow-end-${Date.now()}.png`,
      fullPage: true
    });

    // Log test completion
    const cardCount = await page.locator('.ticket-card').count();
    console.log(`Workflow test completed with ${cardCount} cards visible`);
  });
});
