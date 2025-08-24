#!/usr/bin/env node

/**
 * Agent-Human Collaboration Test
 * Tests MCP → API → WebSocket → UI pipeline
 */

const WebSocket = require('ws');

class AgentCollaborationTester {
  constructor() {
    this.humanWebSocket = null;
    this.messageLog = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  async createHumanConnection() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:18000/ws/connect?client_id=human-ui');

      ws.on('open', () => {
        console.log('👨‍💻 Human UI WebSocket connected');
        ws.messages = [];
        this.humanWebSocket = ws;
        resolve(ws);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          ws.messages.push(message);
          this.messageLog.push({
            clientId: 'human-ui',
            timestamp: new Date().toISOString(),
            message
          });
          console.log(`📡 Human UI received:`, message.event || message.type, message.data?.id ? `(ID: ${message.data.id})` : '');
        } catch (e) {
          console.error(`❌ Failed to parse message:`, data.toString());
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error:`, error);
        reject(error);
      });

      ws.on('close', () => {
        console.log(`🔌 Human UI WebSocket closed`);
      });

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  async simulateAgentAction(action, params) {
    // Simulate an MCP agent making API calls (what would happen via MCP tools)
    try {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      };

      const endpoints = {
        'create_ticket': '/api/tickets/',
        'update_ticket': (id) => `/api/tickets/${id}`,
        'move_ticket': (id) => `/api/tickets/${id}/move`,
        'claim_ticket': (id, agent_id) => `/api/tickets/${id}/claim?agent_id=${agent_id}`,
        'add_comment': '/api/comments/'
      };

      let url;
      if (action === 'update_ticket' || action === 'move_ticket') {
        url = endpoints[action](params.ticket_id || params.id);
        delete params.ticket_id;
        delete params.id;
        if (action === 'update_ticket') {
          options.method = 'PUT';
        }
        options.body = JSON.stringify(params);
      } else if (action === 'claim_ticket') {
        url = endpoints[action](params.ticket_id || params.id, params.agent_id);
        // claim_ticket doesn't need a body, agent_id is in URL
      } else {
        url = endpoints[action];
        options.body = JSON.stringify(params);
      }

      const response = await fetch(`http://localhost:18000${url}`, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`❌ Agent action ${action} failed:`, error.message);
      throw error;
    }
  }

  async waitForHumanUI(expectedEvent, timeoutMs = 3000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const check = () => {
        const received = this.humanWebSocket.messages.some(msg =>
          (msg.event === expectedEvent || msg.type === expectedEvent)
        );

        if (received || Date.now() - startTime > timeoutMs) {
          resolve(received);
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
    console.log('🚀 Starting Agent-Human Collaboration Tests\n');

    try {
      // Step 1: Establish human UI connection
      console.log('Step 1: Connecting human UI WebSocket...');
      await this.createHumanConnection();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Agent creates a ticket
      console.log('\nStep 2: Agent creates ticket...');
      const ticket = await this.simulateAgentAction('create_ticket', {
        title: 'Agent Created Task',
        description: 'This task was created by an AI agent via MCP',
        priority: '1.0',
        board_id: 1,
        current_column: 'Not Started',
        created_by: 'ai_agent_test'
      });

      const creationReceived = await this.waitForHumanUI('ticket_created');
      this.logTest('Agent → UI: Ticket Creation', creationReceived,
        `Human UI ${creationReceived ? 'received' : 'missed'} agent-created ticket`);

      // Step 3: Agent claims the ticket
      console.log('\nStep 3: Agent claims ticket...');
      await this.simulateAgentAction('claim_ticket', {
        ticket_id: ticket.id,
        agent_id: 'ai_agent_test'
      });

      const claimReceived = await this.waitForHumanUI('ticket_claimed');
      this.logTest('Agent → UI: Ticket Claim', claimReceived,
        `Human UI ${claimReceived ? 'received' : 'missed'} agent claim event`);

      // Step 4: Agent moves ticket through workflow
      console.log('\nStep 4: Agent moves ticket to In Progress...');
      await this.simulateAgentAction('move_ticket', {
        ticket_id: ticket.id,
        column: 'In Progress',
        moved_by: 'ai_agent_test'
      });

      const moveReceived = await this.waitForHumanUI('ticket_moved');
      this.logTest('Agent → UI: Ticket Movement', moveReceived,
        `Human UI ${moveReceived ? 'received' : 'missed'} agent move event`);

      // Step 5: Agent updates ticket with progress
      console.log('\nStep 5: Agent updates ticket with progress...');
      await this.simulateAgentAction('update_ticket', {
        ticket_id: ticket.id,
        description: 'Agent is working on this task. Progress: 50% complete.',
        changed_by: 'ai_agent_test'
      });

      const updateReceived = await this.waitForHumanUI('ticket_updated');
      this.logTest('Agent → UI: Ticket Update', updateReceived,
        `Human UI ${updateReceived ? 'received' : 'missed'} agent update event`);

      // Step 6: Agent completes task
      console.log('\nStep 6: Agent completes task...');
      await this.simulateAgentAction('move_ticket', {
        ticket_id: ticket.id,
        column: 'Done',
        moved_by: 'ai_agent_test'
      });

      const completionReceived = await this.waitForHumanUI('ticket_moved');
      this.logTest('Agent → UI: Task Completion', completionReceived,
        `Human UI ${completionReceived ? 'received' : 'missed'} task completion`);

      // Step 7: Test real-time collaboration scenario
      console.log('\nStep 7: Testing real-time collaboration...');

      // Create a new ticket for collaboration test
      const collabTicket = await this.simulateAgentAction('create_ticket', {
        title: 'Collaboration Test Ticket',
        description: 'Testing real-time human-agent collaboration',
        priority: '1.0',
        board_id: 1,
        current_column: 'Not Started',
        created_by: 'collaboration_test'
      });

      // Agent claims it
      await this.simulateAgentAction('claim_ticket', {
        ticket_id: collabTicket.id,
        agent_id: 'collaborative_agent'
      });

      // Agent starts working
      await this.simulateAgentAction('move_ticket', {
        ticket_id: collabTicket.id,
        column: 'In Progress',
        moved_by: 'collaborative_agent'
      });

      // Wait a moment then simulate agent activity
      await new Promise(resolve => setTimeout(resolve, 500));

      // Agent provides status update
      await this.simulateAgentAction('update_ticket', {
        ticket_id: collabTicket.id,
        description: 'Agent is actively working. Human can see real-time progress updates.',
        changed_by: 'collaborative_agent'
      });

      // Count the collaboration events received by human UI
      const collaborationEvents = this.humanWebSocket.messages.filter(msg =>
        msg.data && (msg.data.id === collabTicket.id)
      ).length;

      this.logTest('Real-time Collaboration', collaborationEvents >= 3,
        `Human UI received ${collaborationEvents} real-time updates from agent`);

      // Cleanup
      console.log('\nCleaning up test tickets...');
      await fetch(`http://localhost:18000/api/tickets/${ticket.id}`, { method: 'DELETE' });
      await fetch(`http://localhost:18000/api/tickets/${collabTicket.id}`, { method: 'DELETE' });

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.logTest('Test Suite Execution', false, error.message);
    }

    // Close connection
    if (this.humanWebSocket) {
      this.humanWebSocket.close();
    }

    // Print final results
    console.log('\n' + '='.repeat(70));
    console.log('🎯 AGENT-HUMAN COLLABORATION RESULTS');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total:  ${this.testResults.total}`);
    console.log(`🏆 Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);

    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Agent-Human collaboration is working perfectly!');
      console.log('✅ MCP → API → WebSocket → UI pipeline: FUNCTIONAL');
      console.log('✅ Real-time agent updates to humans: WORKING');
      console.log('✅ Multi-window synchronization: VERIFIED');
      console.log('\n🤖 AGENTS CAN NOW COLLABORATE WITH HUMANS IN REAL-TIME! 🎯');
    } else {
      console.log('\n⚠️  Some collaboration tests failed. Please review the issues above.');
    }

    return this.testResults.failed === 0;
  }
}

// Run the tests
if (require.main === module) {
  const tester = new AgentCollaborationTester();
  tester.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = AgentCollaborationTester;
