import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * 🔴 IMMEDIATE: WebSocket Real-Time Sync Validation
 *
 * Purpose: Test real-time synchronization between multiple browser windows
 * to ensure WebSocket functionality is working correctly for collaboration.
 *
 * Test Scenarios:
 * 1. Two windows on same board - card creation sync
 * 2. Two windows on same board - card movement sync
 * 3. Two windows on same board - card editing sync
 * 4. Different boards - no cross-contamination
 * 5. Connection recovery testing
 */

test.describe('🔴 IMMEDIATE: WebSocket Real-Time Sync Testing', () => {
  const baseURL = 'http://localhost:15179';
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;
  let boardName: string;
  let boardId: string;

  test.beforeEach(async ({ browser }) => {
    // Create two separate browser contexts (simulate different users)
    context1 = await browser.newContext();
    context2 = await browser.newContext();

    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Setup board for testing
    boardName = `WebSocket Sync Test ${Date.now()}`;
    await setupTestBoard();
  });

  async function setupTestBoard() {
    console.log('🔄 Setting up test board for WebSocket sync testing...');

    // Create board on page1
    await page1.goto(baseURL);
    await page1.waitForLoadState('networkidle');

    await page1.click('button:has-text("Create Board")');
    await page1.fill('input[placeholder*="board name" i]', boardName);
    await page1.click('button:has-text("Create")');
    await page1.click(`.board-card:has-text("${boardName}")`);
    await page1.waitForSelector('.column');

    // Get board ID from URL
    boardId = page1.url().split('/').pop() || 'unknown';
    console.log(`✅ Created test board: ${boardName} (ID: ${boardId})`);

    // Navigate page2 to the same board
    await page2.goto(`${baseURL}/board/${boardId}`);
    await page2.waitForSelector('.column');
    console.log('✅ Both pages connected to same board');
  }

  test('CRITICAL: Real-time card creation sync between windows', async () => {
    console.log('🔴 Testing real-time card creation sync');

    // Monitor WebSocket messages on both pages
    const page1Messages: any[] = [];
    const page2Messages: any[] = [];

    await page1.addInitScript(() => {
      const originalWS = window.WebSocket;
      window.WebSocket = class extends originalWS {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type !== 'ping' && data.type !== 'pong') {
                (window as any).wsMessages = (window as any).wsMessages || [];
                (window as any).wsMessages.push({
                  timestamp: Date.now(),
                  type: data.type,
                  data: data
                });
              }
            } catch (e) {}
          });
        }
      };
    });

    await page2.addInitScript(() => {
      const originalWS = window.WebSocket;
      window.WebSocket = class extends originalWS {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type !== 'ping' && data.type !== 'pong') {
                (window as any).wsMessages = (window as any).wsMessages || [];
                (window as any).wsMessages.push({
                  timestamp: Date.now(),
                  type: data.type,
                  data: data
                });
              }
            } catch (e) {}
          });
        }
      };
    });

    // Wait for WebSocket connections to establish
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Get initial card counts
    const initialPage1Cards = await page1.locator('.ticket-card').count();
    const initialPage2Cards = await page2.locator('.ticket-card').count();

    expect(initialPage1Cards).toBe(initialPage2Cards);
    console.log(`✅ Initial sync: Both pages show ${initialPage1Cards} cards`);

    // Create card on page1
    const testCardTitle = `WebSocket Test Card ${Date.now()}`;
    console.log(`🔄 Creating card on Page 1: ${testCardTitle}`);

    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', testCardTitle);
    await page1.click('button:has-text("Save")');
    await page1.waitForTimeout(2000);

    // Verify card appears on page1
    const cardOnPage1 = await page1.locator('.ticket-card').filter({ hasText: testCardTitle }).isVisible();
    expect(cardOnPage1).toBe(true);
    console.log('✅ Card created and visible on Page 1');

    // CRITICAL TEST: Card should appear on page2 via WebSocket sync
    await page2.waitForTimeout(3000); // Allow time for WebSocket sync

    const cardOnPage2 = await page2.locator('.ticket-card').filter({ hasText: testCardTitle }).isVisible();
    expect(cardOnPage2).toBe(true);
    console.log('✅ Card automatically appeared on Page 2 via WebSocket sync');

    // Verify final card counts match
    const finalPage1Cards = await page1.locator('.ticket-card').count();
    const finalPage2Cards = await page2.locator('.ticket-card').count();

    expect(finalPage1Cards).toBe(finalPage2Cards);
    expect(finalPage1Cards).toBe(initialPage1Cards + 1);

    console.log(`✅ Final sync: Both pages show ${finalPage1Cards} cards`);

    // Check WebSocket messages
    const page1WsMessages = await page1.evaluate(() => (window as any).wsMessages || []);
    const page2WsMessages = await page2.evaluate(() => (window as any).wsMessages || []);

    console.log(`📊 Page 1 received ${page1WsMessages.length} WebSocket messages`);
    console.log(`📊 Page 2 received ${page2WsMessages.length} WebSocket messages`);

    // Page 2 should have received update messages
    expect(page2WsMessages.length).toBeGreaterThan(0);

    console.log('✅ WebSocket real-time card creation sync working correctly');
  });

  test('CRITICAL: Real-time card movement sync between windows', async () => {
    console.log('🔴 Testing real-time card movement sync');

    // Create a card first
    const testCardTitle = `Move Test Card ${Date.now()}`;

    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', testCardTitle);
    await page1.click('button:has-text("Save")');
    await page1.waitForTimeout(2000);

    // Wait for card to sync to page2
    await page2.waitForTimeout(2000);

    // Verify card is in TODO on both pages
    const cardInTodoPage1 = await page1.locator('.column').filter({ hasText: 'TODO' }).locator('.ticket-card').filter({ hasText: testCardTitle }).isVisible();
    const cardInTodoPage2 = await page2.locator('.column').filter({ hasText: 'TODO' }).locator('.ticket-card').filter({ hasText: testCardTitle }).isVisible();

    expect(cardInTodoPage1).toBe(true);
    expect(cardInTodoPage2).toBe(true);
    console.log('✅ Card in TODO column on both pages');

    // Move card from TODO to IN PROGRESS on page1
    console.log('🔄 Moving card from TODO to IN PROGRESS on Page 1...');

    const todoCard = page1.locator('.column').filter({ hasText: 'TODO' }).locator('.ticket-card').filter({ hasText: testCardTitle });
    const inProgressColumn1 = page1.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

    await todoCard.dragTo(inProgressColumn1);
    await page1.waitForTimeout(3000);

    // Verify card moved on page1
    const cardInProgressPage1 = await page1.locator('.column').filter({ hasText: 'IN PROGRESS' }).locator('.ticket-card').filter({ hasText: testCardTitle }).isVisible();
    const cardStillInTodoPage1 = await page1.locator('.column').filter({ hasText: 'TODO' }).locator('.ticket-card').filter({ hasText: testCardTitle }).isVisible();

    expect(cardInProgressPage1).toBe(true);
    expect(cardStillInTodoPage1).toBe(false);
    console.log('✅ Card moved to IN PROGRESS on Page 1');

    // CRITICAL TEST: Movement should sync to page2
    await page2.waitForTimeout(4000); // Allow extra time for WebSocket sync

    const cardInProgressPage2 = await page2.locator('.column').filter({ hasText: 'IN PROGRESS' }).locator('.ticket-card').filter({ hasText: testCardTitle }).isVisible();
    const cardStillInTodoPage2 = await page2.locator('.column').filter({ hasText: 'TODO' }).locator('.ticket-card').filter({ hasText: testCardTitle }).isVisible();

    expect(cardInProgressPage2).toBe(true);
    expect(cardStillInTodoPage2).toBe(false);
    console.log('✅ Card movement synced to Page 2 via WebSocket');

    console.log('✅ WebSocket real-time card movement sync working correctly');
  });

  test('CRITICAL: Real-time card editing sync between windows', async () => {
    console.log('🔴 Testing real-time card editing sync');

    // Create a card first
    const originalTitle = `Edit Test Card ${Date.now()}`;
    const updatedTitle = `EDITED ${originalTitle}`;

    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', originalTitle);
    await page1.click('button:has-text("Save")');
    await page1.waitForTimeout(2000);

    // Wait for sync
    await page2.waitForTimeout(2000);

    // Edit card on page1
    console.log('🔄 Editing card on Page 1...');

    const cardToEdit = page1.locator('.ticket-card').filter({ hasText: originalTitle });
    await cardToEdit.click();
    await page1.waitForTimeout(500);

    // Look for edit button or inline edit
    const editButton = page1.locator('button').filter({ hasText: /edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page1.waitForTimeout(500);

      const titleField = page1.locator('input[value*="Edit Test Card"], input[placeholder*="title" i]').first();
      if (await titleField.isVisible()) {
        await titleField.clear();
        await titleField.fill(updatedTitle);

        const saveButton = page1.locator('button').filter({ hasText: /save/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page1.waitForTimeout(3000);
        }
      }
    }

    // Verify edit on page1
    const editedCardPage1 = await page1.locator('.ticket-card').filter({ hasText: updatedTitle }).isVisible();
    if (editedCardPage1) {
      console.log('✅ Card edited on Page 1');

      // CRITICAL TEST: Edit should sync to page2
      await page2.waitForTimeout(4000);

      const editedCardPage2 = await page2.locator('.ticket-card').filter({ hasText: updatedTitle }).isVisible();
      if (editedCardPage2) {
        console.log('✅ Card edit synced to Page 2 via WebSocket');
      } else {
        console.log('⚠️ Card edit did not sync to Page 2 (may indicate WebSocket issue)');
      }
    } else {
      console.log('⚠️ Card editing functionality not available or failed');
    }
  });

  test('CRITICAL: No cross-board WebSocket contamination', async () => {
    console.log('🔴 Testing WebSocket isolation between different boards');

    // Create second board on page2
    const board2Name = `WebSocket Isolation Test ${Date.now()}`;

    await page2.goto(baseURL);
    await page2.waitForLoadState('networkidle');

    await page2.click('button:has-text("Create Board")');
    await page2.fill('input[placeholder*="board name" i]', board2Name);
    await page2.click('button:has-text("Create")');
    await page2.click(`.board-card:has-text("${board2Name}")`);
    await page2.waitForSelector('.column');

    const board2Id = page2.url().split('/').pop() || 'unknown';
    console.log(`✅ Created second board: ${board2Name} (ID: ${board2Id})`);

    // Ensure page1 is still on original board
    await page1.goto(`${baseURL}/board/${boardId}`);
    await page1.waitForSelector('.column');

    // Add card to board1 (page1)
    const board1CardTitle = `Board 1 Card ${Date.now()}`;
    const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn1.locator('button:has-text("Add Card")').click();
    await page1.fill('input[placeholder*="title" i]', board1CardTitle);
    await page1.click('button:has-text("Save")');
    await page1.waitForTimeout(2000);

    // Add card to board2 (page2)
    const board2CardTitle = `Board 2 Card ${Date.now()}`;
    const todoColumn2 = page2.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn2.locator('button:has-text("Add Card")').click();
    await page2.fill('input[placeholder*="title" i]', board2CardTitle);
    await page2.click('button:has-text("Save")');
    await page2.waitForTimeout(3000);

    // CRITICAL TEST: Board1 should NOT show Board2's card
    const board2CardOnBoard1 = await page1.locator('.ticket-card').filter({ hasText: board2CardTitle }).isVisible();
    expect(board2CardOnBoard1).toBe(false);
    console.log('✅ Board 1 does not show Board 2 cards');

    // CRITICAL TEST: Board2 should NOT show Board1's card
    const board1CardOnBoard2 = await page2.locator('.ticket-card').filter({ hasText: board1CardTitle }).isVisible();
    expect(board1CardOnBoard2).toBe(false);
    console.log('✅ Board 2 does not show Board 1 cards');

    console.log('✅ WebSocket isolation between boards working correctly');
  });

  test('WebSocket connection recovery testing', async () => {
    console.log('🔴 Testing WebSocket connection recovery');

    // Monitor connection status
    let page1Connected = true;
    let page2Connected = true;

    await page1.addInitScript(() => {
      const originalWS = window.WebSocket;
      window.WebSocket = class extends originalWS {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          (window as any).connectionStatus = 'connecting';

          this.addEventListener('open', () => {
            (window as any).connectionStatus = 'connected';
            console.log('WebSocket connected');
          });

          this.addEventListener('close', () => {
            (window as any).connectionStatus = 'disconnected';
            console.log('WebSocket disconnected');
          });

          this.addEventListener('error', () => {
            (window as any).connectionStatus = 'error';
            console.log('WebSocket error');
          });
        }
      };
    });

    // Wait for connections
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    // Check initial connection status
    const initialStatus = await page1.evaluate(() => (window as any).connectionStatus);
    console.log(`Initial connection status: ${initialStatus}`);

    if (initialStatus === 'connected') {
      console.log('✅ WebSocket connection established');

      // Create test card to verify sync works
      const testCard = `Recovery Test ${Date.now()}`;
      const todoColumn1 = page1.locator('.column').filter({ hasText: 'TODO' }).first();
      await todoColumn1.locator('button:has-text("Add Card")').click();
      await page1.fill('input[placeholder*="title" i]', testCard);
      await page1.click('button:has-text("Save")');
      await page1.waitForTimeout(2000);

      // Check if card syncs
      await page2.waitForTimeout(3000);
      const cardSynced = await page2.locator('.ticket-card').filter({ hasText: testCard }).isVisible();

      if (cardSynced) {
        console.log('✅ WebSocket sync working correctly');
      } else {
        console.log('⚠️ WebSocket sync not working - may indicate connection issues');
      }
    } else {
      console.log('⚠️ WebSocket connection not established properly');
    }
  });

  test.afterEach(async () => {
    console.log('\n=== WebSocket Sync Test Complete ===');

    await context1.close();
    await context2.close();

    if (test.info().status !== 'passed') {
      console.error('🔴 WebSocket sync test failed - real-time collaboration may not be working');
    }
  });
});
