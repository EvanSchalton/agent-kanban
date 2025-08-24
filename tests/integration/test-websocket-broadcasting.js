#!/usr/bin/env node

/**
 * Comprehensive WebSocket Broadcasting Test
 * Tests multi-window synchronization and agent-human collaboration
 */

const WebSocket = require('ws');

class WebSocketTester {
  constructor() {
    this.connections = [];
    this.messageLog = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  async createConnection(clientId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:18000/ws/connect?client_id=${clientId}`);

      ws.on('open', () => {
        console.log(`✅ Connection ${clientId} established`);
        ws.clientId = clientId;
        ws.messages = [];
        this.connections.push(ws);
        resolve(ws);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          ws.messages.push(message);
          this.messageLog.push({
            clientId,
            timestamp: new Date().toISOString(),
            message
          });
          console.log(`📡 ${clientId} received:`, message.event || message.type, message.data?.id ? `(ID: ${message.data.id})` : '');
        } catch (e) {
          console.error(`❌ Failed to parse message for ${clientId}:`, data.toString());
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error);
        reject(error);
      });

      ws.on('close', () => {
        console.log(`🔌 Connection ${clientId} closed`);
      });

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error(`Connection timeout for ${clientId}`)), 5000);
    });
  }

  async testAPI(method, url, data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`http://localhost:18000${url}`, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`❌ API ${method} ${url} failed:`, error.message);
      throw error;
    }
  }

