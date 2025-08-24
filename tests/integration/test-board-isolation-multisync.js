#!/usr/bin/env node

/**
 * Board Isolation and Multi-User WebSocket Sync Test
 * Tests that board isolation works and multiple users sync properly
 */

const WebSocket = require('ws');

class BoardIsolationTest {
  constructor() {
    this.connections = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  async testAPI(method, url, data = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);

    const response = await fetch(`http://localhost:18000${url}`, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  }

  async createWebSocketConnection(clientId, boardId = null) {
    return new Promise((resolve, reject) => {
      const url = boardId
        ? `ws://localhost:18000/ws/connect?client_id=${clientId}&board_id=${boardId}`
        : `ws://localhost:18000/ws/connect?client_id=${clientId}`;
      const ws = new WebSocket(url);

      ws.on('open', () => {
        console.log(`✅ ${clientId} WebSocket connected`);
        ws.clientId = clientId;
        ws.messages = [];
        this.connections.push(ws);
        resolve(ws);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          ws.messages.push(message);
          if (message.event && message.event !== 'connected' && message.event !== 'heartbeat') {
            const boardId = message.board_id || message.data?.board_id;
            console.log(`📡 ${clientId} received: ${message.event} (board: ${boardId}, id: ${message.data?.id})`);
          }
        } catch (e) {
          console.error(`❌ Parse error for ${clientId}:`, e);
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error(`Timeout for ${clientId}`)), 5000);
    });
  }

  async waitForMessages(clients, expectedEvent, boardId = null, timeoutMs = 3000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const check = () => {
        const results = {};

        for (const client of clients) {
          const connection = this.connections.find(c => c.clientId === client);
          if (connection) {
            results[client] = connection.messages.some(msg => {
              const eventMatch = msg.event === expectedEvent || msg.type === expectedEvent;
              const msgBoardId = msg.board_id || msg.data?.board_id;
              const boardMatch = !boardId || msgBoardId === boardId;
              return eventMatch && boardMatch;
            });
          }
        }

        const allReceived = clients.every(client => results[client]);

        if (allReceived || Date.now() - startTime > timeoutMs) {
          resolve(results);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  logTest(testName, passed, details = '') {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
      console.log(`✅ PASS: ${testName} ${details}`);
    } else {
      this.testResults.failed++;
      console.log(`❌ FAIL: ${testName} ${details}`);
    }
  }

  async runTests() {
    console.log('🚀 Starting Board Isolation & Multi-User WebSocket Tests\n');

    try {
      // Step 1: Create test boards
      console.log('Step 1: Setting up test boards...');
      const board1 = await this.testAPI('POST', '/api/boards/', {
        name: 'Isolation Test Board 1',
        description: 'First board for isolation testing'
      });
      const board2 = await this.testAPI('POST', '/api/boards/', {
        name: 'Isolation Test Board 2',
        description: 'Second board for isolation testing'
      });
      console.log(`Created Board 1: ${board1.id}, Board 2: ${board2.id}`);

      // Step 2: Test board isolation - GET endpoints
      console.log('\nStep 2: Testing board isolation with GET endpoints...');

      // Test tickets endpoint with board_id filter
      const board1Tickets = await this.testAPI('GET', `/api/tickets/?board_id=${board1.id}`);
      const board2Tickets = await this.testAPI('GET', `/api/tickets/?board_id=${board2.id}`);

      console.log(`Board 1 has ${board1Tickets.total} tickets, Board 2 has ${board2Tickets.total} tickets`);

      // Test board-specific tickets endpoint
      const board1TicketsSpecific = await this.testAPI('GET', `/api/boards/${board1.id}/tickets`);
      const board2TicketsSpecific = await this.testAPI('GET', `/api/boards/${board2.id}/tickets`);

      this.logTest('Board Isolation - Specific Endpoints',
        board1TicketsSpecific.board_id === board1.id && board2TicketsSpecific.board_id === board2.id,
        `Board 1: ${board1TicketsSpecific.total_tickets} tickets, Board 2: ${board2TicketsSpecific.total_tickets} tickets`);

      // Step 3: Create WebSocket connections for multiple users with board subscriptions
      console.log('\nStep 3: Creating WebSocket connections for multi-user testing...');
      await this.createWebSocketConnection('user1-board1', board1.id);
      await this.createWebSocketConnection('user2-board1', board1.id);
      await this.createWebSocketConnection('user3-board2', board2.id);
      await this.createWebSocketConnection('user4-board2', board2.id);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Test ticket creation isolation
      console.log('\nStep 4: Testing ticket creation with board isolation...');

      // Clear previous messages
      this.connections.forEach(conn => conn.messages = []);

      // Create ticket in Board 1
      const board1Ticket = await this.testAPI('POST', '/api/tickets/', {
        title: 'Board 1 Isolated Ticket',
        description: 'This should only appear to Board 1 users',
        priority: 'high',
        board_id: board1.id,
        current_column: 'Not Started'
      });

      // Wait for WebSocket messages
      const board1Results = await this.waitForMessages(['user1-board1', 'user2-board1'], 'ticket_created', board1.id);
      const board2Results = await this.waitForMessages(['user3-board2', 'user4-board2'], 'ticket_created', board1.id, 1000);

      const board1UsersGotMessage = Object.values(board1Results).every(Boolean);
      const board2UsersGotMessage = Object.values(board2Results).some(Boolean);

      this.logTest('Board Isolation - Ticket Creation Broadcasting',
        board1UsersGotMessage && !board2UsersGotMessage,
        `Board 1 users: ${board1UsersGotMessage ? 'received' : 'missed'}, Board 2 users: ${board2UsersGotMessage ? 'incorrectly received' : 'correctly isolated'}`);

      // Step 5: Test ticket creation in Board 2
      console.log('\nStep 5: Testing ticket creation in Board 2...');

      // Clear previous messages
      this.connections.forEach(conn => conn.messages = []);

      const board2Ticket = await this.testAPI('POST', '/api/tickets/', {
        title: 'Board 2 Isolated Ticket',
        description: 'This should only appear to Board 2 users',
        priority: 'medium',
        board_id: board2.id,
        current_column: 'Not Started'
      });

      const board1Results2 = await this.waitForMessages(['user1-board1', 'user2-board1'], 'ticket_created', board2.id, 1000);
      const board2Results2 = await this.waitForMessages(['user3-board2', 'user4-board2'], 'ticket_created', board2.id);

      const board1UsersGotMessage2 = Object.values(board1Results2).some(Boolean);
      const board2UsersGotMessage2 = Object.values(board2Results2).every(Boolean);

      this.logTest('Board Isolation - Reverse Ticket Creation',
        !board1UsersGotMessage2 && board2UsersGotMessage2,
        `Board 1 users: ${board1UsersGotMessage2 ? 'incorrectly received' : 'correctly isolated'}, Board 2 users: ${board2UsersGotMessage2 ? 'received' : 'missed'}`);

      // Step 6: Test multi-user sync within same board
      console.log('\nStep 6: Testing multi-user synchronization within Board 1...');

      // Clear previous messages
      this.connections.forEach(conn => conn.messages = []);

      // Move Board 1 ticket
      await this.testAPI('POST', `/api/tickets/${board1Ticket.id}/move`, {
        column: 'In Progress',
        moved_by: 'user1-board1'
      });

      const syncResults = await this.waitForMessages(['user1-board1', 'user2-board1'], 'ticket_moved', board1.id);
      const allUsersSync = Object.values(syncResults).every(Boolean);

      this.logTest('Multi-User Sync - Same Board',
        allUsersSync,
        `All Board 1 users ${allUsersSync ? 'synchronized' : 'failed to sync'}: ${JSON.stringify(syncResults)}`);

      // Step 7: Test cross-board isolation on moves
      console.log('\nStep 7: Testing cross-board isolation on ticket moves...');

      // Clear previous messages
      this.connections.forEach(conn => conn.messages = []);

      // Move Board 2 ticket
      await this.testAPI('POST', `/api/tickets/${board2Ticket.id}/move`, {
        column: 'Done',
        moved_by: 'user3-board2'
      });

      const crossBoardResults1 = await this.waitForMessages(['user1-board1', 'user2-board1'], 'ticket_moved', board2.id, 1000);
      const crossBoardResults2 = await this.waitForMessages(['user3-board2', 'user4-board2'], 'ticket_moved', board2.id);

      const board1IsolatedFromBoard2Move = !Object.values(crossBoardResults1).some(Boolean);
      const board2UsersGotBoard2Move = Object.values(crossBoardResults2).every(Boolean);

      this.logTest('Cross-Board Isolation - Ticket Moves',
        board1IsolatedFromBoard2Move && board2UsersGotBoard2Move,
        `Board 1 isolation: ${board1IsolatedFromBoard2Move ? 'maintained' : 'broken'}, Board 2 sync: ${board2UsersGotBoard2Move ? 'working' : 'failed'}`);

      // Step 8: Test simultaneous multi-user activity
      console.log('\nStep 8: Testing simultaneous multi-user activity...');

      // Clear previous messages
      this.connections.forEach(conn => conn.messages = []);

      // Create multiple tickets simultaneously in different boards
      const simultaneousPromises = [
        this.testAPI('POST', '/api/tickets/', {
          title: 'Simultaneous Board 1 Ticket A',
          description: 'Created simultaneously',
          priority: 'low',
          board_id: board1.id,
          current_column: 'Not Started'
        }),
        this.testAPI('POST', '/api/tickets/', {
          title: 'Simultaneous Board 1 Ticket B',
          description: 'Created simultaneously',
          priority: 'low',
          board_id: board1.id,
          current_column: 'Not Started'
        }),
        this.testAPI('POST', '/api/tickets/', {
          title: 'Simultaneous Board 2 Ticket A',
          description: 'Created simultaneously',
          priority: 'low',
          board_id: board2.id,
          current_column: 'Not Started'
        })
      ];

      await Promise.all(simultaneousPromises);

      // Wait for all messages
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Count messages received by each user type
      const user1Messages = this.connections.find(c => c.clientId === 'user1-board1').messages.filter(m => m.event === 'ticket_created').length;
      const user3Messages = this.connections.find(c => c.clientId === 'user3-board2').messages.filter(m => m.event === 'ticket_created').length;

      this.logTest('Simultaneous Multi-User Activity',
        user1Messages === 2 && user3Messages === 1,
        `Board 1 user got ${user1Messages}/2 messages, Board 2 user got ${user3Messages}/1 messages`);

      // Cleanup
      console.log('\nCleaning up test data...');
      await this.testAPI('DELETE', `/api/boards/${board1.id}`);
      await this.testAPI('DELETE', `/api/boards/${board2.id}`);

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.logTest('Test Suite Execution', false, error.message);
    }

    // Close connections
    this.connections.forEach(ws => ws.close());

    // Print results
    console.log('\n' + '='.repeat(70));
    console.log('🎯 BOARD ISOLATION & MULTI-USER SYNC RESULTS');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total:  ${this.testResults.total}`);
    console.log(`🏆 Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);

    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('✅ Board isolation: PERFECT');
      console.log('✅ Multi-user WebSocket sync: WORKING');
      console.log('✅ Cross-board privacy: MAINTAINED');
      console.log('✅ Simultaneous operations: HANDLED CORRECTLY');
    } else {
      console.log('\n⚠️  Some tests failed. Issues found above.');
    }

    return this.testResults.failed === 0;
  }
}

if (require.main === module) {
  const tester = new BoardIsolationTest();
  tester.runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}
