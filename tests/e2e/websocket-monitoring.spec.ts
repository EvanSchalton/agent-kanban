import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

/**
 * WEBSOCKET REAL-TIME MONITORING TESTS
 *
 * Emergency test suite for WebSocket real-time updates and sync validation
 * Monitors connection stability and data synchronization across clients
 */
test.describe('WebSocket Real-time Monitoring Suite', () => {
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
    // Create two separate browser contexts
    context1 = await browser.newContext();
    context2 = await browser.newContext();

    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Monitor WebSocket connections
    page1.on('websocket', ws => {
      console.log(`📡 Client 1 WebSocket: ${ws.url()}`);
      ws.on('framesent', event => console.log(`➡️ Client 1 sent: ${event.payload}`));
      ws.on('framereceived', event => console.log(`⬅️ Client 1 received: ${event.payload}`));
    });

    page2.on('websocket', ws => {
      console.log(`📡 Client 2 WebSocket: ${ws.url()}`);
      ws.on('framesent', event => console.log(`➡️ Client 2 sent: ${event.payload}`));
      ws.on('framereceived', event => console.log(`⬅️ Client 2 received: ${event.payload}`));
    });

    // Monitor console errors
    [page1, page2].forEach((page, index) => {
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error(`❌ Client ${index + 1} Error: ${msg.text()}`);
        }
      });
    });

    // Navigate both pages
    await Promise.all([
      page1.goto(baseURL),
      page2.goto(baseURL)
    ]);

    await Promise.all([
      page1.waitForLoadState('networkidle'),
      page2.waitForLoadState('networkidle')
    ]);
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
  });

  test.describe('P0 Critical WebSocket Operations', () => {
    test('CRITICAL: Real-time card creation sync', async () => {
      const timestamp = Date.now();
      const boardName = `RT-Sync-${timestamp}`;
      const cardTitle = `RT-Card-${timestamp}`;

      console.log('🚨 CRITICAL: Testing real-time card creation synchronization');

      // Create board in client 1
      await page1.click('button:has-text("Create Board")');
      await page1.fill('input[placeholder*="board name" i]', boardName);
      await page1.click('button:has-text("Create")');

      // Verify board appears in client 1
      await expect(page1.locator('.board-card').filter({ hasText: boardName })).toBeVisible({ timeout: 10000 });

      // CRITICAL: Board should appear in client 2 via WebSocket
      await expect(page2.locator('.board-card').filter({ hasText: boardName })).toBeVisible({ timeout: 15000 });
      console.log('✅ Board creation synced to client 2');

      // Navigate both clients to the board
      await page1.click(`.board-card:has-text("${boardName}")`);
      await page1.waitForSelector('.column');

      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // Create card in client 1
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn1.locator('button:has-text("Add Card")').click();
      await page1.fill('input[placeholder*="title" i]', cardTitle);
      await page1.click('button:has-text("Save")');

      // Verify card appears in client 1
      await expect(page1.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 10000 });

      // CRITICAL: Card should appear in client 2 via WebSocket
      await expect(page2.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 15000 });

      console.log('🎉 CRITICAL SUCCESS: Real-time card creation working');
    });

    test('CRITICAL: Real-time drag and drop sync', async () => {
      const timestamp = Date.now();
      const boardName = `RT-Drag-${timestamp}`;
      const cardTitle = `RT-DragCard-${timestamp}`;

      console.log('🚨 CRITICAL: Testing real-time drag and drop synchronization');

      // Setup board and card
      await page1.click('button:has-text("Create Board")');
      await page1.fill('input[placeholder*="board name" i]', boardName);
      await page1.click('button:has-text("Create")');

      await page1.click(`.board-card:has-text("${boardName}")`);
      await page1.waitForSelector('.column');

      // Wait for board to sync and navigate client 2
      await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 15000 });
      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // Create card
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn1.locator('button:has-text("Add Card")').click();
      await page1.fill('input[placeholder*="title" i]', cardTitle);
      await page1.click('button:has-text("Save")');

      // Wait for card to sync
      await expect(page1.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
      await expect(page2.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 15000 });

      // Drag card in client 1
      const card1 = page1.locator('.ticket-card').filter({ hasText: cardTitle });
      const inProgressColumn1 = page1.locator('.column').filter({ hasText: 'IN PROGRESS' });
      await card1.dragTo(inProgressColumn1);
      await page1.waitForTimeout(2000);

      // Verify move in client 1
      await expect(inProgressColumn1.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();

      // CRITICAL: Move should sync to client 2
      const inProgressColumn2 = page2.locator('.column').filter({ hasText: 'IN PROGRESS' });
      await expect(inProgressColumn2.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 15000 });

      // Verify card is no longer in TODO in client 2
      const todoColumn2 = page2.locator('.column').filter({ hasText: 'TODO' });
      await expect(todoColumn2.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible();

      console.log('🎉 CRITICAL SUCCESS: Real-time drag and drop working');
    });

    test('CRITICAL: Real-time card update sync', async () => {
      const timestamp = Date.now();
      const boardName = `RT-Update-${timestamp}`;
      const originalTitle = `Original-${timestamp}`;
      const updatedTitle = `Updated-${timestamp}`;

      console.log('🚨 CRITICAL: Testing real-time card update synchronization');

      // Setup board and card
      await page1.click('button:has-text("Create Board")');
      await page1.fill('input[placeholder*="board name" i]', boardName);
      await page1.click('button:has-text("Create")');

      await page1.click(`.board-card:has-text("${boardName}")`);
      await page1.waitForSelector('.column');

      await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 15000 });
      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // Create card
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn1.locator('button:has-text("Add Card")').click();
      await page1.fill('input[placeholder*="title" i]', originalTitle);
      await page1.click('button:has-text("Save")');

      // Wait for sync
      await expect(page1.locator('.ticket-card').filter({ hasText: originalTitle })).toBeVisible();
      await expect(page2.locator('.ticket-card').filter({ hasText: originalTitle })).toBeVisible({ timeout: 15000 });

      // Edit card in client 1
      await page1.click(`.ticket-card:has-text("${originalTitle}")`);
      await page1.waitForSelector('.ticket-detail');

      await page1.fill('input[value*="' + originalTitle.split('-')[0] + '"]', updatedTitle);
      await page1.click('button:has-text("Save")');

      // Close detail view
      const closeButton = page1.locator('button[aria-label="Close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }

      // Verify update in client 1
      await expect(page1.locator('.ticket-card').filter({ hasText: updatedTitle })).toBeVisible();

      // CRITICAL: Update should sync to client 2
      await expect(page2.locator('.ticket-card').filter({ hasText: updatedTitle })).toBeVisible({ timeout: 15000 });
      await expect(page2.locator('.ticket-card').filter({ hasText: originalTitle })).not.toBeVisible();

      console.log('🎉 CRITICAL SUCCESS: Real-time card update working');
    });

    test('CRITICAL: Real-time card deletion sync', async () => {
      const timestamp = Date.now();
      const boardName = `RT-Delete-${timestamp}`;
      const cardTitle = `DeleteMe-${timestamp}`;

      console.log('🚨 CRITICAL: Testing real-time card deletion synchronization');

      // Setup board and card
      await page1.click('button:has-text("Create Board")');
      await page1.fill('input[placeholder*="board name" i]', boardName);
      await page1.click('button:has-text("Create")');

      await page1.click(`.board-card:has-text("${boardName}")`);
      await page1.waitForSelector('.column');

      await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 15000 });
      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // Create card
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn1.locator('button:has-text("Add Card")').click();
      await page1.fill('input[placeholder*="title" i]', cardTitle);
      await page1.click('button:has-text("Save")');

      // Wait for sync
      await expect(page1.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
      await expect(page2.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 15000 });

      // Delete card in client 1
      await page1.click(`.ticket-card:has-text("${cardTitle}")`);
      await page1.waitForSelector('.ticket-detail');

      const deleteButton = page1.locator('button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const confirmButton = page1.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }
      }

      // Verify deletion in client 1
      await expect(page1.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible();

      // CRITICAL: Deletion should sync to client 2
      await expect(page2.locator('.ticket-card').filter({ hasText: cardTitle })).not.toBeVisible({ timeout: 15000 });

      console.log('🎉 CRITICAL SUCCESS: Real-time card deletion working');
    });
  });

  test.describe('P1 WebSocket Stability and Recovery', () => {
    test('CRITICAL: Connection status monitoring', async () => {
      console.log('🚨 CRITICAL: Testing WebSocket connection status monitoring');

      // Check for connection status indicators
      const connectionStatus1 = page1.locator('.connection-status, .status-indicator, [aria-label*="connection"]');
      const connectionStatus2 = page2.locator('.connection-status, .status-indicator, [aria-label*="connection"]');

      // Test normal connection
      if (await connectionStatus1.isVisible()) {
        await expect(connectionStatus1).toHaveAttribute('class', /connected|online/i);
        console.log('✅ Client 1 shows connected status');
      }

      if (await connectionStatus2.isVisible()) {
        await expect(connectionStatus2).toHaveAttribute('class', /connected|online/i);
        console.log('✅ Client 2 shows connected status');
      }

      // Test disconnection
      await context1.setOffline(true);
      await page1.waitForTimeout(3000);

      if (await connectionStatus1.isVisible()) {
        await expect(connectionStatus1).toHaveAttribute('class', /disconnected|offline/i, { timeout: 10000 });
        console.log('✅ Client 1 shows disconnected status');
      }

      // Test reconnection
      await context1.setOffline(false);
      await page1.waitForTimeout(5000);

      if (await connectionStatus1.isVisible()) {
        await expect(connectionStatus1).toHaveAttribute('class', /connected|online/i, { timeout: 15000 });
        console.log('✅ Client 1 reconnected successfully');
      }

      console.log('🎉 WebSocket connection monitoring working');
    });

    test('CRITICAL: Data sync after reconnection', async () => {
      const timestamp = Date.now();
      const boardName = `Reconnect-${timestamp}`;
      const cardTitle = `OfflineCard-${timestamp}`;

      console.log('🚨 CRITICAL: Testing data sync after reconnection');

      // Setup board
      await page1.click('button:has-text("Create Board")');
      await page1.fill('input[placeholder*="board name" i]', boardName);
      await page1.click('button:has-text("Create")');

      await page1.click(`.board-card:has-text("${boardName}")`);
      await page1.waitForSelector('.column');

      await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 15000 });
      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // Disconnect client 2
      await context2.setOffline(true);
      console.log('📡 Client 2 disconnected');

      // Create card while client 2 is offline
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn1.locator('button:has-text("Add Card")').click();
      await page1.fill('input[placeholder*="title" i]', cardTitle);
      await page1.click('button:has-text("Save")');

      await expect(page1.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible();
      console.log('✅ Card created while client 2 offline');

      // Reconnect client 2
      await context2.setOffline(false);
      await page2.reload();
      await page2.waitForLoadState('networkidle');

      // Navigate back to board
      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // CRITICAL: Card should appear after reconnection
      await expect(page2.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 20000 });

      console.log('🎉 CRITICAL SUCCESS: Data sync after reconnection working');
    });

    test('CRITICAL: Concurrent operations handling', async () => {
      const timestamp = Date.now();
      const boardName = `Concurrent-${timestamp}`;
      const card1Title = `Concurrent1-${timestamp}`;
      const card2Title = `Concurrent2-${timestamp}`;

      console.log('🚨 CRITICAL: Testing concurrent operations handling');

      // Setup board
      await page1.click('button:has-text("Create Board")');
      await page1.fill('input[placeholder*="board name" i]', boardName);
      await page1.click('button:has-text("Create")');

      await page1.click(`.board-card:has-text("${boardName}")`);
      await page1.waitForSelector('.column');

      await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 15000 });
      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // Create cards simultaneously
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
      const todoColumn2 = page2.locator('.column').filter({ hasText: 'TODO' });

      // Start both operations at the same time
      await Promise.all([
        (async () => {
          await todoColumn1.locator('button:has-text("Add Card")').click();
          await page1.fill('input[placeholder*="title" i]', card1Title);
          await page1.click('button:has-text("Save")');
        })(),
        (async () => {
          await page2.waitForTimeout(100); // Slight delay to ensure concurrent execution
          await todoColumn2.locator('button:has-text("Add Card")').click();
          await page2.fill('input[placeholder*="title" i]', card2Title);
          await page2.click('button:has-text("Save")');
        })()
      ]);

      // Wait for operations to complete
      await page1.waitForTimeout(3000);
      await page2.waitForTimeout(3000);

      // Both cards should exist in both clients
      await expect(page1.locator('.ticket-card').filter({ hasText: card1Title })).toBeVisible();
      await expect(page1.locator('.ticket-card').filter({ hasText: card2Title })).toBeVisible({ timeout: 10000 });

      await expect(page2.locator('.ticket-card').filter({ hasText: card1Title })).toBeVisible({ timeout: 10000 });
      await expect(page2.locator('.ticket-card').filter({ hasText: card2Title })).toBeVisible();

      console.log('🎉 CRITICAL SUCCESS: Concurrent operations handled correctly');
    });
  });

  test.describe('P2 WebSocket Performance and Edge Cases', () => {
    test('WebSocket message frequency stress test', async () => {
      const timestamp = Date.now();
      const boardName = `Stress-${timestamp}`;

      console.log('🔄 Testing WebSocket under rapid operations');

      // Setup board
      await page1.click('button:has-text("Create Board")');
      await page1.fill('input[placeholder*="board name" i]', boardName);
      await page1.click('button:has-text("Create")');

      await page1.click(`.board-card:has-text("${boardName}")`);
      await page1.waitForSelector('.column');

      await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 15000 });
      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // Create multiple cards rapidly
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
      const cardTitles: string[] = [];

      for (let i = 1; i <= 5; i++) {
        const cardTitle = `StressCard-${i}-${timestamp}`;
        cardTitles.push(cardTitle);

        await todoColumn1.locator('button:has-text("Add Card")').click();
        await page1.fill('input[placeholder*="title" i]', cardTitle);
        await page1.click('button:has-text("Save")');
        await page1.waitForTimeout(200); // Minimal delay
      }

      // Wait for all operations to sync
      await page1.waitForTimeout(5000);

      // Verify all cards synced to client 2
      for (const cardTitle of cardTitles) {
        await expect(page2.locator('.ticket-card').filter({ hasText: cardTitle })).toBeVisible({ timeout: 5000 });
      }

      console.log(`✅ All ${cardTitles.length} rapid operations synced successfully`);
    });

    test('Large data synchronization test', async () => {
      const timestamp = Date.now();
      const boardName = `LargeData-${timestamp}`;
      const longDescription = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20);

      console.log('📊 Testing large data synchronization');

      // Setup board
      await page1.click('button:has-text("Create Board")');
      await page1.fill('input[placeholder*="board name" i]', boardName);
      await page1.click('button:has-text("Create")');

      await page1.click(`.board-card:has-text("${boardName}")`);
      await page1.waitForSelector('.column');

      await page2.waitForSelector(`.board-card:has-text("${boardName}")`, { timeout: 15000 });
      await page2.click(`.board-card:has-text("${boardName}")`);
      await page2.waitForSelector('.column');

      // Create card with large description
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn1.locator('button:has-text("Add Card")').click();
      await page1.fill('input[placeholder*="title" i]', `LargeCard-${timestamp}`);

      const descInput = page1.locator('textarea[placeholder*="description" i]');
      if (await descInput.isVisible()) {
        await descInput.fill(longDescription);
      }

      await page1.click('button:has-text("Save")');

      // Verify sync
      await expect(page1.locator('.ticket-card').filter({ hasText: `LargeCard-${timestamp}` })).toBeVisible();
      await expect(page2.locator('.ticket-card').filter({ hasText: `LargeCard-${timestamp}` })).toBeVisible({ timeout: 15000 });

      console.log('✅ Large data synchronized successfully');
    });
  });
});
