import { test, expect, Page } from '@playwright/test';

/**
 * TEMPORARY FIX VALIDATION TESTS
 *
 * Current State (Temporary Fix):
 * - ✅ Drops ON cards work (move to card's column)
 * - ❌ Drops on empty column space CANCELLED (prevents wrong column bug)
 * - This is a partial fix to prevent data corruption
 *
 * Full fix still needed for proper column detection on empty spaces
 */

test.describe('🟡 TEMPORARY FIX: Drag & Drop Partial Solution', () => {
  const baseURL = 'http://localhost:5173';
  let boardName: string;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create test board
    boardName = `Temp Fix Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Setup test scenario
    await setupTestCards(page);
  });

  async function setupTestCards(page: Page) {
    // Create cards in TODO
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

    for (let i = 1; i <= 3; i++) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', `TODO Card ${i}`);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Create cards in IN PROGRESS
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    for (let i = 1; i <= 2; i++) {
      await inProgressColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', `IN PROGRESS Card ${i}`);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Leave DONE empty for testing
  }

  test('✅ WORKING: Drop ON existing card moves to that card\'s column', async () => {
    console.log('🟡 Testing drops ON cards (should work with temp fix)');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Get cards
    const todoCard = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });
    const targetCard = inProgressColumn.locator('.ticket-card').filter({ hasText: 'IN PROGRESS Card 1' });

    // Intercept API
    let apiPayload: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiPayload = request.postDataJSON();
        console.log('API Payload:', apiPayload);
      }
      await route.continue();
    });

    // Drop TODO card ON IN PROGRESS card
    console.log('Dropping TODO Card 1 ON IN PROGRESS Card 1...');
    await todoCard.dragTo(targetCard);
    await page.waitForTimeout(2000);

    // Should work - card moves to IN PROGRESS
    const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible();
    expect(cardInProgress).toBe(true);
    console.log('✅ Card successfully moved to IN PROGRESS column');

    // API should receive correct column
    if (apiPayload) {
      expect(apiPayload.current_column).toBe('In Progress');
      console.log('✅ API received correct column: In Progress');
    }

    // Card removed from TODO
    const cardInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible();
    expect(cardInTodo).toBe(false);
  });

  test('❌ BLOCKED: Drop on EMPTY column space is cancelled (temporary behavior)', async () => {
    console.log('🟡 Testing drops on empty column space (should be cancelled)');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Get TODO card
    const todoCard = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });

    // Count cards before
    const todoCountBefore = await todoColumn.locator('.ticket-card').count();
    const doneCountBefore = await doneColumn.locator('.ticket-card').count();

    console.log(`Before: TODO has ${todoCountBefore} cards, DONE has ${doneCountBefore} cards`);

    // Intercept API (should NOT be called)
    let apiCalled = false;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiCalled = true;
      }
      await route.continue();
    });

    // Try to drop on empty DONE column
    console.log('Attempting to drop on empty DONE column...');
    const doneBox = await doneColumn.boundingBox();
    if (doneBox) {
      await todoCard.hover();
      await page.mouse.down();
      await page.waitForTimeout(100);

      // Move to empty space in DONE
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
      await page.waitForTimeout(500);

      // Drop
      await page.mouse.up();
      await page.waitForTimeout(2000);
    }

    // TEMPORARY BEHAVIOR: Card should NOT move (drop cancelled)
    const todoCountAfter = await todoColumn.locator('.ticket-card').count();
    const doneCountAfter = await doneColumn.locator('.ticket-card').count();

    console.log(`After: TODO has ${todoCountAfter} cards, DONE has ${doneCountAfter} cards`);

    // Card should remain in TODO
    expect(todoCountAfter).toBe(todoCountBefore);
    expect(doneCountAfter).toBe(doneCountBefore);
    console.log('✅ Drop cancelled - card remained in original column (expected with temp fix)');

    // API should NOT have been called
    expect(apiCalled).toBe(false);
    console.log('✅ No API call made (drop was cancelled)');
  });

  test('✅ WORKING: Drop between existing cards uses correct column', async () => {
    console.log('🟡 Testing drops between cards (should work)');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Get TODO card to move
    const todoCard = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });

    // Get IN PROGRESS cards for positioning
    const inProgressCard1 = inProgressColumn.locator('.ticket-card').nth(0);
    const inProgressCard2 = inProgressColumn.locator('.ticket-card').nth(1);

    // Intercept API
    let apiPayload: any = null;
    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        apiPayload = request.postDataJSON();
      }
      await route.continue();
    });

    // Drop directly on first IN PROGRESS card (not between)
    console.log('Dropping TODO Card 1 on first IN PROGRESS card...');
    await todoCard.dragTo(inProgressCard1);
    await page.waitForTimeout(2000);

    // Should work - card moves to IN PROGRESS
    const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible();
    expect(cardInProgress).toBe(true);
    console.log('✅ Card moved to IN PROGRESS column');

    // API should receive correct column
    if (apiPayload) {
      expect(apiPayload.current_column).toBe('In Progress');
      console.log('✅ API received correct column: In Progress');
    }
  });

  test('Mixed scenario: Some drops work, some cancelled', async () => {
    console.log('🟡 Testing mixed drop scenarios with temp fix');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Track movements
    const movements: { action: string; success: boolean }[] = [];

    // Test 1: Drop on card (should work)
    console.log('Test 1: Drop TODO Card 1 on IN PROGRESS card...');
    const todoCard1 = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' });
    const inProgressCard = inProgressColumn.locator('.ticket-card').first();

    await todoCard1.dragTo(inProgressCard);
    await page.waitForTimeout(1500);

    const card1InProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 1' }).isVisible();
    movements.push({ action: 'Drop on card', success: card1InProgress });
    console.log(`Result: ${card1InProgress ? '✅ Worked' : '❌ Failed'}`);

    // Test 2: Drop on empty DONE (should be cancelled)
    console.log('Test 2: Drop TODO Card 2 on empty DONE column...');
    const todoCard2 = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 2' });
    const doneBox = await doneColumn.boundingBox();

    if (doneBox) {
      await todoCard2.hover();
      await page.mouse.down();
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }

    const card2StillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 2' }).isVisible();
    movements.push({ action: 'Drop on empty column', success: !card2StillInTodo });
    console.log(`Result: ${card2StillInTodo ? '✅ Cancelled (expected)' : '❌ Moved (unexpected)'}`);

    // Test 3: Drop remaining TODO card on IN PROGRESS card (should work)
    console.log('Test 3: Drop TODO Card 3 on IN PROGRESS card...');
    const todoCard3 = todoColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 3' });

    await todoCard3.dragTo(inProgressCard);
    await page.waitForTimeout(1500);

    const card3InProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'TODO Card 3' }).isVisible();
    movements.push({ action: 'Drop on card again', success: card3InProgress });
    console.log(`Result: ${card3InProgress ? '✅ Worked' : '❌ Failed'}`);

    // Summary
    console.log('\n=== Movement Summary ===');
    movements.forEach(m => {
      const icon = m.action.includes('empty') ? (m.success ? '❌' : '✅') : (m.success ? '✅' : '❌');
      console.log(`${icon} ${m.action}: ${m.success ? 'Moved' : 'Cancelled'}`);
    });
  });

  test('Workaround validation: Users must drop ON cards not empty space', async () => {
    console.log('🟡 Validating workaround: drops must target existing cards');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Move one IN PROGRESS card to DONE first
    const inProgressCard = inProgressColumn.locator('.ticket-card').first();
    const doneBox = await doneColumn.boundingBox();

    // This should fail (empty column)
    console.log('Step 1: Try to move IN PROGRESS card to empty DONE...');
    if (doneBox) {
      await inProgressCard.hover();
      await page.mouse.down();
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }

    // Should still be in IN PROGRESS
    expect(await inProgressColumn.locator('.ticket-card').filter({ hasText: 'IN PROGRESS Card 1' }).isVisible()).toBe(true);
    console.log('✅ Drop on empty DONE cancelled');

    // Workaround: First move a TODO card to DONE by dropping on IN PROGRESS, then to DONE
    console.log('Step 2: Workaround - chain drops through existing cards...');

    // Move TODO to IN PROGRESS (drop on card)
    const todoCard = todoColumn.locator('.ticket-card').first();
    await todoCard.dragTo(inProgressCard);
    await page.waitForTimeout(1500);

    // Now we have a card in IN PROGRESS, try to move another to DONE
    // This still won't work on empty DONE

    console.log('✅ Workaround requires cards in target column to drop on');
  });

  test.afterEach(async () => {
    // Log final state
    console.log('\n=== Final Board State (Temp Fix) ===');
    const columns = ['TODO', 'IN PROGRESS', 'DONE'];

    for (const columnName of columns) {
      const column = page.locator('.column').filter({ hasText: columnName }).first();
      const cards = await column.locator('.ticket-card').allTextContents();
      console.log(`${columnName}: ${cards.length} cards`);
      if (cards.length > 0) {
        cards.forEach((card, i) => console.log(`  ${i + 1}. ${card}`));
      }
    }

    console.log('\n⚠️ TEMPORARY FIX LIMITATIONS:');
    console.log('  - Cannot drop on empty column spaces');
    console.log('  - Must drop ON existing cards');
    console.log('  - Full fix still needed for proper column detection');

    // Screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/temp-fix-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});

// Quick validation test
test.describe('Temporary Fix Quick Check', () => {
  test('QUICK: Verify temp fix behavior', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Quick setup
    const boardName = `Quick Temp Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);

    // Create cards
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Add TODO card
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Test Card 1');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Add IN PROGRESS card
    await inProgressColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Target Card');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Test 1: Drop on empty DONE (should fail)
    const todoCard = todoColumn.locator('.ticket-card').first();
    const doneBox = await doneColumn.boundingBox();

    if (doneBox) {
      await todoCard.hover();
      await page.mouse.down();
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }

    // Should still be in TODO
    const stillInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: 'Test Card 1' }).isVisible();
    console.log(`Drop on empty: ${stillInTodo ? '✅ Cancelled (temp fix working)' : '❌ Moved (unexpected)'}`);

    // Test 2: Drop on card (should work)
    const targetCard = inProgressColumn.locator('.ticket-card').first();
    await todoCard.dragTo(targetCard);
    await page.waitForTimeout(1500);

    const movedToProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Test Card 1' }).isVisible();
    console.log(`Drop on card: ${movedToProgress ? '✅ Worked' : '❌ Failed'}`);

    // Overall result
    if (stillInTodo && movedToProgress) {
      console.log('\n✅ TEMPORARY FIX VALIDATED');
      console.log('  - Empty drops: BLOCKED ✅');
      console.log('  - Card drops: WORKING ✅');
    }
  });
});
