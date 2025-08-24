#!/usr/bin/env node

/**
 * Regression Test Runner for Card Creation
 * Quick validation script to test the 5-step workflow
 */

const { exec } = require('child_process');
const fs = require('fs');

console.log('🧪 Card Creation Regression Test Runner');
console.log('=====================================');

// Check if services are running
async function checkServices() {
  console.log('📋 Checking required services...');

  try {
    const fetch = (await import('node-fetch')).default;

    // Check frontend
    const frontendResponse = await fetch('http://localhost:15175');
    if (frontendResponse.ok) {
      console.log('✅ Frontend running on port 15175');
    } else {
      console.log('⚠️ Frontend responded but may have issues');
    }

    // Check backend
    try {
      const backendResponse = await fetch('http://localhost:8000/api/boards');
      console.log(`✅ Backend running on port 8000 (status: ${backendResponse.status})`);
    } catch (e) {
      console.log('⚠️ Backend may not be running on port 8000');
    }

    return true;
  } catch (error) {
    console.log('❌ Service check failed:', error.message);
    return false;
  }
}

// Run the regression test
function runRegressionTest() {
  return new Promise((resolve) => {
    console.log('\n🚀 Running Card Creation Regression Test...');
    console.log('Target: 5-step workflow (navigate → click + → fill form → submit → verify)');

    const testCommand = `npx playwright test ../tests/e2e/card-creation-regression-prevention.spec.ts --grep "5-step" --reporter=line --timeout=30000`;

    const startTime = Date.now();

    exec(testCommand, { cwd: process.cwd() }, (error, stdout, stderr) => {
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      console.log(`\n📊 Test Execution Complete (${duration}s)`);
      console.log('=' + '='.repeat(50));

      if (error) {
        console.log('❌ Regression Test FAILED');
        console.log('Error Code:', error.code);
        console.log('\nOutput:');
        console.log(stdout);
        console.log('\nErrors:');
        console.log(stderr);

        // Check for common issues
        if (stderr.includes('browser not found')) {
          console.log('\n💡 Suggested Fix: Run "npx playwright install"');
        }
        if (stderr.includes('timeout')) {
          console.log('\n💡 Suggested Fix: Services may be slow or not running');
        }

        resolve({ success: false, error: error.message, output: stdout, stderr });
      } else {
        console.log('✅ Regression Test PASSED');
        console.log('\n📋 Test Output:');
        console.log(stdout);

        // Parse for specific success indicators
        const hasSteps = stdout.includes('STEP 1') && stdout.includes('STEP 5');
        const hasCompletion = stdout.includes('COMPLETE');

        if (hasSteps && hasCompletion) {
          console.log('\n🎉 All 5 steps executed successfully!');
          console.log('✅ Regression prevention test validates card creation workflow');
        }

        resolve({ success: true, output: stdout, duration });
      }
    });
  });
}

// Generate report
function generateReport(testResult) {
  const report = {
    timestamp: new Date().toISOString(),
    testType: 'Card Creation Regression Prevention',
    workflow: '5-step process (navigate → click + → fill form → submit → verify)',
    success: testResult.success,
    duration: testResult.duration,
    summary: testResult.success ?
      'Regression test passed - card creation workflow protected' :
      'Regression test failed - workflow may have issues',
    recommendations: testResult.success ? [
      'Deploy with confidence - regression protection active',
      'Continue monitoring for edge cases',
      'Run full test suite before major releases'
    ] : [
      'Investigate card creation workflow issues',
      'Check service connectivity and performance',
      'Review browser compatibility and timeouts'
    ]
  };

  // Save report
  const reportPath = '../tests/results/regression-test-report.json';
  try {
    if (!fs.existsSync('../tests/results')) {
      fs.mkdirSync('../tests/results', { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved: ${reportPath}`);
  } catch (e) {
    console.log('⚠️ Could not save report:', e.message);
  }

  return report;
}

// Main execution
async function main() {
  try {
    // Check services
    const servicesOk = await checkServices();

    if (!servicesOk) {
      console.log('\n⚠️ Service issues detected - test results may be unreliable');
    }

    // Run regression test
    const testResult = await runRegressionTest();

    // Generate report
    const report = generateReport(testResult);

    // Summary
    console.log('\n📋 REGRESSION TEST SUMMARY');
    console.log('=' + '='.repeat(30));
    console.log(`Status: ${report.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Workflow: ${report.workflow}`);
    console.log(`Duration: ${report.duration || 'N/A'}s`);

    console.log('\nRecommendations:');
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });

    // Exit with appropriate code
    process.exit(report.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run the test
main();
