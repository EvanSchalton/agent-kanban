#!/usr/bin/env node
/**
 * Debug Drag-Drop API Call Issue
 * This script simulates what the frontend should be doing
 */

async function testDragDropAPI() {
    const baseURL = 'http://localhost:8000';

    console.log('🔍 Testing Drag-Drop API Flow...\n');

    // First, get a ticket to test with
    console.log('1. Getting tickets...');
    const ticketsResponse = await fetch(`${baseURL}/api/tickets/?board_id=1`);
    const tickets = await ticketsResponse.json();
    console.log(`Found ${tickets.items.length} tickets`);

    if (tickets.items.length === 0) {
        console.log('No tickets found. Creating a test ticket...');
        const createResponse = await fetch(`${baseURL}/api/tickets/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Debug Test Ticket',
                description: 'For testing drag-drop',
                priority: 'medium',
                current_column: 'not_started',
                board_id: 1
            })
        });
        const newTicket = await createResponse.json();
        console.log('Created test ticket:', newTicket.id);
        return newTicket.id;
    }

    const testTicket = tickets.items[0];
    console.log(`Using ticket: ${testTicket.id} - "${testTicket.title}"`);
    console.log(`Current column: "${testTicket.current_column}"`);

    // Test different API call scenarios
    const scenarios = [
        {
            name: 'WRONG: Send ticket ID as column',
            payload: { column: testTicket.id.toString() }, // This is what's causing the bug!
            expectedResult: 'SHOULD FAIL with validation error'
        },
        {
            name: 'CORRECT: Send proper column name',
            payload: { column: 'in_progress' },
            expectedResult: 'Should succeed and set current_column to "in_progress"'
        },
        {
            name: 'WRONG: Send random invalid column',
            payload: { column: 'invalid_column' },
            expectedResult: 'SHOULD FAIL with validation error'
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🧪 ${scenario.name}`);
        console.log(`Expected: ${scenario.expectedResult}`);
        console.log(`Payload: ${JSON.stringify(scenario.payload)}`);

        try {
            const response = await fetch(`${baseURL}/api/tickets/${testTicket.id}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scenario.payload)
            });

            const result = await response.json();

            if (response.ok) {
                console.log(`✅ API Response: SUCCESS`);
                console.log(`   Result column: "${result.current_column}"`);

                // Check if this is actually a bug
                if (scenario.payload.column === testTicket.id.toString() && result.current_column === testTicket.id.toString()) {
                    console.log('🚨 BUG CONFIRMED: Backend accepted ticket ID as column name!');
                }
            } else {
                console.log(`❌ API Response: FAILED - ${result.detail || 'Unknown error'}`);
            }
        } catch (error) {
            console.log(`❌ Request failed: ${error.message}`);
        }
    }

    // Test the expected frontend column mapping
    console.log('\n📋 Frontend Column Mapping Test:');

    const COLUMN_MAP = {
        'not_started': 'Not Started',
        'in_progress': 'In Progress',
        'blocked': 'Blocked',
        'ready_for_qc': 'Ready for QC',
        'done': 'Done'
    };

    const VALID_COLUMN_IDS = ['not_started', 'in_progress', 'blocked', 'ready_for_qc', 'done'];

    console.log('Valid frontend column IDs:', VALID_COLUMN_IDS);
    console.log('Column mapping (frontend → backend):', COLUMN_MAP);

    // Simulate what should happen in frontend drag-drop
    console.log('\n🎯 Simulating Correct Frontend Logic:');

    // This is what Board.tsx should be doing:
    const droppableId = 'in_progress'; // This should come from drag event
    const ticketId = testTicket.id.toString();

    console.log(`Droppable ID from drag event: "${droppableId}"`);
    console.log(`Ticket ID being moved: "${ticketId}"`);

    // The API call should use the COLUMN_MAP
    const columnName = COLUMN_MAP[droppableId];
    if (!columnName) {
        console.log(`❌ Invalid droppable ID: ${droppableId}`);
        return;
    }

    console.log(`Mapped column name: "${columnName}"`);
    console.log(`Should call API with: {"column": "${columnName}"}`);

    // But the bug report shows it's calling with: {"column": "${ticketId}"}
    console.log(`🚨 BUG: Frontend is calling with: {"column": "${ticketId}"}`);
    console.log('This means the droppableId is somehow getting the ticket ID instead of column ID!');
}

// Run the test
testDragDropAPI().catch(console.error);
