/**
 * TEST ENGINEER LEAD - WebSocket Sync Testing
 * Priority 1: Verify real-time ticket updates across board isolation
 */

const WebSocket = require('ws');
const http = require('http');

class WebSocketSyncTester {
    constructor() {
        this.backendURL = 'http://localhost:18000';
        this.wsURL = 'ws://localhost:18000';
        this.connections = new Map();
        this.messageLog = [];
    }

    async makeHTTPRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const reqOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: { 'Content-Type': 'application/json', ...options.headers }
            };

            const req = http.request(reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = data ? JSON.parse(data) : {};
                        resolve({ statusCode: res.statusCode, data: parsed });
                    } catch (e) {
                        resolve({ statusCode: res.statusCode, data: data });
                    }
                });
            });

            req.on('error', reject);

            if (options.body) {
                req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
            }

            req.end();
        });
    }

    async testWebSocketConnection() {
        console.log('🔌 TESTING WEBSOCKET CONNECTION');
        console.log('===============================');

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`${this.wsURL}/ws/connect`);
            let connected = false;

            const timeout = setTimeout(() => {
                if (!connected) {
                    ws.close();
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 5000);

            ws.on('open', () => {
                console.log('✅ WebSocket connected successfully');
                connected = true;
                clearTimeout(timeout);

                // Send test message
                ws.send(JSON.stringify({ type: 'test', data: 'connection_test' }));

                setTimeout(() => {
                    ws.close();
                    resolve(true);
                }, 1000);
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log('📨 WebSocket message received:', message);
                    this.messageLog.push({ timestamp: Date.now(), message });
                } catch (e) {
                    console.log('📨 WebSocket raw message:', data.toString());
                }
            });

            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                clearTimeout(timeout);
                reject(error);
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
                clearTimeout(timeout);
                if (!connected) {
                    reject(new Error('WebSocket connection failed'));
                }
            });
        });
    }

    async testTicketMovementSync(boardId = 1) {
        console.log(`\n🎯 TESTING TICKET MOVEMENT SYNC (Board ${boardId})`);
        console.log('==========================================');

        try {
            // Get tickets for the board
            const ticketsResponse = await this.makeHTTPRequest(`${this.backendURL}/api/tickets/?board_id=${boardId}`);

            if (ticketsResponse.statusCode !== 200) {
                throw new Error(`Failed to get tickets: ${ticketsResponse.statusCode}`);
            }

            const tickets = ticketsResponse.data.items || [];
            console.log(`📋 Found ${tickets.length} tickets in board ${boardId}`);

            if (tickets.length === 0) {
                console.log('⚠️  No tickets to test movement - skipping sync test');
                return false;
            }

            const testTicket = tickets[0];
            console.log(`🎫 Testing with ticket: "${testTicket.title}" (ID: ${testTicket.id})`);
            console.log(`📍 Current column: ${testTicket.current_column}`);

            // Test column options
            const columns = ['Not Started', 'In Progress', 'Blocked', 'Ready for QC', 'Done'];
            const currentColumn = testTicket.current_column;
            const targetColumn = columns.find(col => col !== currentColumn) || 'In Progress';

            console.log(`🎯 Moving to: ${targetColumn}`);

            // Setup WebSocket listener for move event
            const ws = new WebSocket(`${this.wsURL}/ws/connect`);
            let moveEventReceived = false;

            const messagePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket sync timeout'));
                }, 10000);

                ws.on('open', () => {
                    console.log('🔌 WebSocket listener ready for sync test');
                });

                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        console.log('📨 WebSocket sync message:', message);

                        if (message.type === 'ticket_moved' || message.event === 'ticket_moved') {
                            if (message.data && message.data.id == testTicket.id) {
                                console.log('✅ SYNC SUCCESS: Ticket move event received');
                                moveEventReceived = true;
                                clearTimeout(timeout);
                                resolve(message);
                            }
                        }
                    } catch (e) {
                        console.log('📨 Non-JSON WebSocket message:', data.toString());
                    }
                });

                ws.on('error', (error) => {
                    console.error('❌ WebSocket sync error:', error.message);
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            // Perform the ticket move
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for WS setup

            console.log('🚀 Executing ticket move...');
            const moveResponse = await this.makeHTTPRequest(`${this.backendURL}/api/tickets/${testTicket.id}/move`, {
                method: 'POST',
                body: { column: targetColumn }
            });

            console.log(`📤 Move API response: ${moveResponse.statusCode}`);

            if (moveResponse.statusCode === 200) {
                console.log('✅ Move API successful');

                // Wait for WebSocket sync
                try {
                    await messagePromise;
                    console.log('✅ WEBSOCKET SYNC: WORKING');
                    return true;
                } catch (syncError) {
                    console.log('❌ WEBSOCKET SYNC: FAILED');
                    console.log(`   Error: ${syncError.message}`);
                    return false;
                }
            } else {
                console.log('❌ Move API failed');
                return false;
            }

        } catch (error) {
            console.error(`❌ Ticket movement sync test failed: ${error.message}`);
            return false;
        }
    }

    async runWebSocketSyncTest() {
        console.log('🚨 TEST ENGINEER LEAD - WEBSOCKET SYNC TESTING');
        console.log('===============================================');
        console.log('Priority 1: Verify real-time updates across board isolation');
        console.log('===============================================\n');

        try {
            // Test 1: Basic WebSocket connection
            await this.testWebSocketConnection();

            // Test 2: Ticket movement sync
            const syncWorking = await this.testTicketMovementSync(1);

            // Report to PM
            console.log('\n🚨 PM REPORT - WEBSOCKET SYNC TESTING');
            console.log('=====================================');

            if (syncWorking) {
                console.log('✅ WEBSOCKET SYNC: WORKING');
                console.log('✅ Real-time updates functional');
                console.log('✅ Ticket movement events broadcast correctly');
            } else {
                console.log('❌ WEBSOCKET SYNC: ISSUES DETECTED');
                console.log('⚠️  Real-time updates may not be working');
            }

            console.log('\n📋 Next Priority: Board deletion debugging');

            return syncWorking;

        } catch (error) {
            console.error(`❌ WebSocket sync testing failed: ${error.message}`);
            console.log('\n🚨 PM REPORT: WEBSOCKET CONNECTION FAILED');
            return false;
        }
    }
}

// Execute WebSocket sync testing
if (require.main === module) {
    const tester = new WebSocketSyncTester();
    tester.runWebSocketSyncTest()
        .then(result => {
            console.log(`\n🎯 WebSocket Sync Test: ${result ? 'PASSED' : 'FAILED'}`);
            process.exit(result ? 0 : 1);
        })
        .catch(console.error);
}

module.exports = { WebSocketSyncTester };
