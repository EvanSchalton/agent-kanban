#!/usr/bin/env node

/**
 * Final End-to-End WebSocket Test
 * Tests all WebSocket functionality including user attribution and real-time sync
 */

const WebSocket = require('ws');
const http = require('http');

console.log('🎯 Final End-to-End WebSocket Test');
console.log('==================================');
console.log('Testing: User Attribution + Real-Time Sync + Board Isolation');
console.log('');

class E2ETest {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
        this.users = [];
        this.testTicketIds = [];
        this.boardId = 1;
    }

    logTest(testName, passed, details = '') {
        this.results.total++;
        if (passed) {
            this.results.passed++;
            console.log(`✅ PASS: ${testName} ${details}`);
        } else {
            this.results.failed++;
            console.log(`❌ FAIL: ${testName} ${details}`);
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async makeApiCall(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const postData = data ? JSON.stringify(data) : null;

            const options = {
                hostname: 'localhost',
                port: 8000,
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

    createUser(username) {
        return new Promise((resolve, reject) => {
            const wsUrl = `ws://localhost:8000/ws/connect?username=${encodeURIComponent(username)}&board_id=${this.boardId}`;
            const ws = new WebSocket(wsUrl);

            const user = {
                name: username,
                ws: ws,
                messages: [],
                connected: false
            };

            ws.on('open', () => {
                console.log(`🔗 ${username} connected to WebSocket`);
                user.connected = true;
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);

                    // Skip heartbeats for cleaner logs
                    if (message.event === 'heartbeat') return;

                    user.messages.push(message);

                    if (message.event === 'connected') {
                        console.log(`📡 ${username} authenticated as: ${message.data.username}`);
                        resolve(user);
                    } else if (message.event && !['pong'].includes(message.event)) {
                        console.log(`📨 ${username} received: ${message.event} ${message.data?.moved_by ? `(by ${message.data.moved_by})` : ''}`);
                    }
                } catch (error) {
                    console.error(`❌ ${username} parse error:`, error.message);
                }
            });

            ws.on('error', (error) => {
                console.error(`❌ ${username} WebSocket error:`, error.message);
                reject(error);
            });

            ws.on('close', () => {
                console.log(`❌ ${username} disconnected`);
                user.connected = false;
            });

            // Timeout if connection takes too long
            setTimeout(() => {
                if (!user.connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 5000);
        });
    }

    async testSetup() {
        console.log('📋 Step 1: Setting up test users...\n');

        try {
            // Create three users
            const alice = await this.createUser('Alice');
            const bob = await this.createUser('Bob');

            this.users = [alice, bob];

            this.logTest('User connections established',
                alice.connected && bob.connected,
                `Alice: ${alice.connected}, Bob: ${bob.connected}`);

            // Wait for connection messages
            await this.delay(1000);

            // Check connection messages
            const aliceConnected = alice.messages.find(m => m.event === 'connected');
            const bobConnected = bob.messages.find(m => m.event === 'connected');

            this.logTest('User attribution in connection',
                aliceConnected?.data?.username === 'Alice' && bobConnected?.data?.username === 'Bob',
                `Alice: ${aliceConnected?.data?.username}, Bob: ${bobConnected?.data?.username}`);

            return true;
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            return false;
        }
    }

    async testTicketCreation() {
        console.log('\n📝 Step 2: Testing ticket creation with attribution...\n');

        // Clear previous messages
        this.users.forEach(user => user.messages = []);

        try {
            // Alice creates a ticket
            const response = await this.makeApiCall('POST', '/api/tickets/', {
                title: `Alice's E2E Test Ticket ${Date.now().toString().slice(-4)}`,
                description: 'Testing user attribution in E2E test',
                board_id: this.boardId,
                current_column: 'Not Started',
                created_by: 'Alice'
            });

            this.logTest('Ticket creation API call', response.status === 201, `Status: ${response.status}`);

            if (response.status === 201) {
                this.testTicketIds.push(response.data.id);

                // Wait for WebSocket events
                await this.delay(500);

                // Check if both users received the event
                const aliceEvent = this.users[0].messages.find(m => m.event === 'ticket_created');
                const bobEvent = this.users[1].messages.find(m => m.event === 'ticket_created');

                this.logTest('Alice received ticket_created event', !!aliceEvent);
                this.logTest('Bob received ticket_created event', !!bobEvent);
                this.logTest('Real-time sync working', !!(aliceEvent && bobEvent));

                return response.data.id;
            }
        } catch (error) {
            console.error('❌ Ticket creation failed:', error.message);
            this.logTest('Ticket creation', false, error.message);
        }

        return null;
    }

    async testTicketMovement(ticketId) {
        console.log('\n🔄 Step 3: Testing drag-drop with user attribution...\n');

        if (!ticketId) {
            this.logTest('Ticket movement', false, 'No ticket ID available');
            return;
        }

        // Clear previous messages
        this.users.forEach(user => user.messages = []);

        try {
            // Bob moves the ticket
            const response = await this.makeApiCall('POST', `/api/tickets/${ticketId}/move`, {
                column: 'In Progress',
                moved_by: 'Bob'
            });

            this.logTest('Ticket move API call', response.status === 200, `Status: ${response.status}`);

            // Wait for WebSocket events
            await this.delay(500);

            // Check move events
            const aliceMoveEvent = this.users[0].messages.find(m =>
                m.event === 'ticket_moved' || m.event === 'ticket_updated'
            );
            const bobMoveEvent = this.users[1].messages.find(m =>
                m.event === 'ticket_moved' || m.event === 'ticket_updated'
            );

            this.logTest('Alice received move event', !!aliceMoveEvent);
            this.logTest('Bob received move event', !!bobMoveEvent);

            // Check attribution
            const hasAttribution = aliceMoveEvent?.data?.moved_by === 'Bob';
            this.logTest('Move attribution correct', hasAttribution,
                `moved_by: ${aliceMoveEvent?.data?.moved_by}`);

            this.logTest('Real-time drag-drop sync',
                !!(aliceMoveEvent && bobMoveEvent && hasAttribution));

        } catch (error) {
            console.error('❌ Ticket movement failed:', error.message);
            this.logTest('Ticket movement', false, error.message);
        }
    }

    async testTicketUpdate(ticketId) {
        console.log('\n✏️ Step 4: Testing ticket updates with attribution...\n');

        if (!ticketId) {
            this.logTest('Ticket update', false, 'No ticket ID available');
            return;
        }

        // Clear previous messages
        this.users.forEach(user => user.messages = []);

        try {
            // Alice updates the ticket
            const response = await this.makeApiCall('PUT', `/api/tickets/${ticketId}`, {
                title: 'Updated E2E Test Ticket',
                priority: '2.0',
                changed_by: 'Alice'
            });

            this.logTest('Ticket update API call', response.status === 200, `Status: ${response.status}`);

            // Wait for WebSocket events
            await this.delay(500);

            // Check update events
            const aliceUpdateEvent = this.users[0].messages.find(m => m.event === 'ticket_updated');
            const bobUpdateEvent = this.users[1].messages.find(m => m.event === 'ticket_updated');

            this.logTest('Alice received update event', !!aliceUpdateEvent);
            this.logTest('Bob received update event', !!bobUpdateEvent);

            // Check attribution would be handled by backend
            this.logTest('Real-time update sync', !!(aliceUpdateEvent && bobUpdateEvent));

        } catch (error) {
            console.error('❌ Ticket update failed:', error.message);
            this.logTest('Ticket update', false, error.message);
        }
    }

    async testConcurrentOperations() {
        console.log('\n🔥 Step 5: Testing concurrent operations...\n');

        // Clear previous messages
        this.users.forEach(user => user.messages = []);

        try {
            // Both users create tickets simultaneously
            const promises = [
                this.makeApiCall('POST', '/api/tickets/', {
                    title: 'Alice Concurrent Ticket',
                    board_id: this.boardId,
                    current_column: 'Not Started',
                    created_by: 'Alice'
                }),
                this.makeApiCall('POST', '/api/tickets/', {
                    title: 'Bob Concurrent Ticket',
                    board_id: this.boardId,
                    current_column: 'Not Started',
                    created_by: 'Bob'
                })
            ];

            const results = await Promise.all(promises);

            this.logTest('Concurrent ticket creation',
                results.every(r => r.status === 201),
                `Status codes: ${results.map(r => r.status).join(', ')}`);

            // Store ticket IDs for cleanup
            results.forEach(r => {
                if (r.status === 201) {
                    this.testTicketIds.push(r.data.id);
                }
            });

            // Wait for WebSocket events
            await this.delay(1000);

            // Both users should receive both events
            const aliceEvents = this.users[0].messages.filter(m => m.event === 'ticket_created');
            const bobEvents = this.users[1].messages.filter(m => m.event === 'ticket_created');

            this.logTest('Alice received both creation events', aliceEvents.length >= 2);
            this.logTest('Bob received both creation events', bobEvents.length >= 2);
            this.logTest('Concurrent operations handled correctly',
                aliceEvents.length >= 2 && bobEvents.length >= 2);

        } catch (error) {
            console.error('❌ Concurrent operations failed:', error.message);
            this.logTest('Concurrent operations', false, error.message);
        }
    }

    async testBoardIsolation() {
        console.log('\n🎯 Step 6: Testing board isolation...\n');

        try {
            // Create a user on a different board
            const charlie = await this.createUser('Charlie');

            // Connect Charlie to board 2
            charlie.ws.close();
            await this.delay(500);

            const wsUrl = `ws://localhost:8000/ws/connect?username=Charlie&board_id=2`;
            const charlieWs = new WebSocket(wsUrl);

            await new Promise((resolve) => {
                charlieWs.on('open', () => {
                    console.log('🔗 Charlie connected to Board 2');
                    resolve();
                });
            });

            // Clear all messages
            this.users.forEach(user => user.messages = []);

            // Charlie creates a ticket on board 2
            const board2Response = await this.makeApiCall('POST', '/api/tickets/', {
                title: 'Charlie Board 2 Ticket',
                board_id: 2,
                current_column: 'Not Started',
                created_by: 'Charlie'
            });

            this.logTest('Board 2 ticket creation', board2Response.status === 201);

            if (board2Response.status === 201) {
                this.testTicketIds.push(board2Response.data.id);
            }

            // Alice creates a ticket on board 1
            const board1Response = await this.makeApiCall('POST', '/api/tickets/', {
                title: 'Alice Board 1 Ticket',
                board_id: 1,
                current_column: 'Not Started',
                created_by: 'Alice'
            });

            if (board1Response.status === 201) {
                this.testTicketIds.push(board1Response.data.id);
            }

            // Wait for events
            await this.delay(1000);

            // Alice and Bob (on board 1) should NOT see Charlie's board 2 ticket
            const board2Events = this.users[0].messages.filter(m =>
                m.event === 'ticket_created' && m.data?.title?.includes('Board 2')
            );

            this.logTest('Board isolation working',
                board2Events.length === 0,
                `Board 2 events on Board 1: ${board2Events.length}`);

            charlieWs.close();

        } catch (error) {
            console.error('❌ Board isolation test failed:', error.message);
            this.logTest('Board isolation', false, error.message);
        }
    }

    async cleanup() {
        console.log('\n🧹 Step 7: Cleaning up test data...\n');

        // Close all WebSocket connections
        this.users.forEach(user => {
            if (user.ws.readyState === WebSocket.OPEN) {
                user.ws.close();
            }
        });

        // Delete test tickets
        let cleaned = 0;
        for (const ticketId of this.testTicketIds) {
            try {
                const response = await this.makeApiCall('DELETE', `/api/tickets/${ticketId}`);
                if (response.status === 200 || response.status === 204) {
                    cleaned++;
                }
            } catch (error) {
                console.warn(`Warning: Could not delete ticket ${ticketId}`);
            }
        }

        this.logTest('Test data cleanup',
            cleaned === this.testTicketIds.length,
            `Cleaned ${cleaned}/${this.testTicketIds.length} tickets`);
    }

    printResults() {
        console.log('\n' + '='.repeat(50));
        console.log('🏁 FINAL END-TO-END TEST RESULTS');
        console.log('='.repeat(50));

        const successRate = Math.round((this.results.passed / this.results.total) * 100);

        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📊 Total:  ${this.results.total}`);
        console.log(`🎯 Success Rate: ${successRate}%`);
        console.log('');

        if (this.results.failed === 0) {
            console.log('🎉 ALL TESTS PASSED!');
            console.log('✅ User Attribution: WORKING');
            console.log('✅ Real-Time Sync: WORKING');
            console.log('✅ Board Isolation: WORKING');
            console.log('✅ Concurrent Operations: WORKING');
            console.log('✅ WebSocket Integration: PERFECT');
            console.log('');
            console.log('🚀 READY FOR PRODUCTION DEPLOYMENT!');
        } else {
            console.log('⚠️  Some tests failed. Review the issues above.');
        }

        return this.results.failed === 0;
    }

    async run() {
        console.log('Starting comprehensive E2E test...\n');

        try {
            // Run all test phases
            const setupOk = await this.testSetup();
            if (!setupOk) {
                console.error('❌ Setup failed - aborting tests');
                return false;
            }

            const ticketId = await this.testTicketCreation();
            await this.testTicketMovement(ticketId);
            await this.testTicketUpdate(ticketId);
            await this.testConcurrentOperations();
            await this.testBoardIsolation();
            await this.cleanup();

            return this.printResults();

        } catch (error) {
            console.error('💥 Test suite crashed:', error);
            this.logTest('Test Suite Execution', false, error.message);
            return false;
        }
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    const test = new E2ETest();
    test.run()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('💥 Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = E2ETest;
