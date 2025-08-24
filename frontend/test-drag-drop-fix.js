#!/usr/bin/env node

/**
 * Quick Drag-Drop Fix Verification Script
 * Tests critical drag-drop functionality to verify P0 bug fix
 */

const { exec } = require('child_process');
const fs = require('fs');

console.log('🔍 Quick Drag-Drop Fix Verification');
console.log('===================================');

// Function to check if services are running
async function checkServices() {
  console.log('Checking required services...');

  // Check backend
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('http://localhost:8000/api/boards');
    if (response.status === 200 || response.status === 401) {
      console.log('✅ Backend is running');
      return { backend: true };
    }
  } catch (e) {
    console.log('❌ Backend not running - starting tests anyway');
  }

  return { backend: false };
}

// Function to run specific drag-drop test
function runDragDropTest() {
  return new Promise((resolve) => {
    console.log('\n🧪 Running drag-drop critical tests...');

    const testCommand = 'npx playwright test ../tests/e2e/drag-drop-critical.spec.ts --reporter=line --headed=false';

    exec(testCommand, (error, stdout, stderr) => {
      const result = {
        success: !error,
        output: stdout,
        error: stderr,
        exitCode: error ? error.code : 0
      };

      console.log('\n📊 Test Results:');
      if (result.success) {
        console.log('✅ DRAG-DROP TESTS PASSED - FIX VERIFIED!');
        console.log('🎉 P0 data loss bug appears to be resolved');
      } else {
        console.log('❌ DRAG-DROP TESTS FAILED - FIX NOT VERIFIED');
        console.log('⚠️  P0 data loss bug may still exist');
      }

      if (result.output) {
        console.log('\nTest Output:');
        console.log(result.output);
      }

      if (result.error) {
        console.log('\nError Details:');
        console.log(result.error);
      }

      resolve(result);
    });
  });
}

// Generate PM Report
function generatePMReport(testResult) {
  const report = {
    timestamp: new Date().toISOString(),
    testType: 'Critical Drag-Drop Verification',
    priority: 'P0 - Data Loss Bug',
    status: testResult.success ? 'FIXED' : 'FAILED',
    summary: {
      dragDropFix: testResult.success ? 'VERIFIED' : 'NOT VERIFIED',
      dataLossPrevented: testResult.success ? 'YES' : 'NO',
      productionReady: testResult.success ? 'YES' : 'NO'
    },
    recommendations: testResult.success ? [
      'Deploy fix to production immediately',
      'Continue monitoring for edge cases',
      'Run full regression suite'
    ] : [
      'DO NOT DEPLOY - Data loss still occurring',
      'Investigate drag-drop implementation',
      'Check API field mappings',
      'Verify database persistence'
    ],
    testDetails: {
      exitCode: testResult.exitCode,
      hasOutput: !!testResult.output,
      hasErrors: !!testResult.error
    }
  };

  // Save report
  const reportPath = '../tests/results/drag-drop-fix-verification.json';
  try {
    if (!fs.existsSync('../tests/results')) {
      fs.mkdirSync('../tests/results', { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 PM Report saved to: ${reportPath}`);
  } catch (e) {
    console.log('⚠️  Could not save PM report');
  }

  return report;
}

// Main execution
async function main() {
  try {
    // Check services
    const services = await checkServices();

    if (!services.backend) {
      console.log('\n⚠️  Backend not running - test results may be unreliable');
      console.log('To start backend: cd ../backend && python run.py');
    }

    // Run drag-drop tests
    const testResult = await runDragDropTest();

    // Generate report for PM
    const report = generatePMReport(testResult);

    // Summary for PM
    console.log('\n📋 PM SUMMARY:');
    console.log('==============');
    console.log(`Status: ${report.status}`);
    console.log(`Data Loss Fixed: ${report.summary.dataLossPrevented}`);
    console.log(`Production Ready: ${report.summary.productionReady}`);

    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

    process.exit(testResult.success ? 0 : 1);

  } catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
  }
}

main();
