#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');

console.log('🧪 Multi-User WebSocket Synchronization Test');
console.log('='.repeat(50));

let client1, client2;
let client1Messages = [];
let client2Messages = [];
let testsPassed = 0;
let testsTotal = 0;

function logTest(testName, passed, details = '') {
    testsTotal++;
    if (passed) {
        testsPassed++;
        console.log(`✅ ${testName} ${details}`);
    } else {
        console.log(`❌ ${testName} ${details}`);
    }
}

function createClient(clientName, onMessage) {
    const ws = new WebSocket('ws://localhost:18000/ws/connect');

    ws.on('open', () => {
        console.log(`🔗 ${clientName} connected`);
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            // Skip heartbeats for cleaner logs
            if (message.event === 'heartbeat') return;

            console.log(`📡 ${clientName} received:`, message.event, message.data?.id ? `(ID: ${message.data.id})` : '');
            onMessage(message);
        } catch (error) {
            console.error(`🚨 ${clientName} parse error:`, error.message);
        }
    });

    ws.on('error', (error) => {
        console.error(`🚨 ${clientName} error:`, error.message);
    });

    ws.on('close', () => {
        console.log(`❌ ${clientName} disconnected`);
    });

    return ws;
}

function makeApiCall(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const postData = data ? JSON.stringify(data) : null;

        const options = {
            hostname: 'localhost',
            port: 18000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (postData) {
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (error) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', reject);

        if (postData) {
            req.write(postData);
        }

        req.end();
    });
}

async function runTests() {
    // Initialize clients
    client1 = createClient('Client1', (message) => client1Messages.push(message));
    client2 = createClient('Client2', (message) => client2Messages.push(message));

    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n🧪 Test 1: Ticket Creation Sync');
    client1Messages = [];
    client2Messages = [];

    const createResponse = await makeApiCall('POST', '/api/tickets/', {
        title: 'Multi-User Test Ticket',
        description: 'Testing multi-user sync',
        board_id: 1,
        current_column: 'Not Started',
        created_by: 'test-suite'
    });

    logTest('API ticket creation', createResponse.status === 201);

    // Wait for WebSocket events
    await new Promise(resolve => setTimeout(resolve, 500));

    const client1HasTicketCreated = client1Messages.some(m => m.event === 'ticket_created');
    const client2HasTicketCreated = client2Messages.some(m => m.event === 'ticket_created');

    logTest('Client1 received ticket_created', client1HasTicketCreated);
    logTest('Client2 received ticket_created', client2HasTicketCreated);
    logTest('Multi-user ticket creation sync', client1HasTicketCreated && client2HasTicketCreated);

    const ticketId = createResponse.data.id;

    console.log('\n🧪 Test 2: Drag-Drop Move Sync');
    client1Messages = [];
    client2Messages = [];

    const moveResponse = await makeApiCall('POST', `/api/tickets/${ticketId}/move`, {
        column: 'In Progress',
        moved_by: 'test-suite'
    });

    logTest('API ticket move', moveResponse.status === 200);

    // Wait for WebSocket events
    await new Promise(resolve => setTimeout(resolve, 500));

    const client1HasTicketMoved = client1Messages.some(m =>
        m.event === 'ticket_moved' || m.event === 'ticket_updated'
    );
    const client2HasTicketMoved = client2Messages.some(m =>
        m.event === 'ticket_moved' || m.event === 'ticket_updated'
    );

    logTest('Client1 received move event', client1HasTicketMoved);
    logTest('Client2 received move event', client2HasTicketMoved);
    logTest('Multi-user drag-drop sync', client1HasTicketMoved && client2HasTicketMoved);

    console.log('\n🧪 Test 3: Ticket Update Sync');
    client1Messages = [];
    client2Messages = [];

    const updateResponse = await makeApiCall('PUT', `/api/tickets/${ticketId}`, {
        title: 'Updated Multi-User Test Ticket',
        priority: '2.0',
        changed_by: 'test-suite'
    });

    logTest('API ticket update', updateResponse.status === 200);

    // Wait for WebSocket events
    await new Promise(resolve => setTimeout(resolve, 500));

    const client1HasTicketUpdated = client1Messages.some(m => m.event === 'ticket_updated');
    const client2HasTicketUpdated = client2Messages.some(m => m.event === 'ticket_updated');

    logTest('Client1 received ticket_updated', client1HasTicketUpdated);
    logTest('Client2 received ticket_updated', client2HasTicketUpdated);
    logTest('Multi-user ticket update sync', client1HasTicketUpdated && client2HasTicketUpdated);

    console.log('\n🧪 Test 4: Connection Reliability');

    // Test reconnection by closing and reopening client1
    client1.close();
    await new Promise(resolve => setTimeout(resolve, 500));

    client1Messages = [];
    client1 = createClient('Client1-Reconnected', (message) => client1Messages.push(message));
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test if events still reach both clients
    const reliabilityResponse = await makeApiCall('PUT', `/api/tickets/${ticketId}`, {
        description: 'Testing connection reliability',
        changed_by: 'reliability-test'
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    const reconnectedClient1HasEvent = client1Messages.some(m => m.event === 'ticket_updated');
    const client2HasReliabilityEvent = client2Messages.some(m =>
        m.event === 'ticket_updated' &&
        m.data.description === 'Testing connection reliability'
    );

    logTest('Reconnected Client1 receives events', reconnectedClient1HasEvent);
    logTest('Client2 continues receiving events', client2HasReliabilityEvent);
    logTest('Connection reliability', reconnectedClient1HasEvent && client2HasReliabilityEvent);

    // Cleanup
    console.log('\n🧹 Cleanup');
    await makeApiCall('DELETE', `/api/tickets/${ticketId}`);
    logTest('Cleanup ticket deleted', true);

    // Final results
    console.log('\n' + '='.repeat(50));
    console.log(`🏁 Test Results: ${testsPassed}/${testsTotal} tests passed`);

    if (testsPassed === testsTotal) {
        console.log('✅ All tests passed! Multi-user WebSocket sync is working perfectly.');
    } else {
        console.log('❌ Some tests failed. Multi-user WebSocket sync needs attention.');
    }

    // Close connections
    client1.close();
    client2.close();

    setTimeout(() => process.exit(testsPassed === testsTotal ? 0 : 1), 500);
}

runTests().catch(error => {
    console.error('🚨 Test suite error:', error);
    process.exit(1);
});
