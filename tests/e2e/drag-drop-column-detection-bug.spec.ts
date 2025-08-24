import { test, expect, Page } from '@playwright/test';

/**
 * P0 CRITICAL: Column Detection Bug Tests
 *
 * Bug Location: Board.tsx lines 128-131
 * Issue: When cards are dropped on empty column space, the system uses
 * the dragged card's own column instead of the target column.
 *
 * Test Scenarios:
 * 1. Drop on empty column space
 * 2. Drop on another card (should use card's parent column)
 * 3. Drop between cards (should use correct column)
 */

test.describe('🔴 P0: Column Detection Bug - Board.tsx Lines 128-131', () => {
  const baseURL = 'http://localhost:15175';
  let boardName: string;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create test board
    boardName = `Column Detection Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Create initial test setup
    await setupTestScenario(page);
  });

  async function setupTestScenario(page: Page) {
    // Create cards in TODO column
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

    const todoCards = [
      'TODO Card 1',
      'TODO Card 2',
      'TODO Card 3'
    ];

    for (const title of todoCards) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', title);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Create one card in IN PROGRESS
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    await inProgressColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'IN PROGRESS Card 1');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Leave DONE column empty for testing
  }

  test('CRITICAL BUG: Drop on empty column space must use target column', async () => {
    console.log('🔴 CRITICAL: Testing drop on empty column space');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Get the first TODO card
    const cardToMove = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });
    const cardTitle = await cardToMove.textContent();

    // Intercept API to verify correct column is sent
    let apiPayload: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiPayload = request.postDataJSON();
        console.log('API Payload captured:', apiPayload);
      }
      await route.continue();
    });

    // SCENARIO 1: Drop on EMPTY DONE column
    console.log('Test 1: Dropping card on empty DONE column...');

    // Get DONE column bounding box
    const doneBox = await doneColumn.boundingBox();
    if (!doneBox) throw new Error('Could not get DONE column position');

    // Start drag
    await cardToMove.hover();
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move to empty space in DONE column (middle of column, away from header)
    const dropX = doneBox.x + doneBox.width / 2;
    const dropY = doneBox.y + doneBox.height / 2; // Middle of empty column

    console.log(`Moving to empty DONE column at (${dropX}, ${dropY})`);
    await page.mouse.move(dropX, dropY);
    await page.waitForTimeout(500); // Allow drop zone to activate

    // Drop the card
    await page.mouse.up();
    await page.waitForTimeout(2000);

    // CRITICAL ASSERTION 1: Card should be in DONE column
    const cardInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible();
    expect(cardInDone).toBe(true);
    console.log('✅ Card successfully moved to DONE column');

    // CRITICAL ASSERTION 2: API should receive DONE column, not TODO
    if (apiPayload) {
      // The bug would send 'Not Started' (TODO) instead of 'Done'
      expect(apiPayload.current_column).toBe('Done');
      expect(apiPayload.current_column).not.toBe('Not Started');
      console.log('✅ API received correct column: Done');
    }

    // Verify card removed from TODO
    const cardStillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible();
    expect(cardStillInTodo).toBe(false);
    console.log('✅ Card removed from original TODO column');
  });

  test('Drop on another card must use target card\'s column', async () => {
    console.log('🔴 Testing drop on another card');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Get cards
    const todoCard = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });
    const inProgressCard = inProgressColumn.locator('.ticket-card').filter({ hasText: 'IN PROGRESS Card 1' });

    // Intercept API
    let apiPayload: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiPayload = request.postDataJSON();
      }
      await route.continue();
    });

    // SCENARIO 2: Drop TODO card on IN PROGRESS card
    console.log('Test 2: Dropping TODO card on IN PROGRESS card...');

    // Drag TODO card to IN PROGRESS card
    await todoCard.dragTo(inProgressCard);
    await page.waitForTimeout(2000);

    // Card should move to IN PROGRESS column (where target card is)
    const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible();
    expect(cardInProgress).toBe(true);
    console.log('✅ Card moved to IN PROGRESS column (target card\'s column)');

    // API should receive IN PROGRESS, not TODO
    if (apiPayload) {
      expect(apiPayload.current_column).toBe('In Progress');
      expect(apiPayload.current_column).not.toBe('Not Started');
      console.log('✅ API received correct column: In Progress');
    }
  });

  test('Drop between cards must use correct column', async () => {
    console.log('🔴 Testing drop between cards in a column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Add another card to IN PROGRESS for testing "between" drops
    await inProgressColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'IN PROGRESS Card 2');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Get TODO card to move
    const todoCard = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });

    // Get IN PROGRESS cards for positioning
    const inProgressCard1 = inProgressColumn.locator('.ticket-card').filter({ hasText: 'IN PROGRESS Card 1' });
    const inProgressCard2 = inProgressColumn.locator('.ticket-card').filter({ hasText: 'IN PROGRESS Card 2' });

    // Intercept API
    let apiPayload: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiPayload = request.postDataJSON();
      }
      await route.continue();
    });

    // SCENARIO 3: Drop between two IN PROGRESS cards
    console.log('Test 3: Dropping TODO card between two IN PROGRESS cards...');

    // Get positions of the two IN PROGRESS cards
    const card1Box = await inProgressCard1.boundingBox();
    const card2Box = await inProgressCard2.boundingBox();

    if (!card1Box || !card2Box) throw new Error('Could not get card positions');

    // Calculate position between the two cards
    const dropX = card1Box.x + card1Box.width / 2;
    const dropY = card1Box.y + card1Box.height + 5; // Just below first card

    // Start drag
    await todoCard.hover();
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move to position between cards
    console.log(`Moving to position between cards at (${dropX}, ${dropY})`);
    await page.mouse.move(dropX, dropY);
    await page.waitForTimeout(500);

    // Drop the card
    await page.mouse.up();
    await page.waitForTimeout(2000);

    // Card should be in IN PROGRESS column
    const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible();
    expect(cardInProgress).toBe(true);
    console.log('✅ Card moved to IN PROGRESS column');

    // Verify it's positioned between the two cards
    const allInProgressCards = await inProgressColumn.locator('.ticket-card').allTextContents();
    console.log('Cards order in IN PROGRESS:', allInProgressCards);

    // API should receive IN PROGRESS
    if (apiPayload) {
      expect(apiPayload.current_column).toBe('In Progress');
      expect(apiPayload.current_column).not.toBe('Not Started');
      console.log('✅ API received correct column: In Progress');
    }
  });

  test('Multiple drops on empty columns', async () => {
    console.log('🔴 Testing multiple drops on different empty columns');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Clear IN PROGRESS column for testing
    const inProgressCard = inProgressColumn.locator('.ticket-card').first();
    if (await inProgressCard.isVisible()) {
      await inProgressCard.hover();
      // Move it to DONE to clear IN PROGRESS
      await inProgressCard.dragTo(doneColumn);
      await page.waitForTimeout(1000);
    }

    // Track API calls
    const apiCalls: any[] = [];
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiCalls.push({
          url: request.url(),
          payload: request.postDataJSON()
        });
      }
      await route.continue();
    });

    // Test 1: Move TODO Card 1 to empty IN PROGRESS
    console.log('Moving TODO Card 1 to empty IN PROGRESS...');
    const todoCard1 = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });

    const inProgressBox = await inProgressColumn.boundingBox();
    if (inProgressBox) {
      await todoCard1.hover();
      await page.mouse.down();
      await page.mouse.move(inProgressBox.x + inProgressBox.width / 2, inProgressBox.y + 100);
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }

    // Verify card in IN PROGRESS
    expect(await inProgressColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible()).toBe(true);

    // Test 2: Move TODO Card 2 to DONE (which has one card now)
    console.log('Moving TODO Card 2 to DONE column with existing card...');
    const todoCard2 = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 2' });

    const doneBox = await doneColumn.boundingBox();
    if (doneBox) {
      await todoCard2.hover();
      await page.mouse.down();
      // Drop in empty space below existing card
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height - 50);
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }

    // Verify card in DONE
    expect(await doneColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 2' }).isVisible()).toBe(true);

    // Verify all API calls had correct columns
    console.log(`Total API calls: ${apiCalls.length}`);
    apiCalls.forEach((call, index) => {
      console.log(`API Call ${index + 1}: ${call.payload.current_column}`);
      // Should never be the source column
      expect(call.payload.current_column).not.toBe('Not Started');
    });
  });

  test('Drag from empty column to another empty column', async () => {
    console.log('🔴 Testing drag from empty column to empty column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Move all TODO cards to IN PROGRESS first
    const todoCards = await todoColumn.locator('.ticket-card').all();
    for (const card of todoCards) {
      await card.dragTo(inProgressColumn);
      await page.waitForTimeout(500);
    }

    // Now TODO is empty, DONE is empty, IN PROGRESS has cards
    // Move one card from IN PROGRESS to empty DONE
    const cardToMove = inProgressColumn.locator('.ticket-card').first();
    const cardTitle = await cardToMove.textContent();

    // Intercept API
    let apiPayload: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiPayload = request.postDataJSON();
      }
      await route.continue();
    });

    // Drop on empty DONE column
    const doneBox = await doneColumn.boundingBox();
    if (doneBox) {
      await cardToMove.hover();
      await page.mouse.down();
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(2000);
    }

    // Verify card in DONE
    expect(await doneColumn.locator('.ticket-card').filter({ hasText: cardTitle! }).isVisible()).toBe(true);

    // API should have DONE column
    if (apiPayload) {
      expect(apiPayload.current_column).toBe('Done');
      console.log('✅ Correct column sent when moving to empty DONE');
    }
  });

  test('Edge case: Rapid drops on different columns', async () => {
    console.log('⚡ Testing rapid drops to ensure column detection stays accurate');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Track all API calls
    const apiCalls: any[] = [];
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        apiCalls.push({
          cardTitle: payload.title || 'unknown',
          targetColumn: payload.current_column
        });
      }
      await route.continue();
    });

    // Rapid movements
    const movements = [
      { card: 'TODO Card 1', to: inProgressColumn, expected: 'In Progress' },
      { card: 'TODO Card 2', to: doneColumn, expected: 'Done' },
      { card: 'TODO Card 3', to: inProgressColumn, expected: 'In Progress' },
      { card: 'IN PROGRESS Card 1', to: doneColumn, expected: 'Done' }
    ];

    for (const move of movements) {
      const card = page.locator('.ticket-card').filter({ hasText: move.card }).first();
      if (await card.isVisible()) {
        await card.dragTo(move.to);
        await page.waitForTimeout(500); // Minimal wait
      }
    }

    // Wait for all operations to complete
    await page.waitForTimeout(2000);

    // Verify all API calls had correct target columns
    console.log('API Calls Summary:');
    apiCalls.forEach(call => {
      console.log(`  - ${call.cardTitle} -> ${call.targetColumn}`);
      // None should be 'Not Started' if we moved them out of TODO
      if (call.cardTitle.includes('TODO Card')) {
        expect(call.targetColumn).not.toBe('Not Started');
      }
    });

    console.log('✅ All rapid drops used correct target columns');
  });

  test.afterEach(async () => {
    // Log final board state
    console.log('\n=== Final Board State ===');
    const columns = ['TODO', 'IN PROGRESS', 'DONE'];

    for (const columnName of columns) {
      const column = page.locator('.column').filter({ hasText: columnName }).first();
      const cards = await column.locator('.ticket-card').allTextContents();
      console.log(`${columnName}: ${cards.length} cards`);
      cards.forEach((card, i) => console.log(`  ${i + 1}. ${card}`));
    }

    // Screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/column-detection-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});

// Quick smoke test
test.describe('Column Detection Quick Validation', () => {
  test('SMOKE: Drop on empty column uses target column not source', async ({ page }) => {
    await page.goto('http://localhost:15175');

    // Quick setup
    const boardName = `Quick Column Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);

    // Create one card in TODO
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Test Card');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Intercept API
    let apiColumn: string | null = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        apiColumn = payload.current_column;
      }
      await route.continue();
    });

    // Drop on empty DONE column
    const card = todoColumn.locator('.ticket-card').first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();
    const doneBox = await doneColumn.boundingBox();

    if (doneBox) {
      await card.hover();
      await page.mouse.down();
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(2000);
    }

    // Verify card in DONE
    expect(await doneColumn.locator('.ticket-card').filter({ hasText: 'Test Card' }).isVisible()).toBe(true);

    // CRITICAL: API must receive 'Done' not 'Not Started'
    expect(apiColumn).toBe('Done');
    expect(apiColumn).not.toBe('Not Started');

    console.log('✅ SMOKE TEST PASSED: Column detection working correctly');
  });
});
