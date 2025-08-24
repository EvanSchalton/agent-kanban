import { test, expect, Page } from '@playwright/test';

// Test configuration
const API_BASE = 'http://localhost:18000';
const FRONTEND_URL = 'http://localhost:15173';

// Helper functions
async function createBoard(page: Page, name: string, description: string = 'Test board for isolation') {
  // Navigate to dashboard
  await page.goto(FRONTEND_URL);
  await page.waitForSelector('button:has-text("New Board")', { timeout: 5000 });

  // Click New Board button
  await page.click('button:has-text("New Board")');

  // Fill in board details
  await page.fill('input[placeholder="Enter board name"]', name);
  await page.fill('textarea[placeholder="Enter board description"]', description);

  // Submit
  await page.click('button:has-text("Create Board")');

  // Wait for board to be created
  await page.waitForSelector(`text="${name}"`, { timeout: 5000 });
}

async function createCard(page: Page, boardId: string, title: string, column: string = 'Not Started') {
  // Navigate to specific board
  await page.goto(`${FRONTEND_URL}/board/${boardId}`);
  await page.waitForSelector('.board-columns', { timeout: 5000 });

  // Find the column and click Add card button
  const columnElement = await page.locator(`[aria-label*="${column} column"]`).first();
  await columnElement.locator('button:has-text("+")').click();

  // Fill in card details
  await page.fill('input[placeholder*="Title"]', title);

  // Submit
  await page.click('button:has-text("Add Card")');

  // Wait for card to appear
  await page.waitForSelector(`text="${title}"`, { timeout: 5000 });
}

async function deleteCard(page: Page, cardTitle: string) {
  // Find and click the card
  const card = await page.locator(`button:has-text("${cardTitle}")`).first();
  await card.click();

  // Wait for detail modal and click delete
  await page.waitForSelector('.ticket-detail', { timeout: 5000 });
  await page.click('button:has-text("Delete")');

  // Confirm deletion
  const dialog = page.locator('.confirmation-dialog');
  if (await dialog.isVisible()) {
    await page.click('button:has-text("Confirm")');
  }

  // Wait for card to disappear
  await page.waitForSelector(`text="${cardTitle}"`, { state: 'hidden', timeout: 5000 });
}

async function getCardCount(page: Page, boardId: string): Promise<number> {
  await page.goto(`${FRONTEND_URL}/board/${boardId}`);
  await page.waitForSelector('.board-columns', { timeout: 5000 });

  // Count all ticket cards
  const cards = await page.locator('.ticket-card').count();
  return cards;
}

async function getCardTitles(page: Page, boardId: string): Promise<string[]> {
  await page.goto(`${FRONTEND_URL}/board/${boardId}`);
  await page.waitForSelector('.board-columns', { timeout: 5000 });

  // Get all card titles
  const titles = await page.locator('.ticket-card h3').allTextContents();
  return titles;
}

