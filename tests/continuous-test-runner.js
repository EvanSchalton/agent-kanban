#!/usr/bin/env node

/**
 * Continuous Test Runner for Idle Monitoring
 *
 * This script runs Playwright tests continuously while the test engineer
 * is idle, to proactively catch bugs and regressions.
 *
 * Features:
 * - Runs critical tests on a schedule
 * - Monitors for failures and reports them
 * - Tracks test history and trends
 * - Can be run in watch mode or single run mode
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  // Test suites to run (in priority order)
  testSuites: [
    {
      name: 'Nested Drop Zones Fix',
      file: 'drag-drop-nested-zones-fix.spec.ts',
      priority: 'P0',
      interval: 3 * 60 * 1000, // Run every 3 minutes (CRITICAL)
    },
    {
      name: 'Card Creation Fix',
      file: 'card-creation-fix-verification.spec.ts',
      priority: 'P0',
      interval: 5 * 60 * 1000, // Run every 5 minutes
    },
    {
      name: 'Drag and Drop P0',
      file: 'drag-drop-p0-regression.spec.ts',
      priority: 'P0',
      interval: 5 * 60 * 1000, // Run every 5 minutes
    },
    {
      name: 'Critical Paths',
      file: 'critical-paths.spec.ts',
      priority: 'P1',
      interval: 10 * 60 * 1000, // Run every 10 minutes
    },
    {
      name: 'Regression Suite',
      file: 'regression-suite.spec.ts',
      priority: 'P1',
      interval: 15 * 60 * 1000, // Run every 15 minutes
    },
    {
      name: 'Drag and Drop',
      file: 'drag-drop-critical.spec.ts',
      priority: 'P1',
      interval: 10 * 60 * 1000,
    },
    {
      name: 'WebSocket Real-time',
      file: 'websocket-realtime.spec.ts',
      priority: 'P1',
      interval: 10 * 60 * 1000,
    },
    {
      name: 'Data Persistence',
      file: 'persistence.spec.ts',
      priority: 'P2',
      interval: 20 * 60 * 1000,
    },
  ],

  // Output configuration
  resultsDir: 'tests/results/continuous',
  maxHistoryFiles: 100,

  // Notification thresholds
  failureThreshold: 3, // Alert after 3 consecutive failures

  // Mode settings
  watchMode: true,
  verbose: false,
};

// Test runner state
const state = {
  running: false,
  testHistory: [],
  consecutiveFailures: {},
  lastRun: {},
  startTime: Date.now(),
  totalRuns: 0,
  totalPassed: 0,
  totalFailed: 0,
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Utility functions
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

async function ensureResultsDir() {
  try {
    await fs.mkdir(CONFIG.resultsDir, { recursive: true });
  } catch (error) {
    log(`Failed to create results directory: ${error.message}`, colors.red);
  }
}

// Run a single test suite
async function runTestSuite(suite) {
  log(`Running ${suite.name} tests...`, colors.cyan);

  return new Promise((resolve) => {
    const startTime = Date.now();
    const args = [
      'test',
      suite.file,
      '--reporter=json',
      '--project=chromium', // Default to chromium for speed
    ];

    const child = spawn('npx', ['playwright', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, CI: 'true' },
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      if (CONFIG.verbose) {
        process.stdout.write(data);
      }
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      if (CONFIG.verbose) {
        process.stderr.write(data);
      }
    });

    child.on('close', async (code) => {
      const duration = Date.now() - startTime;
      const success = code === 0;

      // Parse results
      let testResults = null;
      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          testResults = JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        // Fallback to basic result
        testResults = {
          passed: success ? 1 : 0,
          failed: success ? 0 : 1,
          total: 1,
        };
      }

      const result = {
        suite: suite.name,
        file: suite.file,
        priority: suite.priority,
        success,
        duration,
        timestamp: new Date().toISOString(),
        stats: testResults,
        errors: success ? [] : errorOutput.split('\n').filter(line => line.trim()),
      };

      // Update state
      state.totalRuns++;
      if (success) {
        state.totalPassed++;
        state.consecutiveFailures[suite.name] = 0;
        log(`✅ ${suite.name} passed in ${formatDuration(duration)}`, colors.green);
      } else {
        state.totalFailed++;
        state.consecutiveFailures[suite.name] = (state.consecutiveFailures[suite.name] || 0) + 1;
        log(`❌ ${suite.name} failed in ${formatDuration(duration)}`, colors.red);

        // Alert on consecutive failures
        if (state.consecutiveFailures[suite.name] >= CONFIG.failureThreshold) {
          log(`🚨 ALERT: ${suite.name} has failed ${state.consecutiveFailures[suite.name]} times consecutively!`, colors.red);
        }
      }

      // Save result to file
      await saveResult(result);

      // Update last run time
      state.lastRun[suite.name] = Date.now();

      resolve(result);
    });
  });
}

// Save test result to file
async function saveResult(result) {
  try {
    const filename = `${result.suite.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    const filepath = path.join(CONFIG.resultsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));

    // Add to history
    state.testHistory.push(result);

    // Cleanup old files if needed
    await cleanupOldResults();
  } catch (error) {
    log(`Failed to save result: ${error.message}`, colors.red);
  }
}

// Clean up old result files
async function cleanupOldResults() {
  try {
    const files = await fs.readdir(CONFIG.resultsDir);
    if (files.length > CONFIG.maxHistoryFiles) {
      // Sort files by creation time and delete oldest
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filepath = path.join(CONFIG.resultsDir, file);
          const stats = await fs.stat(filepath);
          return { file: filepath, mtime: stats.mtime };
        })
      );

      fileStats.sort((a, b) => a.mtime - b.mtime);
      const toDelete = fileStats.slice(0, files.length - CONFIG.maxHistoryFiles);

      for (const { file } of toDelete) {
        await fs.unlink(file);
      }
    }
  } catch (error) {
    log(`Failed to cleanup old results: ${error.message}`, colors.yellow);
  }
}

// Get next test suite to run
function getNextSuite() {
  const now = Date.now();
  let nextSuite = null;
  let minWaitTime = Infinity;

  for (const suite of CONFIG.testSuites) {
    const lastRun = state.lastRun[suite.name] || 0;
    const timeSinceLastRun = now - lastRun;

    if (timeSinceLastRun >= suite.interval) {
      // This suite is due to run
      if (!nextSuite || suite.priority < nextSuite.priority) {
        nextSuite = suite;
      }
    } else {
      // Track how long until this suite is due
      const waitTime = suite.interval - timeSinceLastRun;
      minWaitTime = Math.min(minWaitTime, waitTime);
    }
  }

  return { suite: nextSuite, waitTime: minWaitTime };
}

// Print current status
function printStatus() {
  const runtime = Date.now() - state.startTime;
  const successRate = state.totalRuns > 0
    ? Math.round((state.totalPassed / state.totalRuns) * 100)
    : 0;

  console.log('\n' + '='.repeat(60));
  log('CONTINUOUS TEST RUNNER STATUS', colors.cyan);
  console.log('='.repeat(60));
  log(`Runtime: ${formatDuration(runtime)}`);
  log(`Total runs: ${state.totalRuns}`);
  log(`Passed: ${state.totalPassed} (${colors.green}${successRate}%${colors.reset})`);
  log(`Failed: ${state.totalFailed}`);

  // Show suite status
  console.log('\nSuite Status:');
  for (const suite of CONFIG.testSuites) {
    const lastRun = state.lastRun[suite.name];
    const failures = state.consecutiveFailures[suite.name] || 0;
    const statusColor = failures > 0 ? colors.red : colors.green;
    const lastRunStr = lastRun
      ? `Last run: ${formatDuration(Date.now() - lastRun)} ago`
      : 'Never run';

    console.log(`  ${statusColor}[${suite.priority}] ${suite.name}${colors.reset} - ${lastRunStr}`);
    if (failures > 0) {
      console.log(`    ${colors.red}⚠️  ${failures} consecutive failures${colors.reset}`);
    }
  }
  console.log('='.repeat(60) + '\n');
}

// Main test loop
async function runTestLoop() {
  if (!CONFIG.watchMode) {
    // Single run mode - run all tests once
    for (const suite of CONFIG.testSuites) {
      if (state.running) {
        await runTestSuite(suite);
      }
    }
    return;
  }

  // Continuous watch mode
  while (state.running) {
    const { suite, waitTime } = getNextSuite();

    if (suite) {
      // Run the next due test
      await runTestSuite(suite);

      // Print status every 5 runs
      if (state.totalRuns % 5 === 0) {
        printStatus();
      }
    } else {
      // No tests due, wait a bit
      const sleepTime = Math.min(waitTime, 30000); // Max 30 seconds
      if (CONFIG.verbose) {
        log(`Next test in ${formatDuration(waitTime)}, sleeping for ${formatDuration(sleepTime)}...`, colors.yellow);
      }
      await new Promise(resolve => setTimeout(resolve, sleepTime));
    }
  }
}

// Handle graceful shutdown
function handleShutdown() {
  log('\nShutting down continuous test runner...', colors.yellow);
  state.running = false;

  // Print final status
  printStatus();

  // Generate summary report
  generateSummaryReport();

  process.exit(0);
}

// Generate summary report
async function generateSummaryReport() {
  const reportPath = path.join(CONFIG.resultsDir, `summary-${Date.now()}.json`);
  const report = {
    startTime: new Date(state.startTime).toISOString(),
    endTime: new Date().toISOString(),
    runtime: Date.now() - state.startTime,
    totalRuns: state.totalRuns,
    totalPassed: state.totalPassed,
    totalFailed: state.totalFailed,
    successRate: state.totalRuns > 0 ? (state.totalPassed / state.totalRuns) : 0,
    suiteResults: {},
    recentFailures: [],
  };

  // Aggregate suite results
  for (const suite of CONFIG.testSuites) {
    const suiteHistory = state.testHistory.filter(r => r.suite === suite.name);
    report.suiteResults[suite.name] = {
      runs: suiteHistory.length,
      passed: suiteHistory.filter(r => r.success).length,
      failed: suiteHistory.filter(r => !r.success).length,
      averageDuration: suiteHistory.reduce((sum, r) => sum + r.duration, 0) / (suiteHistory.length || 1),
      consecutiveFailures: state.consecutiveFailures[suite.name] || 0,
    };
  }

  // Get recent failures
  report.recentFailures = state.testHistory
    .filter(r => !r.success)
    .slice(-10)
    .map(r => ({
      suite: r.suite,
      timestamp: r.timestamp,
      errors: r.errors.slice(0, 3), // First 3 errors
    }));

  try {
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    log(`Summary report saved to ${reportPath}`, colors.green);
  } catch (error) {
    log(`Failed to save summary report: ${error.message}`, colors.red);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--watch':
      case '-w':
        CONFIG.watchMode = true;
        break;
      case '--once':
      case '-o':
        CONFIG.watchMode = false;
        break;
      case '--verbose':
      case '-v':
        CONFIG.verbose = true;
        break;
      case '--suite':
      case '-s':
        // Run specific suite only
        const suiteName = args[++i];
        CONFIG.testSuites = CONFIG.testSuites.filter(s =>
          s.name.toLowerCase().includes(suiteName.toLowerCase())
        );
        break;
      case '--help':
      case '-h':
        console.log(`
Continuous Test Runner for Agent Kanban

Usage: node continuous-test-runner.js [options]

Options:
  --watch, -w      Run in watch mode (continuous) [default]
  --once, -o       Run all tests once and exit
  --verbose, -v    Show detailed test output
  --suite, -s      Run specific suite only
  --help, -h       Show this help message

Examples:
  node continuous-test-runner.js                # Run continuously
  node continuous-test-runner.js --once         # Run once
  node continuous-test-runner.js -s "card"      # Run card tests only
  node continuous-test-runner.js -v -w          # Verbose continuous mode
        `);
        process.exit(0);
    }
  }
}

// Main entry point
async function main() {
  console.log(colors.cyan + '\n' + '='.repeat(60));
  console.log('🤖 CONTINUOUS TEST RUNNER - Agent Kanban');
  console.log('='.repeat(60) + colors.reset);

  // Parse arguments
  parseArgs();

  // Validate configuration
  if (CONFIG.testSuites.length === 0) {
    log('No test suites configured or found!', colors.red);
    process.exit(1);
  }

  log(`Mode: ${CONFIG.watchMode ? 'Continuous Watch' : 'Single Run'}`, colors.cyan);
  log(`Test Suites: ${CONFIG.testSuites.length}`, colors.cyan);
  log(`Verbose: ${CONFIG.verbose ? 'Yes' : 'No'}`, colors.cyan);

  // Set up signal handlers
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  // Ensure results directory exists
  await ensureResultsDir();

  // Start running tests
  state.running = true;
  log('Starting test execution...', colors.green);

  try {
    await runTestLoop();
  } catch (error) {
    log(`Fatal error: ${error.message}`, colors.red);
    console.error(error.stack);
  }

  // If not in watch mode, show final status
  if (!CONFIG.watchMode) {
    handleShutdown();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  runTestSuite,
  getNextSuite,
  CONFIG,
};
