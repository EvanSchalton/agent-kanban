#!/usr/bin/env node

/**
 * CONTINUOUS TEST MONITORING RUNNER
 *
 * Emergency test monitoring system that runs critical tests continuously
 * while the team works on fixes. Provides real-time feedback on system stability.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ContinuousTestMonitor {
  constructor() {
    this.isRunning = false;
    this.testResults = [];
    this.currentCycle = 0;
    this.maxCycles = process.env.MAX_CYCLES ? parseInt(process.env.MAX_CYCLES) : 50;
    this.intervalMs = process.env.INTERVAL_MS ? parseInt(process.env.INTERVAL_MS) : 30000; // 30 seconds
    this.resultsDir = path.join(__dirname, 'results');
    this.logFile = path.join(this.resultsDir, `monitor-${Date.now()}.log`);

    // Critical test specifications
    this.criticalTests = [
      {
        name: 'Critical Regression Suite',
        file: 'tests/e2e/critical-regression-suite.spec.ts',
        maxFailures: 2,
        priority: 'P0'
      },
      {
        name: 'WebSocket Monitoring',
        file: 'tests/e2e/websocket-monitoring.spec.ts',
        maxFailures: 3,
        priority: 'P0'
      },
      {
        name: 'Card Creation Fix Validation',
        file: 'tests/e2e/card-creation-fix-validation.spec.ts',
        maxFailures: 1,
        priority: 'P0'
      }
    ];

    this.setupResultsDirectory();
    this.setupSignalHandlers();
  }

  setupResultsDirectory() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  setupSignalHandlers() {
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down continuous monitor...');
      this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down continuous monitor...');
      this.stop();
      process.exit(0);
    });
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    console.log(logEntry);

    if (fs.existsSync(this.logFile)) {
      fs.appendFileSync(this.logFile, logEntry + '\n');
    } else {
      fs.writeFileSync(this.logFile, logEntry + '\n');
    }
  }

  async start() {
    if (this.isRunning) {
      this.log('Monitor is already running', 'WARN');
      return;
    }

    this.isRunning = true;
    this.log('🚀 Starting Continuous Test Monitor', 'INFO');
    this.log(`📊 Running ${this.criticalTests.length} critical test suites every ${this.intervalMs/1000}s`, 'INFO');
    this.log(`🎯 Max cycles: ${this.maxCycles}`, 'INFO');
    this.log(`📝 Logging to: ${this.logFile}`, 'INFO');

    // Initial health check
    await this.performHealthCheck();

    // Start monitoring loop
    this.monitoringLoop();
  }

  stop() {
    this.isRunning = false;
    this.log('🛑 Continuous monitor stopped', 'INFO');
    this.generateSummaryReport();
  }

  async performHealthCheck() {
    this.log('🔍 Performing initial health check...', 'INFO');

    // Check if servers are running
    const serverChecks = [
      { name: 'Frontend', url: 'http://localhost:5173', port: 5173 },
      { name: 'Backend', url: 'http://localhost:18000', port: 18000 }
    ];

    for (const check of serverChecks) {
      try {
        const response = await this.checkServer(check.url);
        if (response) {
          this.log(`✅ ${check.name} server is running`, 'INFO');
        } else {
          this.log(`❌ ${check.name} server is not responding`, 'ERROR');
        }
      } catch (error) {
        this.log(`❌ ${check.name} server check failed: ${error.message}`, 'ERROR');
      }
    }
  }

  async checkServer(url) {
    return new Promise((resolve) => {
      const http = require('http');
      const request = http.get(url, (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 404);
      });

      request.on('error', () => resolve(false));
      request.setTimeout(5000, () => {
        request.destroy();
        resolve(false);
      });
    });
  }

  async monitoringLoop() {
    while (this.isRunning && this.currentCycle < this.maxCycles) {
      this.currentCycle++;
      this.log(`\n🔄 Starting test cycle ${this.currentCycle}/${this.maxCycles}`, 'INFO');

      const cycleStart = Date.now();
      const cycleResults = {
        cycle: this.currentCycle,
        timestamp: new Date().toISOString(),
        tests: [],
        overallStatus: 'PASS',
        duration: 0
      };

      // Run each critical test
      for (const testSpec of this.criticalTests) {
        if (!this.isRunning) break;

        this.log(`🧪 Running ${testSpec.name} (${testSpec.priority})...`, 'INFO');
        const testResult = await this.runTest(testSpec);
        cycleResults.tests.push(testResult);

        if (testResult.status === 'FAIL') {
          cycleResults.overallStatus = 'FAIL';
          this.log(`❌ ${testSpec.name} FAILED`, 'ERROR');

          if (testResult.failures > testSpec.maxFailures) {
            this.log(`🚨 CRITICAL: ${testSpec.name} exceeded max failures (${testResult.failures}>${testSpec.maxFailures})`, 'ERROR');
            this.sendCriticalAlert(testSpec, testResult);
          }
        } else {
          this.log(`✅ ${testSpec.name} PASSED`, 'INFO');
        }
      }

      cycleResults.duration = Date.now() - cycleStart;
      this.testResults.push(cycleResults);

      this.log(`⏱️  Cycle ${this.currentCycle} completed in ${cycleResults.duration}ms - Status: ${cycleResults.overallStatus}`, 'INFO');

      // Save results
      this.saveResults(cycleResults);

      // Wait before next cycle
      if (this.isRunning && this.currentCycle < this.maxCycles) {
        this.log(`⏳ Waiting ${this.intervalMs/1000}s before next cycle...`, 'INFO');
        await this.sleep(this.intervalMs);
      }
    }

    if (this.currentCycle >= this.maxCycles) {
      this.log(`🏁 Completed all ${this.maxCycles} cycles`, 'INFO');
    }

    this.stop();
  }

  async runTest(testSpec) {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const playwrightProcess = spawn('npx', ['playwright', 'test', testSpec.file, '--reporter=json'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      playwrightProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      playwrightProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      playwrightProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = {
          name: testSpec.name,
          file: testSpec.file,
          priority: testSpec.priority,
          status: code === 0 ? 'PASS' : 'FAIL',
          exitCode: code,
          duration,
          failures: 0,
          tests: 0,
          output: stdout,
          errors: stderr
        };

        // Parse Playwright JSON output if available
        try {
          const jsonOutput = JSON.parse(stdout);
          if (jsonOutput.stats) {
            result.tests = jsonOutput.stats.total || 0;
            result.failures = jsonOutput.stats.failed || 0;
          }
        } catch (e) {
          // Fallback to exit code
          result.failures = code === 0 ? 0 : 1;
        }

        resolve(result);
      });

      // Kill process if it runs too long
      setTimeout(() => {
        playwrightProcess.kill('SIGKILL');
        resolve({
          name: testSpec.name,
          file: testSpec.file,
          priority: testSpec.priority,
          status: 'TIMEOUT',
          exitCode: -1,
          duration: Date.now() - startTime,
          failures: 1,
          tests: 0,
          output: '',
          errors: 'Test timed out after 5 minutes'
        });
      }, 300000); // 5 minute timeout
    });
  }

  sendCriticalAlert(testSpec, testResult) {
    const alert = {
      timestamp: new Date().toISOString(),
      test: testSpec.name,
      priority: testSpec.priority,
      failures: testResult.failures,
      maxFailures: testSpec.maxFailures,
      errors: testResult.errors
    };

    // Write critical alert file
    const alertFile = path.join(this.resultsDir, `CRITICAL_ALERT_${Date.now()}.json`);
    fs.writeFileSync(alertFile, JSON.stringify(alert, null, 2));

    this.log(`🚨 CRITICAL ALERT written to ${alertFile}`, 'ERROR');
  }

  saveResults(cycleResults) {
    const resultFile = path.join(this.resultsDir, `cycle_${this.currentCycle}_${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(cycleResults, null, 2));
  }

  generateSummaryReport() {
    const summary = {
      totalCycles: this.currentCycle,
      startTime: this.testResults[0]?.timestamp,
      endTime: new Date().toISOString(),
      overallStatus: this.calculateOverallStatus(),
      testSummary: this.generateTestSummary(),
      trends: this.analyzeTrends()
    };

    const summaryFile = path.join(this.resultsDir, `MONITOR_SUMMARY_${Date.now()}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    this.log(`📊 Summary report written to ${summaryFile}`, 'INFO');
    this.printSummary(summary);
  }

  calculateOverallStatus() {
    const failedCycles = this.testResults.filter(r => r.overallStatus === 'FAIL').length;
    const totalCycles = this.testResults.length;

    if (failedCycles === 0) return 'ALL_PASS';
    if (failedCycles / totalCycles > 0.3) return 'CRITICAL';
    if (failedCycles / totalCycles > 0.1) return 'WARNING';
    return 'STABLE';
  }

  generateTestSummary() {
    const summary = {};

    this.criticalTests.forEach(testSpec => {
      const testResults = this.testResults.flatMap(cycle =>
        cycle.tests.filter(test => test.name === testSpec.name)
      );

      summary[testSpec.name] = {
        totalRuns: testResults.length,
        passed: testResults.filter(r => r.status === 'PASS').length,
        failed: testResults.filter(r => r.status === 'FAIL').length,
        timeouts: testResults.filter(r => r.status === 'TIMEOUT').length,
        avgDuration: testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length,
        reliability: (testResults.filter(r => r.status === 'PASS').length / testResults.length * 100).toFixed(1) + '%'
      };
    });

    return summary;
  }

  analyzeTrends() {
    if (this.testResults.length < 3) return 'Insufficient data for trend analysis';

    const recentCycles = this.testResults.slice(-5);
    const earlierCycles = this.testResults.slice(0, 5);

    const recentFailRate = recentCycles.filter(r => r.overallStatus === 'FAIL').length / recentCycles.length;
    const earlierFailRate = earlierCycles.filter(r => r.overallStatus === 'FAIL').length / earlierCycles.length;

    if (recentFailRate > earlierFailRate * 1.5) return 'DEGRADING';
    if (recentFailRate < earlierFailRate * 0.5) return 'IMPROVING';
    return 'STABLE';
  }

  printSummary(summary) {
    console.log('\n' + '='.repeat(60));
    console.log('🏁 CONTINUOUS MONITORING SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Total Cycles: ${summary.totalCycles}`);
    console.log(`🎯 Overall Status: ${summary.overallStatus}`);
    console.log(`📈 Trend: ${summary.trends}`);
    console.log('\n📋 Test Summary:');

    Object.entries(summary.testSummary).forEach(([testName, stats]) => {
      console.log(`  ${testName}:`);
      console.log(`    Reliability: ${stats.reliability} (${stats.passed}/${stats.totalRuns})`);
      console.log(`    Avg Duration: ${(stats.avgDuration/1000).toFixed(1)}s`);
    });

    console.log('\n' + '='.repeat(60));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const monitor = new ContinuousTestMonitor();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔬 Continuous Test Monitor - Emergency Testing System

Usage: node continuous-test-monitor.js [options]

Options:
  --help, -h          Show this help message
  --max-cycles N      Maximum number of test cycles (default: 50)
  --interval N        Interval between cycles in milliseconds (default: 30000)

Environment Variables:
  MAX_CYCLES          Maximum number of test cycles
  INTERVAL_MS         Interval between cycles in milliseconds

Example:
  node continuous-test-monitor.js --max-cycles 100 --interval 60000
  MAX_CYCLES=100 INTERVAL_MS=60000 node continuous-test-monitor.js
    `);
    process.exit(0);
  }

  // Parse command line arguments
  const maxCyclesIndex = args.indexOf('--max-cycles');
  if (maxCyclesIndex !== -1 && args[maxCyclesIndex + 1]) {
    process.env.MAX_CYCLES = args[maxCyclesIndex + 1];
  }

  const intervalIndex = args.indexOf('--interval');
  if (intervalIndex !== -1 && args[intervalIndex + 1]) {
    process.env.INTERVAL_MS = args[intervalIndex + 1];
  }

  console.log('🚨 EMERGENCY TEST ENGINEER: Starting continuous monitoring...');
  monitor.start().catch(error => {
    console.error('❌ Monitor failed to start:', error);
    process.exit(1);
  });
}

module.exports = ContinuousTestMonitor;