  async waitForMessages(clients, expectedEvent, timeoutMs = 3000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const check = () => {
        const results = {};

        for (const client of clients) {
          const connection = this.connections.find(c => c.clientId === client);
          if (connection) {
            results[client] = connection.messages.some(msg =>
              (msg.event === expectedEvent || msg.type === expectedEvent)
            );
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
    console.log('🚀 Starting WebSocket Broadcasting Tests\n');

    try {
      // Step 1: Create multiple WebSocket connections
      console.log('Step 1: Establishing WebSocket connections...');
      await this.createConnection('frontend-window-1');
      await this.createConnection('frontend-window-2');
      await this.createConnection('mcp-agent');

      // Wait for connections to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Test ticket creation broadcasting
      console.log('\nStep 2: Testing ticket creation broadcasting...');
      const ticket = await this.testAPI('POST', '/api/tickets/', {
        title: 'WebSocket Test Ticket',
        description: 'Testing real-time broadcasting',
        priority: '1.0',
        board_id: 1,
        current_column: 'Not Started',
        created_by: 'test_suite'
      });

      const creationResults = await this.waitForMessages(['frontend-window-1', 'frontend-window-2', 'mcp-agent'], 'ticket_created');
      const allReceivedCreation = Object.values(creationResults).every(Boolean);
      this.logTest('Ticket Creation Broadcasting', allReceivedCreation,
        `Windows received: ${JSON.stringify(creationResults)}`);

      // Step 3: Test ticket update broadcasting
      console.log('\nStep 3: Testing ticket update broadcasting...');
      await this.testAPI('PUT', `/api/tickets/${ticket.id}`, {
        title: 'Updated WebSocket Test Ticket',
        description: 'Updated description for broadcasting test'
      });

      const updateResults = await this.waitForMessages(['frontend-window-1', 'frontend-window-2', 'mcp-agent'], 'ticket_updated');
      const allReceivedUpdate = Object.values(updateResults).every(Boolean);
      this.logTest('Ticket Update Broadcasting', allReceivedUpdate,
        `Windows received: ${JSON.stringify(updateResults)}`);

      // Step 4: Test ticket movement (drag-drop) broadcasting
      console.log('\nStep 4: Testing ticket movement broadcasting...');
      await this.testAPI('POST', `/api/tickets/${ticket.id}/move`, {
        column: 'In Progress',
        moved_by: 'test_suite'
      });

      const moveResults = await this.waitForMessages(['frontend-window-1', 'frontend-window-2', 'mcp-agent'], 'ticket_moved');
      const allReceivedMove = Object.values(moveResults).every(Boolean);
      this.logTest('Ticket Movement Broadcasting', allReceivedMove,
        `Windows received: ${JSON.stringify(moveResults)}`);

      // Step 5: Test comment addition broadcasting
      console.log('\nStep 5: Testing comment broadcasting...');
      await this.testAPI('POST', '/api/comments/', {
        ticket_id: ticket.id,
        content: 'This is a test comment for WebSocket broadcasting',
        author: 'test_suite'
      });

      const commentResults = await this.waitForMessages(['frontend-window-1', 'frontend-window-2', 'mcp-agent'], 'comment_added');
      const allReceivedComment = Object.values(commentResults).every(Boolean);
      this.logTest('Comment Addition Broadcasting', allReceivedComment,
        `Windows received: ${JSON.stringify(commentResults)}`);

      // Step 6: Test bulk operations broadcasting
      console.log('\nStep 6: Testing bulk operations broadcasting...');

      // Create a second ticket for bulk testing
      const ticket2 = await this.testAPI('POST', '/api/tickets/', {
        title: 'Bulk Test Ticket 2',
        description: 'Second ticket for bulk testing',
        priority: '2.0',
        board_id: 1,
        current_column: 'Not Started',
        created_by: 'test_suite'
      });

      // Clear previous messages
      this.connections.forEach(conn => conn.messages = []);

      // Perform bulk move
      await this.testAPI('POST', '/api/bulk/tickets/move', {
        ticket_ids: [ticket.id, ticket2.id],
        target_column: 'Done'
      });

      const bulkResults = await this.waitForMessages(['frontend-window-1', 'frontend-window-2', 'mcp-agent'], 'bulk_update');
      const allReceivedBulk = Object.values(bulkResults).every(Boolean);
      this.logTest('Bulk Operations Broadcasting', allReceivedBulk,
        `Windows received: ${JSON.stringify(bulkResults)}`);

      // Step 7: Test board operations broadcasting
      console.log('\nStep 7: Testing board operations broadcasting...');
      const board = await this.testAPI('POST', '/api/boards/', {
        name: 'WebSocket Test Board',
        description: 'Board for testing WebSocket broadcasting'
      });

      const boardResults = await this.waitForMessages(['frontend-window-1', 'frontend-window-2', 'mcp-agent'], 'board_created');
      const allReceivedBoard = Object.values(boardResults).every(Boolean);
      this.logTest('Board Creation Broadcasting', allReceivedBoard,
        `Windows received: ${JSON.stringify(boardResults)}`);

      // Step 8: Test heartbeat mechanism
      console.log('\nStep 8: Testing heartbeat mechanism...');
      await new Promise(resolve => setTimeout(resolve, 35000)); // Wait for heartbeat cycle

      const heartbeatCount = this.connections[0].messages.filter(msg =>
        msg.event === 'heartbeat' || msg.event === 'heartbeat_ack'
      ).length;
      this.logTest('Heartbeat Mechanism', heartbeatCount > 0,
        `Heartbeat messages received: ${heartbeatCount}`);

      // Cleanup
      console.log('\nCleaning up...');
      await this.testAPI('DELETE', `/api/tickets/${ticket.id}`);
      await this.testAPI('DELETE', `/api/tickets/${ticket2.id}`);
      await this.testAPI('DELETE', `/api/boards/${board.id}`);

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.logTest('Test Suite Execution', false, error.message);
    }

    // Close all connections
    this.connections.forEach(ws => ws.close());

    // Print final results
    console.log('\n' + '='.repeat(60));
    console.log('🎯 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total:  ${this.testResults.total}`);
    console.log(`🏆 Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);

    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! WebSocket broadcasting is working correctly.');
      console.log('✅ Multi-window synchronization: FUNCTIONAL');
      console.log('✅ Agent-human collaboration: READY');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }

    return this.testResults.failed === 0;
  }
}

// Run the tests
if (require.main === module) {
  const tester = new WebSocketTester();
  tester.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = WebSocketTester;
