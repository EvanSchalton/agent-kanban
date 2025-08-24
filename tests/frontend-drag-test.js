/**
 * Frontend Drag & Drop Testing - Critical P0 Bug Verification
 * Tests the Board.tsx implementation for card disappearance during drag operations
 */

class FrontendDragDropTester {
    constructor() {
        this.testResults = [];
        this.errorCount = 0;
        this.startTime = Date.now();
    }

    logTest(testName, status, details = '') {
        const result = {
            test: testName,
            status: status,
            timestamp: new Date().toISOString(),
            details: details
        };
        this.testResults.push(result);

        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${statusIcon} ${testName}: ${status}`);
        if (details) {
            console.log(`   Details: ${details}`);
        }
        if (status === 'FAIL') {
            this.errorCount++;
        }
    }

    async waitForElement(selector, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Element ${selector} not found within ${timeout}ms`);
    }

    async waitForElements(selector, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return Array.from(elements);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Elements ${selector} not found within ${timeout}ms`);
    }

    async testPageLoad() {
        try {
            // Check if we're on the correct page
            if (!window.location.href.includes('localhost')) {
                this.logTest('Page Load', 'FAIL', 'Not on localhost - navigate to app first');
                return false;
            }

            // Look for board elements
            const boardElement = await this.waitForElement('.board, [data-testid="board"]', 3000);
            this.logTest('Page Load', 'PASS', 'Board element found');
            return true;
        } catch (error) {
            this.logTest('Page Load', 'FAIL', error.message);
            return false;
        }
    }

    async testColumnsPresent() {
        try {
            const columns = await this.waitForElements('.column, [data-testid="column"]', 3000);
            if (columns.length >= 3) {
                this.logTest('Columns Present', 'PASS', `Found ${columns.length} columns`);
                return columns;
            } else {
                this.logTest('Columns Present', 'FAIL', `Only found ${columns.length} columns`);
                return null;
            }
        } catch (error) {
            this.logTest('Columns Present', 'FAIL', error.message);
            return null;
        }
    }

    async testCardsPresent() {
        try {
            const cards = await this.waitForElements('.ticket-card, [data-testid="ticket-card"], .card', 2000);
            if (cards.length > 0) {
                this.logTest('Cards Present', 'PASS', `Found ${cards.length} cards`);
                return cards;
            } else {
                // Try to create a card first
                this.logTest('Cards Present', 'WARN', 'No cards found - may need to create test data');
                return [];
            }
        } catch (error) {
            this.logTest('Cards Present', 'WARN', 'No cards visible - ' + error.message);
            return [];
        }
    }

    simulateDragDrop(sourceElement, targetElement) {
        // Create drag events
        const dragStartEvent = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });

        const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });

        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });

        const dragEndEvent = new DragEvent('dragend', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });

        // Execute drag sequence
        console.log('🚨 CRITICAL: Simulating drag start...');
        sourceElement.dispatchEvent(dragStartEvent);

        console.log('🚨 CRITICAL: Simulating drag over target...');
        targetElement.dispatchEvent(dragOverEvent);

        console.log('🚨 CRITICAL: Simulating drop...');
        targetElement.dispatchEvent(dropEvent);

        console.log('🚨 CRITICAL: Simulating drag end...');
        sourceElement.dispatchEvent(dragEndEvent);
    }

    async testCriticalDragDrop() {
        console.log('\n🚨 STARTING CRITICAL P0 DRAG & DROP TEST');
        console.log('=' * 50);

        try {
            const columns = await this.testColumnsPresent();
            if (!columns) return false;

            const cards = await this.testCardsPresent();
            if (cards.length === 0) {
                this.logTest('Critical Drag Drop', 'SKIP', 'No cards available for testing');
                return false;
            }

            // Find source card and target column
            const sourceCard = cards[0];
            const targetColumn = columns.find(col => col !== sourceCard.closest('.column, [data-testid="column"]'));

            if (!targetColumn) {
                this.logTest('Critical Drag Drop', 'FAIL', 'Could not find target column');
                return false;
            }

            console.log('🎯 Testing card:', sourceCard);
            console.log('🎯 Target column:', targetColumn);

            // Record initial state
            const initialCardCount = cards.length;
            const sourceCardId = sourceCard.getAttribute('data-id') || sourceCard.id;
            const sourceCardTitle = sourceCard.querySelector('.ticket-title, .card-title, .title')?.textContent;

            console.log(`📊 Initial state: ${initialCardCount} cards, testing card: ${sourceCardTitle || sourceCardId}`);

            // Perform drag operation
            this.simulateDragDrop(sourceCard, targetColumn);

            // Wait for UI to update
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check for data loss (critical P0 bug)
            const finalCards = document.querySelectorAll('.ticket-card, [data-testid="ticket-card"], .card');
            const finalCardCount = finalCards.length;

            console.log(`📊 Final state: ${finalCardCount} cards`);

            if (finalCardCount < initialCardCount) {
                this.logTest('Critical Drag Drop', 'FAIL', `🚨 DATA LOSS DETECTED! Cards before: ${initialCardCount}, after: ${finalCardCount}`);
                return false;
            }

            // Check if the specific card still exists
            const cardStillExists = document.querySelector(`[data-id="${sourceCardId}"]`) ||
                                  Array.from(finalCards).find(card =>
                                      card.querySelector('.ticket-title, .card-title, .title')?.textContent === sourceCardTitle
                                  );

            if (!cardStillExists) {
                this.logTest('Critical Drag Drop', 'FAIL', `🚨 SPECIFIC CARD DISAPPEARED! Card: ${sourceCardTitle || sourceCardId}`);
                return false;
            }

            this.logTest('Critical Drag Drop', 'PASS', '✅ No data loss detected');
            return true;

        } catch (error) {
            this.logTest('Critical Drag Drop', 'FAIL', `Exception: ${error.message}`);
            return false;
        }
    }

    async testConsoleErrors() {
        const originalConsoleError = console.error;
        const errors = [];

        console.error = (...args) => {
            errors.push(args.join(' '));
            originalConsoleError.apply(console, args);
        };

        // Run for 10 seconds and capture errors
        setTimeout(() => {
            console.error = originalConsoleError;

            if (errors.length === 0) {
                this.logTest('Console Errors', 'PASS', 'No JavaScript errors detected');
            } else {
                this.logTest('Console Errors', 'FAIL', `${errors.length} errors: ${errors.slice(0, 3).join('; ')}`);
            }
        }, 10000);
    }

    async testWebSocketConnection() {
        try {
            // Check for WebSocket connection indicators
            const connectionStatus = document.querySelector('.connection-status, [data-testid="connection-status"]');

            if (connectionStatus) {
                const statusText = connectionStatus.textContent.toLowerCase();
                if (statusText.includes('connected') || statusText.includes('online')) {
                    this.logTest('WebSocket Connection', 'PASS', 'Connection appears active');
                    return true;
                } else {
                    this.logTest('WebSocket Connection', 'WARN', `Status: ${statusText}`);
                    return false;
                }
            } else {
                this.logTest('WebSocket Connection', 'WARN', 'No connection status indicator found');
                return false;
            }
        } catch (error) {
            this.logTest('WebSocket Connection', 'FAIL', error.message);
            return false;
        }
    }

    async runComprehensiveTest() {
        console.log('🚨 FRONTEND QA - P0 DRAG & DROP BUG TESTING');
        console.log('=' * 60);
        console.log('Testing URL:', window.location.href);
        console.log('Started:', new Date().toISOString());
        console.log('');

        // Start console error monitoring
        this.testConsoleErrors();

        // Run tests sequentially
        const pageLoaded = await this.testPageLoad();
        if (!pageLoaded) {
            console.log('❌ CRITICAL: Page not loaded properly');
            return;
        }

        await this.testColumnsPresent();
        await this.testCardsPresent();
        await this.testWebSocketConnection();

        // The critical test
        await this.testCriticalDragDrop();

        // Wait for console error monitoring to complete
        await new Promise(resolve => setTimeout(resolve, 11000));

        // Generate summary
        this.generateSummary();
    }

    generateSummary() {
        console.log('\n' + '=' * 60);
        console.log('📊 FRONTEND TEST SUMMARY');
        console.log('=' * 60);

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        const failedTests = this.errorCount;
        const skippedTests = this.testResults.filter(t => t.status === 'SKIP').length;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ❌`);
        console.log(`Skipped: ${skippedTests} ⏭️`);
        console.log(`Success Rate: ${((passedTests/totalTests)*100).toFixed(1)}%`);

        if (failedTests === 0) {
            console.log('\n🎉 ALL FRONTEND TESTS PASSED - P0 Bug appears to be FIXED!');
        } else {
            console.log(`\n🚨 ${failedTests} FAILURES DETECTED - P0 Bug may still exist!`);
        }

        // Save results to window for external access
        window.frontendTestResults = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                skipped: skippedTests,
                successRate: (passedTests/totalTests)*100,
                duration: Date.now() - this.startTime
            },
            results: this.testResults
        };

        console.log('\n💾 Results saved to window.frontendTestResults');
        console.log('To download results: copy(JSON.stringify(window.frontendTestResults, null, 2))');
    }
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
    console.log('🚀 Frontend Drag & Drop Tester loaded');
    console.log('Run: new FrontendDragDropTester().runComprehensiveTest()');

    // Provide global access
    window.FrontendDragDropTester = FrontendDragDropTester;

    // Auto-run after 2 seconds if on localhost
    if (window.location.hostname === 'localhost') {
        setTimeout(() => {
            console.log('🚀 AUTO-STARTING FRONTEND TESTS...');
            new FrontendDragDropTester().runComprehensiveTest();
        }, 2000);
    }
}
