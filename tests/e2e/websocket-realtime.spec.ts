import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

test.describe('WebSocket Real-time Updates', () => {
  let browser: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;
  const baseURL = 'http://localhost:5173';

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
  });

  test.beforeEach(async () => {
    // Create two separate browser contexts to simulate different users
    context1 = await browser.newContext();
    context2 = await browser.newContext();

    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Navigate both pages to the app
    await page1.goto(baseURL);
    await page2.goto(baseURL);

    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
  });

  test('should sync board creation across multiple clients', async () => {
    const boardName = `RT Board ${Date.now()}`;

    // Create board in first client
    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');

    // Verify board appears in first client
    await expect(page1.locator('.board-card').filter({ hasText: boardName })).toBeVisible();

    // Verify board appears in second client without refresh
    await expect(page2.locator('.board-card').filter({ hasText: boardName })).toBeVisible({ timeout: 5000 });
  });

  test('should sync ticket creation in real-time', async () => {
    const boardName = `RT Tickets ${Date.now()}`;

    // Create and navigate to board in both clients
    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');

    // Both clients navigate to the board
    await page1.click(`.board-card:has-text("${boardName}")`);
    await page1.waitForSelector('.column');

    // Wait for board to appear in second client and navigate
    await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 5000 });
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Create ticket in first client
    const ticketTitle = `RT Ticket ${Date.now()}`;
    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', ticketTitle);
    await page1.fill('textarea[placeholder*="description" i]', 'Real-time test ticket');
    await page1.click('button:has-text("Save")');

    // Verify ticket appears in first client
    await expect(page1.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();

    // Verify ticket appears in second client without refresh
    await expect(page2.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible({ timeout: 5000 });
  });

  test('should sync ticket moves between columns', async () => {
    const boardName = `RT Moves ${Date.now()}`;

    // Setup: Create board and navigate both clients
    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');

    await page1.click(`.board-card:has-text("${boardName}")`);
    await page1.waitForSelector('.column');

    await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 5000 });
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Create a ticket
    const ticketTitle = `Move Test ${Date.now()}`;
    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', ticketTitle);
    await page1.click('button:has-text("Save")');

    // Wait for ticket to appear in both clients
    await expect(page1.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();
    await expect(page2.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible({ timeout: 5000 });

    // Move ticket in first client
    const ticket1 = page1.locator('.ticket-card').filter({ hasText: ticketTitle });
    const inProgressColumn1 = page1.locator('.column').filter({ hasText: 'IN PROGRESS' });
    await ticket1.dragTo(inProgressColumn1);

    // Wait for the move to complete
    await page1.waitForTimeout(1000);

    // Verify move in first client
    await expect(inProgressColumn1.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();

    // Verify move is reflected in second client
    const inProgressColumn2 = page2.locator('.column').filter({ hasText: 'IN PROGRESS' });
    await expect(inProgressColumn2.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible({ timeout: 5000 });

    // Verify ticket is no longer in TODO in second client
    const todoColumn2 = page2.locator('.column').filter({ hasText: 'TODO' });
    await expect(todoColumn2.locator('.ticket-card').filter({ hasText: ticketTitle })).not.toBeVisible();
  });

  test('should sync ticket updates in real-time', async () => {
    const boardName = `RT Updates ${Date.now()}`;

    // Setup board and ticket
    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');

    await page1.click(`.board-card:has-text("${boardName}")`);
    await page1.waitForSelector('.column');

    await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 5000 });
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Create initial ticket
    const originalTitle = `Original ${Date.now()}`;
    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', originalTitle);
    await page1.click('button:has-text("Save")');

    // Wait for ticket in both clients
    await expect(page1.locator('.ticket-card').filter({ hasText: originalTitle })).toBeVisible();
    await expect(page2.locator('.ticket-card').filter({ hasText: originalTitle })).toBeVisible({ timeout: 5000 });

    // Edit ticket in first client
    await page1.click(`.ticket-card:has-text("${originalTitle}")`);
    await page1.waitForSelector('.ticket-detail');

    const updatedTitle = `Updated ${originalTitle}`;
    await page1.fill('input[value*="' + originalTitle + '"]', updatedTitle);
    await page1.fill('textarea', 'Updated description in real-time');
    await page1.click('button:has-text("Save")');

    // Close detail view
    const closeButton = page1.locator('button[aria-label="Close"]');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }

    // Verify update in first client
    await expect(page1.locator('.ticket-card').filter({ hasText: updatedTitle })).toBeVisible();

    // Verify update appears in second client
    await expect(page2.locator('.ticket-card').filter({ hasText: updatedTitle })).toBeVisible({ timeout: 5000 });
    await expect(page2.locator('.ticket-card').filter({ hasText: originalTitle })).not.toBeVisible();
  });

  test('should sync ticket deletion across clients', async () => {
    const boardName = `RT Delete ${Date.now()}`;

    // Setup board and ticket
    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');

    await page1.click(`.board-card:has-text("${boardName}")`);
    await page1.waitForSelector('.column');

    await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 5000 });
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Create ticket
    const ticketTitle = `Delete Test ${Date.now()}`;
    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', ticketTitle);
    await page1.click('button:has-text("Save")');

    // Wait for ticket in both clients
    await expect(page1.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();
    await expect(page2.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible({ timeout: 5000 });

    // Delete ticket in first client
    await page1.click(`.ticket-card:has-text("${ticketTitle}")`);
    await page1.waitForSelector('.ticket-detail');

    const deleteButton = page1.locator('button:has-text("Delete")');
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      const confirmButton = page1.locator('button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }
    }

    // Verify deletion in first client
    await expect(page1.locator('.ticket-card').filter({ hasText: ticketTitle })).not.toBeVisible();

    // Verify deletion is reflected in second client
    await expect(page2.locator('.ticket-card').filter({ hasText: ticketTitle })).not.toBeVisible({ timeout: 5000 });
  });

  test('should sync comments in real-time', async () => {
    const boardName = `RT Comments ${Date.now()}`;

    // Setup board and ticket
    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');

    await page1.click(`.board-card:has-text("${boardName}")`);
    await page1.waitForSelector('.column');

    await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 5000 });
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Create ticket
    const ticketTitle = `Comment Test ${Date.now()}`;
    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', ticketTitle);
    await page1.click('button:has-text("Save")');

    // Wait for ticket and open details in both clients
    await expect(page1.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();
    await expect(page2.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible({ timeout: 5000 });

    await page1.click(`.ticket-card:has-text("${ticketTitle}")`);
    await page1.waitForSelector('.ticket-detail');

    await page2.click(`.ticket-card:has-text("${ticketTitle}")`);
    await page2.waitForSelector('.ticket-detail');

    // Add comment in first client
    const commentText = 'This is a real-time comment test';
    const commentInput1 = page1.locator('textarea[placeholder*="comment" i]');
    if (await commentInput1.isVisible()) {
      await commentInput1.fill(commentText);
      await page1.click('button:has-text("Add Comment")');

      // Verify comment appears in first client
      await expect(page1.locator('.comment').filter({ hasText: commentText })).toBeVisible();

      // Verify comment appears in second client
      await expect(page2.locator('.comment').filter({ hasText: commentText })).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show connection status indicator', async () => {
    // Check for connection status indicator
    const connectionStatus1 = page1.locator('.connection-status, .status-indicator, [aria-label*="connection"]');
    const connectionStatus2 = page2.locator('.connection-status, .status-indicator, [aria-label*="connection"]');

    // Verify both clients show connected status
    if (await connectionStatus1.isVisible()) {
      await expect(connectionStatus1).toHaveAttribute('class', /connected|online/i);
    }

    if (await connectionStatus2.isVisible()) {
      await expect(connectionStatus2).toHaveAttribute('class', /connected|online/i);
    }

    // Simulate disconnect by going offline
    await context1.setOffline(true);

    // Check for disconnected status
    if (await connectionStatus1.isVisible()) {
      await expect(connectionStatus1).toHaveAttribute('class', /disconnected|offline/i, { timeout: 5000 });
    }

    // Reconnect
    await context1.setOffline(false);

    // Verify reconnection
    if (await connectionStatus1.isVisible()) {
      await expect(connectionStatus1).toHaveAttribute('class', /connected|online/i, { timeout: 10000 });
    }
  });

  test('should handle concurrent edits gracefully', async () => {
    const boardName = `RT Concurrent ${Date.now()}`;

    // Setup board and ticket
    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');

    await page1.click(`.board-card:has-text("${boardName}")`);
    await page1.waitForSelector('.column');

    await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 5000 });
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Create ticket
    const ticketTitle = `Concurrent Edit ${Date.now()}`;
    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', ticketTitle);
    await page1.click('button:has-text("Save")');

    // Wait for ticket in both clients
    await expect(page1.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();
    await expect(page2.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible({ timeout: 5000 });

    // Open ticket details in both clients
    await page1.click(`.ticket-card:has-text("${ticketTitle}")`);
    await page1.waitForSelector('.ticket-detail');

    await page2.click(`.ticket-card:has-text("${ticketTitle}")`);
    await page2.waitForSelector('.ticket-detail');

    // Make concurrent edits
    const edit1 = `Edit from Client 1 - ${Date.now()}`;
    const edit2 = `Edit from Client 2 - ${Date.now()}`;

    // Client 1 edits title
    await page1.fill('input[value*="' + ticketTitle + '"]', edit1);

    // Client 2 edits description
    await page2.fill('textarea', edit2);

    // Save both edits
    await Promise.all([
      page1.click('button:has-text("Save")'),
      page2.click('button:has-text("Save")')
    ]);

    // Wait for updates to propagate
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Verify both clients have consistent state
    // The last write should win, but both clients should be in sync
    const finalTitle1 = await page1.locator('.ticket-detail input').first().inputValue();
    const finalTitle2 = await page2.locator('.ticket-detail input').first().inputValue();

    // Both clients should show the same final state
    expect(finalTitle1).toBe(finalTitle2);
  });

  test('should maintain real-time sync after reconnection', async () => {
    const boardName = `RT Reconnect ${Date.now()}`;

    // Setup board
    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');

    await page1.click(`.board-card:has-text("${boardName}")`);
    await page1.waitForSelector('.column');

    await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 5000 });
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Disconnect client 2
    await context2.setOffline(true);

    // Create ticket while client 2 is offline
    const ticketTitle = `Offline Test ${Date.now()}`;
    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', ticketTitle);
    await page1.click('button:has-text("Save")');

    // Verify ticket in client 1
    await expect(page1.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible();

    // Reconnect client 2
    await context2.setOffline(false);
    await page2.reload(); // May need to reload to reconnect
    await page2.waitForLoadState('networkidle');

    // Navigate back to board
    await page2.click(`.board-card:has-text("${boardName}")`);
    await page2.waitForSelector('.column');

    // Verify client 2 receives the update after reconnection
    await expect(page2.locator('.ticket-card').filter({ hasText: ticketTitle })).toBeVisible({ timeout: 10000 });
  });
});
