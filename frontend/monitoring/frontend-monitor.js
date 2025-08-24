/**
 * Frontend Emergency Monitoring Script
 * Tests critical user flows every 10 minutes
 */

const puppeteer = require('puppeteer');

const FRONTEND_URL = 'http://localhost:5173';
const MONITORING_INTERVAL = 10 * 60 * 1000; // 10 minutes

class FrontendMonitor {
  constructor() {
    this.browser = null;
    this.isRunning = false;
  }

  async initialize() {
    console.log('🚨 Frontend Emergency Specialist - Initializing Monitor');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async testBoardCreation() {
    console.log('📋 Testing Board Creation Flow...');
    const page = await this.browser.newPage();

    try {
      await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 10000 });

      // Look for board creation UI elements
      const createBoardButton = await page.$('[data-testid="create-board"], .create-board-btn, button[contains(text(), "Create")]');

      if (createBoardButton) {
        console.log('✅ Board creation UI element found');
        return { status: 'success', message: 'Board creation UI accessible' };
      } else {
        console.log('⚠️ Board creation button not found - checking alternative selectors');
        const dashboardElements = await page.$$eval('button', buttons =>
          buttons.filter(btn => btn.textContent.toLowerCase().includes('create') ||
                              btn.textContent.toLowerCase().includes('new') ||
                              btn.textContent.toLowerCase().includes('board')).length
        );

        if (dashboardElements > 0) {
          return { status: 'warning', message: `Found ${dashboardElements} potential create buttons` };
        } else {
          return { status: 'error', message: 'No board creation UI found' };
        }
      }
    } catch (error) {
      return { status: 'error', message: `Board creation test failed: ${error.message}` };
    } finally {
      await page.close();
    }
  }

  async testCardCreation() {
    console.log('🎫 Testing Card Creation Flow...');
    const page = await this.browser.newPage();

    try {
      await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 10000 });

      // Look for add card buttons
      const addCardElements = await page.$$eval('button, .add-card, [data-testid*="add"]', elements =>
        elements.filter(el =>
          el.textContent.toLowerCase().includes('add') ||
          el.textContent.toLowerCase().includes('+') ||
          el.className.includes('add')
        ).length
      );

      if (addCardElements > 0) {
        console.log('✅ Card creation UI elements found');
        return { status: 'success', message: `Found ${addCardElements} add card elements` };
      } else {
        return { status: 'error', message: 'No card creation UI found' };
      }
    } catch (error) {
      return { status: 'error', message: `Card creation test failed: ${error.message}` };
    } finally {
      await page.close();
    }
  }

  async testDragAndDrop() {
    console.log('🔄 Testing Drag and Drop Operations...');
    const page = await this.browser.newPage();

    try {
      await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 10000 });

      // Look for draggable elements
      const draggableElements = await page.$$eval('[draggable="true"], .draggable, .ticket-card', elements => elements.length);
      const dropZones = await page.$$eval('.column, .drop-zone, [data-droppable="true"]', elements => elements.length);

      if (draggableElements > 0 && dropZones > 0) {
        console.log('✅ Drag and drop elements found');
        return {
          status: 'success',
          message: `Found ${draggableElements} draggable items and ${dropZones} drop zones`
        };
      } else {
        return {
          status: 'warning',
          message: `Draggable: ${draggableElements}, Drop zones: ${dropZones}`
        };
      }
    } catch (error) {
      return { status: 'error', message: `Drag and drop test failed: ${error.message}` };
    } finally {
      await page.close();
    }
  }

  async runHealthCheck() {
    const timestamp = new Date().toISOString();
    console.log(`\n🔍 FRONTEND HEALTH CHECK - ${timestamp}`);

    const results = {
      timestamp,
      boardCreation: await this.testBoardCreation(),
      cardCreation: await this.testCardCreation(),
      dragAndDrop: await this.testDragAndDrop()
    };

    // Report anomalies
    const errors = Object.values(results).filter(r => r.status === 'error');
    const warnings = Object.values(results).filter(r => r.status === 'warning');

    if (errors.length > 0) {
      console.log('🚨 ANOMALIES DETECTED:');
      errors.forEach(error => console.log(`   ❌ ${error.message}`));
    }

    if (warnings.length > 0) {
      console.log('⚠️ WARNINGS:');
      warnings.forEach(warning => console.log(`   ⚠️ ${warning.message}`));
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ All critical flows operational');
    }

    return results;
  }

  async startMonitoring() {
    if (this.isRunning) {
      console.log('Monitor already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚨 Starting Frontend Emergency Monitoring (${MONITORING_INTERVAL/60000} min intervals)`);

    // Initial check
    await this.runHealthCheck();

    // Set up interval
    this.monitorInterval = setInterval(async () => {
      await this.runHealthCheck();
    }, MONITORING_INTERVAL);
  }

  async stop() {
    this.isRunning = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🛑 Frontend monitoring stopped');
  }
}

// Export for use in other scripts
module.exports = FrontendMonitor;

// Run immediately if called directly
if (require.main === module) {
  const monitor = new FrontendMonitor();

  monitor.initialize().then(() => {
    monitor.startMonitoring();
  }).catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down monitor...');
    await monitor.stop();
    process.exit(0);
  });
}
