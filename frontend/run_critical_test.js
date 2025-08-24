#!/usr/bin/env node
/**
 * Quick Critical Drag-Drop Test Runner
 * Runs a simplified version of critical drag-drop tests to baseline current issues
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function runCriticalDragDropTest() {
  console.log('🚨 CRITICAL DRAG-DROP TEST: Baseline Current Issues');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const testResults = {
    timestamp: new Date().toISOString(),
    testType: 'Critical Drag-Drop Baseline',
    results: [],
    issues: [],
    summary: {}
  };

  try {
    // Navigate to application
    console.log('🔍 Navigating to http://localhost:15174...');
    await page.goto('http://localhost:15174');
    await page.waitForLoadState('networkidle');

    // Check for dashboard crash (useBoard context issue)
    console.log('🔍 Checking for dashboard crash...');
    const errorBoundary = page.locator('text="Something went wrong", text="Error:", [data-testid="error-boundary"]');
    const hasDashboardCrash = await errorBoundary.isVisible();

    if (hasDashboardCrash) {
      console.log('🚨 CRITICAL: Dashboard crash detected (useBoard context issue)');
      testResults.issues.push({
        type: 'CRITICAL',
        issue: 'Dashboard crash - useBoard context error',
        status: 'BLOCKING'
      });

      // Cannot proceed with drag-drop tests if dashboard crashes
      testResults.summary = {
        canTestDragDrop: false,
        dashboardCrash: true,
        blockedBy: 'useBoard context error'
      };

      await page.screenshot({ path: 'dashboard-crash-baseline.png' });
      return testResults;
    }

    console.log('✅ Dashboard loads without crash');

    // Try to create a test board
    console.log('🔍 Testing board creation...');
    const createBoardButton = page.locator('button:has-text("Create Board")');

    if (await createBoardButton.isVisible()) {
      await createBoardButton.click();
      await page.fill('input[placeholder*="board name" i]', `Baseline Test ${Date.now()}`);
      await page.click('button:has-text("Create")');

      // Navigate to board
      await page.click('.board-card');
      await page.waitForSelector('.column', { timeout: 10000 });

      console.log('✅ Successfully navigated to board view');

      // Test 1: Basic card creation
      console.log('🧪 Test 1: Basic card creation...');
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });

      try {
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', 'Baseline Test Card');
        await page.click('button:has-text("Save")');

        const testCard = page.locator('.ticket-card').filter({ hasText: 'Baseline Test Card' });
        const cardExists = await testCard.isVisible();

        testResults.results.push({
          test: 'Basic Card Creation',
          status: cardExists ? 'PASS' : 'FAIL',
          details: cardExists ? 'Card created successfully' : 'Card creation failed'
        });

        console.log(cardExists ? '✅ Card creation: PASS' : '❌ Card creation: FAIL');

        if (cardExists) {
          // Test 2: Basic drag operation
          console.log('🧪 Test 2: Basic drag operation...');
          const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

          const initialCardCount = await page.locator('.ticket-card').count();
          console.log(`   Initial card count: ${initialCardCount}`);

          try {
            await testCard.dragTo(inProgressColumn);
            await page.waitForTimeout(3000);

            const finalCardCount = await page.locator('.ticket-card').count();
            const cardStillExists = await page.locator('.ticket-card').filter({ hasText: 'Baseline Test Card' }).isVisible();
            const cardInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Baseline Test Card' }).isVisible();

            console.log(`   Final card count: ${finalCardCount}`);
            console.log(`   Card still exists: ${cardStillExists}`);
            console.log(`   Card in IN PROGRESS: ${cardInProgress}`);

            if (!cardStillExists) {
              console.log('🚨 CRITICAL BUG: Card disappeared during drag operation!');
              testResults.issues.push({
                type: 'CRITICAL',
                issue: 'Card disappears during drag operation - DATA LOSS',
                status: 'CONFIRMED'
              });
            }

            if (finalCardCount < initialCardCount) {
              console.log('🚨 CRITICAL BUG: Card count decreased - data loss detected!');
              testResults.issues.push({
                type: 'CRITICAL',
                issue: 'Card count decreased during drag - data loss',
                status: 'CONFIRMED'
              });
            }

            testResults.results.push({
              test: 'Basic Drag Operation',
              status: cardStillExists ? (cardInProgress ? 'PASS' : 'PARTIAL') : 'FAIL',
              details: {
                cardExists: cardStillExists,
                cardMoved: cardInProgress,
                dataLoss: finalCardCount < initialCardCount,
                initialCount: initialCardCount,
                finalCount: finalCardCount
              }
            });

            if (cardStillExists && cardInProgress) {
              console.log('✅ Drag operation: PASS (card moved successfully)');
            } else if (cardStillExists) {
              console.log('⚠️ Drag operation: PARTIAL (card exists but may not have moved)');
            } else {
              console.log('❌ Drag operation: FAIL (card disappeared - DATA LOSS)');
            }

          } catch (error) {
            console.log(`❌ Drag operation failed: ${error.message}`);
            testResults.results.push({
              test: 'Basic Drag Operation',
              status: 'ERROR',
              details: error.message
            });
          }
        }

      } catch (error) {
        console.log(`❌ Card creation failed: ${error.message}`);
        testResults.results.push({
          test: 'Basic Card Creation',
          status: 'ERROR',
          details: error.message
        });
      }

    } else {
      console.log('❌ Create Board button not found - dashboard may have issues');
      testResults.issues.push({
        type: 'ERROR',
        issue: 'Create Board button not accessible',
        status: 'BLOCKING'
      });
    }

  } catch (error) {
    console.log(`❌ Test execution failed: ${error.message}`);
    testResults.issues.push({
      type: 'ERROR',
      issue: `Test execution failed: ${error.message}`,
      status: 'BLOCKING'
    });
  }

  // Generate summary
  const passCount = testResults.results.filter(r => r.status === 'PASS').length;
  const failCount = testResults.results.filter(r => r.status === 'FAIL').length;
  const errorCount = testResults.results.filter(r => r.status === 'ERROR').length;
  const criticalIssues = testResults.issues.filter(i => i.type === 'CRITICAL').length;

  testResults.summary = {
    totalTests: testResults.results.length,
    passed: passCount,
    failed: failCount,
    errors: errorCount,
    criticalIssues: criticalIssues,
    canTestDragDrop: !hasDashboardCrash,
    dashboardCrash: hasDashboardCrash
  };

  console.log('\n📊 BASELINE TEST SUMMARY:');
  console.log('='.repeat(30));
  console.log(`Tests Run: ${testResults.results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Critical Issues: ${criticalIssues}`);

  if (criticalIssues > 0) {
    console.log('\n🚨 CRITICAL ISSUES DETECTED:');
    testResults.issues.filter(i => i.type === 'CRITICAL').forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue.issue}`);
    });
  }

  // Save results
  fs.writeFileSync('critical-drag-drop-baseline.json', JSON.stringify(testResults, null, 2));
  console.log('\n💾 Results saved to: critical-drag-drop-baseline.json');

  await browser.close();
  return testResults;
}

// Run the test
runCriticalDragDropTest()
  .then(results => {
    console.log('\n🎯 BASELINE TESTING COMPLETE');
    process.exit(results.summary.criticalIssues > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
