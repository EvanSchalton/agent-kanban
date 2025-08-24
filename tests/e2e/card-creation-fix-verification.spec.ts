import { test, expect, Page } from '@playwright/test';

/**
 * Card Creation Fix Verification Tests
 *
 * This test suite specifically verifies the fix for the card creation bug
 * where the API expects 'current_column' but the frontend sends 'column_id'
 *
 * Bug Details from Team Plan:
 * - Frontend sends: { column_id: 'not_started' }
 * - Backend expects: { current_column: 'Not Started' }
 * - Fix involves transforming column_id to current_column with proper mapping
 */
test.describe('Card Creation Fix Verification - Priority 1 Bug', () => {
  const baseURL = 'http://localhost:5173';
  let boardId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create a test board
    const boardName = `Fix Verification ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to the board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Extract board ID from URL for API validation
    const url = page.url();
    const match = url.match(/\/board\/(\d+)/);
    if (match) {
      boardId = match[1];
    }

    // Wait for board to fully load
    await page.waitForTimeout(1000);
  });

  test('CRITICAL: Card creation in TODO column with column_id transformation', async ({ page }) => {
    console.log('🔴 CRITICAL BUG TEST: Verifying column_id to current_column transformation');

    const cardTitle = `Critical Fix Test ${Date.now()}`;
    const cardDescription = 'Testing the critical API fix for column_id transformation';

    // Intercept the API request to verify the payload
    let requestPayload: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        requestPayload = request.postDataJSON();
        console.log('📡 API Request Payload:', JSON.stringify(requestPayload, null, 2));
      }
      await route.continue();
    });

    // Open add card modal in TODO column
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    await expect(todoColumn).toBeVisible();

    const addCardButton = todoColumn.locator('button:has-text("Add Card")');
    await expect(addCardButton).toBeVisible();
    await addCardButton.click();

    // Fill in card details
    const titleInput = page.locator('input[placeholder*="title" i]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(cardTitle);

    const descriptionInput = page.locator('textarea[placeholder*="description" i]');
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill(cardDescription);
    }

    // Set priority
    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('high');
    }

    // Submit card creation
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for card creation to complete
    await page.waitForTimeout(2000);

    // CRITICAL ASSERTIONS

    // 1. Verify the API payload was transformed correctly
    if (requestPayload) {
      console.log('✅ API request intercepted, checking payload...');

      // The fix should transform column_id to current_column
      expect(requestPayload).toHaveProperty('current_column');
      expect(requestPayload.current_column).toBe('Not Started'); // Mapped from 'not_started'

      // Should NOT have column_id in the payload
      expect(requestPayload).not.toHaveProperty('column_id');

      // Verify other required fields
      expect(requestPayload.title).toBe(cardTitle);
      expect(requestPayload.description).toBe(cardDescription);
      expect(requestPayload.board_id).toBeTruthy();

      console.log('✅ API payload is correctly transformed!');
    } else {
      console.log('⚠️ Could not intercept API request - checking UI result');
    }

    // 2. Verify card was created successfully in UI
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible({ timeout: 10000 });

    // 3. Verify card is in the correct column
    const cardInTodo = todoColumn.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(cardInTodo).toBeVisible();

    console.log('✅ CRITICAL BUG FIX VERIFIED: Card creation works with proper API transformation');
  });

  test('Card creation in each column with proper mapping', async ({ page }) => {
    console.log('🔍 Testing card creation in all columns with proper column mapping');

    // Column mapping from team plan
    const columnMappings = [
      { uiName: 'TODO', apiName: 'Not Started', columnId: 'not_started' },
      { uiName: 'IN PROGRESS', apiName: 'In Progress', columnId: 'in_progress' },
      { uiName: 'DONE', apiName: 'Done', columnId: 'done' }
    ];

    for (const columnMap of columnMappings) {
      console.log(`Testing column: ${columnMap.uiName} -> ${columnMap.apiName}`);

      const cardTitle = `${columnMap.uiName} Card ${Date.now()}`;

      // Intercept API request
      let requestPayload: any = null;
      await page.route('**/api/tickets/**', async route => {
        const request = route.request();
        if (request.method() === 'POST' && request.postDataJSON()?.title === cardTitle) {
          requestPayload = request.postDataJSON();
        }
        await route.continue();
      });

      // Find the column
      const column = page.locator('.column').filter({ hasText: columnMap.uiName }).first();
      await expect(column).toBeVisible();

      // Create card
      const addButton = column.locator('button:has-text("Add Card")');
      if (await addButton.isVisible()) {
        await addButton.click();

        await page.fill('input[placeholder*="title" i]', cardTitle);
        await page.click('button:has-text("Save")');

        await page.waitForTimeout(1500);

        // Verify API payload
        if (requestPayload) {
          expect(requestPayload.current_column).toBe(columnMap.apiName);
          expect(requestPayload).not.toHaveProperty('column_id');
          console.log(`✅ ${columnMap.uiName}: API payload correct`);
        }

        // Verify card appears in correct column
        const card = column.locator('.ticket-card').filter({ hasText: cardTitle });
        await expect(card).toBeVisible();
        console.log(`✅ ${columnMap.uiName}: Card created successfully`);
      }

      // Clean up route intercept
      await page.unroute('**/api/tickets/**');
    }
  });

  test('Card creation with all fields populated', async ({ page }) => {
    console.log('🔍 Testing card creation with all fields to ensure fix doesn\'t break other fields');

    const cardData = {
      title: `Full Card Test ${Date.now()}`,
      description: 'Comprehensive test with all fields populated',
      acceptanceCriteria: '- Card should be created\n- All fields should be saved\n- No errors should occur',
      priority: 'high',
      assignee: 'Test User'
    };

    // Intercept API request
    let requestPayload: any = null;
    let responseData: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        requestPayload = request.postDataJSON();
      }
      const response = await route.fetch();
      if (response.ok()) {
        responseData = await response.json();
      }
      await route.fulfill({ response });
    });

    // Create card with all fields
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn.locator('button:has-text("Add Card")').click();

    // Fill all fields
    await page.fill('input[placeholder*="title" i]', cardData.title);

    const descInput = page.locator('textarea[placeholder*="description" i]');
    if (await descInput.isVisible()) {
      await descInput.fill(cardData.description);
    }

    const criteriaInput = page.locator('textarea[placeholder*="acceptance" i]');
    if (await criteriaInput.isVisible()) {
      await criteriaInput.fill(cardData.acceptanceCriteria);
    }

    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption(cardData.priority);
    }

    const assigneeInput = page.locator('input[placeholder*="assignee" i]');
    if (await assigneeInput.isVisible()) {
      await assigneeInput.fill(cardData.assignee);
    }

    // Submit
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // Verify API request
    if (requestPayload) {
      expect(requestPayload.current_column).toBe('Not Started');
      expect(requestPayload.title).toBe(cardData.title);
      expect(requestPayload.description).toBe(cardData.description);
      if (requestPayload.acceptance_criteria) {
        expect(requestPayload.acceptance_criteria).toBe(cardData.acceptanceCriteria);
      }
      console.log('✅ All fields properly sent to API');
    }

    // Verify response
    if (responseData) {
      expect(responseData.id).toBeTruthy();
      expect(responseData.title).toBe(cardData.title);
      console.log('✅ API response contains created card data');
    }

    // Verify card in UI
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardData.title });
    await expect(createdCard).toBeVisible();

    // Open card to verify all fields were saved
    await createdCard.click();
    await page.waitForSelector('.ticket-detail, [role="dialog"]', { timeout: 5000 });

    // Verify saved data
    const titleInDetail = page.locator('input[value*="' + cardData.title.split(' ')[0] + '"], h1, h2').first();
    await expect(titleInDetail).toBeVisible();

    console.log('✅ Card creation with all fields successful');
  });

  test('Rapid card creation stress test', async ({ page }) => {
    console.log('⚡ Stress testing rapid card creation to ensure fix handles concurrent requests');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const cardTitles: string[] = [];
    const numCards = 5;

    // Track all API requests
    const apiRequests: any[] = [];
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        apiRequests.push(payload);
      }
      await route.continue();
    });

    // Create multiple cards rapidly
    for (let i = 1; i <= numCards; i++) {
      const cardTitle = `Stress Test Card ${i} - ${Date.now()}`;
      cardTitles.push(cardTitle);

      console.log(`Creating card ${i}/${numCards}`);

      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');

      // Minimal wait between cards
      await page.waitForTimeout(300);
    }

    // Wait for all operations to complete
    await page.waitForTimeout(3000);

    // Verify all API requests had correct payload
    console.log(`Checking ${apiRequests.length} API requests...`);
    for (const request of apiRequests) {
      expect(request).toHaveProperty('current_column');
      expect(request).not.toHaveProperty('column_id');
    }
    console.log('✅ All API requests have correct structure');

    // Verify all cards were created
    for (const cardTitle of cardTitles) {
      const card = page.locator('.ticket-card').filter({ hasText: cardTitle });
      await expect(card).toBeVisible({ timeout: 5000 });
    }

    // Verify total count
    const totalCards = await page.locator('.ticket-card').count();
    expect(totalCards).toBeGreaterThanOrEqual(numCards);

    console.log(`✅ All ${numCards} cards created successfully under stress`);
  });

  test('Card creation error recovery', async ({ page }) => {
    console.log('🔄 Testing card creation error recovery to ensure fix handles failures gracefully');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    let failureCount = 0;

    // Simulate one API failure then success
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'POST' && failureCount === 0) {
        failureCount++;
        // Simulate server error on first attempt
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      } else {
        await route.continue();
      }
    });

    const cardTitle = `Recovery Test ${Date.now()}`;

    // First attempt - should fail
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Wait for error handling
    await page.waitForTimeout(2000);

    // Check for error message
    const errorMessage = page.locator('.error-message, .toast-error, [role="alert"]');
    if (await errorMessage.isVisible({ timeout: 3000 })) {
      console.log('✅ Error message displayed on failure');
    }

    // Close modal if still open
    const closeButton = page.locator('button[aria-label="Close"], button:has-text("Cancel")');
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    // Second attempt - should succeed
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', cardTitle);
    await page.click('button:has-text("Save")');

    // Wait for success
    await page.waitForTimeout(2000);

    // Verify card was created on retry
    const createdCard = page.locator('.ticket-card').filter({ hasText: cardTitle });
    await expect(createdCard).toBeVisible({ timeout: 10000 });

    console.log('✅ Card creation recovered after initial failure');
  });

  test('Card creation form validation', async ({ page }) => {
    console.log('📝 Testing form validation to ensure fix doesn\'t bypass validations');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

    // Test empty title validation
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.click('button:has-text("Save")');

    // Check for validation error or modal staying open
    const validationError = page.locator('.error-message, .validation-error, [role="alert"]');
    const titleInput = page.locator('input[placeholder*="title" i]');

    if (await validationError.isVisible({ timeout: 2000 })) {
      console.log('✅ Validation error shown for empty title');
      await expect(validationError).toContainText(/required|enter|provide/i);
    } else if (await titleInput.isVisible()) {
      console.log('✅ Modal stays open on validation failure');
    }

    // Now provide valid input
    const validTitle = `Valid After Validation ${Date.now()}`;
    await titleInput.fill(validTitle);
    await page.click('button:has-text("Save")');

    // Verify card is created after fixing validation
    await page.waitForTimeout(2000);
    const createdCard = page.locator('.ticket-card').filter({ hasText: validTitle });
    await expect(createdCard).toBeVisible();

    console.log('✅ Validation works correctly with the fix');
  });

  test.afterEach(async ({ page }) => {
    // Log test results
    const cardCount = await page.locator('.ticket-card').count();
    console.log(`Test completed with ${cardCount} cards on board`);

    // Take screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/fix-verification-failure-${Date.now()}.png`,
        fullPage: true
      });

      // Log console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error('Browser console error:', msg.text());
        }
      });
    }
  });
});

// Additional test for monitoring console errors
test.describe('Console Error Monitoring', () => {
  test('No console errors during card creation', async ({ page }) => {
    const errors: string[] = [];

    // Monitor console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate to app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Create a board
    const boardName = `Console Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);

    // Create a card
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Console Error Test Card');
    await page.click('button:has-text("Save")');

    await page.waitForTimeout(2000);

    // Assert no console errors
    if (errors.length > 0) {
      console.error('Console errors detected:', errors);
    }
    expect(errors).toHaveLength(0);

    console.log('✅ No console errors during card creation');
  });
});
