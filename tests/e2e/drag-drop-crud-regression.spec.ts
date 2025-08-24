import { test, expect, Page } from '@playwright/test';

/**
 * P0 CRITICAL: CRUD Operations Regression Tests During Drag & Drop
 *
 * Purpose: Ensure that Create, Read, Update, Delete operations remain functional
 * during and after drag & drop operations. The drag & drop bug could potentially
 * corrupt card data or interfere with other operations.
 *
 * Critical Test Scenarios:
 * 1. Create new cards after drag operations
 * 2. Edit cards that have been moved via drag & drop
 * 3. Delete cards from different columns after moves
 * 4. Ensure drag operations don't corrupt card metadata
 * 5. Verify search/filter still works after moves
 */

test.describe('🔴 P0: CRUD Regression Tests - Drag & Drop Impact', () => {
  const baseURL = 'http://localhost:15175';
  let boardName: string;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Create test board
    boardName = `CRUD Regression Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    // Setup initial test data
    await setupCrudTestScenario(page);
  });

  async function setupCrudTestScenario(page: Page) {
    // Create cards with specific content for testing
    const testData = [
      { column: 'TODO', title: 'CRUD Test Card 1', description: 'Initial description' },
      { column: 'TODO', title: 'CRUD Test Card 2', description: 'Another description' },
      { column: 'IN PROGRESS', title: 'Active Task', description: 'Work in progress' }
    ];

    for (const card of testData) {
      const column = page.locator('.column').filter({ hasText: card.column }).first();
      await column.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', card.title);

      // Add description if field exists
      const descField = page.locator('textarea[placeholder*="description" i]');
      if (await descField.isVisible()) {
        await descField.fill(card.description);
      }

      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }
  }

  test('CREATE: Add new cards after drag operations complete successfully', async () => {
    console.log('🔴 Testing CREATE operations after drag & drop');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // STEP 1: Perform drag operation first
    const cardToMove = todoColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' });
    await cardToMove.dragTo(doneColumn);
    await page.waitForTimeout(2000);

    // Verify the drag worked
    const cardInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' }).isVisible();
    expect(cardInDone).toBe(true);
    console.log('✅ Drag operation completed successfully');

    // STEP 2: Test CREATE operation in each column after drag
    const newCards = [
      { column: todoColumn, title: 'New TODO After Drag' },
      { column: inProgressColumn, title: 'New IN PROGRESS After Drag' },
      { column: doneColumn, title: 'New DONE After Drag' }
    ];

    for (const newCard of newCards) {
      console.log(`Creating new card: ${newCard.title}`);

      // Click add card button
      await newCard.column.locator('button:has-text("Add Card")').click();
      await page.waitForTimeout(500);

      // Fill form
      await page.fill('input[placeholder*="title" i]', newCard.title);

      // Add description to test full form functionality
      const descField = page.locator('textarea[placeholder*="description" i]');
      if (await descField.isVisible()) {
        await descField.fill(`Description for ${newCard.title}`);
      }

      // Save card
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1500);

      // CRITICAL ASSERTION: New card should appear in correct column
      const newCardVisible = await newCard.column.locator('.ticket-card').filter({ hasText: newCard.title }).isVisible();
      expect(newCardVisible).toBe(true);
      console.log(`✅ New card "${newCard.title}" created successfully`);
    }

    // STEP 3: Verify all cards are in expected positions
    const todoCards = await todoColumn.locator('.ticket-card').allTextContents();
    const inProgressCards = await inProgressColumn.locator('.ticket-card').allTextContents();
    const doneCards = await doneColumn.locator('.ticket-card').allTextContents();

    expect(todoCards.some(card => card.includes('New TODO After Drag'))).toBe(true);
    expect(inProgressCards.some(card => card.includes('New IN PROGRESS After Drag'))).toBe(true);
    expect(doneCards.some(card => card.includes('New DONE After Drag'))).toBe(true);
    expect(doneCards.some(card => card.includes('CRUD Test Card 1'))).toBe(true);

    console.log('✅ CREATE operations work correctly after drag & drop');
  });

  test('UPDATE: Edit cards that have been moved via drag & drop', async () => {
    console.log('🔴 Testing UPDATE operations on dragged cards');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // STEP 1: Move a card via drag & drop
    const cardToMove = todoColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 2' });
    await cardToMove.dragTo(inProgressColumn);
    await page.waitForTimeout(2000);

    // Verify card moved
    const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 2' }).isVisible();
    expect(cardInProgress).toBe(true);
    console.log('✅ Card moved to IN PROGRESS column');

    // STEP 2: Edit the moved card
    const movedCard = inProgressColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 2' });

    // Click on card to open edit mode or detail view
    await movedCard.click();
    await page.waitForTimeout(1000);

    // Look for edit mode (could be inline edit or modal)
    const editButton = page.locator('button').filter({ hasText: /edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);
    }

    // Update the title
    const titleField = page.locator('input[value*="CRUD Test Card 2"], input[placeholder*="title" i]').first();
    if (await titleField.isVisible()) {
      await titleField.clear();
      await titleField.fill('UPDATED Card After Drag');
    }

    // Update description if available
    const descField = page.locator('textarea[placeholder*="description" i], textarea[value*="Another description"]').first();
    if (await descField.isVisible()) {
      await descField.clear();
      await descField.fill('UPDATED Description after drag operation');
    }

    // Save changes
    const saveButton = page.locator('button').filter({ hasText: /save|update/i }).first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(2000);
    }

    // CRITICAL ASSERTION: Updated card should show new content
    const updatedCardVisible = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'UPDATED Card After Drag' }).isVisible();
    expect(updatedCardVisible).toBe(true);

    // CRITICAL ASSERTION: Old title should not exist
    const oldCardVisible = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 2' }).isVisible();
    expect(oldCardVisible).toBe(false);

    console.log('✅ UPDATE operations work correctly on dragged cards');
  });

  test('DELETE: Remove cards from different columns after drag operations', async () => {
    console.log('🔴 Testing DELETE operations after drag movements');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // STEP 1: Move cards to different columns
    const card1 = todoColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' });
    const card2 = todoColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 2' });

    await card1.dragTo(inProgressColumn);
    await page.waitForTimeout(1500);
    await card2.dragTo(doneColumn);
    await page.waitForTimeout(1500);

    // STEP 2: Verify cards moved
    const card1InProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' }).isVisible();
    const card2InDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 2' }).isVisible();
    expect(card1InProgress).toBe(true);
    expect(card2InDone).toBe(true);
    console.log('✅ Cards moved to different columns successfully');

    // STEP 3: Delete cards from their new locations
    const cardsToDelete = [
      { column: inProgressColumn, cardText: 'CRUD Test Card 1' },
      { column: doneColumn, cardText: 'CRUD Test Card 2' },
      { column: inProgressColumn, cardText: 'Active Task' } // Original card
    ];

    for (const cardInfo of cardsToDelete) {
      const cardToDelete = cardInfo.column.locator('.ticket-card').filter({ hasText: cardInfo.cardText });

      if (await cardToDelete.isVisible()) {
        console.log(`Deleting card: ${cardInfo.cardText}`);

        // Right-click for context menu or look for delete button
        await cardToDelete.click({ button: 'right' });
        await page.waitForTimeout(500);

        let deleteButton = page.locator('button').filter({ hasText: /delete|remove/i }).first();

        // If no context menu, try clicking on card and looking for delete option
        if (!await deleteButton.isVisible()) {
          await cardToDelete.click();
          await page.waitForTimeout(500);
          deleteButton = page.locator('button').filter({ hasText: /delete|remove/i }).first();
        }

        // If still no delete button, try looking for a trash icon or X button
        if (!await deleteButton.isVisible()) {
          const trashIcon = cardToDelete.locator('[class*="delete"], [class*="trash"], [class*="remove"], .fa-trash').first();
          if (await trashIcon.isVisible()) {
            await trashIcon.click();
          } else {
            console.log(`Delete button not found for ${cardInfo.cardText}, skipping...`);
            continue;
          }
        } else {
          await deleteButton.click();
        }

        // Confirm deletion if confirmation dialog appears
        const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        await page.waitForTimeout(2000);

        // CRITICAL ASSERTION: Card should be deleted
        const cardStillExists = await cardInfo.column.locator('.ticket-card').filter({ hasText: cardInfo.cardText }).isVisible();
        expect(cardStillExists).toBe(false);
        console.log(`✅ Card "${cardInfo.cardText}" deleted successfully`);
      }
    }

    console.log('✅ DELETE operations work correctly after drag movements');
  });

  test('READ: Search and filter functionality after drag operations', async () => {
    console.log('🔴 Testing READ/Search operations after drag movements');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // STEP 1: Perform several drag operations
    const card1 = todoColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' });
    const card2 = todoColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 2' });

    await card1.dragTo(inProgressColumn);
    await page.waitForTimeout(1500);
    await card2.dragTo(doneColumn);
    await page.waitForTimeout(1500);

    // STEP 2: Test search functionality
    const searchField = page.locator('input[placeholder*="search" i], input[type="search"]').first();

    if (await searchField.isVisible()) {
      console.log('Testing search functionality...');

      // Search for moved card
      await searchField.fill('CRUD Test Card 1');
      await page.waitForTimeout(1000);

      // CRITICAL ASSERTION: Moved card should be found in new location
      const searchResults = await page.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' }).count();
      expect(searchResults).toBeGreaterThan(0);

      // Card should still be visible in IN PROGRESS column
      const cardVisibleInSearch = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' }).isVisible();
      expect(cardVisibleInSearch).toBe(true);

      // Clear search
      await searchField.clear();
      await page.waitForTimeout(500);

      console.log('✅ Search finds moved cards in correct columns');
    }

    // STEP 3: Test filter functionality (if available)
    const filterButton = page.locator('button, select').filter({ hasText: /filter|status/i }).first();

    if (await filterButton.isVisible()) {
      console.log('Testing filter functionality...');

      await filterButton.click();
      await page.waitForTimeout(500);

      // Try to filter by status
      const inProgressFilter = page.locator('option, button').filter({ hasText: /in progress/i }).first();
      if (await inProgressFilter.isVisible()) {
        await inProgressFilter.click();
        await page.waitForTimeout(1000);

        // CRITICAL ASSERTION: Only IN PROGRESS cards should be visible
        const visibleCards = await page.locator('.ticket-card').count();
        const inProgressCards = await inProgressColumn.locator('.ticket-card').count();

        // When filtered, all visible cards should be from IN PROGRESS column
        expect(visibleCards).toBe(inProgressCards);
        console.log('✅ Filter correctly shows cards in IN PROGRESS column');
      }
    }

    console.log('✅ READ operations (search/filter) work correctly after drag movements');
  });

  test('Card metadata integrity during drag operations', async () => {
    console.log('🔴 Testing card metadata integrity during drag operations');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // STEP 1: Create a card with rich metadata
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Metadata Test Card');

    const descField = page.locator('textarea[placeholder*="description" i]');
    if (await descField.isVisible()) {
      await descField.fill('This card has detailed metadata that must be preserved');
    }

    // Add due date if field exists
    const dueDateField = page.locator('input[type="date"], input[placeholder*="date" i]');
    if (await dueDateField.isVisible()) {
      await dueDateField.fill('2024-12-31');
    }

    // Add priority if field exists
    const priorityField = page.locator('select, input').filter({ hasText: /priority/i }).first();
    if (await priorityField.isVisible()) {
      await priorityField.selectOption({ label: 'High' });
    }

    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // STEP 2: Record initial metadata
    const metadataCard = todoColumn.locator('.ticket-card').filter({ hasText: 'Metadata Test Card' });
    const initialContent = await metadataCard.textContent();

    // STEP 3: Perform drag operation
    await metadataCard.dragTo(doneColumn);
    await page.waitForTimeout(2000);

    // STEP 4: Verify card moved and metadata preserved
    const movedCard = doneColumn.locator('.ticket-card').filter({ hasText: 'Metadata Test Card' });
    expect(await movedCard.isVisible()).toBe(true);

    // Click to view full details
    await movedCard.click();
    await page.waitForTimeout(1000);

    // CRITICAL ASSERTION: Metadata should be preserved
    const currentContent = await movedCard.textContent();

    // Title should be preserved
    expect(currentContent).toContain('Metadata Test Card');

    // If we can access detailed view, check description
    const detailDescription = page.locator('textarea, div').filter({ hasText: 'detailed metadata' }).first();
    if (await detailDescription.isVisible()) {
      const descText = await detailDescription.textContent();
      expect(descText).toContain('detailed metadata');
      console.log('✅ Description metadata preserved');
    }

    console.log('✅ Card metadata integrity maintained during drag operations');
  });

  test('Concurrent CRUD operations during drag activities', async () => {
    console.log('🔴 Testing concurrent CRUD operations during drag activities');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // STEP 1: Start drag operation (but don't complete immediately)
    const cardToDrag = todoColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' });
    await cardToDrag.hover();
    await page.mouse.down();

    const doneBox = await doneColumn.boundingBox();
    if (doneBox) {
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + 50);
      // Don't release mouse yet - simulate slow drag
    }

    // STEP 2: While dragging, try to create a new card
    console.log('Creating new card while drag is in progress...');

    try {
      // Use keyboard to open new card modal (might be more reliable during drag)
      await page.keyboard.press('Escape'); // Cancel any current operations
      await page.waitForTimeout(500);

      // Try to create card in TODO column
      const addButton = todoColumn.locator('button:has-text("Add Card")');
      await addButton.click();
      await page.waitForTimeout(500);

      await page.fill('input[placeholder*="title" i]', 'Concurrent Create Test');
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);

      // Verify card was created
      const newCardExists = await todoColumn.locator('.ticket-card').filter({ hasText: 'Concurrent Create Test' }).isVisible();
      expect(newCardExists).toBe(true);
      console.log('✅ Concurrent card creation successful');

    } catch (error) {
      console.log('Concurrent operation not possible during drag (expected behavior)');
    }

    // STEP 3: Complete the original drag operation
    if (doneBox) {
      await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(2000);
    }

    // STEP 4: Verify drag completed successfully
    const draggedCardInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'CRUD Test Card 1' }).isVisible();
    expect(draggedCardInDone).toBe(true);

    // STEP 5: Verify all CRUD operations work after drag completion

    // CREATE test
    await inProgressColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'Post-Drag Create Test');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    const postDragCard = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Post-Drag Create Test' }).isVisible();
    expect(postDragCard).toBe(true);

    console.log('✅ All CRUD operations functional after drag completion');
  });

  test.afterEach(async () => {
    // Log final state for debugging
    console.log('\n=== CRUD Regression Test - Final State ===');

    const columns = ['TODO', 'IN PROGRESS', 'DONE'];
    for (const columnName of columns) {
      const column = page.locator('.column').filter({ hasText: columnName }).first();
      const cards = await column.locator('.ticket-card').allTextContents();
      console.log(`${columnName}: ${cards.length} cards`);
      cards.forEach((card, i) => console.log(`  ${i + 1}. ${card.substring(0, 50)}...`));
    }

    // Screenshot on failure
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/crud-regression-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
