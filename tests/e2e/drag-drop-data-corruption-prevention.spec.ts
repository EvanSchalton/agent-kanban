import { test, expect, Page } from '@playwright/test';

/**
 * P0 CRITICAL: Data Corruption Prevention Tests
 *
 * Purpose: Prevent the critical data loss bug where cards are moved to wrong columns
 * during drag & drop operations, causing data corruption and user confusion.
 *
 * Bug Context: Board.tsx line 136-139 bug where over.id === active.id leads to
 * using the dragged card's column instead of the target column.
 *
 * Test Coverage:
 * 1. Detect when drag operations would corrupt data
 * 2. Verify database integrity after drag operations
 * 3. Ensure UI state matches backend state
 * 4. Validate data consistency across WebSocket updates
 */

test.describe('🔴 P0: Data Corruption Prevention - Drag & Drop', () => {
  const baseURL = 'http://localhost:15175';
  let boardName: string;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create test board with predictable name
    boardName = `Data Corruption Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Create test data setup
    await setupDataCorruptionTestScenario(page);
  });

  async function setupDataCorruptionTestScenario(page: Page) {
    const columns = [
      { name: 'TODO', cards: ['Critical Bug Fix', 'Feature A', 'Feature B'] },
      { name: 'IN PROGRESS', cards: ['Urgent Task'] },
      { name: 'DONE', cards: [] }
    ];

    for (const col of columns) {
      const column = page.locator('.column').filter({ hasText: col.name }).first();

      for (const cardTitle of col.cards) {
        await column.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', cardTitle);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(800); // Allow for creation
      }
    }

    // Wait for all cards to be created
    await page.waitForTimeout(1000);
  }

  test('CRITICAL: Database integrity check during drag operations', async () => {
    console.log('🔴 CRITICAL: Testing database integrity during drag operations');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Track all API calls to verify data integrity
    const apiOperations: Array<{
      ticketId: string;
      operation: string;
      requestedColumn: string;
      timestamp: number;
    }> = [];

    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      const url = request.url();

      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        const ticketId = url.split('/').pop() || 'unknown';

        apiOperations.push({
          ticketId,
          operation: 'move',
          requestedColumn: payload.current_column,
          timestamp: Date.now()
        });

        console.log(`API Call: Moving ticket ${ticketId} to column "${payload.current_column}"`);
      }

      await route.continue();
    });

    // SCENARIO 1: Move Critical Bug Fix from TODO to DONE (empty column)
    console.log('Test 1: Moving Critical Bug Fix to empty DONE column...');
    const criticalBugCard = todoColumn.locator('.ticket-card').filter({ hasText: 'Critical Bug Fix' });

    const doneBox = await doneColumn.boundingBox();
    if (!doneBox) throw new Error('Could not get DONE column position');

    await criticalBugCard.hover();
    await page.mouse.down();
    await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(2000);

    // CRITICAL ASSERTION: Card must be in DONE column (database integrity)
    const cardInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'Critical Bug Fix' }).isVisible();
    expect(cardInDone).toBe(true);

    // CRITICAL ASSERTION: Card must NOT be in original TODO column
    const cardStillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'Critical Bug Fix' }).isVisible();
    expect(cardStillInTodo).toBe(false);

    // CRITICAL ASSERTION: API must have requested correct column
    const criticalBugOperation = apiOperations.find(op =>
      op.requestedColumn === 'Done' || op.requestedColumn === 'done'
    );
    expect(criticalBugOperation).toBeTruthy();
    expect(criticalBugOperation?.requestedColumn).not.toBe('Not Started');
    console.log('✅ Database integrity maintained for critical card move');

    // SCENARIO 2: Move Feature A to IN PROGRESS (column with existing card)
    console.log('Test 2: Moving Feature A to IN PROGRESS column...');
    const featureACard = todoColumn.locator('.ticket-card').filter({ hasText: 'Feature A' });
    const urgentTaskCard = inProgressColumn.locator('.ticket-card').filter({ hasText: 'Urgent Task' });

    // Clear API log for this test
    apiOperations.length = 0;

    await featureACard.dragTo(urgentTaskCard);
    await page.waitForTimeout(2000);

    // Verify data integrity
    const featureAInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Feature A' }).isVisible();
    expect(featureAInProgress).toBe(true);

    const featureAStillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'Feature A' }).isVisible();
    expect(featureAStillInTodo).toBe(false);

    // Verify API integrity
    const featureAOperation = apiOperations.find(op =>
      op.requestedColumn === 'In Progress' || op.requestedColumn === 'in_progress'
    );
    expect(featureAOperation).toBeTruthy();
    console.log('✅ Data integrity maintained for card-to-card drop');
  });

  test('UI state vs Backend state consistency validation', async () => {
    console.log('🔴 Testing UI/Backend state consistency during rapid operations');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Track frontend state changes
    const frontendState: Array<{
      card: string;
      column: string;
      timestamp: number;
    }> = [];

    // Track backend operations
    const backendOperations: Array<{
      ticketId: string;
      targetColumn: string;
      timestamp: number;
    }> = [];

    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        const ticketId = request.url().split('/').pop() || 'unknown';

        backendOperations.push({
          ticketId,
          targetColumn: payload.current_column,
          timestamp: Date.now()
        });
      }
      await route.continue();
    });

    // Perform multiple rapid operations
    const operations = [
      { card: 'Critical Bug Fix', target: doneColumn, expectedColumn: 'Done' },
      { card: 'Feature A', target: inProgressColumn, expectedColumn: 'In Progress' },
      { card: 'Feature B', target: doneColumn, expectedColumn: 'Done' }
    ];

    for (const op of operations) {
      const card = page.locator('.ticket-card').filter({ hasText: op.card }).first();
      if (await card.isVisible()) {
        await card.dragTo(op.target);
        await page.waitForTimeout(1000);

        // Record frontend state
        const isInTarget = await op.target.locator('.ticket-card').filter({ hasText: op.card }).isVisible();
        frontendState.push({
          card: op.card,
          column: isInTarget ? op.expectedColumn : 'UNKNOWN',
          timestamp: Date.now()
        });
      }
    }

    // Wait for all backend operations to complete
    await page.waitForTimeout(3000);

    // CRITICAL VALIDATION: Frontend and backend must be consistent
    console.log('Frontend State:', frontendState);
    console.log('Backend Operations:', backendOperations);

    // Each frontend move should have corresponding backend operation
    for (const frontendMove of frontendState) {
      const correspondingBackend = backendOperations.find(bo =>
        bo.targetColumn === frontendMove.column &&
        Math.abs(bo.timestamp - frontendMove.timestamp) < 5000 // 5 second tolerance
      );

      expect(correspondingBackend).toBeTruthy();
      console.log(`✅ ${frontendMove.card}: Frontend/Backend state consistent`);
    }

    // No backend operation should target wrong column
    for (const backendOp of backendOperations) {
      expect(backendOp.targetColumn).not.toBe('Not Started'); // Would indicate the bug
      expect(backendOp.targetColumn).not.toBe('TODO'); // Should use proper API values
    }

    console.log('✅ UI/Backend state consistency validated');
  });

  test('WebSocket data corruption prevention', async () => {
    console.log('🔴 Testing WebSocket data corruption prevention');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Listen for WebSocket messages that might indicate data corruption
    const wsMessages: Array<{
      type: string;
      data: any;
      timestamp: number;
    }> = [];

    await page.addInitScript(() => {
      const originalWS = window.WebSocket;
      window.WebSocket = class extends originalWS {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);

          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              (window as any).wsMessages = (window as any).wsMessages || [];
              (window as any).wsMessages.push({
                type: data.type || 'unknown',
                data: data,
                timestamp: Date.now()
              });
            } catch (e) {
              // Non-JSON message
            }
          });
        }
      };
    });

    // Perform drag operation that previously caused corruption
    const featureBCard = todoColumn.locator('.ticket-card').filter({ hasText: 'Feature B' });

    const doneBox = await doneColumn.boundingBox();
    if (doneBox) {
      await featureBCard.hover();
      await page.mouse.down();
      // Drop in empty space of DONE column
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(3000); // Wait for WebSocket propagation
    }

    // Extract WebSocket messages
    const messages = await page.evaluate(() => (window as any).wsMessages || []);

    // CRITICAL VALIDATION: No WebSocket message should indicate wrong column
    for (const message of messages) {
      if (message.data && message.data.ticket) {
        const ticket = message.data.ticket;
        if (ticket.title === 'Feature B') {
          // This card should be in 'Done' column, not 'Not Started'
          expect(ticket.current_column).not.toBe('Not Started');
          expect(ticket.current_column).not.toBe('not_started');
          expect(ticket.current_column).not.toBe('TODO');
          console.log(`✅ WebSocket message shows correct column: ${ticket.current_column}`);
        }
      }
    }

    // Verify final UI state matches expected state
    const cardInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'Feature B' }).isVisible();
    expect(cardInDone).toBe(true);

    const cardStillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'Feature B' }).isVisible();
    expect(cardStillInTodo).toBe(false);

    console.log('✅ WebSocket data corruption prevention validated');
  });

  test('Data consistency during page refresh', async () => {
    console.log('🔴 Testing data consistency after page refresh');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Move a card and record the operation
    const criticalBugCard = todoColumn.locator('.ticket-card').filter({ hasText: 'Critical Bug Fix' });

    let apiTargetColumn: string = '';
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        apiTargetColumn = payload.current_column;
      }
      await route.continue();
    });

    // Perform the move
    await criticalBugCard.dragTo(inProgressColumn);
    await page.waitForTimeout(2000);

    // Verify the move worked
    const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Critical Bug Fix' }).isVisible();
    expect(cardInProgress).toBe(true);
    expect(apiTargetColumn).toBe('In Progress');

    // CRITICAL TEST: Refresh page and verify data persistence
    console.log('Refreshing page to test data persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.column');

    // After refresh, card should still be in IN PROGRESS
    const inProgressColumnAfterRefresh = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const todoColumnAfterRefresh = page.locator('.column').filter({ hasText: 'TODO' }).first();

    const cardStillInProgress = await inProgressColumnAfterRefresh.locator('.ticket-card').filter({ hasText: 'Critical Bug Fix' }).isVisible();
    const cardBackInTodo = await todoColumnAfterRefresh.locator('.ticket-card').filter({ hasText: 'Critical Bug Fix' }).isVisible();

    expect(cardStillInProgress).toBe(true);
    expect(cardBackInTodo).toBe(false);

    console.log('✅ Data consistency maintained after page refresh');
  });

  test('Concurrent user simulation - data corruption prevention', async () => {
    console.log('🔴 Testing concurrent user simulation');

    // Simulate concurrent operations by making rapid API calls while UI operations happen
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    let apiCallCount = 0;
    const apiResults: string[] = [];

    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiCallCount++;
        const payload = request.postDataJSON();
        apiResults.push(payload.current_column);

        // Simulate network delay to test race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await route.continue();
    });

    // Start concurrent operations
    const operations = [
      async () => {
        const card = todoColumn.locator('.ticket-card').filter({ hasText: 'Feature A' });
        await card.dragTo(doneColumn);
      },
      async () => {
        const card = todoColumn.locator('.ticket-card').filter({ hasText: 'Feature B' });
        await card.dragTo(doneColumn);
      }
    ];

    // Execute operations concurrently
    await Promise.all(operations.map(op => op()));
    await page.waitForTimeout(3000);

    // CRITICAL VALIDATION: All API calls should target correct columns
    console.log(`Total API calls: ${apiCallCount}`);
    console.log('API target columns:', apiResults);

    for (const targetColumn of apiResults) {
      expect(targetColumn).not.toBe('Not Started'); // The bug would cause this
      expect(targetColumn).not.toBe('TODO'); // Should use proper API values
    }

    // Verify final state
    const featureAInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'Feature A' }).isVisible();
    const featureBInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'Feature B' }).isVisible();

    expect(featureAInDone).toBe(true);
    expect(featureBInDone).toBe(true);

    console.log('✅ Concurrent operations completed without data corruption');
  });

  test.afterEach(async () => {
    // Log final state for debugging
    console.log('\n=== Data Corruption Test - Final State ===');

    const columns = ['TODO', 'IN PROGRESS', 'DONE'];
    for (const columnName of columns) {
      const column = page.locator('.column').filter({ hasText: columnName }).first();
      const cards = await column.locator('.ticket-card').allTextContents();
      console.log(`${columnName}: ${cards.length} cards - ${cards.join(', ')}`);
    }

    // Take screenshot on failure for debugging
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/data-corruption-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
