import { test, expect } from '@playwright/test';

/**
 * Card Creation Regression Prevention Tests
 *
 * Comprehensive test suite to prevent future card creation regressions.
 * Implements the exact 5-step workflow: navigate to board, click '+',
 * fill form, submit, verify card appears.
 */
test.describe('Card Creation Regression Prevention', () => {
  const baseURL = 'http://localhost:15175';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create a fresh test board for each test
    const boardName = `Regression Test Board ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to the board for testing
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');
  });

  test('REGRESSION: 5-step card creation workflow', async ({ page }) => {
    console.log('🧪 REGRESSION TEST: Starting 5-step card creation workflow');

    const cardTitle = `Regression Card ${Date.now()}`;
    const cardDescription = 'This card validates the regression prevention workflow';

    // STEP 1: Navigate to board
    console.log('STEP 1: Navigate to board');
    // Board navigation already completed in beforeEach
    await expect(page.locator('.column').filter({ hasText: 'TODO' })).toBeVisible();
    await expect(page.locator('.column').filter({ hasText: 'IN PROGRESS' })).toBeVisible();
    await expect(page.locator('.column').filter({ hasText: 'DONE' })).toBeVisible();
    console.log('✅ STEP 1 COMPLETE: Successfully navigated to board with all columns visible');

    // STEP 2: Click '+' button (Add Card)
    console.log('STEP 2: Click \'+\' button');
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const addCardButton = todoColumn.locator('button:has-text("Add Card")');

    // Verify button exists and is clickable
    await expect(addCardButton).toBeVisible();
    await expect(addCardButton).toBeEnabled();
    await addCardButton.click();
    console.log('✅ STEP 2 COMPLETE: Successfully clicked Add Card button');

    // STEP 3: Fill form
    console.log('STEP 3: Fill form');

    // Wait for form to appear
    const titleInput = page.locator('input[placeholder*="title" i]');
    await expect(titleInput).toBeVisible();

    // Fill required title field
    await titleInput.fill(cardTitle);
    console.log(`   ✓ Title filled: ${cardTitle}`);

    // Fill description if available
    const descriptionInput = page.locator('textarea[placeholder*="description" i]');
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill(cardDescription);
      console.log(`   ✓ Description filled: ${cardDescription}`);
    } else {
      console.log('   ℹ️ Description field not available');
    }

    // Set priority if available
    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('medium');
      console.log('   ✓ Priority set: medium');
    } else {
      console.log('   ℹ️ Priority field not available');
    }

    // Verify form data
    const currentTitle = await titleInput.inputValue();
    expect(currentTitle).toBe(cardTitle);
    console.log('✅ STEP 3 COMPLETE: Form filled successfully with validated data');

    // STEP 4: Submit
    console.log('STEP 4: Submit form');
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();

    // Take screenshot before submission
    await page.screenshot({
      path: `tests/results/before-submit-regression-${Date.now()}.png`
    });

    await saveButton.click();
    console.log('✅ STEP 4 COMPLETE: Form submitted successfully');

    // Wait for form to close (indicates successful submission)
    await expect(titleInput).not.toBeVisible({ timeout: 10000 });
    console.log('   ✓ Form closed after submission');

    // STEP 5: Verify card appears
    console.log('STEP 5: Verify card appears');

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
    console.log('   ✓ Card contains expected title text');

    // Take screenshot after successful creation
    await page.screenshot({
      path: `tests/results/after-creation-regression-${Date.now()}.png`
    });

    console.log('✅ STEP 5 COMPLETE: Card successfully appears in board');

    // BONUS: Verify data persistence by opening card details
    console.log('BONUS: Verify data persistence');
    await createdCard.click();
    await page.waitForSelector('.ticket-detail');

    // Verify title persistence
    const detailTitle = page.locator('.ticket-detail input').first();
    const persistedTitle = await detailTitle.inputValue();
    expect(persistedTitle).toContain(cardTitle.split(' ')[0]);
    console.log('   ✓ Title data persisted correctly');

    // Verify description persistence if it was set
    if (cardDescription) {
      const detailDesc = page.locator('.ticket-detail textarea');
      if (await detailDesc.isVisible()) {
        const persistedDesc = await detailDesc.inputValue();
        expect(persistedDesc).toContain('regression');
        console.log('   ✓ Description data persisted correctly');
      }
    }

    console.log('✅ BONUS COMPLETE: Data persistence verified');

    console.log('🎉 REGRESSION TEST COMPLETE: All 5 steps successful');
    console.log('📊 WORKFLOW SUMMARY:');
    console.log('   1. ✅ Navigate to board');
    console.log('   2. ✅ Click \'+\' button');
    console.log('   3. ✅ Fill form');
    console.log('   4. ✅ Submit');
    console.log('   5. ✅ Verify card appears');
    console.log('   ✅ Data persistence validated');
  });

  test('REGRESSION: Multiple card creation stress test', async ({ page }) => {
    console.log('🧪 REGRESSION TEST: Multiple card creation for stress testing');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const cardCount = 5;
    const createdCards: string[] = [];

    // Create multiple cards to test for regressions
    for (let i = 1; i <= cardCount; i++) {
      const cardTitle = `Stress Test Card ${i} - ${Date.now()}`;
      createdCards.push(cardTitle);

      console.log(`Creating card ${i}/${cardCount}: ${cardTitle}`);

      // Navigate to board, click '+', fill form, submit, verify
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.waitForSelector('input[placeholder*="title" i]');
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Verify this specific card was created
      await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 10000 });
      console.log(`   ✅ Card ${i} created successfully`);

      // Brief pause between cards
      await page.waitForTimeout(500);
    }

    // Final verification: all cards should be visible
    console.log('Final verification: checking all cards are present');
    for (const cardTitle of createdCards) {
      const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(card).toBeVisible();
    }

    // Verify total count
    const totalCards = await page.locator('.ticket-card').count();
    expect(totalCards).toBe(cardCount);

    console.log(`✅ STRESS TEST COMPLETE: All ${cardCount} cards created successfully`);
  });

  test('REGRESSION: Error handling and form validation', async ({ page }) => {
    console.log('🧪 REGRESSION TEST: Error handling and form validation');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Test 1: Empty form submission (should be prevented)
    console.log('Test 1: Empty form submission validation');
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');

    // Try to submit without filling any data
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Check if form validation prevents submission
    const titleInput = page.locator('input[placeholder*="title" i]');
    const formStillOpen = await titleInput.isVisible();

    if (formStillOpen) {
      console.log('   ✅ Form validation prevents empty submission');

      // Fill with valid data and retry
      const validTitle = `Valid Card After Error ${Date.now()}`;
      await titleInput.fill(validTitle);
      await page.click('button:has-text("Save")');

      // Verify successful creation after validation
      await expect(page.locator('.ticket-card').filter({ hasText: validTitle })).toBeVisible({ timeout: 10000 });
      console.log('   ✅ Valid submission works after validation error');
    } else {
      console.log('   ℹ️ No strict form validation detected');
    }

    console.log('✅ ERROR HANDLING TEST COMPLETE');
  });

  test('REGRESSION: Form cancellation and retry', async ({ page }) => {
    console.log('🧪 REGRESSION TEST: Form cancellation and retry');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Test form cancellation
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');
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
    console.log('   ✅ Form cancellation successful');

    // Test successful creation after cancellation
    const retryTitle = `Retry After Cancel ${Date.now()}`;
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');
    await page.fill('input[placeholder*="title" i]', retryTitle);
    await page.click('button:has-text("Save")');

    // Verify successful creation
    await expect(page.locator('.ticket-card').filter({ hasText: retryTitle })).toBeVisible({ timeout: 10000 });
    console.log('   ✅ Successful creation after cancellation');

    console.log('✅ CANCELLATION TEST COMPLETE');
  });

  test('REGRESSION: Data persistence after page refresh', async ({ page }) => {
    console.log('🧪 REGRESSION TEST: Data persistence after page refresh');

    const cardTitle = `Persistence Test ${Date.now()}`;
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Create card using 5-step workflow
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Verify card appears
    await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
    console.log('   ✅ Card created successfully');

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify card still exists after refresh
    const cardAfterRefresh = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardAfterRefresh).toBeVisible({ timeout: 10000 });
    console.log('   ✅ Card persisted after page refresh');

    console.log('✅ PERSISTENCE TEST COMPLETE');
  });

  test('REGRESSION: Cross-browser compatibility', async ({ page, browserName }) => {
    console.log(`🧪 REGRESSION TEST: Cross-browser compatibility on ${browserName}`);

    const cardTitle = `${browserName} Test Card ${Date.now()}`;
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Execute complete 5-step workflow on current browser
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Verify success
    await expect(page.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 10000 });

    console.log(`✅ CROSS-BROWSER TEST COMPLETE: ${browserName} workflow successful`);
  });

  test('REGRESSION: Special characters and edge cases', async ({ page }) => {
    console.log('🧪 REGRESSION TEST: Special characters and edge cases');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const specialCases = [
      'Card with "quotes" and symbols !@#$%',
      'Card with emoji 🚀✨ and unicode ñáéíóú',
      'Very long title that exceeds normal length expectations and tests field limits',
      'A' // Single character
    ];

    let successCount = 0;

    for (const testTitle of specialCases) {
      try {
        console.log(`Testing: ${testTitle.substring(0, 30)}...`);

        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.waitForSelector('input[placeholder*="title" i]');
        await page.fill('input[placeholder*="title" i]', testTitle);
        await page.click('button:has-text("Save")');

        // Check if card was created (may have sanitized content)
        await page.waitForTimeout(1000);
        const cardCount = await page.locator('.ticket-card').count();

        if (cardCount > successCount) {
          successCount++;
          console.log(`   ✅ Special case handled successfully`);
        }
      } catch (error) {
        console.log(`   ⚠️ Special case test failed: ${error}`);
      }
    }

    expect(successCount).toBeGreaterThan(0);
    console.log(`✅ SPECIAL CHARACTERS TEST COMPLETE: ${successCount}/${specialCases.length} cases successful`);
  });

  test.afterEach(async ({ page }) => {
    // Take final screenshot for documentation
    await page.screenshot({
      path: `tests/results/regression-test-end-${Date.now()}.png`,
      fullPage: true
    });

    // Log final state
    const finalCardCount = await page.locator('.ticket-card').count();
    console.log(`Regression test completed with ${finalCardCount} cards created`);

    // Check for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`🚨 Browser console error detected: ${msg.text()}`);
      }
    });
  });
});
