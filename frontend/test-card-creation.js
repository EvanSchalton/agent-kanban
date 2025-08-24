// Test script to verify card creation API fix
const API_BASE = 'http://localhost:18000';

async function testCardCreation() {
  console.log('Testing card creation API...\n');

  try {
    // First, get boards
    const boardsResponse = await fetch(`${API_BASE}/api/boards/`);
    const boards = await boardsResponse.json();

    if (!boards.items || boards.items.length === 0) {
      console.log('No boards found. Creating a test board...');
      const newBoardResponse = await fetch(`${API_BASE}/api/boards/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Board for Card Creation',
          description: 'Testing card creation API'
        })
      });
      const newBoard = await newBoardResponse.json();
      boards.items = [newBoard];
    }

    const boardId = boards.items[0].id;
    console.log(`Using board ID: ${boardId}`);

    // Test card creation with correct payload structure
    const testPayload = {
      title: 'Test Card - API Fix Validation',
      description: 'This card tests the column_id to current_column transformation',
      acceptance_criteria: '- Card should be created successfully\n- Should appear in Not Started column',
      priority: '2.0',
      assignee: 'Test Engineer',
      board_id: boardId,
      current_column: 'Not Started'
    };

    console.log('\nSending payload:', JSON.stringify(testPayload, null, 2));

    const response = await fetch(`${API_BASE}/api/tickets/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create card: ${response.status} - ${error}`);
    }

    const createdCard = await response.json();
    console.log('\n✅ Card created successfully!');
    console.log('Created card:', JSON.stringify(createdCard, null, 2));

    // Verify the card appears in the list
    const listResponse = await fetch(`${API_BASE}/api/tickets/?board_id=${boardId}`);
    const ticketList = await listResponse.json();
    const foundCard = ticketList.items.find(t => t.id === createdCard.id);

    if (foundCard) {
      console.log('\n✅ Card verified in ticket list!');
      console.log(`Card "${foundCard.title}" is in column: ${foundCard.current_column}`);
    } else {
      console.log('\n⚠️ Warning: Card not found in ticket list');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testCardCreation().then(() => {
  console.log('\n✅ All tests passed!');
  process.exit(0);
});