// Test Suite
test.describe('Board Isolation Tests', () => {
  test.describe.configure({ mode: 'serial' }); // Run tests in order

  let board1Id: string;
  let board2Id: string;
  let board3Id: string;

  test.beforeAll(async ({ request }) => {
    // Create test boards via API for consistent state
    const board1Response = await request.post(`${API_BASE}/api/boards/`, {
      data: {
        name: 'Isolation Test Board 1',
        description: 'Testing board isolation - Board 1',
        columns: ['Not Started', 'In Progress', 'Done']
      }
    });
    const board1Data = await board1Response.json();
    board1Id = board1Data.id.toString();

    const board2Response = await request.post(`${API_BASE}/api/boards/`, {
      data: {
        name: 'Isolation Test Board 2',
        description: 'Testing board isolation - Board 2',
        columns: ['Not Started', 'In Progress', 'Done']
      }
    });
    const board2Data = await board2Response.json();
    board2Id = board2Data.id.toString();

    const board3Response = await request.post(`${API_BASE}/api/boards/`, {
      data: {
        name: 'Isolation Test Board 3',
        description: 'Testing board isolation - Board 3',
        columns: ['Not Started', 'In Progress', 'Done']
      }
    });
    const board3Data = await board3Response.json();
    board3Id = board3Data.id.toString();

    // Create test cards for each board
    await request.post(`${API_BASE}/api/tickets/`, {
      data: {
        title: 'Board1-Card1',
        description: 'Test card for board 1',
        board_id: parseInt(board1Id),
        current_column: 'Not Started'
      }
    });

    await request.post(`${API_BASE}/api/tickets/`, {
      data: {
        title: 'Board1-Card2',
        description: 'Second test card for board 1',
        board_id: parseInt(board1Id),
        current_column: 'In Progress'
      }
    });

    await request.post(`${API_BASE}/api/tickets/`, {
      data: {
        title: 'Board2-Card1',
        description: 'Test card for board 2',
        board_id: parseInt(board2Id),
        current_column: 'Not Started'
      }
    });

    await request.post(`${API_BASE}/api/tickets/`, {
      data: {
        title: 'Board2-Card2',
        description: 'Second test card for board 2',
        board_id: parseInt(board2Id),
        current_column: 'Done'
      }
    });

    await request.post(`${API_BASE}/api/tickets/`, {
      data: {
        title: 'Board3-Card1',
        description: 'Test card for board 3',
        board_id: parseInt(board3Id),
        current_column: 'In Progress'
      }
    });
  });

  test('Each board should only display its own cards', async ({ page }) => {
    // Check Board 1
    await page.goto(`${FRONTEND_URL}/board/${board1Id}`);
    await page.waitForSelector('.board-columns', { timeout: 5000 });

    const board1Titles = await getCardTitles(page, board1Id);
    expect(board1Titles).toContain('Board1-Card1');
    expect(board1Titles).toContain('Board1-Card2');
    expect(board1Titles).not.toContain('Board2-Card1');
    expect(board1Titles).not.toContain('Board2-Card2');
    expect(board1Titles).not.toContain('Board3-Card1');

    // Check Board 2
    const board2Titles = await getCardTitles(page, board2Id);
    expect(board2Titles).toContain('Board2-Card1');
    expect(board2Titles).toContain('Board2-Card2');
    expect(board2Titles).not.toContain('Board1-Card1');
    expect(board2Titles).not.toContain('Board1-Card2');
    expect(board2Titles).not.toContain('Board3-Card1');

    // Check Board 3
    const board3Titles = await getCardTitles(page, board3Id);
    expect(board3Titles).toContain('Board3-Card1');
    expect(board3Titles).not.toContain('Board1-Card1');
    expect(board3Titles).not.toContain('Board1-Card2');
    expect(board3Titles).not.toContain('Board2-Card1');
    expect(board3Titles).not.toContain('Board2-Card2');
  });

  test('Creating a card in one board should not appear in other boards', async ({ page, request }) => {
    // Create a new card in Board 1
    await request.post(`${API_BASE}/api/tickets/`, {
      data: {
        title: 'Board1-NewCard',
        description: 'New card created during test',
        board_id: parseInt(board1Id),
        current_column: 'Not Started'
      }
    });

    // Verify it appears in Board 1
    const board1Titles = await getCardTitles(page, board1Id);
    expect(board1Titles).toContain('Board1-NewCard');

    // Verify it doesn't appear in Board 2
    const board2Titles = await getCardTitles(page, board2Id);
    expect(board2Titles).not.toContain('Board1-NewCard');

    // Verify it doesn't appear in Board 3
    const board3Titles = await getCardTitles(page, board3Id);
    expect(board3Titles).not.toContain('Board1-NewCard');
  });

  test('Deleting a card from one board should not affect other boards', async ({ page, request }) => {
    // Get initial card counts
    const board1CountBefore = await getCardCount(page, board1Id);
    const board2CountBefore = await getCardCount(page, board2Id);
    const board3CountBefore = await getCardCount(page, board3Id);

    // Delete a card from Board 2 via API
    const ticketsResponse = await request.get(`${API_BASE}/api/tickets/?board_id=${board2Id}`);
    const ticketsData = await ticketsResponse.json();
    const board2Card = ticketsData.items.find((t: any) => t.title === 'Board2-Card1');

    if (board2Card) {
      await request.delete(`${API_BASE}/api/tickets/${board2Card.id}`);
    }

    // Check card counts after deletion
    const board1CountAfter = await getCardCount(page, board1Id);
    const board2CountAfter = await getCardCount(page, board2Id);
    const board3CountAfter = await getCardCount(page, board3Id);

    // Board 1 should be unchanged
    expect(board1CountAfter).toBe(board1CountBefore);

    // Board 2 should have one less card
    expect(board2CountAfter).toBe(board2CountBefore - 1);

    // Board 3 should be unchanged
    expect(board3CountAfter).toBe(board3CountBefore);

    // Verify the specific card is gone from Board 2
    const board2Titles = await getCardTitles(page, board2Id);
    expect(board2Titles).not.toContain('Board2-Card1');
    expect(board2Titles).toContain('Board2-Card2'); // Other card should still exist
  });

  test('Moving a card within a board should not affect other boards', async ({ page, request }) => {
    // Move Board1-Card1 from Not Started to Done
    const ticketsResponse = await request.get(`${API_BASE}/api/tickets/?board_id=${board1Id}`);
    const ticketsData = await ticketsResponse.json();
    const board1Card = ticketsData.items.find((t: any) => t.title === 'Board1-Card1');

    if (board1Card) {
      await request.post(`${API_BASE}/api/tickets/${board1Card.id}/move`, {
        data: { column: 'Done' }
      });
    }

    // Verify Board 1 still has the same cards
    const board1Titles = await getCardTitles(page, board1Id);
    expect(board1Titles).toContain('Board1-Card1');
    expect(board1Titles).toContain('Board1-Card2');

    // Verify Board 2 is unchanged
    const board2Titles = await getCardTitles(page, board2Id);
    expect(board2Titles).toContain('Board2-Card2');

    // Verify Board 3 is unchanged
    const board3Titles = await getCardTitles(page, board3Id);
    expect(board3Titles).toContain('Board3-Card1');
  });

  test('WebSocket updates should be board-specific', async ({ page, context }) => {
    // Open two browser tabs for different boards
    const page1 = page;
    const page2 = await context.newPage();

    // Navigate to different boards
    await page1.goto(`${FRONTEND_URL}/board/${board1Id}`);
    await page2.goto(`${FRONTEND_URL}/board/${board2Id}`);

    // Wait for boards to load
    await page1.waitForSelector('.board-columns', { timeout: 5000 });
    await page2.waitForSelector('.board-columns', { timeout: 5000 });

    // Create a card in Board 1 via UI
    const columnElement = await page1.locator('[aria-label*="Not Started column"]').first();
    await columnElement.locator('button:has-text("+")').click();
    await page1.fill('input[placeholder*="Title"]', 'WebSocket-Test-Card');
    await page1.click('button:has-text("Add Card")');

    // Wait for the card to appear in Board 1
    await page1.waitForSelector('text="WebSocket-Test-Card"', { timeout: 5000 });

    // Verify it doesn't appear in Board 2
    await page2.waitForTimeout(2000); // Wait for potential WebSocket update
    const board2HasCard = await page2.locator('text="WebSocket-Test-Card"').count();
    expect(board2HasCard).toBe(0);

    // Clean up
    await page2.close();
  });

  test('Bulk operations should respect board boundaries', async ({ request }) => {
    // Get all tickets from Board 1
    const board1Response = await request.get(`${API_BASE}/api/tickets/?board_id=${board1Id}`);
    const board1Data = await board1Response.json();
    const board1TicketIds = board1Data.items.map((t: any) => t.id);

    // Try bulk update on Board 1 tickets
    if (board1TicketIds.length > 0) {
      await request.post(`${API_BASE}/api/bulk/update`, {
        data: {
          ticket_ids: board1TicketIds,
          updates: { priority: '2.0' }
        }
      });
    }

    // Verify Board 2 tickets are unaffected
    const board2Response = await request.get(`${API_BASE}/api/tickets/?board_id=${board2Id}`);
    const board2Data = await board2Response.json();

    board2Data.items.forEach((ticket: any) => {
      expect(ticket.priority).not.toBe('2.0'); // Should not have the bulk update priority
    });
  });

  test.afterAll(async ({ request }) => {
    // Clean up test boards
    try {
      await request.delete(`${API_BASE}/api/boards/${board1Id}`);
      await request.delete(`${API_BASE}/api/boards/${board2Id}`);
      await request.delete(`${API_BASE}/api/boards/${board3Id}`);
    } catch (error) {
      console.log('Cleanup error (non-critical):', error);
    }
  });
});

