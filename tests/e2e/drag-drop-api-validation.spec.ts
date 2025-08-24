import { test, expect, Page } from '@playwright/test';

/**
 * 🔴 P0 CRITICAL: API Validation for Drag & Drop Operations
 *
 * Purpose: Verify the Frontend Developer's fix ensures correct column IDs
 * are sent to the API instead of card IDs (the original bug).
 *
 * Specific Focus:
 * 1. Empty column drops send correct column IDs
 * 2. API payloads are validated for correct format
 * 3. No card IDs are sent as column values
 * 4. Error handling for invalid API responses
 * 5. Network failure resilience
 */

test.describe('🔴 P0: API Validation - Drag & Drop Column ID Fix', () => {
  const baseURL = 'http://localhost:5173';
  let boardName: string;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    boardName = `API Validation ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    await setupApiTestCards(page);
  });

  async function setupApiTestCards(page: Page) {
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

    const testCards = [
      'API Test Card Alpha',
      'API Test Card Beta',
      'API Test Card Gamma'
    ];

    for (const cardTitle of testCards) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }
  }

  test('CRITICAL: Empty column drops send correct API column values', async () => {
    console.log('🔴 Testing API payloads for empty column drops');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const blockedColumn = page.locator('.column').filter({ hasText: 'BLOCKED' }).first();
    const qcColumn = page.locator('.column').filter({ hasText: 'READY FOR QC' }).first();

    // Detailed API call tracking with full payload analysis
    const detailedApiCalls: Array<{
      ticketId: string;
      method: string;
      url: string;
      fullPayload: any;
      columnValue: string;
      timestamp: number;
      isValid: boolean;
    }> = [];

    await page.route('**/api/tickets/**', async route => {
      const request = route.request();

      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const url = request.url();
        const ticketId = url.split('/').pop() || 'unknown';
        const payload = request.postDataJSON();

        const apiCall = {
          ticketId,
          method: request.method(),
          url,
          fullPayload: payload,
          columnValue: payload.current_column || 'MISSING',
          timestamp: Date.now(),
          isValid: false
        };

        // Validate API call format
        const validColumns = ['Not Started', 'In Progress', 'Blocked', 'Ready for QC', 'Done'];
        apiCall.isValid = validColumns.includes(apiCall.columnValue);

        detailedApiCalls.push(apiCall);

        console.log(`API Call: ${request.method()} ${url}`);
        console.log(`  Payload: ${JSON.stringify(payload, null, 2)}`);
        console.log(`  Column Value: "${apiCall.columnValue}" (Valid: ${apiCall.isValid})`);
      }

      await route.continue();
    });

    // Test Case 1: Drop on EMPTY BLOCKED column
    console.log('\n🔴 Test Case 1: Drop on EMPTY BLOCKED column');

    // Clear BLOCKED column first
    const blockedCards = await blockedColumn.locator('.ticket-card').all();
    for (const card of blockedCards) {
      await card.dragTo(todoColumn);
      await page.waitForTimeout(500);
    }

    // Verify BLOCKED is empty
    const blockedCount = await blockedColumn.locator('.ticket-card').count();
    expect(blockedCount).toBe(0);
    console.log('✅ BLOCKED column is empty');

    // Drop TODO card on empty BLOCKED column
    const alphaCard = todoColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Alpha' });

    const blockedBox = await blockedColumn.boundingBox();
    if (blockedBox) {
      await alphaCard.hover();
      await page.mouse.down();
      await page.mouse.move(blockedBox.x + blockedBox.width / 2, blockedBox.y + blockedBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(3000);
    }

    // Test Case 2: Drop on EMPTY READY FOR QC column
    console.log('\n🔴 Test Case 2: Drop on EMPTY READY FOR QC column');

    // Clear QC column
    const qcCards = await qcColumn.locator('.ticket-card').all();
    for (const card of qcCards) {
      await card.dragTo(todoColumn);
      await page.waitForTimeout(500);
    }

    const betaCard = todoColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Beta' });

    const qcBox = await qcColumn.boundingBox();
    if (qcBox) {
      await betaCard.hover();
      await page.mouse.down();
      await page.mouse.move(qcBox.x + qcBox.width / 2, qcBox.y + qcBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(3000);
    }

    // COMPREHENSIVE API VALIDATION
    console.log('\n📊 Comprehensive API Call Analysis:');

    // Filter to recent ticket update calls
    const recentCalls = detailedApiCalls.filter(call =>
      call.timestamp > Date.now() - 10000 && // Last 10 seconds
      call.url.includes('/tickets/')
    );

    expect(recentCalls.length).toBeGreaterThan(0);
    console.log(`Found ${recentCalls.length} recent ticket update API calls`);

    for (const apiCall of recentCalls) {
      console.log(`\n--- API Call Analysis ---`);
      console.log(`Ticket ID: ${apiCall.ticketId}`);
      console.log(`Method: ${apiCall.method}`);
      console.log(`Column Value: "${apiCall.columnValue}"`);
      console.log(`Valid: ${apiCall.isValid}`);
      console.log(`Full Payload:`, JSON.stringify(apiCall.fullPayload, null, 2));

      // CRITICAL ASSERTION 1: Must be valid column value
      expect(apiCall.isValid).toBe(true);

      // CRITICAL ASSERTION 2: Must NOT be a card ID (number)
      expect(apiCall.columnValue).not.toMatch(/^\d+$/);

      // CRITICAL ASSERTION 3: Must NOT be internal column ID format
      expect(apiCall.columnValue).not.toBe('not_started');
      expect(apiCall.columnValue).not.toBe('in_progress');
      expect(apiCall.columnValue).not.toBe('blocked');
      expect(apiCall.columnValue).not.toBe('ready_for_qc');
      expect(apiCall.columnValue).not.toBe('done');

      // CRITICAL ASSERTION 4: Payload must have required fields
      expect(apiCall.fullPayload).toHaveProperty('current_column');

      console.log(`✅ API Call ${apiCall.ticketId}: Valid column "${apiCall.columnValue}"`);
    }

    // CRITICAL ASSERTION 5: Verify cards are in expected columns
    const alphaInBlocked = await blockedColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Alpha' }).isVisible();
    const betaInQc = await qcColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Beta' }).isVisible();

    expect(alphaInBlocked).toBe(true);
    expect(betaInQc).toBe(true);

    console.log('✅ All API validations passed - no card IDs sent as column values');
  });

  test('CRITICAL: Error handling for invalid API responses', async () => {
    console.log('🔴 Testing error handling for API failures');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Test Case 1: Simulate API error response
    let apiCallCount = 0;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();

      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiCallCount++;

        // Simulate error on first API call
        if (apiCallCount === 1) {
          console.log('Simulating API error response');
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Invalid column ID: 24. Must be one of: not_started, in_progress, blocked, ready_for_qc, done'
            })
          });
          return;
        }
      }

      await route.continue();
    });

    // Perform drag operation that would trigger error
    const testCard = todoColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Alpha' });

    // Record card position before drag
    const initialPosition = await testCard.textContent();

    // Attempt drag operation
    await testCard.dragTo(inProgressColumn);
    await page.waitForTimeout(3000);

    // CRITICAL ASSERTION: Card should remain in original position on API error
    const cardStillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Alpha' }).isVisible();
    const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Alpha' }).isVisible();

    // Should stay in TODO due to API error
    expect(cardStillInTodo).toBe(true);
    expect(cardInProgress).toBe(false);

    console.log('✅ Error handling: Card reverted to original position on API failure');

    // Test Case 2: Verify subsequent operations work after error
    console.log('Testing recovery after API error...');

    const betaCard = todoColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Beta' });

    // This should work (no simulated error)
    await betaCard.dragTo(inProgressColumn);
    await page.waitForTimeout(2000);

    const betaInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Beta' }).isVisible();
    expect(betaInProgress).toBe(true);

    console.log('✅ System recovers correctly after API error');
  });

  test('CRITICAL: Network failure resilience during drag operations', async () => {
    console.log('🔴 Testing network failure resilience');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Test Case 1: Network timeout simulation
    let timeoutCount = 0;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();

      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        timeoutCount++;

        if (timeoutCount === 1) {
          console.log('Simulating network timeout');
          // Simulate timeout by delaying response
          await new Promise(resolve => setTimeout(resolve, 5000));
          await route.fulfill({
            status: 408,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Request timeout' })
          });
          return;
        }
      }

      await route.continue();
    });

    const gammaCard = todoColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Gamma' });

    // Attempt drag during network issues
    await gammaCard.dragTo(doneColumn);
    await page.waitForTimeout(6000); // Wait for timeout handling

    // Card should remain in original position due to timeout
    const cardStillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Gamma' }).isVisible();
    expect(cardStillInTodo).toBe(true);

    console.log('✅ Network timeout handled gracefully');

    // Test Case 2: Connection recovery
    console.log('Testing connection recovery...');

    // Try the operation again (should work now)
    await gammaCard.dragTo(doneColumn);
    await page.waitForTimeout(3000);

    const cardRecovered = await doneColumn.locator('.ticket-card').filter({ hasText: 'API Test Card Gamma' }).isVisible();
    expect(cardRecovered).toBe(true);

    console.log('✅ Network recovery successful');
  });

  test.afterEach(async () => {
    console.log('\n=== API Validation Test Complete ===');

    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/api-validation-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
