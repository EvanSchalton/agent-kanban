#!/usr/bin/env node

/**
 * User Attribution Test
 * Tests username session management and comment attribution
 */

const WebSocket = require('ws');

class UserAttributionTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
    this.sessions = {};
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

    const response = await fetch(`http://localhost:18000${url}`, options);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseData)}`);
    }

    // Extract session cookie if present
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const sessionMatch = setCookie.match(/session_id=([^;]+)/);
      if (sessionMatch) {
        return { data: responseData, sessionId: sessionMatch[1] };
      }
    }

    return { data: responseData };
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
    console.log('🚀 Starting User Attribution Tests\n');

    try {
      // Step 1: Create user sessions
      console.log('Step 1: Creating user sessions...');

      // Create session for Alice
      const aliceSession = await this.testAPI('POST', '/api/users/session', {
        username: 'Alice'
      });
      this.sessions.alice = aliceSession.data.session_id;
      console.log(`Created session for Alice: ${this.sessions.alice}`);

      // Create session for Bob
      const bobSession = await this.testAPI('POST', '/api/users/session', {
        username: 'Bob'
      });
      this.sessions.bob = bobSession.data.session_id;
      console.log(`Created session for Bob: ${this.sessions.bob}`);

      this.logTest('User Session Creation',
        aliceSession.data.username === 'Alice' && bobSession.data.username === 'Bob',
        `Alice: ${aliceSession.data.username}, Bob: ${bobSession.data.username}`);

      // Step 2: Test session retrieval
      console.log('\nStep 2: Testing session retrieval...');

      const aliceGet = await this.testAPI('GET', '/api/users/session', null, {
        'X-Session-Id': this.sessions.alice
      });

      const bobGet = await this.testAPI('GET', '/api/users/session', null, {
        'X-Session-Id': this.sessions.bob
      });

      this.logTest('Session Retrieval',
        aliceGet.data.username === 'Alice' && bobGet.data.username === 'Bob',
        `Retrieved: Alice="${aliceGet.data.username}", Bob="${bobGet.data.username}"`);

      // Step 3: Create a test board and ticket
      console.log('\nStep 3: Setting up test board and ticket...');

      const board = await this.testAPI('POST', '/api/boards/', {
        name: 'Attribution Test Board',
        description: 'Testing user attribution'
      });

      const ticket = await this.testAPI('POST', '/api/tickets/', {
        title: 'Test Ticket for Comments',
        description: 'This ticket will receive comments from multiple users',
        priority: 'medium',
        board_id: board.data.id,
        current_column: 'Not Started'
      });

      console.log(`Created board ${board.data.id} and ticket ${ticket.data.id}`);

      // Step 4: Test comment attribution
      console.log('\nStep 4: Testing comment attribution...');

      // Alice adds a comment
      const aliceComment = await this.testAPI('POST', '/api/comments/', {
        ticket_id: ticket.data.id,
        text: 'This is Alice\'s comment',
        author: 'ShouldBeOverridden'  // This should be overridden by session
      }, {
        'X-Session-Id': this.sessions.alice
      });

      // Bob adds a comment
      const bobComment = await this.testAPI('POST', '/api/comments/', {
        ticket_id: ticket.data.id,
        text: 'This is Bob\'s comment',
        author: 'ShouldBeOverridden'  // This should be overridden by session
      }, {
        'X-Session-Id': this.sessions.bob
      });

      // Anonymous user adds a comment (no session)
      const anonComment = await this.testAPI('POST', '/api/comments/', {
        ticket_id: ticket.data.id,
        text: 'This is an anonymous comment',
        author: 'Anonymous User'  // This should NOT be overridden
      });

      this.logTest('Comment Attribution',
        aliceComment.data.author === 'Alice' &&
        bobComment.data.author === 'Bob' &&
        anonComment.data.author === 'Anonymous User',
        `Alice: "${aliceComment.data.author}", Bob: "${bobComment.data.author}", Anon: "${anonComment.data.author}"`);

      // Step 5: Test WebSocket with username
      console.log('\nStep 5: Testing WebSocket with username attribution...');

      const ws = new WebSocket(`ws://localhost:18000/ws/connect?client_id=alice_client&board_id=${board.data.id}&username=Alice`);

      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          console.log('WebSocket connected with username');
          resolve();
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      });

      // Wait for connection message
      const connectionMsg = await new Promise((resolve) => {
        ws.once('message', (data) => {
          resolve(JSON.parse(data));
        });
      });

      this.logTest('WebSocket Username Attribution',
        connectionMsg.data?.username === 'Alice',
        `WebSocket username: ${connectionMsg.data?.username}`);

      ws.close();

      // Step 6: Test username update
      console.log('\nStep 6: Testing username update...');

      const updatedAlice = await this.testAPI('PUT', '/api/users/session', {
        username: 'AliceUpdated'
      }, {
        'X-Session-Id': this.sessions.alice
      });

      this.logTest('Username Update',
        updatedAlice.data.username === 'AliceUpdated',
        `Updated username: ${updatedAlice.data.username}`);

      // Step 7: Verify all comments
      console.log('\nStep 7: Verifying all comments...');

      const allComments = await this.testAPI('GET', `/api/comments/ticket/${ticket.data.id}`);

      const authors = allComments.data.map(c => c.author);
      console.log(`Comment authors: ${authors.join(', ')}`);

      this.logTest('Comment Retrieval',
        allComments.data.length === 3 &&
        authors.includes('Alice') &&
        authors.includes('Bob') &&
        authors.includes('Anonymous User'),
        `Found ${allComments.data.length} comments with correct authors`);

      // Cleanup
      console.log('\nCleaning up test data...');
      await this.testAPI('DELETE', `/api/boards/${board.data.id}`);
      await this.testAPI('DELETE', '/api/users/session', null, {
        'X-Session-Id': this.sessions.alice
      });
      await this.testAPI('DELETE', '/api/users/session', null, {
        'X-Session-Id': this.sessions.bob
      });

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.logTest('Test Suite Execution', false, error.message);
    }

    // Print results
    console.log('\n' + '='.repeat(70));
    console.log('🎯 USER ATTRIBUTION TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total:  ${this.testResults.total}`);
    console.log(`🏆 Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);

    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('✅ User sessions: WORKING');
      console.log('✅ Comment attribution: PERFECT');
      console.log('✅ WebSocket username: IMPLEMENTED');
      console.log('✅ Session management: COMPLETE');
    } else {
      console.log('\n⚠️  Some tests failed. Review the issues above.');
    }

    return this.testResults.failed === 0;
  }
}

if (require.main === module) {
  const tester = new UserAttributionTest();
  tester.runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}
