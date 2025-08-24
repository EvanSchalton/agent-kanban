#!/usr/bin/env node
/**
 * Health Check Test
 * Tests the health check endpoints and validates all metrics
 */

const WebSocket = require('ws');

class HealthCheckTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
    this.connections = [];
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

  async createWebSocketConnections(count = 3) {
    console.log(`Creating ${count} test WebSocket connections...`);

    for (let i = 0; i < count; i++) {
      const ws = new WebSocket(`ws://localhost:18000/ws/connect?client_id=health_test_${i}&username=HealthTest${i}`);

      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          console.log(`✅ WebSocket ${i} connected`);
          this.connections.push(ws);
          resolve();
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error(`WebSocket ${i} timeout`)), 3000);
      });
    }
  }

  async runTests() {
    console.log('🚀 Starting Health Check Tests\n');

    try {
      // Test 1: Simple health check
      console.log('Test 1: Simple health check...');
      const simple = await this.testAPI('GET', '/api/health/simple');

      this.logTest('Simple Health Check',
        simple.status === 'ok' && simple.timestamp,
        `Status: ${simple.status}, Time: ${simple.timestamp}`);

      // Test 2: Create some test data and WebSocket connections
      console.log('\nTest 2: Setting up test environment...');

      // Create a test board
      const board = await this.testAPI('POST', '/api/boards/', {
        name: 'Health Test Board',
        description: 'Board created for health check testing'
      });

      // Create test tickets
      const ticket1 = await this.testAPI('POST', '/api/tickets/', {
        title: 'Health Test Ticket 1',
        description: 'Test ticket for health metrics',
        priority: 'high',
        board_id: board.id,
        current_column: 'Not Started'
      });

      const ticket2 = await this.testAPI('POST', '/api/tickets/', {
        title: 'Health Test Ticket 2',
        description: 'Another test ticket',
        priority: 'medium',
        board_id: board.id,
        current_column: 'In Progress'
      });

      // Create test comments
      await this.testAPI('POST', '/api/comments/', {
        ticket_id: ticket1.id,
        text: 'Health check test comment',
        author: 'Health Tester'
      });

      // Create WebSocket connections
      await this.createWebSocketConnections(3);

      console.log('✅ Test environment setup complete\n');

      // Test 3: Comprehensive health check
      console.log('Test 3: Comprehensive health check...');
      const health = await this.testAPI('GET', '/api/health/');

      // Validate overall status
      this.logTest('Overall Health Status',
        health.status === 'healthy',
        `Status: ${health.status}`);

      // Validate server info
      this.logTest('Server Information',
        health.server && health.server.name && health.server.uptime,
        `Name: ${health.server?.name}, Uptime: ${health.server?.uptime?.human_readable}`);

      // Validate database status
      this.logTest('Database Connection',
        health.database?.status === 'connected',
        `Status: ${health.database?.status}`);

      // Validate database statistics
      const dbStats = health.database?.statistics;
      this.logTest('Database Statistics',
        dbStats && typeof dbStats.boards === 'number' && typeof dbStats.tickets === 'number',
        `Boards: ${dbStats?.boards}, Tickets: ${dbStats?.tickets}, Comments: ${dbStats?.comments}`);

      // Validate WebSocket status
      this.logTest('WebSocket Status',
        health.websocket?.status === 'active' && health.websocket?.active_connections >= 3,
        `Status: ${health.websocket?.status}, Connections: ${health.websocket?.active_connections}`);

      // Validate metrics
      this.logTest('Performance Metrics',
        health.metrics && typeof health.metrics.average_tickets_per_board === 'number',
        `Avg tickets/board: ${health.metrics?.average_tickets_per_board}`);

      // Validate system resources
      this.logTest('System Resources',
        health.resources && health.resources.cpu && health.resources.memory,
        `CPU: ${health.resources?.cpu?.usage_percent}%, Memory: ${health.resources?.memory?.percent}%`);

      // Validate recent activity
      this.logTest('Recent Activity Tracking',
        Array.isArray(health.recent_activity),
        `Recent changes: ${health.recent_activity?.length || 0}`);

      // Validate user sessions
      this.logTest('User Sessions',
        health.sessions && typeof health.sessions.active_count === 'number',
        `Active sessions: ${health.sessions?.active_count}`);

      // Test 4: Check ticket distribution
      console.log('\nTest 4: Validating data distributions...');

      const ticketDist = health.database?.statistics?.ticket_distribution;
      const priorityDist = health.database?.statistics?.priority_distribution;

      this.logTest('Ticket Distribution',
        ticketDist && Object.keys(ticketDist).length > 0,
        `Columns: ${Object.keys(ticketDist || {}).join(', ')}`);

      this.logTest('Priority Distribution',
        priorityDist && Object.keys(priorityDist).length > 0,
        `Priorities: ${Object.keys(priorityDist || {}).join(', ')}`);

      // Test 5: Validate board subscriptions
      console.log('\nTest 5: WebSocket board subscriptions...');

      const boardSubs = health.websocket?.board_subscriptions;
      this.logTest('Board Subscriptions',
        boardSubs && Object.keys(boardSubs).length > 0,
        `Subscribed boards: ${Object.keys(boardSubs || {}).join(', ')}`);

      // Test 6: Performance under load
      console.log('\nTest 6: Health check performance...');

      const startTime = Date.now();
      await this.testAPI('GET', '/api/health/');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      this.logTest('Response Time Performance',
        responseTime < 1000,
        `Response time: ${responseTime}ms`);

      // Cleanup
      console.log('\nCleaning up test data...');

      // Close WebSocket connections
      this.connections.forEach(ws => ws.close());

      // Delete test board (cascades to tickets and comments)
      await this.testAPI('DELETE', `/api/boards/${board.id}`);

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.logTest('Test Suite Execution', false, error.message);
    }

    // Print results
    console.log('\n' + '='.repeat(70));
    console.log('🎯 HEALTH CHECK TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total:  ${this.testResults.total}`);
    console.log(`🏆 Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);

    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('✅ Health check endpoint: WORKING');
      console.log('✅ Database monitoring: ACTIVE');
      console.log('✅ WebSocket tracking: FUNCTIONAL');
      console.log('✅ System metrics: AVAILABLE');
      console.log('✅ Performance monitoring: IMPLEMENTED');
    } else {
      console.log('\n⚠️  Some tests failed. Review the issues above.');
    }

    return this.testResults.failed === 0;
  }
}

if (require.main === module) {
  const tester = new HealthCheckTest();
  tester.runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}
