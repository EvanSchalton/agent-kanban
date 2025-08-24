/**
 * TEST ENGINEER LEAD - IMMEDIATE MULTI-BROWSER WEBSOCKET TESTING
 * PM FINAL WARNING - EXECUTING CRITICAL WEBSOCKET SYNC VERIFICATION
 */

const WebSocket = require('ws');
const http = require('http');

class MultiBrowserWebSocketTester {
    constructor() {
        this.backendURL = 'http://localhost:18000';
        this.wsURL = 'ws://localhost:18000';
        this.browser1 = null;
        this.browser2 = null;
        this.syncEvents = [];
        this.testStartTime = Date.now();
    }

    log(message) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        console.log(`[${timestamp}] ${message}`);
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

    async createBrowserWebSocketConnection(browserId) {
        return new Promise((resolve, reject) => {
            this.log(`🌐 Browser ${browserId}: Connecting to WebSocket...`);

            const ws = new WebSocket(`${this.wsURL}/ws/connect`);
            let connected = false;

            const timeout = setTimeout(() => {
                if (!connected) {
                    ws.close();
                    reject(new Error(`Browser ${browserId} WebSocket timeout`));
                }
            }, 5000);

            ws.on('open', () => {
                this.log(`✅ Browser ${browserId}: WebSocket connected`);
                connected = true;
                clearTimeout(timeout);
                resolve(ws);
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.log(`📨 Browser ${browserId}: ${message.event || 'message'}`);

                    if (message.event === 'ticket_moved' || message.event === 'ticket_created') {
                        this.syncEvents.push({
                            browserId,
                            timestamp: Date.now(),
                            event: message.event,
                            data: message.data
                        });
                        this.log(`🔄 Browser ${browserId}: Sync event received - ${message.event}`);
                    }
                } catch (e) {
                    this.log(`📨 Browser ${browserId}: Raw message - ${data.toString().substring(0, 100)}`);
                }
            });

            ws.on('error', (error) => {
                this.log(`❌ Browser ${browserId}: WebSocket error - ${error.message}`);
                clearTimeout(timeout);
                reject(error);
            });

            ws.on('close', () => {
                this.log(`🔌 Browser ${browserId}: WebSocket disconnected`);
                clearTimeout(timeout);
            });
        });
    }

    async simulateCardOperation(operationType = 'move') {
        this.log(`🎮 Simulating ${operationType} operation...`);

        try {
            // Get available tickets
            const ticketsResponse = await this.makeHTTPRequest(`${this.backendURL}/api/tickets/?board_id=1`);

            if (ticketsResponse.statusCode !== 200) {
                throw new Error(`Failed to get tickets: ${ticketsResponse.statusCode}`);
            }

            const tickets = ticketsResponse.data.items || [];

            if (tickets.length === 0) {
                this.log('📝 No tickets available - creating test ticket...');

                // Create a test ticket
                const createResponse = await this.makeHTTPRequest(`${this.backendURL}/api/tickets/`, {
                    method: 'POST',
                    body: {
                        title: `Multi-Browser Test ${Date.now()}`,
                        description: 'Testing WebSocket sync across browsers',
                        board_id: 1,
                        current_column: 'Not Started'
                    }
                });

                if (createResponse.statusCode === 201) {
                    this.log('✅ Test ticket created successfully');
                    return { operation: 'create', ticket: createResponse.data };
                } else {
                    throw new Error(`Failed to create ticket: ${createResponse.statusCode}`);
                }
            }

            // Move existing ticket
            const testTicket = tickets[0];
            const columns = ['Not Started', 'In Progress', 'Blocked', 'Ready for QC', 'Done'];
            const currentColumn = testTicket.current_column;
            const targetColumn = columns.find(col => col !== currentColumn) || 'In Progress';

            this.log(`🎯 Moving ticket "${testTicket.title}" from ${currentColumn} to ${targetColumn}`);

            const moveResponse = await this.makeHTTPRequest(`${this.backendURL}/api/tickets/${testTicket.id}/move`, {
                method: 'POST',
                body: { column: targetColumn }
            });

            if (moveResponse.statusCode === 200) {
                this.log('✅ Ticket move successful');
                return { operation: 'move', ticket: moveResponse.data };
            } else {
                throw new Error(`Failed to move ticket: ${moveResponse.statusCode}`);
            }

        } catch (error) {
            this.log(`❌ Card operation failed: ${error.message}`);
            throw error;
        }
    }

    async runMultiBrowserTest() {
        console.log('🚨🚨🚨 CRITICAL: TEST ENGINEER LEAD - MULTI-BROWSER WEBSOCKET TEST 🚨🚨🚨');
        console.log('================================================================================');
        console.log('PM FINAL WARNING RESPONSE - IMMEDIATE EXECUTION OF WEBSOCKET SYNC TESTING');
        console.log('================================================================================\n');

        try {
            // Step 1: Create two browser WebSocket connections
            this.log('🚀 STEP 1: Creating Browser WebSocket Connections');
            this.log('==================================================');

            this.browser1 = await this.createBrowserWebSocketConnection(1);
            this.browser2 = await this.createBrowserWebSocketConnection(2);

            this.log('✅ Both browser WebSocket connections established');

            // Step 2: Wait for connections to stabilize
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 3: Simulate card operation in "Browser 1"
            this.log('\n🚀 STEP 2: Simulating Card Operation (Browser 1)');
            this.log('==================================================');

            const operation = await this.simulateCardOperation();

            // Step 4: Wait for WebSocket sync to propagate
            this.log('\n⏱️  STEP 3: Waiting for WebSocket Sync (3 seconds)');
            this.log('==================================================');

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Step 5: Analyze sync results
            this.log('\n📊 STEP 4: WebSocket Sync Analysis');
            this.log('===================================');

            const syncEventsReceived = this.syncEvents.length;
            const browser1Events = this.syncEvents.filter(e => e.browserId === 1).length;
            const browser2Events = this.syncEvents.filter(e => e.browserId === 2).length;

            this.log(`📈 Total sync events: ${syncEventsReceived}`);
            this.log(`📈 Browser 1 events: ${browser1Events}`);
            this.log(`📈 Browser 2 events: ${browser2Events}`);

            // Step 6: Generate PM Report
            console.log('\n🚨 PM REPORT - MULTI-BROWSER WEBSOCKET TESTING');
            console.log('===============================================');

            if (syncEventsReceived > 0 && browser2Events > 0) {
                console.log('✅ WEBSOCKET SYNC: WORKING ACROSS BROWSERS');
                console.log('✅ Real-time updates propagating to all connected clients');
                console.log(`✅ Sync latency: < 3 seconds`);
                console.log(`✅ Operation: ${operation.operation} was broadcast successfully`);

                this.syncEvents.forEach(event => {
                    console.log(`   📡 Browser ${event.browserId}: ${event.event} event received`);
                });

                return true;
            } else {
                console.log('❌ WEBSOCKET SYNC: FAILED TO PROPAGATE');
                console.log('❌ Browser 2 did not receive sync events');
                console.log('❌ Multi-browser real-time sync not working');
                return false;
            }

        } catch (error) {
            console.log('\n🚨 PM REPORT - WEBSOCKET TESTING FAILED');
            console.log('=======================================');
            console.log(`❌ Error: ${error.message}`);
            console.log('❌ Multi-browser WebSocket testing could not complete');
            return false;

        } finally {
            // Cleanup connections
            if (this.browser1) this.browser1.close();
            if (this.browser2) this.browser2.close();
            this.log('🔌 WebSocket connections closed');
        }
    }
}

// IMMEDIATE EXECUTION - PM FINAL WARNING RESPONSE
if (require.main === module) {
    const tester = new MultiBrowserWebSocketTester();
    tester.runMultiBrowserTest()
        .then(success => {
            console.log(`\n🎯 FINAL RESULT: ${success ? 'WEBSOCKET SYNC WORKING' : 'WEBSOCKET SYNC FAILED'}`);
            console.log('📋 TEST ENGINEER LEAD: Multi-browser testing complete');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error(`\n❌ CRITICAL ERROR: ${error.message}`);
            console.log('📋 TEST ENGINEER LEAD: Testing failed');
            process.exit(1);
        });
}
