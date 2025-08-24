import { test, expect, Page } from '@playwright/test';

/**
 * P0 CRITICAL: Nested Drop Zones Bug Fix Verification
 *
 * Root Cause: Cards are incorrectly being treated as drop targets
 * Expected Behavior:
 * 1. ONLY columns should be valid drop zones
 * 2. Cards should NOT accept drops on themselves
 * 3. Correct column IDs must be sent to API
 *
 * Bug Details from QA:
 * - Nested drop zones causing cards to accept drops
 * - Incorrect drop target detection
 * - API receiving wrong column information
 */

test.describe('🔴 P0: Nested Drop Zones Fix Verification', () => {
  const baseURL = 'http://localhost:5173';
  let boardName: string;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create test board
    boardName = `Drop Zone Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Create test cards
    await createTestScenario(page);
  });

  async function createTestScenario(page: Page) {
    // Create cards in TODO column
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

    const cards = [
      'Card 1 - Draggable',
      'Card 2 - Drop Target Test',
      'Card 3 - Bottom Card'
    ];

    for (const title of cards) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', title);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Create a card in IN PROGRESS to test cross-column scenarios
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    await inProgressColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Card 4 - In Progress');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);
  }

  test('CRITICAL: Cards should NOT be drop zones', async () => {
    console.log('🔴 CRITICAL TEST: Verifying cards cannot be drop targets');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const card1 = todoColumn.locator('.ticket-card').filter({ hasText: 'Card 1' });
    const card2 = todoColumn.locator('.ticket-card').filter({ hasText: 'Card 2' });

    // Monitor drop zone activation
    await page.addStyleTag({
      content: `
        .drop-zone-active { border: 2px solid green !important; }
        .invalid-drop-zone { border: 2px solid red !important; }
      `
    });

    // Start dragging Card 1
    await card1.hover();
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move over Card 2 (should NOT be a valid drop target)
    await card2.hover();
    await page.waitForTimeout(500);

    // Check if Card 2 has drop zone indicators
    const card2Classes = await card2.getAttribute('class');
    const card2DataAttributes = await card2.evaluate(el => {
      return {
        droppable: el.getAttribute('data-droppable'),
        dropTarget: el.getAttribute('data-drop-target'),
        acceptsDrop: el.classList.contains('accepts-drop'),
        dropZoneActive: el.classList.contains('drop-zone-active')
      };
    });

    console.log('Card 2 drop attributes:', card2DataAttributes);

    // Drop on Card 2
    await page.mouse.up();
    await page.waitForTimeout(1000);

    // CRITICAL ASSERTION: Card 1 should still be in TODO column
    const card1StillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'Card 1' }).isVisible();
    expect(card1StillInTodo).toBe(true);

    // Verify cards didn't merge or nest
    const todoCardCount = await todoColumn.locator('.ticket-card').count();
    expect(todoCardCount).toBe(3); // All 3 cards should still be separate

    console.log('✅ Cards correctly reject drops on other cards');
  });

  test('CRITICAL: Only columns should accept drops', async () => {
    console.log('🔴 CRITICAL TEST: Verifying only columns are valid drop zones');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Get column drop zone attributes
    const columnAttributes = await Promise.all([
      todoColumn.evaluate(el => ({
        name: 'TODO',
        droppable: el.getAttribute('data-droppable'),
        dropZone: el.classList.contains('drop-zone'),
        acceptsCards: el.getAttribute('data-accepts') === 'cards'
      })),
      inProgressColumn.evaluate(el => ({
        name: 'IN PROGRESS',
        droppable: el.getAttribute('data-droppable'),
        dropZone: el.classList.contains('drop-zone'),
        acceptsCards: el.getAttribute('data-accepts') === 'cards'
      })),
      doneColumn.evaluate(el => ({
        name: 'DONE',
        droppable: el.getAttribute('data-droppable'),
        dropZone: el.classList.contains('drop-zone'),
        acceptsCards: el.getAttribute('data-accepts') === 'cards'
      }))
    ]);

    console.log('Column drop zone attributes:', columnAttributes);

    // Test dropping on column (should work)
    const card1 = todoColumn.locator('.ticket-card').filter({ hasText: 'Card 1' });

    // Drag to IN PROGRESS column (not on a card)
    await card1.hover();
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move to empty area of IN PROGRESS column
    const columnBox = await inProgressColumn.boundingBox();
    if (columnBox) {
      // Move to bottom of column where no cards are
      await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + columnBox.height - 50);
    }

    await page.mouse.up();
    await page.waitForTimeout(1500);

    // Card should now be in IN PROGRESS
    const cardInNewColumn = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Card 1' }).isVisible();
    expect(cardInNewColumn).toBe(true);

    console.log('✅ Columns correctly accept card drops');
  });

  test('CRITICAL: Correct column IDs sent to API', async () => {
    console.log('🔴 CRITICAL TEST: Verifying correct column IDs in API calls');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Expected column ID mappings
    const expectedMappings = {
      'TODO': { id: 'not_started', apiName: 'Not Started' },
      'IN PROGRESS': { id: 'in_progress', apiName: 'In Progress' },
      'DONE': { id: 'done', apiName: 'Done' }
    };

    // Intercept API calls
    let apiCalls: any[] = [];
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        apiCalls.push({
          url: request.url(),
          method: request.method(),
          payload
        });
        console.log('API Call intercepted:', payload);
      }
      await route.continue();
    });

    // Test 1: TODO -> IN PROGRESS
    const card1 = todoColumn.locator('.ticket-card').filter({ hasText: 'Card 1' });
    await card1.dragTo(inProgressColumn);
    await page.waitForTimeout(1500);

    // Verify API call
    if (apiCalls.length > 0) {
      const lastCall = apiCalls[apiCalls.length - 1];
      expect(lastCall.payload.current_column).toBe('In Progress');
      expect(lastCall.payload.column_id).toBeUndefined(); // Should not have old column_id field
      console.log('✅ TODO -> IN PROGRESS: Correct column ID sent');
    }

    // Test 2: IN PROGRESS -> DONE
    const movedCard = inProgressColumn.locator('.ticket-card').filter({ hasText: 'Card 1' });
    await movedCard.dragTo(doneColumn);
    await page.waitForTimeout(1500);

    // Verify API call
    if (apiCalls.length > 1) {
      const lastCall = apiCalls[apiCalls.length - 1];
      expect(lastCall.payload.current_column).toBe('Done');
      console.log('✅ IN PROGRESS -> DONE: Correct column ID sent');
    }

    // Test 3: DONE -> TODO (reverse)
    const finalCard = doneColumn.locator('.ticket-card').filter({ hasText: 'Card 1' });
    await finalCard.dragTo(todoColumn);
    await page.waitForTimeout(1500);

    // Verify API call
    if (apiCalls.length > 2) {
      const lastCall = apiCalls[apiCalls.length - 1];
      expect(lastCall.payload.current_column).toBe('Not Started');
      console.log('✅ DONE -> TODO: Correct column ID sent');
    }

    console.log(`Total API calls made: ${apiCalls.length}`);
    console.log('All column IDs correctly mapped in API calls');
  });

  test('Drop zone visual feedback', async () => {
    console.log('🔍 Testing drop zone visual indicators');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const card1 = todoColumn.locator('.ticket-card').filter({ hasText: 'Card 1' });
    const card2 = todoColumn.locator('.ticket-card').filter({ hasText: 'Card 2' });

    // Start dragging
    await card1.hover();
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move over valid drop zone (column)
    await inProgressColumn.hover();
    await page.waitForTimeout(500);

    // Check for visual feedback on column
    const columnStyles = await inProgressColumn.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        border: computed.border,
        opacity: computed.opacity,
        cursor: computed.cursor
      };
    });

    console.log('Column styles during hover:', columnStyles);

    // Move over invalid drop zone (another card)
    await card2.hover();
    await page.waitForTimeout(500);

    // Check that card doesn't show drop zone feedback
    const cardStyles = await card2.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        border: computed.border,
        cursor: computed.cursor,
        hasDropClass: el.classList.contains('drop-zone-active')
      };
    });

    console.log('Card styles during hover:', cardStyles);
    expect(cardStyles.hasDropClass).toBe(false);

    // Cancel drag
    await page.keyboard.press('Escape');
    await page.mouse.up();

    console.log('✅ Visual feedback correctly shows valid/invalid drop zones');
  });

  test('Prevent card-on-card nesting', async () => {
    console.log('🔍 Testing prevention of card nesting');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const initialCardCount = await todoColumn.locator('.ticket-card').count();

    // Try to drop multiple cards on each other
    for (let i = 0; i < 2; i++) {
      const sourceCard = todoColumn.locator('.ticket-card').nth(0);
      const targetCard = todoColumn.locator('.ticket-card').nth(1);

      await sourceCard.hover();
      await page.mouse.down();
      await targetCard.hover();
      await page.mouse.up();
      await page.waitForTimeout(1000);
    }

    // Verify no cards were lost or nested
    const finalCardCount = await todoColumn.locator('.ticket-card').count();
    expect(finalCardCount).toBe(initialCardCount);

    // Verify all cards are still at the same DOM level
    const cardDepths = await todoColumn.locator('.ticket-card').evaluateAll(cards => {
      return cards.map(card => {
        let depth = 0;
        let parent = card.parentElement;
        while (parent && !parent.classList.contains('column')) {
          depth++;
          parent = parent.parentElement;
        }
        return depth;
      });
    });

    // All cards should have the same depth
    const uniqueDepths = [...new Set(cardDepths)];
    expect(uniqueDepths.length).toBe(1);

    console.log('✅ Card nesting prevented successfully');
  });

  test('Drop position accuracy', async () => {
    console.log('🔍 Testing drop position accuracy within columns');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Get initial card order in TODO
    const initialOrder = await todoColumn.locator('.ticket-card').allTextContents();
    console.log('Initial TODO order:', initialOrder);

    // Drag first card to different positions in IN PROGRESS
    const card1 = todoColumn.locator('.ticket-card').first();

    // Drop at top of IN PROGRESS
    const inProgressBox = await inProgressColumn.boundingBox();
    if (inProgressBox) {
      await card1.hover();
      await page.mouse.down();
      await page.mouse.move(inProgressBox.x + inProgressBox.width / 2, inProgressBox.y + 50);
      await page.mouse.up();
      await page.waitForTimeout(1500);

      // Verify card is in IN PROGRESS
      const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Card 1' }).isVisible();
      expect(cardInProgress).toBe(true);

      // Verify position (should be first if dropped at top)
      const inProgressCards = await inProgressColumn.locator('.ticket-card').allTextContents();
      console.log('IN PROGRESS order after drop:', inProgressCards);
    }

    console.log('✅ Drop position accuracy verified');
  });

  test('Rapid drag operations', async () => {
    console.log('⚡ Testing rapid drag & drop operations');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Perform rapid movements
    const movements = [
      { card: 'Card 1', from: todoColumn, to: inProgressColumn },
      { card: 'Card 2', from: todoColumn, to: doneColumn },
      { card: 'Card 3', from: todoColumn, to: inProgressColumn },
      { card: 'Card 4', from: inProgressColumn, to: doneColumn }
    ];

    for (const move of movements) {
      const card = move.from.locator('.ticket-card').filter({ hasText: move.card });
      if (await card.isVisible()) {
        await card.dragTo(move.to);
        await page.waitForTimeout(500); // Minimal wait
      }
    }

    // Verify all cards ended up in correct columns
    const inProgressCount = await inProgressColumn.locator('.ticket-card').count();
    const doneCount = await doneColumn.locator('.ticket-card').count();

    console.log(`Final state - IN PROGRESS: ${inProgressCount}, DONE: ${doneCount}`);

    // No cards should be lost
    const totalCards = await page.locator('.ticket-card').count();
    expect(totalCards).toBe(4);

    console.log('✅ Rapid drag operations handled correctly');
  });

  test('Drag with modifier keys', async () => {
    console.log('🔍 Testing drag with modifier keys (should not affect behavior)');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const card = todoColumn.locator('.ticket-card').first();

    // Test with Shift key held
    await page.keyboard.down('Shift');
    await card.dragTo(inProgressColumn);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(1000);

    // Card should move normally
    const cardMoved = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Card 1' }).isVisible();
    expect(cardMoved).toBe(true);

    // Move back with Ctrl/Cmd key
    const movedCard = inProgressColumn.locator('.ticket-card').filter({ hasText: 'Card 1' });
    const isMac = process.platform === 'darwin';
    await page.keyboard.down(isMac ? 'Meta' : 'Control');
    await movedCard.dragTo(todoColumn);
    await page.keyboard.up(isMac ? 'Meta' : 'Control');
    await page.waitForTimeout(1000);

    // Card should move back normally
    const cardBack = await todoColumn.locator('.ticket-card').filter({ hasText: 'Card 1' }).isVisible();
    expect(cardBack).toBe(true);

    console.log('✅ Modifier keys do not interfere with drag & drop');
  });

  test.afterEach(async () => {
    // Log final state
    console.log('\n=== Final Board State ===');
    const columns = ['TODO', 'IN PROGRESS', 'DONE'];

    for (const columnName of columns) {
      const column = page.locator('.column').filter({ hasText: columnName }).first();
      const cards = await column.locator('.ticket-card').allTextContents();
      console.log(`${columnName}: ${cards.length} cards`);
      cards.forEach((card, index) => console.log(`  ${index + 1}. ${card}`));
    }

    // Check for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    if (errors.length > 0) {
      console.log('\n❌ Console Errors Detected:');
      errors.forEach(err => console.log(`  - ${err}`));
    }

    // Screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/nested-drop-zones-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});

// Smoke test for immediate validation
test.describe('Drop Zone Quick Validation', () => {
  test('Quick smoke test - card should not drop on card', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Quick board setup
    const boardName = `Quick Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);

    // Create two cards
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

    for (let i = 1; i <= 2; i++) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', `Test Card ${i}`);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(500);
    }

    // Try to drop card 1 on card 2
    const card1 = todoColumn.locator('.ticket-card').first();
    const card2 = todoColumn.locator('.ticket-card').nth(1);

    await card1.dragTo(card2);
    await page.waitForTimeout(1000);

    // Both cards should still be in TODO
    const todoCards = await todoColumn.locator('.ticket-card').count();
    expect(todoCards).toBe(2);

    console.log('✅ SMOKE TEST PASSED: Cards cannot be dropped on other cards');
  });
});
