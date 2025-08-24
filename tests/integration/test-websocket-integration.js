#!/usr/bin/env node
/**
 * WebSocket Real-time Integration Test
 * Tests that frontend WebSocket handlers properly receive and process backend events
 */

const WebSocket = require('ws');

class WebSocketTester {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.events = [];
        this.testResults = [];
    }

    async connect() {
        return new Promise((resolve, reject) => {
            console.log('🔌 Connecting to WebSocket...');
            this.ws = new WebSocket('ws://localhost:8000/ws/connect');

            this.ws.on('open', () => {
                console.log('✅ WebSocket connected');
                this.connected = true;
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log('📡 Received:', message.event || message.type, message.data);
                    this.events.push(message);
                } catch (e) {
                    console.log('📡 Raw message:', data.toString());
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('🔌 WebSocket disconnected');
                this.connected = false;
            });
        });
    }

    async makeApiRequest(method, path, data = null) {
        const url = `http://localhost:8000${path}`;
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        console.log(`🌐 ${method} ${url}`);
        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || 'API request failed');
        }

        return result;
    }

    async testTicketCreation() {
        console.log('\n🎫 Testing ticket creation...');
        const initialEventCount = this.events.length;

        const ticket = await this.makeApiRequest('POST', '/api/tickets/', {
            title: `WebSocket Test ${Date.now()}`,
            description: 'Testing real-time sync',
            priority: 'medium',
            current_column: 'todo',
            board_id: 1,
            created_by: 'test-user'
        });

        // Wait for WebSocket event
        await this.waitForEvent('ticket_created', 2000);

        const newEvents = this.events.slice(initialEventCount);
        const createdEvent = newEvents.find(e => e.event === 'ticket_created');

        if (createdEvent) {
            console.log('✅ Ticket creation event received');
            this.testResults.push({ test: 'ticket_creation', status: 'PASS' });
            return ticket;
        } else {
            console.log('❌ Ticket creation event NOT received');
            this.testResults.push({ test: 'ticket_creation', status: 'FAIL' });
            return ticket;
        }
    }

    async testTicketUpdate(ticketId) {
        console.log('\n🔄 Testing ticket update...');
        const initialEventCount = this.events.length;

        await this.makeApiRequest('PUT', `/api/tickets/${ticketId}`, {
            title: `Updated Ticket ${Date.now()}`,
            priority: 'high',
            changed_by: 'test-user'
        });

        await this.waitForEvent('ticket_updated', 2000);

        const newEvents = this.events.slice(initialEventCount);
        const updatedEvent = newEvents.find(e => e.event === 'ticket_updated');

        if (updatedEvent) {
            console.log('✅ Ticket update event received');
            this.testResults.push({ test: 'ticket_update', status: 'PASS' });
        } else {
            console.log('❌ Ticket update event NOT received');
            this.testResults.push({ test: 'ticket_update', status: 'FAIL' });
        }
    }

    async testTicketMove(ticketId) {
        console.log('\n🚀 Testing ticket move...');
        const initialEventCount = this.events.length;

        await this.makeApiRequest('POST', `/api/tickets/${ticketId}/move`, {
            column: 'in_progress',
            moved_by: 'test-user'
        });

        await this.waitForEvent('ticket_moved', 2000);

        const newEvents = this.events.slice(initialEventCount);
        const movedEvent = newEvents.find(e => e.event === 'ticket_moved');

        if (movedEvent) {
            console.log('✅ Ticket move event received');
            this.testResults.push({ test: 'ticket_move', status: 'PASS' });
        } else {
            console.log('❌ Ticket move event NOT received');
            this.testResults.push({ test: 'ticket_move', status: 'FAIL' });
        }
    }

    async testTicketClaim(ticketId) {
        console.log('\n🎯 Testing ticket claim...');
        const initialEventCount = this.events.length;

        await this.makeApiRequest('POST', `/api/tickets/${ticketId}/claim?agent_id=test-agent`);

        await this.waitForEvent('ticket_claimed', 2000);

        const newEvents = this.events.slice(initialEventCount);
        const claimedEvent = newEvents.find(e => e.event === 'ticket_claimed');

        if (claimedEvent) {
            console.log('✅ Ticket claim event received');
            this.testResults.push({ test: 'ticket_claim', status: 'PASS' });
        } else {
            console.log('❌ Ticket claim event NOT received');
            this.testResults.push({ test: 'ticket_claim', status: 'FAIL' });
        }
    }

    async testTicketDeletion(ticketId) {
        console.log('\n🗑️ Testing ticket deletion...');
        const initialEventCount = this.events.length;

        await this.makeApiRequest('DELETE', `/api/tickets/${ticketId}`);

        await this.waitForEvent('ticket_deleted', 2000);

        const newEvents = this.events.slice(initialEventCount);
        const deletedEvent = newEvents.find(e => e.event === 'ticket_deleted');

        if (deletedEvent) {
            console.log('✅ Ticket deletion event received');
            this.testResults.push({ test: 'ticket_deletion', status: 'PASS' });
        } else {
            console.log('❌ Ticket deletion event NOT received');
            this.testResults.push({ test: 'ticket_deletion', status: 'FAIL' });
        }
    }

    async waitForEvent(eventType, timeout = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (this.events.some(e => e.event === eventType)) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return false;
    }

    async runAllTests() {
        try {
            console.log('🚀 Starting WebSocket Real-time Integration Tests\n');

            await this.connect();

            // Wait a moment for connection to stabilize
            await new Promise(resolve => setTimeout(resolve, 1000));

            const ticket = await this.testTicketCreation();
            if (ticket) {
                await this.testTicketUpdate(ticket.id);
                await this.testTicketMove(ticket.id);
                await this.testTicketClaim(ticket.id);
                await this.testTicketDeletion(ticket.id);
            }

            this.printResults();

        } catch (error) {
            console.error('❌ Test error:', error.message);
            this.testResults.push({ test: 'connection', status: 'FAIL', error: error.message });
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('=' * 50);

        let passed = 0;
        let failed = 0;

        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${status} ${result.test}: ${result.status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }

            if (result.status === 'PASS') passed++;
            else failed++;
        });

        console.log('=' * 50);
        console.log(`Total: ${this.testResults.length}, Passed: ${passed}, Failed: ${failed}`);

        if (failed === 0) {
            console.log('🎉 All WebSocket integration tests PASSED!');
            console.log('✅ Real-time updates are working correctly for agent collaboration');
        } else {
            console.log('⚠️ Some tests failed - WebSocket integration needs attention');
        }

        console.log('\n📡 All events received:');
        this.events.forEach((event, i) => {
            console.log(`${i + 1}. ${event.event || event.type}:`, event.data);
        });
    }
}

// Run the tests
const tester = new WebSocketTester();
tester.runAllTests().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
