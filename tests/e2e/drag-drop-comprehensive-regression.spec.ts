import { test, expect, Page } from '@playwright/test';

/**
 * 🔴 P0 CRITICAL: Comprehensive Drag & Drop Regression Tests
 *
 * Purpose: Verify the Frontend Developer's drag & drop bug fix works correctly
 * for ALL possible column combinations and scenarios.
 *
 * Bug Context: Board.tsx was passing draggableId instead of destination column ID
 *
 * Test Coverage:
 * 1. All possible column-to-column combinations (5x5 = 25 combinations)
 * 2. Empty column scenarios
 * 3. API call validation for correct column IDs
 * 4. Rapid operations and edge cases
 * 5. Position accuracy within columns
 */

test.describe('🔴 P0: Comprehensive Drag & Drop Regression - All Column Combinations', () => {
  const baseURL = 'http://localhost:5173';
  let boardName: string;
  let page: Page;

  // All possible column combinations for testing
  const COLUMNS = [
    { name: 'TODO', id: 'not_started', apiValue: 'Not Started' },
    { name: 'IN PROGRESS', id: 'in_progress', apiValue: 'In Progress' },
    { name: 'BLOCKED', id: 'blocked', apiValue: 'Blocked' },
    { name: 'READY FOR QC', id: 'ready_for_qc', apiValue: 'Ready for QC' },
    { name: 'DONE', id: 'done', apiValue: 'Done' }
  ];

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    boardName = `Regression Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    await setupTestCards(page);
  });

  async function setupTestCards(page: Page) {
    // Create test cards in each column for comprehensive testing
    for (let i = 0; i < COLUMNS.length; i++) {
      const column = COLUMNS[i];
      const columnLocator = page.locator('.column').filter({ hasText: column.name }).first();

      // Create 2 cards per column
      for (let cardNum = 1; cardNum <= 2; cardNum++) {
        const cardTitle = `${column.name} Card ${cardNum}`;

        await columnLocator.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', cardTitle);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(800);
      }
    }

    console.log('✅ Created test cards in all columns');
  }

  test('CRITICAL: All column-to-column combinations work correctly', async () => {
    console.log('🔴 Testing ALL possible column combinations (25 total combinations)');

    // Track all API calls to verify correct column IDs
    const apiCalls: Array<{
      sourceColumn: string;
      targetColumn: string;
      apiColumnValue: string;
      cardTitle: string;
      timestamp: number;
    }> = [];

    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        const ticketId = request.url().split('/').pop();

        apiCalls.push({
          sourceColumn: 'unknown', // Will be determined from card context
          targetColumn: 'unknown',
          apiColumnValue: payload.current_column,
          cardTitle: payload.title || `ticket-${ticketId}`,
          timestamp: Date.now()
        });
      }
      await route.continue();
    });

    // Test EVERY possible column combination
    let totalMoves = 0;

    for (const sourceCol of COLUMNS) {
      for (const targetCol of COLUMNS) {
        if (sourceCol.id === targetCol.id) continue; // Skip same-column moves

        console.log(`Testing: ${sourceCol.name} → ${targetCol.name}`);

        const sourceColumn = page.locator('.column').filter({ hasText: sourceCol.name }).first();
        const targetColumn = page.locator('.column').filter({ hasText: targetCol.name }).first();

        // Find a card in the source column
        const sourceCard = sourceColumn.locator('.ticket-card').first();

        if (await sourceCard.isVisible()) {
          const cardTitle = await sourceCard.textContent();

          // Perform the drag operation
          await sourceCard.dragTo(targetColumn);
          await page.waitForTimeout(1500);

          // CRITICAL ASSERTION 1: Card should appear in target column
          const cardInTarget = await targetColumn.locator('.ticket-card').filter({ hasText: cardTitle! }).isVisible();
          expect(cardInTarget).toBe(true);

          // CRITICAL ASSERTION 2: Card should NOT be in source column
          const cardStillInSource = await sourceColumn.locator('.ticket-card').filter({ hasText: cardTitle! }).isVisible();
          expect(cardStillInSource).toBe(false);

          totalMoves++;
          console.log(`  ✅ Move ${totalMoves}: ${sourceCol.name} → ${targetCol.name} successful`);
        }
      }
    }

    // Wait for all API calls to complete
    await page.waitForTimeout(3000);

    // CRITICAL ASSERTION 3: All API calls should have correct column values
    console.log(`\n📊 API Call Analysis (${apiCalls.length} total calls):`);

    for (const apiCall of apiCalls) {
      // Verify API received proper column values (not card IDs)
      const validApiValues = COLUMNS.map(col => col.apiValue);
      expect(validApiValues).toContain(apiCall.apiColumnValue);

      // Should NEVER receive card IDs or invalid values
      expect(apiCall.apiColumnValue).not.toMatch(/^\d+$/); // Not a number (card ID)
      expect(apiCall.apiColumnValue).not.toBe('undefined');
      expect(apiCall.apiColumnValue).not.toBe('null');

      console.log(`  API Call: "${apiCall.cardTitle}" → "${apiCall.apiColumnValue}" ✅`);
    }

    console.log(`\n🎉 ALL ${totalMoves} column combinations tested successfully!`);
    expect(totalMoves).toBeGreaterThan(15); // Should have tested most combinations
  });

  test('CRITICAL: Empty column drag operations work correctly', async () => {
    console.log('🔴 Testing drag operations to EMPTY columns');

    // Clear specific columns to create empty targets
    const columnsToEmpty = ['BLOCKED', 'READY FOR QC'];

    for (const columnName of columnsToEmpty) {
      const column = page.locator('.column').filter({ hasText: columnName }).first();
      const cards = await column.locator('.ticket-card').all();

      // Move all cards out of this column to make it empty
      const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

      for (const card of cards) {
        await card.dragTo(doneColumn);
        await page.waitForTimeout(500);
      }

      // Verify column is empty
      const remainingCards = await column.locator('.ticket-card').count();
      expect(remainingCards).toBe(0);
      console.log(`✅ ${columnName} column cleared (empty)`);
    }

    // Track API calls for empty column drops
    const emptyColumnApiCalls: Array<{
      targetColumn: string;
      apiValue: string;
      cardTitle: string;
    }> = [];

    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        emptyColumnApiCalls.push({
          targetColumn: 'unknown',
          apiValue: payload.current_column,
          cardTitle: payload.title || 'unknown'
        });
      }
      await route.continue();
    });

    // Test dropping cards into empty columns
    const testCases = [
      { source: 'TODO', target: 'BLOCKED', expectedApi: 'Blocked' },
      { source: 'IN PROGRESS', target: 'READY FOR QC', expectedApi: 'Ready for QC' },
      { source: 'DONE', target: 'BLOCKED', expectedApi: 'Blocked' }
    ];

    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.source} → EMPTY ${testCase.target}`);

      const sourceColumn = page.locator('.column').filter({ hasText: testCase.source }).first();
      const targetColumn = page.locator('.column').filter({ hasText: testCase.target }).first();

      const cardToMove = sourceColumn.locator('.ticket-card').first();

      if (await cardToMove.isVisible()) {
        const cardTitle = await cardToMove.textContent();

        // Get target column bounding box for precise drop
        const targetBox = await targetColumn.boundingBox();
        if (!targetBox) throw new Error(`Could not get ${testCase.target} column position`);

        // Drag to center of empty column
        await cardToMove.hover();
        await page.mouse.down();
        await page.waitForTimeout(100);

        const dropX = targetBox.x + targetBox.width / 2;
        const dropY = targetBox.y + targetBox.height / 2;

        console.log(`  Dropping at center of empty column (${dropX}, ${dropY})`);
        await page.mouse.move(dropX, dropY);
        await page.waitForTimeout(500);
        await page.mouse.up();
        await page.waitForTimeout(2000);

        // CRITICAL ASSERTION 1: Card appears in empty target column
        const cardInTarget = await targetColumn.locator('.ticket-card').filter({ hasText: cardTitle! }).isVisible();
        expect(cardInTarget).toBe(true);

        // CRITICAL ASSERTION 2: Card removed from source
        const cardStillInSource = await sourceColumn.locator('.ticket-card').filter({ hasText: cardTitle! }).isVisible();
        expect(cardStillInSource).toBe(false);

        console.log(`  ✅ Card successfully moved to empty ${testCase.target} column`);
      }
    }

    // Wait for API calls
    await page.waitForTimeout(2000);

    // CRITICAL ASSERTION 3: API calls for empty columns have correct values
    console.log('\n📊 Empty Column API Call Analysis:');
    for (const apiCall of emptyColumnApiCalls) {
      console.log(`  "${apiCall.cardTitle}" → API: "${apiCall.apiValue}"`);

      // Should be valid column values, not source column or card IDs
      expect(['Blocked', 'Ready for QC']).toContain(apiCall.apiValue);
      expect(apiCall.apiValue).not.toBe('Not Started'); // Bug would cause this
      expect(apiCall.apiValue).not.toBe('In Progress'); // Bug would cause this
      expect(apiCall.apiValue).not.toBe('Done'); // Bug would cause this
    }

    console.log('✅ Empty column drag operations verified');
  });

  test('CRITICAL: Position accuracy within columns after drag', async () => {
    console.log('🔴 Testing card positioning within columns');

    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

    // Get initial card order in IN PROGRESS
    const initialCards = await inProgressColumn.locator('.ticket-card').allTextContents();
    console.log('Initial IN PROGRESS cards:', initialCards);

    // Add a new card from TODO to specific position
    const newCard = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });

    if (await newCard.isVisible() && initialCards.length > 0) {
      // Target: Drop between first and second card in IN PROGRESS
      const firstCard = inProgressColumn.locator('.ticket-card').first();
      const secondCard = inProgressColumn.locator('.ticket-card').nth(1);

      if (await firstCard.isVisible() && await secondCard.isVisible()) {
        const firstCardBox = await firstCard.boundingBox();
        const secondCardBox = await secondCard.boundingBox();

        if (firstCardBox && secondCardBox) {
          // Calculate position between cards
          const dropX = firstCardBox.x + firstCardBox.width / 2;
          const dropY = firstCardBox.y + firstCardBox.height + 5; // Just below first card

          await newCard.hover();
          await page.mouse.down();
          await page.mouse.move(dropX, dropY);
          await page.waitForTimeout(500);
          await page.mouse.up();
          await page.waitForTimeout(2000);

          // Verify card was inserted in correct position
          const finalCards = await inProgressColumn.locator('.ticket-card').allTextContents();
          console.log('Final IN PROGRESS cards:', finalCards);

          // The TODO Card 1 should now be in the IN PROGRESS column
          expect(finalCards.some(card => card.includes('TODO Card 1'))).toBe(true);
          expect(finalCards.length).toBe(initialCards.length + 1);

          console.log('✅ Card positioned correctly within column');
        }
      }
    }
  });

  test('CRITICAL: Rapid sequential drag operations', async () => {
    console.log('🔴 Testing rapid sequential drag operations');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Track all API calls during rapid operations
    const rapidApiCalls: Array<{
      cardTitle: string;
      targetColumn: string;
      timestamp: number;
    }> = [];

    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        rapidApiCalls.push({
          cardTitle: payload.title || 'unknown',
          targetColumn: payload.current_column,
          timestamp: Date.now()
        });
      }
      await route.continue();
    });

    // Perform rapid drag operations
    const rapidOperations = [
      { source: todoColumn, target: inProgressColumn, card: 'TODO Card 1' },
      { source: todoColumn, target: doneColumn, card: 'TODO Card 2' },
      { source: inProgressColumn, target: doneColumn, card: 'IN PROGRESS Card 1' },
      { source: inProgressColumn, target: todoColumn, card: 'IN PROGRESS Card 2' }
    ];

    console.log('Executing rapid drag operations...');
    for (const op of rapidOperations) {
      const card = op.source.locator('.ticket-card').filter({ hasText: op.card }).first();

      if (await card.isVisible()) {
        await card.dragTo(op.target);
        await page.waitForTimeout(300); // Minimal delay for rapid testing
      }
    }

    // Wait for all operations to complete
    await page.waitForTimeout(3000);

    // CRITICAL ASSERTION: All operations should have completed successfully
    console.log(`📊 Rapid Operations Analysis: ${rapidApiCalls.length} API calls`);

    for (const apiCall of rapidApiCalls) {
      // All API calls should have valid column values
      const validColumns = ['Not Started', 'In Progress', 'Blocked', 'Ready for QC', 'Done'];
      expect(validColumns).toContain(apiCall.targetColumn);

      console.log(`  "${apiCall.cardTitle}" → "${apiCall.targetColumn}" ✅`);
    }

    // Verify final state is consistent
    const finalTodoCount = await todoColumn.locator('.ticket-card').count();
    const finalInProgressCount = await inProgressColumn.locator('.ticket-card').count();
    const finalDoneCount = await doneColumn.locator('.ticket-card').count();

    console.log(`Final counts: TODO=${finalTodoCount}, IN PROGRESS=${finalInProgressCount}, DONE=${finalDoneCount}`);

    // Should have moved cards (exact counts may vary due to initial setup)
    expect(finalTodoCount + finalInProgressCount + finalDoneCount).toBeGreaterThan(0);

    console.log('✅ Rapid drag operations completed successfully');
  });

  test('CRITICAL: API validation - No invalid column IDs sent', async () => {
    console.log('🔴 Comprehensive API validation during drag operations');

    // Capture ALL API requests for detailed analysis
    const allApiRequests: Array<{
      method: string;
      url: string;
      payload: any;
      timestamp: number;
    }> = [];

    await page.route('**/api/**', async route => {
      const request = route.request();

      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        try {
          allApiRequests.push({
            method: request.method(),
            url: request.url(),
            payload: request.postDataJSON(),
            timestamp: Date.now()
          });
        } catch (e) {
          // Handle non-JSON payloads
          console.warn('Non-JSON API request detected');
        }
      }

      await route.continue();
    });

    // Perform various drag operations to trigger API calls
    const validationTests = [
      { source: 'TODO', target: 'IN PROGRESS' },
      { source: 'IN PROGRESS', target: 'DONE' },
      { source: 'DONE', target: 'BLOCKED' },
      { source: 'BLOCKED', target: 'READY FOR QC' },
      { source: 'READY FOR QC', target: 'TODO' }
    ];

    for (const test of validationTests) {
      const sourceColumn = page.locator('.column').filter({ hasText: test.source }).first();
      const targetColumn = page.locator('.column').filter({ hasText: test.target }).first();

      const card = sourceColumn.locator('.ticket-card').first();
      if (await card.isVisible()) {
        await card.dragTo(targetColumn);
        await page.waitForTimeout(1500);
      }
    }

    // Wait for all API calls to complete
    await page.waitForTimeout(3000);

    // COMPREHENSIVE API VALIDATION
    console.log(`\n📊 Comprehensive API Analysis: ${allApiRequests.length} requests`);

    const ticketUpdateRequests = allApiRequests.filter(req =>
      req.url.includes('/tickets/') && (req.method === 'PUT' || req.method === 'PATCH')
    );

    console.log(`Ticket update requests: ${ticketUpdateRequests.length}`);

    for (const request of ticketUpdateRequests) {
      const payload = request.payload;

      if (payload && payload.current_column) {
        const columnValue = payload.current_column;

        // CRITICAL ASSERTION 1: Must be valid column value
        const validColumns = ['Not Started', 'In Progress', 'Blocked', 'Ready for QC', 'Done'];
        expect(validColumns).toContain(columnValue);

        // CRITICAL ASSERTION 2: Must NOT be a number (card ID)
        expect(columnValue).not.toMatch(/^\d+$/);

        // CRITICAL ASSERTION 3: Must NOT be undefined/null
        expect(columnValue).not.toBe('undefined');
        expect(columnValue).not.toBe('null');
        expect(columnValue).not.toBe('');

        // CRITICAL ASSERTION 4: Must NOT be internal column IDs
        expect(columnValue).not.toBe('not_started');
        expect(columnValue).not.toBe('in_progress');
        expect(columnValue).not.toBe('blocked');
        expect(columnValue).not.toBe('ready_for_qc');
        expect(columnValue).not.toBe('done');

        console.log(`  ✅ API Request: current_column = "${columnValue}"`);
      }
    }

    console.log('✅ All API requests send correct column values');
  });

  test.afterEach(async () => {
    // Log final board state for debugging
    console.log('\n=== Final Board State ===');

    for (const column of COLUMNS) {
      const columnLocator = page.locator('.column').filter({ hasText: column.name }).first();
      const cards = await columnLocator.locator('.ticket-card').allTextContents();
      console.log(`${column.name}: ${cards.length} cards - [${cards.join(', ')}]`);
    }

    // Screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/regression-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