test.describe('Board Isolation Security Tests', () => {
  test('Cannot move a card to a different board via API manipulation', async ({ request }) => {
    // Create two boards
    const board1Response = await request.post(`${API_BASE}/api/boards/`, {
      data: { name: 'Security Test Board 1' }
    });
    const board1 = await board1Response.json();

    const board2Response = await request.post(`${API_BASE}/api/boards/`, {
      data: { name: 'Security Test Board 2' }
    });
    const board2 = await board2Response.json();

    // Create a card in Board 1
    const cardResponse = await request.post(`${API_BASE}/api/tickets/`, {
      data: {
        title: 'Security Test Card',
        board_id: board1.id,
        current_column: 'Not Started'
      }
    });
    const card = await cardResponse.json();

    // Try to update the card's board_id to Board 2 (should fail or be ignored)
    const updateResponse = await request.put(`${API_BASE}/api/tickets/${card.id}`, {
      data: { board_id: board2.id }
    });

    // Verify the card is still in Board 1
    const board1TicketsResponse = await request.get(`${API_BASE}/api/tickets/?board_id=${board1.id}`);
    const board1Tickets = await board1TicketsResponse.json();
    const cardStillInBoard1 = board1Tickets.items.some((t: any) => t.id === card.id);
    expect(cardStillInBoard1).toBeTruthy();

    // Verify the card is not in Board 2
    const board2TicketsResponse = await request.get(`${API_BASE}/api/tickets/?board_id=${board2.id}`);
    const board2Tickets = await board2TicketsResponse.json();
    const cardInBoard2 = board2Tickets.items.some((t: any) => t.id === card.id);
    expect(cardInBoard2).toBeFalsy();

    // Clean up
    await request.delete(`${API_BASE}/api/boards/${board1.id}`);
    await request.delete(`${API_BASE}/api/boards/${board2.id}`);
  });
});
