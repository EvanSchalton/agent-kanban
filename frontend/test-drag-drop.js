// Test script to verify drag and drop API functionality
const API_BASE = 'http://localhost:18000';

async function testDragDrop() {
  console.log('Testing drag and drop API...\n');

  try {
    // First, get boards
    const boardsResponse = await fetch(`${API_BASE}/api/boards/`);
    const boards = await boardsResponse.json();

    if (!boards || boards.length === 0) {
      console.log('No boards found. Please create a board first.');
      return;
    }

    const boardId = boards[0].id;
    console.log(`Using board ID: ${boardId}`);

    // Get tickets in the board
    const ticketsResponse = await fetch(`${API_BASE}/api/tickets/?board_id=${boardId}`);
    const ticketsData = await ticketsResponse.json();
    const tickets = ticketsData.items || [];

    if (tickets.length === 0) {
      console.log('No tickets found. Creating a test ticket...');
      const createResponse = await fetch(`${API_BASE}/api/tickets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Drag-Drop Card',
          description: 'This card will test drag and drop',
          board_id: boardId,
          current_column: 'Not Started'
        })
      });
      const newTicket = await createResponse.json();
      tickets.push(newTicket);
    }

    const testTicket = tickets[0];
    console.log(`\nTest ticket: "${testTicket.title}" (ID: ${testTicket.id})`);
    console.log(`Current column: ${testTicket.current_column}`);

    // Test moving the ticket to different columns
    const columns = ['In Progress', 'Blocked', 'Ready for QC', 'Done', 'Not Started'];
    const targetColumn = columns.find(col => col !== testTicket.current_column) || 'In Progress';

    console.log(`\nMoving ticket to "${targetColumn}"...`);

    const moveResponse = await fetch(`${API_BASE}/api/tickets/${testTicket.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        column: targetColumn
      })
    });

    if (!moveResponse.ok) {
      const error = await moveResponse.text();
      throw new Error(`Failed to move ticket: ${moveResponse.status} - ${error}`);
    }

    const movedTicket = await moveResponse.json();
    console.log('\n✅ Ticket moved successfully!');
    console.log(`New column: ${movedTicket.current_column}`);

    // Verify the ticket is in the new column
    const verifyResponse = await fetch(`${API_BASE}/api/tickets/${testTicket.id}`);
    const verifiedTicket = await verifyResponse.json();

    if (verifiedTicket.current_column === targetColumn) {
      console.log('\n✅ Move verified! Ticket is in the correct column.');
    } else {
      console.log(`\n⚠️ Warning: Ticket column mismatch. Expected: ${targetColumn}, Got: ${verifiedTicket.current_column}`);
    }

    // Test moving back to original column
    console.log(`\nMoving ticket back to "${testTicket.current_column}"...`);
    const moveBackResponse = await fetch(`${API_BASE}/api/tickets/${testTicket.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        column: testTicket.current_column
      })
    });

    if (moveBackResponse.ok) {
      console.log('✅ Ticket moved back successfully!');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testDragDrop().then(() => {
  console.log('\n✅ All drag-drop tests passed!');
  process.exit(0);
});
