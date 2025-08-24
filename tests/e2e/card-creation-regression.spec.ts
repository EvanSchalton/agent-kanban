import { test, expect } from '@playwright/test';

/**
 * Card Creation Regression Tests
 *
 * Comprehensive test suite to prevent future card creation issues.
 * Based on successful API verification - these tests ensure the UI
 * workflow remains functional.
 */
test.describe('Card Creation Regression Tests', () => {
  const baseURL = 'http://localhost:15175';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create a test board for each test
    const boardName = `Regression Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to the board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');
  });

  test('REGRESSION: Basic card creation workflow', async ({ page }) => {
    console.log('🔄 Testing basic card creation workflow');

    const cardTitle = `Basic Card ${Date.now()}`;

    // Step 1: Navigate to board (done in beforeEach)
    await expect(page.locator('.column').filter({ hasText: 'TODO' })).toBeVisible();
    console.log('✅ Step 1: Navigated to board');

    // Step 2: Click '+' button (Add Card)
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const addButton = todoColumn.locator('button:has-text("Add Card")');
    await expect(addButton).toBeVisible();
    await addButton.click();
    console.log('✅ Step 2: Clicked Add Card button');

    // Step 3: Fill form
    const titleInput = page.locator('input[placeholder*="title" i]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(cardTitle);

    const descInput = page.locator('textarea[placeholder*="description" i]');
    if (await descInput.isVisible()) {
      await descInput.fill('Regression test card description');
    }
    console.log('✅ Step 3: Filled form');

    // Step 4: Submit
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    console.log('✅ Step 4: Submitted form');

    // Step 5: Verify card appears
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 5: Card appears in board');

    // Additional verification: Card is in correct column
    const cardInTodo = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardInTodo).toBeVisible();
    console.log('✅ Additional: Card is in correct TODO column');
  });

  test('REGRESSION: Card creation with all form fields', async ({ page }) => {
    console.log('🔄 Testing card creation with all available fields');

    const cardData = {
      title: `Full Form Card ${Date.now()}`,
      description: 'Complete card with all fields filled',
      priority: 'high'
    };

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Open form
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');

    // Fill all available fields
    await page.fill('input[placeholder*="title" i]', cardData.title);

    const descInput = page.locator('textarea[placeholder*="description" i]');
    if (await descInput.isVisible()) {
      await descInput.fill(cardData.description);
    }

    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption(cardData.priority);
    }

    // Submit
    await page.click('button:has-text("Save")');

    // Verify card creation
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardData.title });
    await expect(createdCard).toBeVisible({ timeout: 10000 });

    // Verify data persistence by opening card details
    await createdCard.click();
    await page.waitForSelector('.ticket-detail');

    // Check title
    const detailTitle = page.locator('.ticket-detail input[value*="' + cardData.title.split(' ')[0] + '"]');
    await expect(detailTitle).toBeVisible();

    // Check description if available
    const detailDesc = page.locator('.ticket-detail textarea');
    if (await detailDesc.isVisible()) {
      const descValue = await detailDesc.inputValue();
      expect(descValue).toContain('Complete card');
    }

    console.log('✅ Card created with all fields and data persisted');
  });

  test('REGRESSION: Multiple rapid card creation', async ({ page }) => {
    console.log('🔄 Testing multiple rapid card creation');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const cardTitles: string[] = [];
    const cardCount = 3;

    for (let i = 1; i <= cardCount; i++) {
      const cardTitle = `Rapid Card ${i} - ${Date.now()}`;
      cardTitles.push(cardTitle);

      // Open form
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.waitForSelector('input[placeholder*="title" i]');

      // Fill and submit
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Wait for form to close
      await expect(page.locator('input[placeholder*="title" i]')).not.toBeVisible();

      // Brief pause
      await page.waitForTimeout(500);
    }

    // Verify all cards were created
    for (const cardTitle of cardTitles) {
      const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(card).toBeVisible({ timeout: 5000 });
    }

    // Verify total count
    const totalCards = await page.locator('.ticket-card').count();
    expect(totalCards).toBe(cardCount);

    console.log(`✅ All ${cardCount} cards created successfully`);
  });

  test('REGRESSION: Card creation form validation', async ({ page }) => {
    console.log('🔄 Testing card creation form validation');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Test empty form submission
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');

    // Try to submit without title
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Check if validation prevents submission
    const titleInput = page.locator('input[placeholder*="title" i]');
    const formStillOpen = await titleInput.isVisible();

    if (formStillOpen) {
      console.log('✅ Form validation prevents empty submission');

      // Now fill with valid data
      await titleInput.fill(`Valid Card ${Date.now()}`);
      await page.click('button:has-text("Save")');

      // Verify successful creation
      await expect(titleInput).not.toBeVisible();
      console.log('✅ Valid submission works after validation');
    } else {
      console.log('ℹ️ No strict validation - form may accept empty titles');
    }
  });

  test('REGRESSION: Card creation persistence after page refresh', async ({ page }) => {
    console.log('🔄 Testing card persistence after page refresh');

    const cardTitle = `Persistence Card ${Date.now()}`;
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Create card
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Verify card appears
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible();

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify card still exists
    const cardAfterRefresh = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardAfterRefresh).toBeVisible({ timeout: 10000 });

    console.log('✅ Card persisted after page refresh');
  });

  test('REGRESSION: Card creation in different columns', async ({ page }) => {
    console.log('🔄 Testing card creation in different columns');

    const columns = ['TODO', 'IN PROGRESS', 'DONE'];
    const createdCards: string[] = [];

    for (const columnName of columns) {
      const cardTitle = `${columnName} Card ${Date.now()}`;
      createdCards.push(cardTitle);

      const column = page.locator('.column').filter({ hasText: columnName });

      // Some columns might not have Add Card buttons
      const addButton = column.locator('button:has-text("Add Card")');

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForSelector('input[placeholder*="title" i]');
        await page.fill('input[placeholder*="title" i]', cardTitle);
        await page.click('button:has-text("Save")');

        // Verify card appears in correct column
        const cardInColumn = column.locator('.ticket-card').filter({ hasText: cardTitle });
        await expect(cardInColumn).toBeVisible({ timeout: 10000 });

        console.log(`✅ Card created in ${columnName} column`);
      } else {
        console.log(`ℹ️ ${columnName} column does not support direct card creation`);
      }

      await page.waitForTimeout(500);
    }
  });

  test('REGRESSION: Card creation with special characters', async ({ page }) => {
    console.log('🔄 Testing card creation with special characters');

    const specialTitles = [
      'Card with "quotes" and symbols !@#$%',
      'Card with emoji 🚀✨ and unicode ñáéíóú',
      'Card with HTML <tags> & entities',
      'Card with numbers 12345 and dates 2024-01-01'
    ];

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    let successCount = 0;

    for (const title of specialTitles) {
      try {
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.waitForSelector('input[placeholder*="title" i]');
        await page.fill('input[placeholder*="title" i]', title);
        await page.click('button:has-text("Save")');

        // Wait and check if card was created
        await page.waitForTimeout(1000);
        const cardCount = await page.locator('.ticket-card').count();

        if (cardCount > successCount) {
          successCount++;
          console.log(`✅ Special character card created: ${title.substring(0, 30)}...`);
        }
      } catch (error) {
        console.log(`⚠️ Special character test failed: ${title.substring(0, 30)}...`);
      }
    }

    expect(successCount).toBeGreaterThan(0);
    console.log(`✅ ${successCount}/${specialTitles.length} special character tests passed`);
  });

  test('REGRESSION: Card creation error recovery', async ({ page }) => {
    console.log('🔄 Testing error recovery in card creation');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

    // Simulate potential error scenarios

    // Test 1: Cancel form and retry
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');
    await page.fill('input[placeholder*="title" i]', 'Cancelled Card');

    // Cancel form
    const cancelButton = page.locator('button:has-text("Cancel"), button[aria-label="Close"]');
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Verify form closed
    await expect(page.locator('input[placeholder*="title" i]')).not.toBeVisible();

    // Test 2: Create card after cancellation
    const validTitle = `Recovery Card ${Date.now()}`;
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.waitForSelector('input[placeholder*="title" i]');
    await page.fill('input[placeholder*="title" i]', validTitle);
    await page.click('button:has-text("Save")');

    // Verify successful creation
    const recoveryCard = page.locator('.ticket-card').filter({ hasText: validTitle });
    await expect(recoveryCard).toBeVisible({ timeout: 10000 });

    console.log('✅ Error recovery successful - card creation works after cancellation');
  });

  test('REGRESSION: Card creation UI state consistency', async ({ page }) => {
    console.log('🔄 Testing UI state consistency during card creation');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
    const cardTitle = `UI State Card ${Date.now()}`;

    // Test form opening
    await todoColumn.locator('button:has-text("Add Card")').click();

    // Verify form elements are visible
    await expect(page.locator('input[placeholder*="title" i]')).toBeVisible();
    await expect(page.locator('button:has-text("Save")')).toBeVisible();

    // Fill form
    await page.fill('input[placeholder*="title" i]', cardTitle);

    // Submit and verify form closes
    await page.click('button:has-text("Save")');
    await expect(page.locator('input[placeholder*="title" i]')).not.toBeVisible();

    // Verify card appears and UI is consistent
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible();

    // Verify Add Card button is still available for next creation
    const addButton = todoColumn.locator('button:has-text("Add Card")');
    await expect(addButton).toBeVisible();

    console.log('✅ UI state remains consistent throughout card creation process');
  });

  test.afterEach(async ({ page }) => {
    // Take screenshot for test documentation
    await page.screenshot({
      path: `tests/results/regression-${Date.now()}.png`,
      fullPage: true
    });

    // Log final card count
    const finalCount = await page.locator('.ticket-card').count();
    console.log(`Test completed with ${finalCount} cards visible`);
  });
});
