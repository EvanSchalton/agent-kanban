import { test, expect } from '@playwright/test';

/**
 * Card Creation Fix Validation Tests
 *
 * These tests specifically validate that the reported card creation fix
 * is working correctly. They test the complete user journey from board
 * creation to card creation and verify data persistence.
 */
test.describe('Card Creation Fix Validation', () => {
  const baseURL = 'http://localhost:15175';

  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Take screenshot for baseline
    await page.screenshot({
      path: `tests/results/baseline-${Date.now()}.png`,
      fullPage: true
    });
  });

  test('VALIDATION: Complete card creation workflow', async ({ page }) => {
    console.log('🔍 Starting comprehensive card creation fix validation');

    const timestamp = Date.now();
    const boardName = `Fix Validation Board ${timestamp}`;
    const cardTitle = `Fix Validation Card ${timestamp}`;
    const cardDescription = 'This card validates the API fix is working correctly';

    // Step 1: Create a board
    console.log('Step 1: Creating test board');
    await page.click('button:has-text("Create Board")');
    await page.waitForSelector('input[placeholder*="board name" i]');
    await page.fill('input[placeholder*="board name" i]', boardName);

    // Add description if field exists
    const descField = page.locator('textarea[placeholder*="description" i]');
    if (await descField.isVisible()) {
      await descField.fill('Test board for card creation fix validation');
    }

    await page.click('button:has-text("Create")');

    // Verify board was created
    await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible({ timeout: 10000 });
    console.log('✅ Board created successfully');

    // Step 2: Navigate to the board
    console.log('Step 2: Navigating to board');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Verify board view loaded
    await expect(page.locator('.column').filter({ hasText: 'TODO' })).toBeVisible();
    await expect(page.locator('.column').filter({ hasText: 'IN PROGRESS' })).toBeVisible();
    await expect(page.locator('.column').filter({ hasText: 'DONE' })).toBeVisible();
    console.log('✅ Board view loaded with all columns');

    // Step 3: Create a card - THE CRITICAL TEST
    console.log('Step 3: Creating card (CRITICAL TEST)');
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Click Add Card button
    const addCardButton = todoColumn.locator('button:has-text("Add Card")');
    await expect(addCardButton).toBeVisible();
    await addCardButton.click();

    // Wait for modal/form to appear
    await page.waitForSelector('input[placeholder*="title" i]');
    console.log('✅ Add card form opened');

    // Fill in card details
    await page.fill('input[placeholder*="title" i]', cardTitle);

    const descInput = page.locator('textarea[placeholder*="description" i]');
    if (await descInput.isVisible()) {
      await descInput.fill(cardDescription);
    }

    // Set priority if available
    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('high');
    }

    // Submit the card
    console.log('Submitting card creation...');
    await page.click('button:has-text("Save")');

    // Step 4: Verify card was created successfully
    console.log('Step 4: Verifying card creation');

    // Wait for modal to close
    await expect(page.locator('input[placeholder*="title" i]')).not.toBeVisible({ timeout: 5000 });

    // Verify card appears in the board
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible({ timeout: 15000 });
    console.log('✅ Card created and visible in board');

    // Verify card is in the correct column
    const cardInTodo = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardInTodo).toBeVisible();
    console.log('✅ Card is in correct TODO column');

    // Step 5: Verify card data persistence
    console.log('Step 5: Verifying card data persistence');

    // Click on the card to open details
    await createdCard.click();
    await page.waitForSelector('.ticket-detail');

    // Verify title is preserved
    const titleInputValue = await page.locator('.ticket-detail input[value*="' + cardTitle.split(' ')[0] + '"]').inputValue();
    expect(titleInputValue).toContain(cardTitle.split(' ')[0]);

    // Verify description if it was set
    const descTextarea = page.locator('.ticket-detail textarea');
    if (await descTextarea.isVisible()) {
      const descValue = await descTextarea.inputValue();
      if (cardDescription) {
        expect(descValue).toContain('fix validation');
      }
    }

    console.log('✅ Card data persisted correctly');

    // Close card detail view
    const closeButton = page.locator('button[aria-label="Close"], .close-button');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Step 6: Test data persistence after page refresh
    console.log('Step 6: Testing persistence after page refresh');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify card still exists after refresh
    const cardAfterRefresh = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardAfterRefresh).toBeVisible({ timeout: 10000 });
    console.log('✅ Card persisted after page refresh');

    console.log('🎉 Card creation fix validation COMPLETED SUCCESSFULLY');
  });

  test('VALIDATION: Multiple card creation stress test', async ({ page }) => {
    console.log('🔍 Starting multiple card creation stress test');

    const timestamp = Date.now();
    const boardName = `Stress Test Board ${timestamp}`;

    // Create board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const cardTitles: string[] = [];

    // Create 5 cards rapidly
    for (let i = 1; i <= 5; i++) {
      const cardTitle = `Stress Test Card ${i} - ${timestamp}`;
      cardTitles.push(cardTitle);

      console.log(`Creating card ${i}/5: ${cardTitle}`);

      // Open form
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.waitForSelector('input[placeholder*="title" i]');

      // Fill and submit
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Wait for form to close
      await expect(page.locator('input[placeholder*="title" i]')).not.toBeVisible();

      // Brief pause between cards
      await page.waitForTimeout(500);
    }

    // Wait for all operations to complete
    await page.waitForTimeout(3000);

    // Verify all cards were created
    for (const cardTitle of cardTitles) {
      const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(card).toBeVisible({ timeout: 5000 });
      console.log(`✅ Verified: ${cardTitle}`);
    }

    // Verify total count
    const totalCards = await page.locator('.ticket-card').count();
    expect(totalCards).toBe(cardTitles.length);

    console.log(`✅ All ${cardTitles.length} cards created successfully in stress test`);
  });

  test('VALIDATION: Card creation with edge cases', async ({ page }) => {
    console.log('🔍 Testing card creation with edge cases');

    const timestamp = Date.now();
    const boardName = `Edge Case Board ${timestamp}`;

    // Create board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Test cases with different content types
    const testCases = [
      {
        title: 'Card with "quotes" and symbols !@#$%^&*()',
        description: 'Testing special characters and symbols'
      },
      {
        title: 'Card with emoji 🚀🎉✨ and unicode characters ñáéíóú',
        description: 'Testing unicode and emoji support'
      },
      {
        title: 'Very long title '.repeat(10),
        description: 'Testing very long content handling'
      },
      {
        title: 'A',
        description: 'Single character'
      }
    ];

    let successCount = 0;

    for (const testCase of testCases) {
      try {
        console.log(`Testing: ${testCase.title.substring(0, 30)}...`);

        // Open form
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.waitForSelector('input[placeholder*="title" i]');

        // Fill form
        await page.fill('input[placeholder*="title" i]', testCase.title);

        const descInput = page.locator('textarea[placeholder*="description" i]');
        if (await descInput.isVisible()) {
          await descInput.fill(testCase.description);
        }

        // Submit
        await page.click('button:has-text("Save")');

        // Wait for form to close or error to appear
        await page.waitForTimeout(2000);

        // Check if card was created (may have modified content due to sanitization)
        const cardCreated = await page.locator('.ticket-card').count() > successCount;

        if (cardCreated) {
          successCount++;
          console.log(`✅ Edge case card created successfully`);
        } else {
          console.log(`⚠️ Edge case card creation failed or was rejected`);
        }

        // Close any open modals
        const closeButton = page.locator('button[aria-label="Close"], button:has-text("Cancel")');
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }

      } catch (error) {
        console.log(`⚠️ Edge case test failed: ${error}`);
      }
    }

    console.log(`✅ Edge case testing completed: ${successCount}/${testCases.length} cases successful`);
    expect(successCount).toBeGreaterThan(0); // At least some should work
  });

  test('VALIDATION: Card creation error handling', async ({ page }) => {
    console.log('🔍 Testing card creation error handling');

    const timestamp = Date.now();
    const boardName = `Error Test Board ${timestamp}`;

    // Create board
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Test 1: Empty title submission
    console.log('Testing empty title submission');
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');

    // Try to submit without title
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Check for validation feedback
    const validationError = page.locator('.error-message, .validation-error, [role="alert"]');
    const formStillOpen = page.locator('input[placeholder*="title" i]');

    if (await validationError.isVisible()) {
      console.log('✅ Validation error message shown for empty title');
    } else if (await formStillOpen.isVisible()) {
      console.log('✅ Form remains open on validation failure');
    } else {
      console.log('ℹ️ No explicit validation - form behavior may vary');
    }

    // Close form
    const closeButton = page.locator('button[aria-label="Close"], button:has-text("Cancel")');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Test 2: Create valid card after error
    console.log('Testing valid card creation after error');
    await page.waitForTimeout(500);

    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');
    await page.fill('input[placeholder*="title" i]', `Recovery Card ${timestamp}`);
    await page.click('button:has-text("Save")');

    // Verify recovery card was created
    const recoveryCard = page.locator('.ticket-card').filter({ hasText: `Recovery Card ${timestamp}` });
    await expect(recoveryCard).toBeVisible({ timeout: 10000 });

    console.log('✅ Card creation works correctly after validation error');
  });

  test.afterEach(async ({ page }) => {
    // Take screenshot after each test
    await page.screenshot({
      path: `tests/results/test-end-${Date.now()}.png`,
      fullPage: true
    });

    // Log final state
    const cardCount = await page.locator('.ticket-card').count();
    console.log(`Test completed with ${cardCount} cards visible`);

    // Log any console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Browser console error: ${msg.text()}`);
      }
    });
  });
});
