import { test, expect, Page } from '@playwright/test';

/**
 * 🔴 CRITICAL P0: Board Isolation Data Corruption Emergency Tests
 *
 * EMERGENCY CONTEXT: All boards showing identical cards due to backend
 * not filtering by board_id. This causes CRITICAL DATA CORRUPTION where
 * users see tickets from other boards mixed together.
 *
 * CRITICAL TEST COVERAGE:
 * 1. Each board shows ONLY its own tickets
 * 2. API calls include correct board_id parameter
 * 3. Backend filtering works correctly
 * 4. No cross-board data contamination
 * 5. Board isolation under rapid switching
 */

test.describe('🔴 CRITICAL P0: Board Isolation Data Corruption Prevention', () => {
  const baseURL = 'http://localhost:15173'; // Use e2e test server port
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // CRITICAL: Verify we're using isolated test database
    console.log('🔍 VERIFYING TEST DATABASE ISOLATION...');
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Check if we're in testing mode by looking for clean state
    const initialBoardCount = await page.locator('.board-card').count();
    console.log(`🗃️  Initial boards in test database: ${initialBoardCount}`);

    if (initialBoardCount > 5) {
      console.warn('⚠️  WARNING: Test database may not be isolated (too many existing boards)');
    } else {
      console.log('✅ Test database appears isolated');
    }
  });

  test('CRITICAL P0: Each board shows ONLY its own tickets', async () => {
    console.log('🔴 CRITICAL: Testing board isolation - each board must show only its own tickets');

    // Create multiple boards with distinct tickets
    const boards = [
      { name: `Board Alpha ${Date.now()}`, tickets: ['Alpha Task 1', 'Alpha Task 2', 'Alpha Critical Bug'] },
      { name: `Board Beta ${Date.now()}`, tickets: ['Beta Feature 1', 'Beta Feature 2', 'Beta Integration'] },
      { name: `Board Gamma ${Date.now()}`, tickets: ['Gamma Test 1', 'Gamma Test 2', 'Gamma Deployment'] }
    ];

    // Track board IDs and API calls
    const boardData: Array<{
      name: string;
      boardId: string;
      url: string;
      tickets: string[];
    }> = [];

    const apiCalls: Array<{
      url: string;
      boardId: string;
      method: string;
      timestamp: number;
    }> = [];

    // Monitor API calls for board_id filtering
    await page.route('**/api/**', async route => {
      const request = route.request();
      const url = request.url();

      // Track ticket API calls
      if (url.includes('/tickets/') || url.includes('/tickets?')) {
        const urlParams = new URL(url);
        const boardId = urlParams.searchParams.get('board_id') || 'MISSING';

        apiCalls.push({
          url: url,
          boardId: boardId,
          method: request.method(),
          timestamp: Date.now()
        });

        console.log(`🔍 API Call: ${request.method()} ${url}`);
        console.log(`   board_id parameter: "${boardId}"`);
      }

      await route.continue();
    });

    // PHASE 1: Create boards and add unique tickets
    for (const board of boards) {
      console.log(`\n📋 Creating board: ${board.name}`);

      // Create board
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', board.name);
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(1000);

      // Navigate to board and capture board ID from URL
      await page.click(`.board-card:has-text("${board.name}")`);
      await page.waitForSelector('.column');
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      const boardId = currentUrl.split('/').pop() || 'unknown';

      boardData.push({
        name: board.name,
        boardId: boardId,
        url: currentUrl,
        tickets: board.tickets
      });

      console.log(`   Board ID: ${boardId}`);
      console.log(`   URL: ${currentUrl}`);

      // Add unique tickets to this board
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();

      for (const ticketTitle of board.tickets) {
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', ticketTitle);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(1500);
        console.log(`   ✅ Added ticket: ${ticketTitle}`);
      }

      // Navigate back to dashboard
      const backButton = page.locator('button, a').filter({ hasText: /back|dashboard/i }).first();
      if (await backButton.isVisible()) {
        await backButton.click();
      } else {
        await page.goto(baseURL);
      }
      await page.waitForSelector('.board-card');
      await page.waitForTimeout(1000);
    }

    // PHASE 2: CRITICAL VALIDATION - Test board isolation
    console.log('\n🔴 PHASE 2: CRITICAL BOARD ISOLATION VALIDATION');

    for (const boardInfo of boardData) {
      console.log(`\n🔍 Testing isolation for: ${boardInfo.name}`);

      // Clear API call log for this board
      apiCalls.length = 0;

      // Navigate to specific board
      await page.click(`.board-card:has-text("${boardInfo.name}")`);
      await page.waitForSelector('.column');
      await page.waitForTimeout(3000); // Allow API calls to complete

      // CRITICAL ASSERTION 1: Verify board ID in URL
      const currentUrl = page.url();
      expect(currentUrl).toContain(boardInfo.boardId);
      console.log(`   ✅ URL contains correct board ID: ${boardInfo.boardId}`);

      // CRITICAL ASSERTION 2: API calls must include board_id parameter
      const ticketApiCalls = apiCalls.filter(call =>
        call.method === 'GET' &&
        (call.url.includes('/tickets') || call.url.includes('/tickets?'))
      );

      expect(ticketApiCalls.length).toBeGreaterThan(0);

      for (const apiCall of ticketApiCalls) {
        // CRITICAL: board_id parameter must be present and correct
        expect(apiCall.boardId).not.toBe('MISSING');
        expect(apiCall.boardId).not.toBe('');
        expect(apiCall.boardId).toBe(boardInfo.boardId);
        console.log(`   ✅ API call includes correct board_id: ${apiCall.boardId}`);
      }

      // CRITICAL ASSERTION 3: Board shows ONLY its own tickets
      const visibleTickets = await page.locator('.ticket-card').allTextContents();

      console.log(`   Visible tickets on ${boardInfo.name}:`, visibleTickets);

      // Must contain ALL tickets from this board
      for (const expectedTicket of boardInfo.tickets) {
        const ticketVisible = visibleTickets.some(visible =>
          visible.includes(expectedTicket)
        );
        expect(ticketVisible).toBe(true);
        console.log(`   ✅ Own ticket visible: ${expectedTicket}`);
      }

      // CRITICAL: Must NOT contain tickets from other boards
      const otherBoards = boardData.filter(b => b.boardId !== boardInfo.boardId);
      for (const otherBoard of otherBoards) {
        for (const otherTicket of otherBoard.tickets) {
          const foreignTicketVisible = visibleTickets.some(visible =>
            visible.includes(otherTicket)
          );

          if (foreignTicketVisible) {
            console.error(`🔴 DATA CORRUPTION: ${boardInfo.name} shows ticket from ${otherBoard.name}: ${otherTicket}`);
          }

          expect(foreignTicketVisible).toBe(false);
        }
      }

      console.log(`   ✅ No foreign tickets visible on ${boardInfo.name}`);

      // Navigate back to dashboard for next test
      await page.goto(baseURL);
      await page.waitForSelector('.board-card');
      await page.waitForTimeout(1000);
    }

    console.log('\n🎉 CRITICAL VALIDATION PASSED: All boards properly isolated');
  });

  test('CRITICAL P0: Rapid board switching maintains isolation', async () => {
    console.log('🔴 CRITICAL: Testing board isolation under rapid switching');

    // Create 2 boards with distinctive tickets
    const rapidTestBoards = [
      { name: `Rapid Test A ${Date.now()}`, tickets: ['A1-UNIQUE', 'A2-UNIQUE'] },
      { name: `Rapid Test B ${Date.now()}`, tickets: ['B1-UNIQUE', 'B2-UNIQUE'] }
    ];

    const boardIds: string[] = [];

    // Create boards
    for (const board of rapidTestBoards) {
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', board.name);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${board.name}")`);
      await page.waitForSelector('.column');

      const boardId = page.url().split('/').pop() || 'unknown';
      boardIds.push(boardId);

      // Add tickets
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
      for (const ticket of board.tickets) {
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', ticket);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(1000);
      }

      await page.goto(baseURL);
      await page.waitForSelector('.board-card');
    }

    // RAPID SWITCHING TEST
    console.log('🔄 Performing rapid board switches...');

    for (let i = 0; i < 5; i++) {
      console.log(`\n🔄 Rapid switch iteration ${i + 1}/5`);

      // Switch to Board A
      await page.click(`.board-card:has-text("${rapidTestBoards[0].name}")`);
      await page.waitForSelector('.column');
      await page.waitForTimeout(1000);

      // CRITICAL ASSERTION: Only A tickets visible
      let visibleTickets = await page.locator('.ticket-card').allTextContents();
      const hasATickets = visibleTickets.some(t => t.includes('A1-UNIQUE'));
      const hasBTickets = visibleTickets.some(t => t.includes('B1-UNIQUE'));

      expect(hasATickets).toBe(true);
      expect(hasBTickets).toBe(false);
      console.log(`   ✅ Board A shows only A tickets: ${hasATickets}, no B tickets: ${!hasBTickets}`);

      // Quick switch to Board B
      await page.goto(baseURL);
      await page.waitForSelector('.board-card');
      await page.click(`.board-card:has-text("${rapidTestBoards[1].name}")`);
      await page.waitForSelector('.column');
      await page.waitForTimeout(1000);

      // CRITICAL ASSERTION: Only B tickets visible
      visibleTickets = await page.locator('.ticket-card').allTextContents();
      const hasATicketsOnB = visibleTickets.some(t => t.includes('A1-UNIQUE'));
      const hasBTicketsOnB = visibleTickets.some(t => t.includes('B1-UNIQUE'));

      expect(hasATicketsOnB).toBe(false);
      expect(hasBTicketsOnB).toBe(true);
      console.log(`   ✅ Board B shows only B tickets: ${hasBTicketsOnB}, no A tickets: ${!hasATicketsOnB}`);

      // Back to dashboard for next iteration
      await page.goto(baseURL);
      await page.waitForSelector('.board-card');
    }

    console.log('✅ Rapid switching maintains proper board isolation');
  });

  test('CRITICAL P0: API endpoint validation for board_id filtering', async () => {
    console.log('🔴 CRITICAL: Validating API endpoint board_id filtering');

    // Create test board
    const testBoardName = `API Filter Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', testBoardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${testBoardName}")`);
    await page.waitForSelector('.column');

    const boardId = page.url().split('/').pop() || 'unknown';
    console.log(`Testing with board ID: ${boardId}`);

    // Detailed API monitoring
    const detailedApiCalls: Array<{
      fullUrl: string;
      boardIdParam: string | null;
      method: string;
      hasFilter: boolean;
      response?: any;
    }> = [];

    await page.route('**/api/tickets**', async route => {
      const request = route.request();
      const url = request.url();
      const urlObj = new URL(url);
      const boardIdParam = urlObj.searchParams.get('board_id');

      console.log(`🔍 DETAILED API CALL:`);
      console.log(`   Full URL: ${url}`);
      console.log(`   Method: ${request.method()}`);
      console.log(`   board_id param: ${boardIdParam}`);
      console.log(`   All params:`, Object.fromEntries(urlObj.searchParams));

      detailedApiCalls.push({
        fullUrl: url,
        boardIdParam: boardIdParam,
        method: request.method(),
        hasFilter: boardIdParam !== null
      });

      await route.continue();
    });

    // Add a test ticket to trigger API calls
    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    await todoColumn.locator('button:has-text("Add Card")').click();
    await page.fill('input[placeholder*="title" i]', 'API Filter Test Ticket');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(3000);

    // Refresh to trigger fresh API calls
    await page.reload();
    await page.waitForSelector('.column');
    await page.waitForTimeout(3000);

    // CRITICAL API VALIDATION
    console.log('\n📊 API CALL ANALYSIS:');

    const getTicketCalls = detailedApiCalls.filter(call =>
      call.method === 'GET' && call.fullUrl.includes('/tickets')
    );

    expect(getTicketCalls.length).toBeGreaterThan(0);
    console.log(`Found ${getTicketCalls.length} GET ticket API calls`);

    for (const apiCall of getTicketCalls) {
      console.log(`\n--- API Call Analysis ---`);
      console.log(`URL: ${apiCall.fullUrl}`);
      console.log(`board_id param: "${apiCall.boardIdParam}"`);
      console.log(`Has filtering: ${apiCall.hasFilter}`);

      // CRITICAL ASSERTIONS
      expect(apiCall.hasFilter).toBe(true); // Must have board_id filtering
      expect(apiCall.boardIdParam).not.toBeNull(); // board_id must be present
      expect(apiCall.boardIdParam).toBe(boardId); // Must match current board

      console.log(`✅ API call properly filtered by board_id: ${apiCall.boardIdParam}`);
    }

    console.log('\n✅ All API calls properly include board_id filtering');
  });

  test('CRITICAL P0: Cross-board contamination detection', async () => {
    console.log('🔴 CRITICAL: Detecting cross-board data contamination');

    // Create boards with predictable, searchable tickets
    const contaminationTestBoards = [
      {
        name: `Contamination Source ${Date.now()}`,
        tickets: ['SOURCE-TICKET-001', 'SOURCE-TICKET-002']
      },
      {
        name: `Contamination Target ${Date.now()}`,
        tickets: ['TARGET-TICKET-001', 'TARGET-TICKET-002']
      }
    ];

    const boardInfo: Array<{name: string, id: string, tickets: string[]}> = [];

    // Create and populate boards
    for (const board of contaminationTestBoards) {
      console.log(`\n📋 Setting up: ${board.name}`);

      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', board.name);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${board.name}")`);
      await page.waitForSelector('.column');

      const boardId = page.url().split('/').pop() || 'unknown';
      boardInfo.push({ name: board.name, id: boardId, tickets: board.tickets });

      // Add distinctive tickets
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
      for (const ticket of board.tickets) {
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', ticket);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(1500);
        console.log(`   ✅ Added: ${ticket}`);
      }

      await page.goto(baseURL);
      await page.waitForSelector('.board-card');
    }

    // CONTAMINATION DETECTION TEST
    console.log('\n🔍 CONTAMINATION DETECTION TEST');

    for (const testBoard of boardInfo) {
      console.log(`\n🔍 Testing contamination on: ${testBoard.name} (ID: ${testBoard.id})`);

      // Navigate to board
      await page.click(`.board-card:has-text("${testBoard.name}")`);
      await page.waitForSelector('.column');
      await page.waitForTimeout(3000);

      // Get all visible tickets
      const allVisibleTickets = await page.locator('.ticket-card').allTextContents();
      console.log(`   Visible tickets:`, allVisibleTickets);

      // Check for own tickets (should be present)
      for (const ownTicket of testBoard.tickets) {
        const hasOwnTicket = allVisibleTickets.some(visible => visible.includes(ownTicket));
        expect(hasOwnTicket).toBe(true);
        console.log(`   ✅ Own ticket found: ${ownTicket}`);
      }

      // Check for foreign tickets (CRITICAL - should NOT be present)
      const otherBoards = boardInfo.filter(b => b.id !== testBoard.id);
      for (const otherBoard of otherBoards) {
        for (const foreignTicket of otherBoard.tickets) {
          const hasForeignTicket = allVisibleTickets.some(visible =>
            visible.includes(foreignTicket)
          );

          if (hasForeignTicket) {
            console.error(`🔴 CONTAMINATION DETECTED: ${testBoard.name} shows ${foreignTicket} from ${otherBoard.name}`);
            console.error(`🔴 This indicates board_id filtering is NOT working!`);
          }

          expect(hasForeignTicket).toBe(false);
          console.log(`   ✅ No contamination from: ${foreignTicket}`);
        }
      }

      await page.goto(baseURL);
      await page.waitForSelector('.board-card');
    }

    console.log('\n✅ No cross-board contamination detected');
  });

  test('CRITICAL P0: Board deletion maintains isolation', async () => {
    console.log('🔴 CRITICAL: Testing board isolation after board deletion');

    // Create 3 boards
    const deletionTestBoards = [
      { name: `Delete Test A ${Date.now()}`, tickets: ['DELETE-A-1'] },
      { name: `Delete Test B ${Date.now()}`, tickets: ['DELETE-B-1'] },
      { name: `Delete Test C ${Date.now()}`, tickets: ['DELETE-C-1'] }
    ];

    // Create all boards
    for (const board of deletionTestBoards) {
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', board.name);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${board.name}")`);
      await page.waitForSelector('.column');

      // Add ticket
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', board.tickets[0]);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);

      await page.goto(baseURL);
      await page.waitForSelector('.board-card');
    }

    // Delete middle board (B)
    console.log('\n🗑️ Deleting middle board...');
    const boardBCard = page.locator('.board-card').filter({ hasText: deletionTestBoards[1].name });

    if (await boardBCard.isVisible()) {
      // Try to delete board (implementation may vary)
      await boardBCard.click({ button: 'right' }); // Right click for context menu

      const deleteButton = page.locator('button').filter({ hasText: /delete/i }).first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Confirm deletion if needed
        const confirmButton = page.locator('button').filter({ hasText: /confirm|yes/i }).first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        await page.waitForTimeout(2000);
      } else {
        console.log('   ⚠️ Delete functionality not found, skipping deletion test');
        return;
      }
    }

    // Verify remaining boards still isolated
    const remainingBoards = [deletionTestBoards[0], deletionTestBoards[2]];

    for (const board of remainingBoards) {
      await page.click(`.board-card:has-text("${board.name}")`);
      await page.waitForSelector('.column');
      await page.waitForTimeout(2000);

      const visibleTickets = await page.locator('.ticket-card').allTextContents();

      // Should show own ticket
      const hasOwnTicket = visibleTickets.some(t => t.includes(board.tickets[0]));
      expect(hasOwnTicket).toBe(true);

      // Should NOT show deleted board's ticket
      const hasDeletedTicket = visibleTickets.some(t => t.includes('DELETE-B-1'));
      expect(hasDeletedTicket).toBe(false);

      console.log(`   ✅ ${board.name} maintains isolation after deletion`);

      await page.goto(baseURL);
      await page.waitForSelector('.board-card');
    }

    console.log('✅ Board deletion maintains proper isolation');
  });

  test.afterEach(async () => {
    // Critical data corruption test cleanup
    console.log('\n=== CRITICAL BOARD ISOLATION TEST COMPLETE ===');

    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/CRITICAL-board-isolation-failure-${Date.now()}.png`,
        fullPage: true
      });

      // Save detailed failure report
      const errorReport = {
        test: test.info().title,
        status: 'FAILED',
        timestamp: new Date().toISOString(),
        error: 'Board isolation data corruption detected',
        severity: 'CRITICAL P0'
      };

      console.error('🔴 CRITICAL TEST FAILURE:', errorReport);
    }
  });
});
