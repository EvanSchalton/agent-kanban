#!/usr/bin/env node

/**
 * Continuous Test Runner for Agent Kanban
 * Runs tests continuously while idle, prioritizing critical paths
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ContinuousTestRunner {
  constructor() {
    this.isRunning = false;
    this.testQueue = [
      // Priority order - most critical first
      'drag-drop-critical.spec.ts',
      'critical-paths.spec.ts',
      'websocket-realtime.spec.ts',
      'accessibility.spec.ts'
    ];
    this.currentTest = 0;
    this.results = {};
    this.runCount = 0;
    this.startTime = new Date();
  }

  async runTest(testFile) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      console.log(`\n🧪 Running: ${testFile}`);

      exec(`npx playwright test tests/e2e/${testFile} --reporter=json`, (error, stdout, stderr) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        let result = {
          testFile,
          duration,
          timestamp: new Date().toISOString(),
          passed: !error,
          output: stdout,
          error: stderr
        };

        if (error) {
          console.log(`❌ ${testFile} - FAILED (${duration}ms)`);
          result.exitCode = error.code;
        } else {
          console.log(`✅ ${testFile} - PASSED (${duration}ms)`);
        }

        // Parse JSON output if available
        try {
          if (stdout.includes('"stats"')) {
            const jsonMatch = stdout.match(/\{.*"stats".*\}/s);
            if (jsonMatch) {
              result.testResults = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }

        this.results[testFile] = result;
        resolve(result);
      });
    });
  }

  async runTestSuite() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.runCount++;

    console.log(`\n🚀 Starting test run #${this.runCount} at ${new Date().toLocaleTimeString()}`);
    console.log('─'.repeat(60));

    const suiteStartTime = Date.now();
    const suiteResults = [];

    for (const testFile of this.testQueue) {
      const result = await this.runTest(testFile);
      suiteResults.push(result);

      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const suiteEndTime = Date.now();
    const totalDuration = suiteEndTime - suiteStartTime;

    this.generateReport(suiteResults, totalDuration);
    this.isRunning = false;

    // Schedule next run
    this.scheduleNextRun();
  }

  generateReport(suiteResults, totalDuration) {
    const passed = suiteResults.filter(r => r.passed).length;
    const failed = suiteResults.filter(r => !r.passed).length;

    console.log('\n📊 Test Suite Results');
    console.log('─'.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`🏃 Run #${this.runCount}`);

    // Detailed results
    console.log('\n📋 Detailed Results:');
    suiteResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = Math.round(result.duration / 1000);
      console.log(`${status} ${result.testFile.padEnd(30)} ${duration}s`);

      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error.split('\n')[0]}`);
      }
    });

    // Save results to file
    this.saveResults(suiteResults, totalDuration);
  }

  saveResults(suiteResults, totalDuration) {
    const reportData = {
      timestamp: new Date().toISOString(),
      runNumber: this.runCount,
      totalDuration,
      summary: {
        passed: suiteResults.filter(r => r.passed).length,
        failed: suiteResults.filter(r => !r.passed).length,
        total: suiteResults.length
      },
      results: suiteResults,
      environment: {
        node: process.version,
        platform: process.platform,
        uptime: process.uptime()
      }
    };

    const reportPath = path.join(__dirname, '..', 'results', `test-run-${this.runCount}-${Date.now()}.json`);

    // Ensure results directory exists
    const resultsDir = path.dirname(reportPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Results saved to: ${reportPath}`);

    // Also save latest results
    const latestPath = path.join(resultsDir, 'latest-results.json');
    fs.writeFileSync(latestPath, JSON.stringify(reportData, null, 2));
  }

  scheduleNextRun() {
    // Run every 10 minutes during active development
    const interval = 10 * 60 * 1000; // 10 minutes

    console.log(`\n⏰ Next test run scheduled in ${interval / 1000 / 60} minutes`);
    console.log(`   Use Ctrl+C to stop continuous testing`);

    setTimeout(() => {
      this.runTestSuite();
    }, interval);
  }

  async checkServices() {
    console.log('🔍 Checking services...');

    // Check if backend is running
    try {
      const response = await fetch('http://localhost:8000/api/health');
      if (response.ok) {
        console.log('✅ Backend service is running');
      } else {
        console.log('⚠️  Backend service responded with error');
      }
    } catch (e) {
      console.log('❌ Backend service is not accessible');
      console.log('   Please start backend: cd backend && python run.py');
    }

    // Check if frontend is running
    try {
      const response = await fetch('http://localhost:5173');
      if (response.ok) {
        console.log('✅ Frontend service is running');
      } else {
        console.log('⚠️  Frontend service responded with error');
      }
    } catch (e) {
      console.log('❌ Frontend service is not accessible');
      console.log('   Please start frontend: cd frontend && npm run dev');
    }
  }

  async start() {
    console.log('🎯 Agent Kanban Continuous Test Runner');
    console.log('=====================================');
    console.log(`Started at: ${this.startTime.toLocaleString()}`);

    await this.checkServices();

    // Run initial test suite
    setTimeout(() => {
      this.runTestSuite();
    }, 2000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping continuous test runner...');
      console.log(`Total runs completed: ${this.runCount}`);
      console.log(`Runtime: ${Math.round((Date.now() - this.startTime.getTime()) / 1000 / 60)} minutes`);
      process.exit(0);
    });
  }

  // Manual test run for specific test
  async runSpecificTest(testFile) {
    console.log(`\n🎯 Running specific test: ${testFile}`);
    const result = await this.runTest(testFile);

    console.log('\n📊 Single Test Result:');
    console.log(`${result.passed ? '✅' : '❌'} ${result.testFile}`);
    console.log(`Duration: ${Math.round(result.duration / 1000)}s`);

    if (!result.passed) {
      console.log('Error details:');
      console.log(result.error);
    }

    return result;
  }
}

// CLI interface
const args = process.argv.slice(2);
const runner = new ContinuousTestRunner();

if (args.length > 0) {
  const command = args[0];

  if (command === 'run' && args[1]) {
    // Run specific test
    runner.runSpecificTest(args[1]).then(() => process.exit(0));
  } else if (command === 'once') {
    // Run suite once
    runner.runTestSuite().then(() => process.exit(0));
  } else if (command === 'help') {
    console.log('Agent Kanban Test Runner');
    console.log('');
    console.log('Usage:');
    console.log('  node test-runner.js           # Start continuous testing');
    console.log('  node test-runner.js once      # Run test suite once');
    console.log('  node test-runner.js run <test> # Run specific test');
    console.log('  node test-runner.js help      # Show this help');
    console.log('');
    console.log('Available tests:');
    runner.testQueue.forEach(test => console.log(`  - ${test}`));
    process.exit(0);
  } else {
    console.log('Unknown command. Use "help" for usage information.');
    process.exit(1);
  }
} else {
  // Start continuous testing
  runner.start();
}

module.exports = ContinuousTestRunner;
