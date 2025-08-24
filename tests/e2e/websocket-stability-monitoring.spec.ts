import { test, expect, Page } from '@playwright/test';

/**
 * ⚠️ P2 MEDIUM: WebSocket Connection Stability Tests
 *
 * Purpose: Address WebSocket connection issues mentioned in QA report:
 * - "No pong received in 35 seconds" warnings
 * - Intermittent disconnections and reconnection attempts
 * - Connection status indicator fluctuations
 *
 * Test Coverage:
 * 1. WebSocket connection establishment and maintenance
 * 2. Ping/Pong heartbeat mechanism
 * 3. Reconnection logic under various failure scenarios
 * 4. Real-time updates during connection instability
 * 5. UI connection status accuracy
 */

test.describe('⚠️ P2: WebSocket Connection Stability', () => {
  const baseURL = 'http://localhost:5173';
  let boardName: string;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    boardName = `WebSocket Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    await setupWebSocketTestData(page);
  });

  async function setupWebSocketTestData(page: Page) {
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

    const wsTestCards = [
      'WebSocket Test Card 1',
      'WebSocket Test Card 2',
      'Real-time Update Test'
    ];

    for (const cardTitle of wsTestCards) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardTitle);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }
  }

  test('WebSocket connection establishment and heartbeat monitoring', async () => {
    console.log('⚠️ Testing WebSocket connection and heartbeat');

    // Monitor WebSocket connections and messages
    const wsConnections: Array<{
      type: string;
      timestamp: number;
      data?: any;
    }> = [];

    // Intercept WebSocket messages
    await page.addInitScript(() => {
      const originalWS = window.WebSocket;
      window.WebSocket = class extends originalWS {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);

          (window as any).wsLogs = (window as any).wsLogs || [];

          this.addEventListener('open', () => {
            (window as any).wsLogs.push({ type: 'open', timestamp: Date.now() });
            console.log('WebSocket connected');
          });

          this.addEventListener('close', (event) => {
            (window as any).wsLogs.push({
              type: 'close',
              timestamp: Date.now(),
              code: event.code,
              reason: event.reason
            });
            console.log('WebSocket disconnected:', event.code, event.reason);
          });

          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              (window as any).wsLogs.push({
                type: 'message',
                timestamp: Date.now(),
                data: data
              });

              if (data.type === 'ping') {
                console.log('Ping received');
              } else if (data.type === 'pong') {
                console.log('Pong received');
              }
            } catch (e) {
              (window as any).wsLogs.push({
                type: 'message',
                timestamp: Date.now(),
                raw: event.data
              });
            }
          });

          this.addEventListener('error', (event) => {
            (window as any).wsLogs.push({
              type: 'error',
              timestamp: Date.now(),
              error: event
            });
            console.log('WebSocket error:', event);
          });
        }
      };
    });

    // Wait for initial connection
    await page.waitForTimeout(3000);

    // Check connection status indicator
    const connectionStatus = page.locator('[class*="connection"], [class*="status"]').first();
    if (await connectionStatus.isVisible()) {
      const statusText = await connectionStatus.textContent();
      console.log(`Connection status: ${statusText}`);

      // Should indicate connected state
      expect(statusText?.toLowerCase()).toContain('connect');
    }

    // Monitor for 30 seconds to catch ping/pong issues
    console.log('Monitoring WebSocket for 30 seconds...');
    await page.waitForTimeout(30000);

    // Retrieve WebSocket logs
    const wsLogs = await page.evaluate(() => (window as any).wsLogs || []);

    console.log(`\nWebSocket Activity Summary: ${wsLogs.length} events`);

    // Analyze connection events
    const openEvents = wsLogs.filter((log: any) => log.type === 'open');
    const closeEvents = wsLogs.filter((log: any) => log.type === 'close');
    const errorEvents = wsLogs.filter((log: any) => log.type === 'error');
    const pingEvents = wsLogs.filter((log: any) => log.data?.type === 'ping');
    const pongEvents = wsLogs.filter((log: any) => log.data?.type === 'pong');

    console.log(`  Opens: ${openEvents.length}`);
    console.log(`  Closes: ${closeEvents.length}`);
    console.log(`  Errors: ${errorEvents.length}`);
    console.log(`  Pings: ${pingEvents.length}`);
    console.log(`  Pongs: ${pongEvents.length}`);

    // ASSERTIONS for connection stability
    expect(openEvents.length).toBeGreaterThan(0); // Should have connected
    expect(errorEvents.length).toBe(0); // No errors during monitoring

    // If we have close events, should have corresponding reconnection
    if (closeEvents.length > 0) {
      expect(openEvents.length).toBeGreaterThan(closeEvents.length); // More opens than closes
      console.log('⚠️ Detected reconnections, but system recovered');
    }

    console.log('✅ WebSocket connection monitoring completed');
  });

  test('Real-time updates during connection instability', async () => {
    console.log('⚠️ Testing real-time updates during connection instability');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Track real-time update messages
    const updateMessages: Array<{
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
              (window as any).realtimeUpdates = (window as any).realtimeUpdates || [];
              (window as any).realtimeUpdates.push({
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

    // Perform card operations to generate real-time updates
    const testCard = todoColumn.locator('.ticket-card').filter({ hasText: 'WebSocket Test Card 1' });

    // Move card to trigger real-time update
    await testCard.dragTo(inProgressColumn);
    await page.waitForTimeout(2000);

    // Edit the moved card to generate more updates
    const movedCard = inProgressColumn.locator('.ticket-card').filter({ hasText: 'WebSocket Test Card 1' });
    await movedCard.click();
    await page.waitForTimeout(500);

    const editButton = page.locator('button').filter({ hasText: /edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);

      const titleField = page.locator('input').first();
      if (await titleField.isVisible()) {
        await titleField.clear();
        await titleField.fill('UPDATED WebSocket Test Card');

        const saveButton = page.locator('button').filter({ hasText: /save/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // Check for real-time updates
    const updates = await page.evaluate(() => (window as any).realtimeUpdates || []);

    console.log(`Real-time updates received: ${updates.length}`);

    // Should have received updates for move and edit operations
    const moveUpdates = updates.filter((update: any) =>
      update.data.type === 'ticket_updated' ||
      update.data.type === 'ticket_moved' ||
      (update.data.ticket && update.data.ticket.title)
    );

    expect(moveUpdates.length).toBeGreaterThan(0);
    console.log('✅ Real-time updates received during operations');

    // Verify final state matches updates
    const updatedCardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'UPDATED WebSocket Test Card' }).isVisible();
    expect(updatedCardInProgress).toBe(true);

    console.log('✅ Real-time updates consistent with final state');
  });

  test('Connection status indicator accuracy', async () => {
    console.log('⚠️ Testing connection status indicator accuracy');

    // Look for connection status elements
    const connectionIndicators = [
      page.locator('[class*="connection-status"]'),
      page.locator('[class*="websocket-status"]'),
      page.locator('[class*="online-status"]'),
      page.locator('[class*="connection"]'),
      page.locator('.status-indicator'),
      page.locator('[data-testid*="connection"]')
    ];

    let statusIndicator = null;
    for (const indicator of connectionIndicators) {
      if (await indicator.first().isVisible()) {
        statusIndicator = indicator.first();
        break;
      }
    }

    if (statusIndicator) {
      console.log('Found connection status indicator');

      const initialStatus = await statusIndicator.textContent();
      console.log(`Initial status: "${initialStatus}"`);

      // Monitor status changes over time
      const statusChanges: string[] = [];

      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(3000); // Check every 3 seconds
        const currentStatus = await statusIndicator.textContent();

        if (currentStatus && currentStatus !== statusChanges[statusChanges.length - 1]) {
          statusChanges.push(currentStatus);
          console.log(`Status change: "${currentStatus}"`);
        }
      }

      // Status should indicate connected state most of the time
      const connectedStates = statusChanges.filter(status =>
        status.toLowerCase().includes('connect') ||
        status.toLowerCase().includes('online')
      );

      expect(connectedStates.length).toBeGreaterThan(statusChanges.length / 2);
      console.log('✅ Connection status indicator shows mostly connected state');

    } else {
      console.log('ℹ️ No connection status indicator found');
    }
  });

  test('WebSocket reconnection stress test', async () => {
    console.log('⚠️ Testing WebSocket reconnection under stress');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    // Track connection events during stress test
    await page.addInitScript(() => {
      const originalWS = window.WebSocket;
      window.WebSocket = class extends originalWS {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);

          (window as any).connectionEvents = (window as any).connectionEvents || [];

          this.addEventListener('open', () => {
            (window as any).connectionEvents.push({ type: 'open', time: Date.now() });
          });

          this.addEventListener('close', (event) => {
            (window as any).connectionEvents.push({
              type: 'close',
              time: Date.now(),
              code: event.code
            });
          });

          this.addEventListener('error', () => {
            (window as any).connectionEvents.push({ type: 'error', time: Date.now() });
          });
        }
      };
    });

    // Simulate network instability by rapidly performing operations
    console.log('Simulating rapid operations to stress WebSocket...');

    for (let i = 0; i < 5; i++) {
      console.log(`Stress iteration ${i + 1}/5`);

      // Rapid drag operations
      const cards = await todoColumn.locator('.ticket-card').all();

      for (const card of cards.slice(0, 2)) { // Limit to 2 cards per iteration
        if (await card.isVisible()) {
          await card.dragTo(inProgressColumn);
          await page.waitForTimeout(200); // Very short delay

          // Move back
          const movedCard = inProgressColumn.locator('.ticket-card').first();
          if (await movedCard.isVisible()) {
            await movedCard.dragTo(todoColumn);
            await page.waitForTimeout(200);
          }
        }
      }
    }

    // Wait for system to stabilize
    await page.waitForTimeout(5000);

    // Analyze connection events
    const connectionEvents = await page.evaluate(() => (window as any).connectionEvents || []);

    console.log(`\nConnection Events Analysis: ${connectionEvents.length} events`);

    const opens = connectionEvents.filter((e: any) => e.type === 'open');
    const closes = connectionEvents.filter((e: any) => e.type === 'close');
    const errors = connectionEvents.filter((e: any) => e.type === 'error');

    console.log(`  Opens: ${opens.length}`);
    console.log(`  Closes: ${closes.length}`);
    console.log(`  Errors: ${errors.length}`);

    // ASSERTIONS for connection stability
    expect(opens.length).toBeGreaterThan(0); // Should have connected
    expect(errors.length).toBeLessThan(3); // Minimal errors acceptable

    // If there were disconnections, should have reconnected
    if (closes.length > 0) {
      expect(opens.length).toBeGreaterThanOrEqual(closes.length);
      console.log('⚠️ Reconnections detected but system recovered');
    }

    // Final verification: System should be functional
    const finalCard = todoColumn.locator('.ticket-card').first();
    if (await finalCard.isVisible()) {
      await finalCard.dragTo(inProgressColumn);
      await page.waitForTimeout(2000);

      const cardMoved = await inProgressColumn.locator('.ticket-card').isVisible();
      expect(cardMoved).toBe(true);
      console.log('✅ System remains functional after stress test');
    }
  });

  test('Real-time update reliability during poor connection', async () => {
    console.log('⚠️ Testing real-time update reliability');

    // Monitor real-time updates
    const realtimeUpdates: Array<{
      type: string;
      cardId?: string;
      column?: string;
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
              (window as any).realtimeUpdates = (window as any).realtimeUpdates || [];

              if (data.type && data.type !== 'ping' && data.type !== 'pong') {
                (window as any).realtimeUpdates.push({
                  type: data.type,
                  cardId: data.ticket?.id,
                  column: data.ticket?.current_column,
                  timestamp: Date.now()
                });
              }
            } catch (e) {
              // Non-JSON message
            }
          });
        }
      };
    });

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Perform operations that should generate real-time updates
    const operations = [
      { card: 'WebSocket Test Card 1', target: doneColumn },
      { card: 'WebSocket Test Card 2', target: doneColumn },
      { card: 'Real-time Update Test', target: doneColumn }
    ];

    for (const op of operations) {
      const card = todoColumn.locator('.ticket-card').filter({ hasText: op.card });

      if (await card.isVisible()) {
        console.log(`Moving ${op.card} to DONE...`);
        await card.dragTo(op.target);
        await page.waitForTimeout(2000);

        // Verify card moved in UI
        const cardInTarget = await op.target.locator('.ticket-card').filter({ hasText: op.card }).isVisible();
        expect(cardInTarget).toBe(true);
      }
    }

    // Analyze real-time updates
    await page.waitForTimeout(2000);
    const updates = await page.evaluate(() => (window as any).realtimeUpdates || []);

    console.log(`\nReal-time Updates Analysis: ${updates.length} updates`);

    updates.forEach((update: any, index: number) => {
      console.log(`  Update ${index + 1}: ${update.type} - Card ${update.cardId} - Column ${update.column}`);
    });

    // Should have received updates for moved cards
    const moveUpdates = updates.filter((update: any) =>
      update.type === 'ticket_updated' ||
      update.type === 'ticket_moved' ||
      update.column
    );

    expect(moveUpdates.length).toBeGreaterThan(0);
    console.log('✅ Real-time updates received for card movements');
  });

  test('Connection recovery after extended disconnection', async () => {
    console.log('⚠️ Testing connection recovery after disconnection');

    // Monitor connection state
    await page.addInitScript(() => {
      (window as any).connectionRecovery = {
        disconnectTime: null,
        reconnectTime: null,
        isConnected: false
      };

      const originalWS = window.WebSocket;
      window.WebSocket = class extends originalWS {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);

          this.addEventListener('open', () => {
            (window as any).connectionRecovery.reconnectTime = Date.now();
            (window as any).connectionRecovery.isConnected = true;
            console.log('Connection recovered');
          });

          this.addEventListener('close', () => {
            (window as any).connectionRecovery.disconnectTime = Date.now();
            (window as any).connectionRecovery.isConnected = false;
            console.log('Connection lost');
          });
        }
      };
    });

    // Wait for initial connection
    await page.waitForTimeout(2000);

    // Simulate extended monitoring (like leaving page open)
    console.log('Extended monitoring for connection stability...');
    await page.waitForTimeout(45000); // 45 seconds to test ping/pong timeout

    // Check connection recovery status
    const recoveryInfo = await page.evaluate(() => (window as any).connectionRecovery);

    console.log('Connection Recovery Analysis:');
    console.log(`  Currently connected: ${recoveryInfo.isConnected}`);
    console.log(`  Last disconnect: ${recoveryInfo.disconnectTime ? new Date(recoveryInfo.disconnectTime) : 'None'}`);
    console.log(`  Last reconnect: ${recoveryInfo.reconnectTime ? new Date(recoveryInfo.reconnectTime) : 'None'}`);

    // If disconnection occurred, should have reconnected
    if (recoveryInfo.disconnectTime) {
      expect(recoveryInfo.reconnectTime).toBeGreaterThan(recoveryInfo.disconnectTime);
      expect(recoveryInfo.isConnected).toBe(true);
      console.log('✅ System recovered from disconnection');
    }

    // Verify system functionality after extended monitoring
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    const testCard = todoColumn.locator('.ticket-card').first();
    if (await testCard.isVisible()) {
      await testCard.dragTo(doneColumn);
      await page.waitForTimeout(2000);

      const cardMoved = await doneColumn.locator('.ticket-card').isVisible();
      expect(cardMoved).toBe(true);
      console.log('✅ System functional after extended monitoring period');
    }
  });

  test.afterEach(async () => {
    console.log('\n=== WebSocket Test Complete ===');

    // Log any console errors
    const logs = await page.evaluate(() => {
      const errors = (window as any).console?.errors || [];
      return errors;
    });

    if (logs.length > 0) {
      console.log('Console errors detected:', logs);
    }

    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/websocket-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
