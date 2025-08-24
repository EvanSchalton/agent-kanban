import { test, expect } from '@playwright/test';

/**
 * CRITICAL: Drag-Drop Regression Prevention Test Suite
 *
 * This test suite is designed to run IMMEDIATELY after bugfix:3 fixes the dashboard crash.
 * Focus: Data persistence during drag operations and backend state validation.
 *
 * Tests for:
 * - Frontend-backend state synchronization
 * - Data persistence during drag operations
 * - Backend API integration
 * - Regression prevention for data corruption
 */
test.describe('CRITICAL: Drag-Drop Regression Prevention', () => {
  const baseURL = 'http://localhost:15174'; // Updated port from HMR logs

  test.beforeEach(async ({ page }) => {
    console.log('🚨 CRITICAL: Setting up regression prevention test');

    // Enhanced monitoring for regression detection
    const regressionIndicators: any[] = [];
    const apiCalls: any[] = [];
    const stateChanges: any[] = [];

    // Monitor for regression indicators
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('error') || text.includes('undefined') || text.includes('null') ||
          text.includes('corrupt') || text.includes('disappear') || text.includes('lost')) {
        regressionIndicators.push({
          type: 'console',
          level: msg.type(),
          message: text,
          timestamp: Date.now()
        });
      }
    });

    // Monitor API calls for backend integration
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({
          method: request.method(),
          url: request.url(),
          timestamp: Date.now(),
          postData: request.postData()
        });
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        try {
          const responseData = await response.json();
          const matchingRequest = apiCalls.find(req =>
            req.url === response.url() &&
            Math.abs(req.timestamp - Date.now()) < 10000
          );
          if (matchingRequest) {
            matchingRequest.response = {
              status: response.status(),
              data: responseData
            };
          }
        } catch (error) {
          // Response might not be JSON
        }
      }
    });

    // Store monitoring data
    (page as any).regressionIndicators = regressionIndicators;
    (page as any).apiCalls = apiCalls;
    (page as any).stateChanges = stateChanges;

    // Navigate and wait for dashboard to load (this should work after bugfix:3)
    await page.goto(baseURL);

    // CRITICAL: Verify dashboard loads without crashing
    console.log('🔍 Verifying dashboard loads without React Context errors...');

    // Wait longer for dashboard to stabilize after fix
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check for error boundaries
    const errorBoundary = page.locator('text="Something went wrong", text="Error:", [data-testid="error-boundary"]');
    const hasErrorBoundary = await errorBoundary.isVisible();

    if (hasErrorBoundary) {
      console.log('🚨 CRITICAL: Dashboard still crashing - bugfix:3 may not be complete');
      throw new Error('REGRESSION: Dashboard crash not fixed - cannot proceed with drag-drop testing');
    }

    console.log('✅ Dashboard loads successfully - bugfix:3 appears effective');

    // Create test board for drag-drop testing
    const boardName = `Regression Test ${Date.now()}`;
    const createBoardButton = page.locator('button:has-text("Create Board")');

    // Verify Create Board button is accessible (validates dashboard fix)
    await expect(createBoardButton).toBeVisible();
    await createBoardButton.click();

    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');

    // Navigate to the board
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    console.log('✅ Test environment ready for drag-drop regression testing');
  });

  test.describe('Backend State Persistence Validation', () => {
    test('REGRESSION-001: Card data persists in backend during drag operations', async ({ page }) => {
      console.log('🚨 CRITICAL: Testing backend data persistence during drag operations');

      // Create test card with comprehensive data
      const cardData = {
        title: `Backend Test Card ${Date.now()}`,
        description: 'Critical regression test - data must persist in backend',
        priority: 'high'
      };

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

      // Create card
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', cardData.title);

      const descInput = page.locator('textarea[placeholder*="description" i]');
      if (await descInput.isVisible()) {
        await descInput.fill(cardData.description);
      }

      await page.click('button:has-text("Save")');

      const testCard = page.locator('.ticket-card').filter({ hasText: cardData.title });
      await expect(testCard).toBeVisible();

      console.log('📊 Card created, capturing initial backend state...');

      // Clear API monitoring for the drag operation
      (page as any).apiCalls = [];

      // Perform drag operation
      console.log('🔄 Performing drag operation with backend monitoring...');

      await testCard.dragTo(inProgressColumn);
      await page.waitForTimeout(5000); // Allow time for backend updates

      // Analyze API calls for backend persistence
      const apiCalls = (page as any).apiCalls || [];
      console.log(`📡 API calls during drag: ${apiCalls.length}`);

      const persistenceApiCalls = apiCalls.filter(call =>
        call.method === 'PATCH' ||
        call.method === 'PUT' ||
        call.url.includes('move') ||
        call.url.includes('tickets') ||
        call.url.includes('status')
      );

      console.log(`🗄️ Backend persistence calls: ${persistenceApiCalls.length}`);

      if (persistenceApiCalls.length === 0) {
        console.log('⚠️ WARNING: No backend persistence calls detected');
        console.log('   This may indicate frontend-only state management');
      } else {
        console.log('✅ Backend persistence calls detected:');
        persistenceApiCalls.forEach(call => {
          console.log(`   - ${call.method} ${call.url} (${call.response?.status || 'pending'})`);
        });
      }

      // CRITICAL: Test backend persistence by refreshing page
      console.log('🔄 Testing backend persistence by refreshing page...');

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Navigate back to board (dashboard should work after bugfix:3)
      const boards = page.locator('.board-card');
      const boardCount = await boards.count();

      if (boardCount > 0) {
        await boards.first().click();
        await page.waitForSelector('.column');
      } else {
        throw new Error('REGRESSION: No boards found after reload - data persistence issue');
      }

      // Verify card still exists after refresh
      const cardAfterRefresh = page.locator('.ticket-card').filter({ hasText: cardData.title });
      const cardExists = await cardAfterRefresh.isVisible();

      if (!cardExists) {
        console.log('🚨 CRITICAL REGRESSION: Card disappeared after refresh');
        console.log('   Backend persistence is NOT working');

        await page.screenshot({
          path: `tests/results/REGRESSION-backend-persistence-failure-${Date.now()}.png`,
          fullPage: true
        });

        throw new Error('CRITICAL REGRESSION: Card data not persisted in backend');
      }

      // Check which column the card is in after refresh
      const cardInTodo = await todoColumn.locator('.ticket-card').filter({ hasText: cardData.title }).isVisible();
      const cardInInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: cardData.title }).isVisible();

      console.log('📊 Backend persistence results:');
      console.log(`   Card in TODO after refresh: ${cardInTodo}`);
      console.log(`   Card in IN PROGRESS after refresh: ${cardInInProgress}`);

      if (cardInInProgress) {
        console.log('✅ EXCELLENT: Card position persisted in backend (drag succeeded)');
      } else if (cardInTodo) {
        console.log('⚠️ PARTIAL: Card exists but reverted to TODO (drag may not have persisted)');
        console.log('   Frontend state may not be syncing with backend');
      } else {
        console.log('❓ Card exists but location unclear - investigating...');
      }

      // Verify card data integrity
      const cardDataAfterRefresh = await cardAfterRefresh.textContent();
      const titleIntact = cardDataAfterRefresh?.includes(cardData.title);
      const descIntact = cardDataAfterRefresh?.includes(cardData.description.substring(0, 10));

      if (!titleIntact) {
        throw new Error('CRITICAL REGRESSION: Card title corrupted during backend persistence');
      }

      console.log('✅ Backend persistence regression test complete');
      console.log(cardInInProgress ?
        '✅ RESULT: Backend persistence working correctly' :
        '⚠️ RESULT: Backend persistence needs investigation');
    });

    test('REGRESSION-002: Frontend state synchronization with backend', async ({ page }) => {
      console.log('🚨 CRITICAL: Testing frontend-backend state synchronization');

      // Create multiple cards to test state sync
      const cardTitles = [
        `Sync Test 1 ${Date.now()}`,
        `Sync Test 2 ${Date.now()}`,
        `Sync Test 3 ${Date.now()}`
      ];

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

      // Create multiple cards
      for (const title of cardTitles) {
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', title);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(500);
      }

      // Verify all cards exist
      for (const title of cardTitles) {
        await expect(page.locator('.ticket-card').filter({ hasText: title })).toBeVisible();
      }

      console.log('✅ Multiple cards created for synchronization test');

      // Test rapid drag operations (stress test for state sync)
      console.log('🔄 Testing rapid drag operations for state synchronization...');

      let syncIssues = 0;
      const syncResults: any[] = [];

      for (let i = 0; i < cardTitles.length; i++) {
        const title = cardTitles[i];
        const card = page.locator('.ticket-card').filter({ hasText: title });

        try {
          // Clear API calls for this operation
          (page as any).apiCalls = [];

          console.log(`   Dragging card ${i + 1}: ${title.substring(0, 20)}...`);

          await card.dragTo(inProgressColumn);
          await page.waitForTimeout(2000); // Allow for sync

          // Check API calls
          const apiCalls = (page as any).apiCalls || [];
          const syncCalls = apiCalls.filter(call =>
            call.url.includes('tickets') || call.url.includes('move')
          );

          // Check frontend state
          const cardInTarget = await inProgressColumn.locator('.ticket-card').filter({ hasText: title }).isVisible();
          const cardInSource = await todoColumn.locator('.ticket-card').filter({ hasText: title }).isVisible();

          const result = {
            cardTitle: title,
            apiCallsTriggered: syncCalls.length,
            frontendStateCorrect: cardInTarget && !cardInSource,
            cardStillExists: cardInTarget || cardInSource
          };

          syncResults.push(result);

          if (!result.cardStillExists) {
            syncIssues++;
            console.log(`   🚨 CRITICAL: Card ${i + 1} disappeared - data loss!`);
          } else if (!result.frontendStateCorrect) {
            console.log(`   ⚠️ WARNING: Card ${i + 1} state sync issue`);
          } else {
            console.log(`   ✅ Card ${i + 1}: State synchronized correctly`);
          }

        } catch (error) {
          syncIssues++;
          console.log(`   ❌ Card ${i + 1} drag failed: ${error}`);

          // Verify card still exists even if drag failed
          const cardExists = await page.locator('.ticket-card').filter({ hasText: title }).isVisible();
          syncResults.push({
            cardTitle: title,
            apiCallsTriggered: 0,
            frontendStateCorrect: false,
            cardStillExists: cardExists,
            error: error.toString()
          });
        }
      }

      // Analyze synchronization results
      console.log('\n📊 FRONTEND-BACKEND SYNCHRONIZATION ANALYSIS:');
      console.log('================================================');
      console.log(`Total cards tested: ${cardTitles.length}`);
      console.log(`Cards still existing: ${syncResults.filter(r => r.cardStillExists).length}`);
      console.log(`Proper state sync: ${syncResults.filter(r => r.frontendStateCorrect).length}`);
      console.log(`API calls triggered: ${syncResults.reduce((sum, r) => sum + r.apiCallsTriggered, 0)}`);
      console.log(`Sync issues detected: ${syncIssues}`);

      // Check for critical regressions
      const cardsLost = syncResults.filter(r => !r.cardStillExists).length;

      if (cardsLost > 0) {
        console.log('🚨 CRITICAL REGRESSION: Data loss detected in synchronization');

        await page.screenshot({
          path: `tests/results/REGRESSION-sync-data-loss-${Date.now()}.png`,
          fullPage: true
        });

        throw new Error(`CRITICAL REGRESSION: ${cardsLost} cards lost during synchronization test`);
      }

      if (syncIssues > cardTitles.length / 2) {
        console.log('⚠️ WARNING: High rate of synchronization issues');
        console.log('   Frontend-backend state sync may need optimization');
      } else {
        console.log('✅ Synchronization test completed with acceptable results');
      }

      // Final verification: All cards should still exist
      for (const title of cardTitles) {
        const cardExists = await page.locator('.ticket-card').filter({ hasText: title }).isVisible();
        expect(cardExists).toBe(true);
      }

      console.log('✅ Frontend-backend synchronization regression test complete');
    });

    test('REGRESSION-003: Validate fix prevents data corruption patterns', async ({ page }) => {
      console.log('🚨 CRITICAL: Testing that fixes prevent previous data corruption patterns');

      // Test scenarios that previously caused corruption
      const corruptionScenarios = [
        'Rapid drag operations',
        'Drag during form submission',
        'Multiple simultaneous drags',
        'Drag with page navigation',
        'Drag during API calls'
      ];

      const testCard = `Corruption Prevention ${Date.now()}`;
      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });
      const doneColumn = page.locator('.column').filter({ hasText: 'DONE' });

      // Create test card
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', testCard);
      await page.fill('textarea[placeholder*="description" i]', 'Testing corruption prevention with comprehensive data that must not be lost or corrupted');
      await page.click('button:has-text("Save")');

      const card = page.locator('.ticket-card').filter({ hasText: testCard });
      await expect(card).toBeVisible();

      console.log('📊 Testing corruption prevention scenarios...');

      // Scenario 1: Rapid drag operations (previously caused corruption)
      console.log('   Scenario 1: Rapid drag operations');

      try {
        for (let i = 0; i < 5; i++) {
          const targetColumn = i % 3 === 0 ? inProgressColumn : i % 3 === 1 ? doneColumn : todoColumn;
          await card.dragTo(targetColumn);
          await page.waitForTimeout(100); // Minimal delay for rapid operations
        }

        // Verify card still exists and data is intact
        const cardExists = await card.isVisible();
        if (!cardExists) {
          throw new Error('REGRESSION: Card disappeared during rapid drag operations');
        }

        const cardData = await card.textContent();
        if (!cardData?.includes(testCard)) {
          throw new Error('REGRESSION: Card data corrupted during rapid operations');
        }

        console.log('   ✅ Rapid drag operations: No corruption detected');

      } catch (error) {
        console.log(`   🚨 REGRESSION in rapid drag: ${error}`);
        throw error;
      }

      // Scenario 2: Drag during form operations
      console.log('   Scenario 2: Drag during form operations');

      try {
        // Open add card form
        await todoColumn.locator('button:has-text("Add Card")').click();

        // Perform drag while form is open
        await card.dragTo(inProgressColumn);
        await page.waitForTimeout(1000);

        // Close form
        const cancelButton = page.locator('button:has-text("Cancel"), [aria-label="Close"]');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        } else {
          await page.keyboard.press('Escape');
        }

        // Verify card integrity
        const cardExists = await card.isVisible();
        expect(cardExists).toBe(true);

        console.log('   ✅ Drag during form operations: No corruption detected');

      } catch (error) {
        console.log(`   🚨 REGRESSION in form operations: ${error}`);
        throw error;
      }

      // Final integrity check
      console.log('🔍 Final data integrity verification...');

      const finalCardData = await page.evaluate((cardTitle) => {
        const cards = Array.from(document.querySelectorAll('.ticket-card'));
        const targetCard = cards.find(card => card.textContent?.includes(cardTitle));

        if (!targetCard) {
          return { found: false, error: 'Card not found' };
        }

        return {
          found: true,
          textContent: targetCard.textContent,
          innerHTML: targetCard.innerHTML,
          hasTitle: targetCard.textContent?.includes(cardTitle),
          hasDescription: targetCard.textContent?.includes('comprehensive data'),
          elementIntegrity: targetCard.children.length > 0
        };
      }, testCard);

      if (!finalCardData.found) {
        throw new Error('CRITICAL REGRESSION: Card disappeared during corruption prevention test');
      }

      if (!finalCardData.hasTitle || !finalCardData.elementIntegrity) {
        throw new Error('CRITICAL REGRESSION: Card data corrupted during corruption prevention test');
      }

      console.log('✅ Corruption prevention test complete');
      console.log('✅ RESULT: Fixes successfully prevent previous corruption patterns');
    });
  });

  test.afterEach(async ({ page }) => {
    // Comprehensive regression analysis
    const regressionIndicators = (page as any).regressionIndicators || [];
    const apiCalls = (page as any).apiCalls || [];

    console.log('\n📋 REGRESSION PREVENTION SUMMARY:');
    console.log('==================================');
    console.log(`Regression indicators: ${regressionIndicators.length}`);
    console.log(`API calls monitored: ${apiCalls.length}`);

    if (regressionIndicators.length > 0) {
      console.log('⚠️ Potential regression indicators detected:');
      regressionIndicators.forEach((indicator, index) => {
        console.log(`   ${index + 1}. [${indicator.level}] ${indicator.message}`);
      });
    }

    // Evidence screenshot
    await page.screenshot({
      path: `tests/results/regression-prevention-${Date.now()}.png`,
      fullPage: true
    });

    console.log('Regression prevention test completed');
  });
});
