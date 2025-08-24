import { test, expect, Page } from '@playwright/test';

test.describe('Critical User Paths - Regression Suite', () => {
  let page: Page;
  const baseURL = 'http://localhost:5173';

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Board Management', () => {
    test('should create a new board successfully', async () => {
      const boardName = `Test Board ${Date.now()}`;
      const boardDescription = 'Test board description';

      // Click create board button
      await page.click('button:has-text("Create Board")');

      // Fill in board details
      await page.fill('input[placeholder*="board name" i]', boardName);
      const descInput = page.locator('textarea[placeholder*="description" i]');
      if (await descInput.isVisible()) {
        await descInput.fill(boardDescription);
      }

      // Submit form
      await page.click('button:has-text("Create")');

      // Verify board appears in dashboard
      await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to board and back to dashboard', async () => {
      // Create a board first
      const boardName = `Nav Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Click on the board to navigate
      await page.click(`.board-card:has-text("${boardName}")`);

      // Verify we're on the board page
      await expect(page).toHaveURL(/\/board\/\d+/);
      await expect(page.locator('.column')).toHaveCount(3); // TODO, IN_PROGRESS, DONE

      // Navigate back to dashboard
      await page.click('a:has-text("Dashboard")');
      await expect(page).toHaveURL(baseURL + '/');
      await expect(page.locator('.board-card')).toBeVisible();
    });

    test('should edit board details', async () => {
      // Create a board
      const originalName = `Edit Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', originalName);
      await page.click('button:has-text("Create")');

      // Wait for board to appear
      await page.waitForSelector(`.board-card:has-text("${originalName}")`);

      // Click edit button on the board card
      const boardCard = page.locator('.board-card').filter({ hasText: originalName });
      await boardCard.hover();
      await boardCard.locator('button[aria-label*="edit" i]').click();

      // Edit the board name
      const newName = `Edited ${originalName}`;
      await page.fill('input[value*="' + originalName + '"]', newName);
      await page.click('button:has-text("Save")');

      // Verify the change
      await expect(page.locator('.board-card').filter({ hasText: newName })).toBeVisible();
      await expect(page.locator('.board-card').filter({ hasText: originalName })).not.toBeVisible();
    });

    test('should delete a board', async () => {
      // Create a board to delete
      const boardName = `Delete Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Wait for board to appear
      await page.waitForSelector(`.board-card:has-text("${boardName}")`);

      // Delete the board
      const boardCard = page.locator('.board-card').filter({ hasText: boardName });
      await boardCard.hover();
      await boardCard.locator('button[aria-label*="delete" i]').click();

      // Confirm deletion if dialog appears
      const confirmButton = page.locator('button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      // Verify board is deleted
      await expect(page.locator('.board-card').filter({ hasText: boardName })).not.toBeVisible();
    });
  });

  test.describe('Ticket Management', () => {
    let boardName: string;

    test.beforeEach(async () => {
      // Create a board for ticket tests
      boardName = `Ticket Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');
    });

    test('should create a new ticket in TODO column', async () => {
      const ticketTitle = `Ticket ${Date.now()}`;
      const ticketDescription = 'Test ticket description';

      // Click add card in TODO column
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();

      // Fill ticket details
      await page.fill('input[placeholder*="title" i]', ticketTitle);
      await page.fill('textarea[placeholder*="description" i]', ticketDescription);

      // Set priority if available
      const prioritySelect = page.locator('select[name="priority"]');
      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption('high');
      }

      // Save ticket
      await page.click('button:has-text("Save")');

      // Verify ticket appears
      await expect(todoColumn.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();
    });

    test('should edit ticket details', async () => {
      // Create a ticket first
      const originalTitle = `Original ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', originalTitle);
      await page.click('button:has-text("Save")');

      // Click on the ticket to open details
      await page.click(`.ticket-card:has-text("${originalTitle}")`);
      await page.waitForSelector('.ticket-detail');

      // Edit the ticket
      const newTitle = `Updated ${originalTitle}`;
      const newDescription = 'Updated description with more details';

      await page.fill('input[value*="' + originalTitle + '"]', newTitle);
      await page.fill('textarea', newDescription);

      // Save changes
      await page.click('button:has-text("Save")');

      // Close detail view if needed
      const closeButton = page.locator('button[aria-label="Close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }

      // Verify changes
      await expect(page.locator('.ticket-card').filter({ hasText: newTitle })).toBeVisible();
    });

    test('should move ticket between columns via drag and drop', async () => {
      // Create a ticket
      const ticketTitle = `Drag Test ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', ticketTitle);
      await page.click('button:has-text("Save")');

      // Wait for ticket to appear
      const ticket = page.locator('.ticket-card').filter({ hasText: ticketTitle });
      await expect(ticket).toBeVisible();

      // Drag to IN PROGRESS column
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
      await ticket.dragTo(inProgressColumn);

      // Wait for the move to complete
      await page.waitForTimeout(1000);

      // Verify ticket is in new column
      await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();
      await expect(todoColumn.locator('.ticket-card').filter({ hasText: ticketTitle })).not.toBeVisible();

      // Drag to DONE column
      const doneColumn = page.locator('.column').filter({ hasText: 'DONE' });
      await inProgressColumn.locator('.ticket-card').filter({ hasText: ticketTitle }).dragTo(doneColumn);

      await page.waitForTimeout(1000);

      // Verify final position
      await expect(doneColumn.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();
    });

    test('should add and view comments on a ticket', async () => {
      // Create a ticket
      const ticketTitle = `Comment Test ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', ticketTitle);
      await page.click('button:has-text("Save")');

      // Open ticket details
      await page.click(`.ticket-card:has-text("${ticketTitle}")`);
      await page.waitForSelector('.ticket-detail');

      // Add a comment
      const commentText = 'This is a test comment with important information';
      const commentInput = page.locator('textarea[placeholder*="comment" i]');
      if (await commentInput.isVisible()) {
        await commentInput.fill(commentText);
        await page.click('button:has-text("Add Comment")');

        // Verify comment appears
        await expect(page.locator('.comment').filter({ hasText: commentText })).toBeVisible();
      }
    });

    test('should delete a ticket', async () => {
      // Create a ticket to delete
      const ticketTitle = `Delete Ticket ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', ticketTitle);
      await page.click('button:has-text("Save")');

      // Open ticket details
      await page.click(`.ticket-card:has-text("${ticketTitle}")`);
      await page.waitForSelector('.ticket-detail');

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }

        // Verify ticket is deleted
        await expect(page.locator('.ticket-card').filter({ hasText: ticketTitle })).not.toBeVisible();
      }
    });
  });

  test.describe('Search and Filter', () => {
    test.beforeEach(async () => {
      // Create a board with multiple tickets
      const boardName = `Search Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Create multiple tickets with different priorities
      const tickets = [
        { title: 'High Priority Bug', priority: 'high' },
        { title: 'Medium Feature Request', priority: 'medium' },
        { title: 'Low Priority Task', priority: 'low' }
      ];

      for (const ticket of tickets) {
        const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', ticket.title);

        const prioritySelect = page.locator('select[name="priority"]');
        if (await prioritySelect.isVisible()) {
          await prioritySelect.selectOption(ticket.priority);
        }

        await page.click('button:has-text("Save")');
        await page.waitForTimeout(500);
      }
    });

    test('should search tickets by title', async () => {
      // Search for "Bug"
      const searchInput = page.locator('input[placeholder*="search" i]');
      await searchInput.fill('Bug');
      await page.waitForTimeout(500);

      // Verify only matching ticket is visible
      await expect(page.locator('.ticket-card').filter({ hasText: 'High Priority Bug' })).toBeVisible();
      await expect(page.locator('.ticket-card').filter({ hasText: 'Medium Feature Request' })).not.toBeVisible();
      await expect(page.locator('.ticket-card').filter({ hasText: 'Low Priority Task' })).not.toBeVisible();

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Verify all tickets are visible again
      await expect(page.locator('.ticket-card')).toHaveCount(3);
    });

    test('should filter tickets by priority', async () => {
      // Filter by high priority
      const priorityFilter = page.locator('select[name*="priority" i]');
      if (await priorityFilter.isVisible()) {
        await priorityFilter.selectOption('high');
        await page.waitForTimeout(500);

        // Verify only high priority ticket is visible
        await expect(page.locator('.ticket-card').filter({ hasText: 'High Priority Bug' })).toBeVisible();
        await expect(page.locator('.ticket-card').filter({ hasText: 'Medium Feature Request' })).not.toBeVisible();

        // Reset filter
        await priorityFilter.selectOption('all');
        await expect(page.locator('.ticket-card')).toHaveCount(3);
      }
    });

    test('should filter tickets by status', async () => {
      // Move one ticket to IN PROGRESS
      const ticket = page.locator('.ticket-card').filter({ hasText: 'High Priority Bug' });
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
      await ticket.dragTo(inProgressColumn);
      await page.waitForTimeout(1000);

      // Filter by status
      const statusFilter = page.locator('select[name*="status" i]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('IN_PROGRESS');
        await page.waitForTimeout(500);

        // Verify only in-progress ticket is visible
        await expect(page.locator('.ticket-card').filter({ hasText: 'High Priority Bug' })).toBeVisible();
        await expect(page.locator('.ticket-card')).toHaveCount(1);
      }
    });
  });

  test.describe('Data Persistence', () => {
    test('should persist board creation after page refresh', async () => {
      const boardName = `Persist Board ${Date.now()}`;

      // Create a board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Wait for board to appear
      await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible();

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify board still exists
      await expect(page.locator('.board-card').filter({ hasText: boardName })).toBeVisible();
    });

    test('should persist ticket changes after page refresh', async () => {
      // Create board and navigate to it
      const boardName = `Persist Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);

      // Create a ticket
      const ticketTitle = `Persist Ticket ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', ticketTitle);
      await page.click('button:has-text("Save")');

      // Move ticket to IN PROGRESS
      const ticket = page.locator('.ticket-card').filter({ hasText: ticketTitle });
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
      await ticket.dragTo(inProgressColumn);
      await page.waitForTimeout(1000);

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify ticket is still in IN PROGRESS
      await expect(inProgressColumn.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();
      await expect(todoColumn.locator('.ticket-card').filter({ hasText: ticketTitle })).not.toBeVisible();
    });

    test('should persist ticket edits after page refresh', async () => {
      // Create board and ticket
      const boardName = `Edit Persist ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);

      const originalTitle = `Original ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', originalTitle);
      await page.click('button:has-text("Save")');

      // Edit the ticket
      await page.click(`.ticket-card:has-text("${originalTitle}")`);
      const newTitle = `Edited ${originalTitle}`;
      const newDescription = 'This description should persist';
      await page.fill('input[value*="' + originalTitle + '"]', newTitle);
      await page.fill('textarea', newDescription);
      await page.click('button:has-text("Save")');

      // Close detail view
      const closeButton = page.locator('button[aria-label="Close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify edits persisted
      await expect(page.locator('.ticket-card').filter({ hasText: newTitle })).toBeVisible();

      // Open ticket to verify description
      await page.click(`.ticket-card:has-text("${newTitle}")`);
      await expect(page.locator('textarea')).toHaveValue(newDescription);
    });
  });

  test.describe('Bulk Operations', () => {
    test.beforeEach(async () => {
      // Create a board with multiple tickets
      const boardName = `Bulk Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Create multiple tickets
      for (let i = 1; i <= 3; i++) {
        const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', `Bulk Ticket ${i}`);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(500);
      }
    });

    test('should select multiple tickets for bulk operations', async () => {
      // Enable bulk selection mode if available
      const bulkButton = page.locator('button:has-text("Bulk Actions")');
      if (await bulkButton.isVisible()) {
        await bulkButton.click();

        // Select multiple tickets
        const tickets = page.locator('.ticket-card');
        const ticketCount = await tickets.count();

        for (let i = 0; i < Math.min(2, ticketCount); i++) {
          const checkbox = tickets.nth(i).locator('input[type="checkbox"]');
          if (await checkbox.isVisible()) {
            await checkbox.check();
          }
        }

        // Verify bulk action buttons appear
        await expect(page.locator('button:has-text("Move Selected")')).toBeVisible();
        await expect(page.locator('button:has-text("Delete Selected")')).toBeVisible();
      }
    });

    test('should bulk move tickets to another column', async () => {
      const bulkButton = page.locator('button:has-text("Bulk Actions")');
      if (await bulkButton.isVisible()) {
        await bulkButton.click();

        // Select all tickets in TODO
        const todoTickets = page.locator('.column').filter({ hasText: 'TODO' }).locator('.ticket-card');
        const count = await todoTickets.count();

        for (let i = 0; i < count; i++) {
          const checkbox = todoTickets.nth(i).locator('input[type="checkbox"]');
          if (await checkbox.isVisible()) {
            await checkbox.check();
          }
        }

        // Move to IN PROGRESS
        await page.click('button:has-text("Move Selected")');
        const moveOption = page.locator('button:has-text("Move to IN PROGRESS")');
        if (await moveOption.isVisible()) {
          await moveOption.click();
          await page.waitForTimeout(1000);

          // Verify all tickets moved
          const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
          await expect(inProgressColumn.locator('.ticket-card')).toHaveCount(count);

          const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
          await expect(todoColumn.locator('.ticket-card')).toHaveCount(0);
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate offline mode
      await page.context().setOffline(true);

      // Try to create a board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', 'Offline Test');
      await page.click('button:has-text("Create")');

      // Verify error message appears
      await expect(page.locator('.error-message, .toast-error, [role="alert"]')).toBeVisible({ timeout: 5000 });

      // Go back online
      await page.context().setOffline(false);
    });

    test('should validate required fields', async () => {
      // Try to create board without name
      await page.click('button:has-text("Create Board")');
      await page.click('button:has-text("Create")');

      // Verify validation message
      const validationMessage = page.locator('.validation-error, .error-text, [role="alert"]');
      if (await validationMessage.isVisible({ timeout: 2000 })) {
        await expect(validationMessage).toContainText(/required|enter|provide/i);
      }
    });

    test('should handle duplicate board names', async () => {
      const boardName = 'Duplicate Test Board';

      // Create first board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.waitForSelector(`.board-card:has-text("${boardName}")`);

      // Try to create duplicate
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');

      // Verify error or warning message
      const errorMessage = page.locator('.error-message, .toast-error, [role="alert"]');
      if (await errorMessage.isVisible({ timeout: 2000 })) {
        await expect(errorMessage).toContainText(/exists|duplicate/i);
      }
    });
  });
});
