#!/usr/bin/env node
/**
 * Final API Integration Test
 * Comprehensive test of all API endpoints including boards, tickets, comments, WebSocket, and health
 */

const WebSocket = require('ws');

class FinalAPIIntegrationTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
    this.baseUrl = 'http://localhost:8000';  // Test on port 8000 as requested
    this.wsUrl = 'ws://localhost:8000';
    this.testData = {};
    this.wsConnections = [];
  }

  async testAPI(method, url, data = null, headers = {}) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (data) options.body = JSON.stringify(data);

    const response = await fetch(`${this.baseUrl}${url}`, options);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseData)}`);
    }

    return { data: responseData, status: response.status };
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

  async createWebSocketConnection(clientId, boardId = null, username = null) {
    let url = `${this.wsUrl}/ws/connect?client_id=${clientId}`;
    if (boardId) url += `&board_id=${boardId}`;
    if (username) url += `&username=${username}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);

      ws.on('open', () => {
        ws.clientId = clientId;
        ws.messages = [];
        this.wsConnections.push(ws);
        resolve(ws);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          ws.messages.push(message);
        } catch (e) {
          console.error(`Parse error for ${clientId}:`, e);
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error(`WebSocket timeout for ${clientId}`)), 5000);
    });
  }

  async runTests() {
    console.log('🚀 Starting Final API Integration Test\n');
    console.log(`Testing API at: ${this.baseUrl}`);
    console.log(`Testing WebSocket at: ${this.wsUrl}\n`);

    try {
      // Test 1: Health Endpoint
      console.log('=== HEALTH ENDPOINT TESTS ===');

      const healthResponse = await this.testAPI('GET', '/api/health/');
      this.logTest('Health Check - Comprehensive',
        healthResponse.data.status === 'healthy' &&
        healthResponse.data.database?.status === 'connected' &&
        healthResponse.data.server?.uptime,
        `Status: ${healthResponse.data.status}, DB: ${healthResponse.data.database?.status}`);

      const simpleHealthResponse = await this.testAPI('GET', '/api/health/simple');
      this.logTest('Health Check - Simple',
        simpleHealthResponse.data.status === 'ok',
        `Status: ${simpleHealthResponse.data.status}`);

      // Test 2: User Session Management
      console.log('\n=== USER SESSION TESTS ===');

      const userSession = await this.testAPI('POST', '/api/users/session', {
        username: 'IntegrationTestUser'
      });
      this.testData.sessionId = userSession.data.session_id;
      this.logTest('User Session Creation',
        userSession.data.username === 'IntegrationTestUser' && userSession.data.session_id,
        `User: ${userSession.data.username}, ID: ${userSession.data.session_id.substring(0, 8)}...`);

      const sessionRetrieve = await this.testAPI('GET', '/api/users/session', null, {
        'X-Session-Id': this.testData.sessionId
      });
      this.logTest('User Session Retrieval',
        sessionRetrieve.data.username === 'IntegrationTestUser',
        `Retrieved user: ${sessionRetrieve.data.username}`);

      // Test 3: Board Management
      console.log('\n=== BOARD MANAGEMENT TESTS ===');

      const boardsListBefore = await this.testAPI('GET', '/api/boards/');
      const initialBoardCount = boardsListBefore.data.length;

      const newBoard = await this.testAPI('POST', '/api/boards/', {
        name: 'Integration Test Board',
        description: 'Board created during final API integration test',
        columns: ['Backlog', 'In Progress', 'Testing', 'Done']
      });
      this.testData.boardId = newBoard.data.id;
      this.logTest('Board Creation',
        newBoard.data.name === 'Integration Test Board' && newBoard.data.id,
        `Board ID: ${newBoard.data.id}, Name: ${newBoard.data.name}`);

      const boardDetail = await this.testAPI('GET', `/api/boards/${this.testData.boardId}`);
      this.logTest('Board Retrieval',
        boardDetail.data.id === this.testData.boardId && boardDetail.data.columns.length === 4,
        `Columns: ${boardDetail.data.columns.join(', ')}`);

      const boardsListAfter = await this.testAPI('GET', '/api/boards/');
      this.logTest('Board List Update',
        boardsListAfter.data.length === initialBoardCount + 1,
        `Board count increased from ${initialBoardCount} to ${boardsListAfter.data.length}`);

      // Test 4: Ticket Management
      console.log('\n=== TICKET MANAGEMENT TESTS ===');

      const newTicket = await this.testAPI('POST', '/api/tickets/', {
        title: 'Integration Test Ticket',
        description: 'Ticket for testing API integration',
        priority: 'high',
        board_id: this.testData.boardId,
        current_column: 'Backlog',
        created_by: 'IntegrationTestUser'
      }, {
        'X-Session-Id': this.testData.sessionId
      });
      this.testData.ticketId = newTicket.data.id;
      this.logTest('Ticket Creation',
        newTicket.data.title === 'Integration Test Ticket' && newTicket.data.id,
        `Ticket ID: ${newTicket.data.id}, Priority: ${newTicket.data.priority}`);

      const ticketDetail = await this.testAPI('GET', `/api/tickets/${this.testData.ticketId}`);
      this.logTest('Ticket Retrieval',
        ticketDetail.data.id === this.testData.ticketId && ticketDetail.data.current_column === 'Backlog',
        `Column: ${ticketDetail.data.current_column}`);

      const ticketUpdate = await this.testAPI('PUT', `/api/tickets/${this.testData.ticketId}`, {
        title: 'Updated Integration Test Ticket',
        priority: 'critical',
        changed_by: 'IntegrationTestUser'
      }, {
        'X-Session-Id': this.testData.sessionId
      });
      this.logTest('Ticket Update',
        ticketUpdate.data.title === 'Updated Integration Test Ticket' && ticketUpdate.data.priority === 'critical',
        `Updated title and priority`);

      const ticketMove = await this.testAPI('POST', `/api/tickets/${this.testData.ticketId}/move`, {
        column: 'In Progress',
        moved_by: 'IntegrationTestUser'
      });
      this.logTest('Ticket Move',
        ticketMove.data.current_column === 'In Progress',
        `Moved to: ${ticketMove.data.current_column}`);

      const ticketsList = await this.testAPI('GET', `/api/tickets/?board_id=${this.testData.boardId}`);
      this.logTest('Tickets List by Board',
        ticketsList.data.items.length >= 1 && ticketsList.data.items[0].board_id === this.testData.boardId,
        `Found ${ticketsList.data.items.length} tickets for board ${this.testData.boardId}`);

      // Test 5: Comment Management
      console.log('\n=== COMMENT MANAGEMENT TESTS ===');

      const newComment = await this.testAPI('POST', '/api/comments/', {
        ticket_id: this.testData.ticketId,
        text: 'This is a test comment for API integration',
        author: 'CommentAuthor'
      }, {
        'X-Session-Id': this.testData.sessionId
      });
      this.testData.commentId = newComment.data.id;
      this.logTest('Comment Creation with User Attribution',
        newComment.data.text === 'This is a test comment for API integration' &&
        newComment.data.author === 'IntegrationTestUser', // Should be overridden by session
        `Comment ID: ${newComment.data.id}, Author: ${newComment.data.author}`);

      const anonComment = await this.testAPI('POST', '/api/comments/', {
        ticket_id: this.testData.ticketId,
        text: 'Anonymous comment without session',
        author: 'Anonymous User'
      });
      this.logTest('Comment Creation without Session',
        anonComment.data.author === 'Anonymous User',
        `Anonymous author preserved: ${anonComment.data.author}`);

      const commentsList = await this.testAPI('GET', `/api/comments/ticket/${this.testData.ticketId}`);
      this.logTest('Comments Retrieval',
        commentsList.data.length >= 2,
        `Found ${commentsList.data.length} comments on ticket`);

      // Test 6: WebSocket Integration
      console.log('\n=== WEBSOCKET INTEGRATION TESTS ===');

      const ws1 = await this.createWebSocketConnection('integration_test_1', this.testData.boardId, 'TestUser1');
      const ws2 = await this.createWebSocketConnection('integration_test_2', this.testData.boardId, 'TestUser2');
      this.logTest('WebSocket Connections',
        this.wsConnections.length === 2,
        `Created ${this.wsConnections.length} WebSocket connections`);

      // Wait for connection messages
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear messages and test real-time updates
      this.wsConnections.forEach(ws => ws.messages = []);

      // Create a ticket to trigger WebSocket events
      const wsTestTicket = await this.testAPI('POST', '/api/tickets/', {
        title: 'WebSocket Test Ticket',
        description: 'Testing real-time updates',
        priority: 'medium',
        board_id: this.testData.boardId,
        current_column: 'Backlog'
      });

      // Wait for WebSocket messages
      await new Promise(resolve => setTimeout(resolve, 2000));

      const ws1ReceivedTicketCreated = ws1.messages.some(msg => msg.event === 'ticket_created');
      const ws2ReceivedTicketCreated = ws2.messages.some(msg => msg.event === 'ticket_created');

      this.logTest('WebSocket Real-time Updates',
        ws1ReceivedTicketCreated && ws2ReceivedTicketCreated,
        `Both clients received ticket_created event`);

      // Test 7: Bulk Operations
      console.log('\n=== BULK OPERATIONS TESTS ===');

      const bulkMove = await this.testAPI('POST', '/api/bulk/tickets/move', {
        ticket_ids: [this.testData.ticketId, wsTestTicket.data.id],
        target_column: 'Testing',
        moved_by: 'IntegrationTestUser'
      });
      this.logTest('Bulk Ticket Move',
        bulkMove.data.results && bulkMove.data.results.length === 2,
        `Moved ${bulkMove.data.results?.length || 0} tickets to Testing`);

      // Test 8: Statistics
      console.log('\n=== STATISTICS TESTS ===');

      const boardStats = await this.testAPI('GET', `/api/statistics/boards/${this.testData.boardId}/statistics`);
      this.logTest('Board Statistics',
        boardStats.data.board_id === this.testData.boardId && boardStats.data.column_statistics,
        `Board ${boardStats.data.board_id} has column statistics for ${Object.keys(boardStats.data.column_statistics || {}).length} columns`);

      // Test 9: History Tracking
      console.log('\n=== HISTORY TRACKING TESTS ===');

      const ticketHistory = await this.testAPI('GET', `/api/history/tickets/${this.testData.ticketId}/history`);
      this.logTest('Ticket History',
        ticketHistory.data.length >= 3, // Creation, update, move, bulk update
        `Found ${ticketHistory.data.length} history entries`);

      // Test 10: Authentication Endpoints
      console.log('\n=== AUTHENTICATION ENDPOINT TESTS ===');

      try {
        const authTest = await this.testAPI('GET', '/api/auth/me');
        this.logTest('Auth Endpoint Accessibility', false, 'Auth endpoint should require authentication');
      } catch (error) {
        this.logTest('Auth Endpoint Security',
          error.message.includes('401') || error.message.includes('403'),
          'Auth endpoint properly secured');
      }

      // Test 11: Error Handling
      console.log('\n=== ERROR HANDLING TESTS ===');

      try {
        await this.testAPI('GET', '/api/tickets/99999');
        this.logTest('404 Error Handling', false, 'Should return 404 for non-existent ticket');
      } catch (error) {
        this.logTest('404 Error Handling',
          error.message.includes('404'),
          'Properly returns 404 for non-existent resources');
      }

      try {
        await this.testAPI('POST', '/api/tickets/', {
          title: 'Invalid Ticket',
          board_id: 99999  // Non-existent board
        });
        this.logTest('Validation Error Handling', false, 'Should validate board existence');
      } catch (error) {
        this.logTest('Validation Error Handling',
          error.message.includes('404') || error.message.includes('400'),
          'Properly validates required relationships');
      }

      // Test 12: Board-specific Endpoints
      console.log('\n=== BOARD-SPECIFIC ENDPOINT TESTS ===');

      const boardTickets = await this.testAPI('GET', `/api/boards/${this.testData.boardId}/tickets`);
      this.logTest('Board-Specific Tickets',
        boardTickets.data.board_id === this.testData.boardId && boardTickets.data.tickets.length >= 2,
        `Board ${boardTickets.data.board_id} has ${boardTickets.data.total_tickets} tickets`);

      const boardColumns = await this.testAPI('GET', `/api/boards/${this.testData.boardId}/columns`);
      this.logTest('Board Columns',
        Array.isArray(boardColumns.data) && boardColumns.data.includes('Backlog'),
        `Columns: ${boardColumns.data.join(', ')}`);

      // Cleanup test data
      console.log('\n=== CLEANUP ===');

      // Close WebSocket connections
      this.wsConnections.forEach(ws => ws.close());

      // Delete test board (cascades to tickets and comments)
      await this.testAPI('DELETE', `/api/boards/${this.testData.boardId}`);
      console.log('✅ Test data cleaned up');

      // Final health check
      const finalHealth = await this.testAPI('GET', '/api/health/');
      this.logTest('Final Health Check',
        finalHealth.data.status === 'healthy',
        `System remains healthy after all tests`);

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.logTest('Test Suite Execution', false, error.message);
    }

    // Print results
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL API INTEGRATION TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total:  ${this.testResults.total}`);
    console.log(`🏆 Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);

    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('✅ Health endpoints: WORKING');
      console.log('✅ Board management: FUNCTIONAL');
      console.log('✅ Ticket operations: COMPLETE');
      console.log('✅ Comment system: OPERATIONAL');
      console.log('✅ WebSocket real-time: ACTIVE');
      console.log('✅ User attribution: WORKING');
      console.log('✅ Bulk operations: FUNCTIONAL');
      console.log('✅ Statistics: AVAILABLE');
      console.log('✅ History tracking: ACTIVE');
      console.log('✅ Error handling: PROPER');
      console.log('✅ Authentication: SECURED');
      console.log('\n🚀 API IS PRODUCTION READY! 🚀');
    } else {
      console.log('\n⚠️  Some tests failed. Review the issues above.');
      console.log('🔧 Fix the failing components before production deployment.');
    }

    return this.testResults.failed === 0;
  }
}

if (require.main === module) {
  const tester = new FinalAPIIntegrationTest();
  tester.runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}
