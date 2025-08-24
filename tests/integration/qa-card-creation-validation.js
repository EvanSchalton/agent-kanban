/**
 * QA VALIDATION SCRIPT: Card Creation Bug Fix
 * Tests: 1) Card creation on all columns 2) API port verification 3) board_id inclusion 4) CRUD workflow 5) Regression checks
 */

const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

class CardCreationQAValidator {
    constructor() {
        this.baseURL = 'http://localhost:5173';
        this.apiURL = 'http://localhost:18000';
        this.results = {
            timestamp: new Date().toISOString(),
            tests: [],
            summary: { passed: 0, failed: 0, total: 0 }
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    }

    addResult(testName, status, details = {}) {
        const result = {
            test: testName,
            status,
            timestamp: new Date().toISOString(),
            ...details
        };
        this.results.tests.push(result);
        this.results.summary.total++;
        if (status === 'PASS') {
            this.results.summary.passed++;
        } else {
            this.results.summary.failed++;
        }
        this.log(`${testName}: ${status}`, status === 'PASS' ? 'info' : 'error');
    }

    async validateAPIHealth() {
        try {
            const response = await fetch(`${this.apiURL}/health`);
            const data = await response.json();

            if (response.status === 200 && data.status === 'healthy') {
                this.addResult('API Health Check', 'PASS', { port: 18000, response: data });
                return true;
            } else {
                this.addResult('API Health Check', 'FAIL', { port: 18000, response: data });
                return false;
            }
        } catch (error) {
            this.addResult('API Health Check', 'FAIL', { port: 18000, error: error.message });
            return false;
        }
    }

    async validateBoardsAPI() {
        try {
            const response = await fetch(`${this.apiURL}/api/boards`);
            const boards = await response.json();

            if (response.status === 200 && Array.isArray(boards) && boards.length > 0) {
                this.addResult('Boards API Check', 'PASS', {
                    boardCount: boards.length,
                    sampleBoard: boards[0]
                });
                return boards[0].id; // Return first board ID for testing
            } else {
                this.addResult('Boards API Check', 'FAIL', { response: boards });
                return null;
            }
        } catch (error) {
            this.addResult('Boards API Check', 'FAIL', { error: error.message });
            return null;
        }
    }

    async testCardCreationAPI(boardId, columnStatus) {
        const testCard = {
            title: `QA Test Card - ${columnStatus}`,
            description: `Testing card creation in ${columnStatus} column`,
            status: columnStatus,
            board_id: boardId
        };

        try {
            const response = await fetch(`${this.apiURL}/api/tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testCard)
            });

            const responseData = await response.json();

            if (response.status === 201 && responseData.id) {
                this.addResult(`Card Creation API - ${columnStatus}`, 'PASS', {
                    cardId: responseData.id,
                    boardId: boardId,
                    status: columnStatus,
                    apiPort: 18000
                });
                return responseData.id;
            } else {
                this.addResult(`Card Creation API - ${columnStatus}`, 'FAIL', {
                    response: responseData,
                    status: response.status
                });
                return null;
            }
        } catch (error) {
            this.addResult(`Card Creation API - ${columnStatus}`, 'FAIL', {
                error: error.message
            });
            return null;
        }
    }

    async testCRUDWorkflow(boardId) {
        const testCard = {
            title: 'QA CRUD Test Card',
            description: 'Testing full CRUD workflow',
            status: 'To Do',
            board_id: boardId
        };

        try {
            // CREATE
            const createResponse = await fetch(`${this.apiURL}/api/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testCard)
            });
            const createdCard = await createResponse.json();

            if (createResponse.status !== 201) {
                this.addResult('CRUD - Create', 'FAIL', { response: createdCard });
                return;
            }

            const cardId = createdCard.id;

            // READ
            const readResponse = await fetch(`${this.apiURL}/api/tickets/${cardId}`);
            const readCard = await readResponse.json();

            if (readResponse.status !== 200 || readCard.id !== cardId) {
                this.addResult('CRUD - Read', 'FAIL', { cardId, response: readCard });
                return;
            }

            // UPDATE
            const updateData = { ...testCard, title: 'QA CRUD Test Card - Updated', status: 'In Progress' };
            const updateResponse = await fetch(`${this.apiURL}/api/tickets/${cardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            const updatedCard = await updateResponse.json();

            if (updateResponse.status !== 200 || updatedCard.title !== updateData.title) {
                this.addResult('CRUD - Update', 'FAIL', { cardId, response: updatedCard });
                return;
            }

            // DELETE
            const deleteResponse = await fetch(`${this.apiURL}/api/tickets/${cardId}`, {
                method: 'DELETE'
            });

            if (deleteResponse.status !== 204) {
                this.addResult('CRUD - Delete', 'FAIL', { cardId, status: deleteResponse.status });
                return;
            }

            // Verify deletion
            const verifyResponse = await fetch(`${this.apiURL}/api/tickets/${cardId}`);
            if (verifyResponse.status === 404) {
                this.addResult('CRUD Workflow', 'PASS', {
                    cardId,
                    operations: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    boardId: boardId
                });
            } else {
                this.addResult('CRUD - Delete Verification', 'FAIL', {
                    cardId,
                    status: verifyResponse.status
                });
            }

        } catch (error) {
            this.addResult('CRUD Workflow', 'FAIL', { error: error.message });
        }
    }

    async testBrowserCardCreation() {
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            // Monitor network requests to verify API port usage
            const apiRequests = [];
            page.on('request', request => {
                if (request.url().includes('/api/')) {
                    apiRequests.push({
                        url: request.url(),
                        method: request.method(),
                        postData: request.postData()
                    });
                }
            });

            await page.goto(this.baseURL, { waitUntil: 'networkidle2' });

            // Wait for the page to load
            await page.waitForSelector('.board-container', { timeout: 10000 });

            // Test card creation in each column
            const columns = ['To Do', 'In Progress', 'Done'];

            for (const column of columns) {
                try {
                    // Find and click the add card button for this column
                    await page.click(`[data-column="${column}"] .add-card-btn`);

                    // Fill in card details
                    await page.waitForSelector('.add-card-modal', { timeout: 5000 });
                    await page.type('#card-title', `QA Browser Test - ${column}`);
                    await page.type('#card-description', `Testing card creation in ${column} via browser`);

                    // Submit the form
                    await page.click('.add-card-submit');

                    // Wait for the card to appear
                    await page.waitForFunction(
                        (columnName) => {
                            const cards = document.querySelectorAll(`[data-column="${columnName}"] .ticket-card`);
                            return cards.length > 0;
                        },
                        { timeout: 5000 },
                        column
                    );

                    this.addResult(`Browser Card Creation - ${column}`, 'PASS', {
                        column: column,
                        method: 'browser'
                    });

                } catch (error) {
                    this.addResult(`Browser Card Creation - ${column}`, 'FAIL', {
                        column: column,
                        error: error.message
                    });
                }
            }

            // Verify API requests used correct port and included board_id
            const cardCreationRequests = apiRequests.filter(req =>
                req.method === 'POST' && req.url.includes('/api/tickets')
            );

            const correctPortUsage = cardCreationRequests.every(req =>
                req.url.includes('localhost:18000')
            );

            const boardIdIncluded = cardCreationRequests.every(req => {
                try {
                    const postData = JSON.parse(req.postData || '{}');
                    return postData.board_id !== undefined;
                } catch {
                    return false;
                }
            });

            this.addResult('API Port Verification', correctPortUsage ? 'PASS' : 'FAIL', {
                expectedPort: 18000,
                requests: cardCreationRequests.map(r => r.url)
            });

            this.addResult('Board ID Inclusion', boardIdIncluded ? 'PASS' : 'FAIL', {
                requests: cardCreationRequests.length,
                validRequests: cardCreationRequests.filter(req => {
                    try {
                        const postData = JSON.parse(req.postData || '{}');
                        return postData.board_id !== undefined;
                    } catch {
                        return false;
                    }
                }).length
            });

        } catch (error) {
            this.addResult('Browser Testing', 'FAIL', { error: error.message });
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async runValidation() {
        this.log('Starting QA validation for card creation bug fix...');

        // 1. Validate API health and port 18000
        const apiHealthy = await this.validateAPIHealth();
        if (!apiHealthy) {
            this.log('API health check failed - aborting tests', 'error');
            return this.generateReport();
        }

        // 2. Get board for testing
        const boardId = await this.validateBoardsAPI();
        if (!boardId) {
            this.log('No boards available for testing - aborting', 'error');
            return this.generateReport();
        }

        // 3. Test card creation on all columns via API
        const columns = ['To Do', 'In Progress', 'Done'];
        for (const column of columns) {
            await this.testCardCreationAPI(boardId, column);
        }

        // 4. Test full CRUD workflow
        await this.testCRUDWorkflow(boardId);

        // 5. Test browser-based card creation
        await this.testBrowserCardCreation();

        this.log('QA validation completed');
        return this.generateReport();
    }

    generateReport() {
        const report = {
            ...this.results,
            summary: {
                ...this.results.summary,
                successRate: `${Math.round((this.results.summary.passed / this.results.summary.total) * 100)}%`
            }
        };

        console.log('\n=== QA VALIDATION REPORT ===');
        console.log(`Total Tests: ${report.summary.total}`);
        console.log(`Passed: ${report.summary.passed}`);
        console.log(`Failed: ${report.summary.failed}`);
        console.log(`Success Rate: ${report.summary.successRate}`);
        console.log('\nDetailed Results:');

        report.tests.forEach(test => {
            console.log(`- ${test.test}: ${test.status}`);
            if (test.status === 'FAIL' && test.error) {
                console.log(`  Error: ${test.error}`);
            }
        });

        return report;
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new CardCreationQAValidator();
    validator.runValidation()
        .then(report => {
            process.exit(report.summary.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Validation failed:', error);
            process.exit(1);
        });
}

module.exports = CardCreationQAValidator;
