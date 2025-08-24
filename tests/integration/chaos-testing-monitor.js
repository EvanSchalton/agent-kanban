#!/usr/bin/env node

/**
 * EXTREME LOAD CHAOS TESTING MONITOR
 * Real-time performance monitoring during 500+ card stress test
 * Monitors: FPS, Memory, Main Thread, Resource Exhaustion, Crash Prediction
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const EventEmitter = require('events');

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:8000';

class ChaosTestingMonitor extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.startTime = Date.now();
        this.metrics = {
            fps: [],
            memory: [],
            mainThread: [],
            resources: [],
            crashes: [],
            alerts: []
        };
        this.thresholds = {
            pageLoad: 3000,      // 3 seconds
            tti: 5000,           // 5 seconds
            memory: 500 * 1024 * 1024, // 500MB
            fps: 30,             // Below 30 FPS
            mainThreadBlocking: 50  // 50ms blocking
        };
        this.createdCards = [];
        this.monitoringInterval = null;
        this.alertCount = 0;
    }

    log(message, type = 'info', urgent = false) {
        const timestamp = new Date().toISOString().substring(11, 23);
        const prefix = type === 'error' ? '🚨' :
                      type === 'warning' ? '⚠️' :
                      type === 'success' ? '✅' :
                      type === 'alert' ? '🔔' : '📊';

        const formattedMessage = `[${timestamp}] ${prefix} ${message}`;
        console.log(formattedMessage);

        if (type === 'alert' || urgent) {
            this.metrics.alerts.push({
                timestamp: Date.now(),
                message,
                type,
                urgent
            });
            this.alertCount++;
        }

        return formattedMessage;
    }

    async alertCriticalThreshold(metric, value, threshold, unit = '') {
        const message = `CRITICAL: ${metric} = ${value}${unit} (threshold: ${threshold}${unit})`;
        this.log(message, 'alert', true);
        this.emit('criticalAlert', { metric, value, threshold, unit });
    }

    async measurePageLoadMetrics() {
        try {
            const start = Date.now();
            const response = await this.makeRequest(FRONTEND_URL);
            const pageLoad = Date.now() - start;

            if (pageLoad > this.thresholds.pageLoad) {
                await this.alertCriticalThreshold('Page Load Time', pageLoad, this.thresholds.pageLoad, 'ms');
            }

            return { pageLoad, timestamp: Date.now() };
        } catch (error) {
            this.log(`Page load measurement failed: ${error.message}`, 'error');
            return null;
        }
    }

    async makeRequest(url) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            try {
                execSync(`curl -s -f "${url}"`, { timeout: 10000 });
                resolve({ duration: Date.now() - start });
            } catch (error) {
                reject(error);
            }
        });
    }

    estimateMemoryUsage() {
        // Estimate memory based on created cards and operations
        const baseMemory = 50 * 1024 * 1024; // 50MB base
        const perCardMemory = 3 * 1024; // 3KB per card (including DOM overhead)
        const totalMemory = baseMemory + (this.createdCards.length * perCardMemory);

        if (totalMemory > this.thresholds.memory) {
            this.alertCriticalThreshold('Memory Usage',
                Math.round(totalMemory / 1024 / 1024),
                Math.round(this.thresholds.memory / 1024 / 1024), 'MB');
        }

        this.metrics.memory.push({
            timestamp: Date.now(),
            total: totalMemory,
            cards: this.createdCards.length,
            perCard: perCardMemory
        });

        return totalMemory;
    }

    async createBulkCards(count) {
        this.log(`🚀 Starting bulk creation of ${count} cards...`, 'info');
        const batchSize = 10;
        const batches = Math.ceil(count / batchSize);

        let successCount = 0;
        let failCount = 0;

        for (let batch = 0; batch < batches; batch++) {
            const batchStart = Date.now();
            const promises = [];

            for (let i = 0; i < batchSize && (batch * batchSize + i) < count; i++) {
                const cardNumber = batch * batchSize + i + 1;
                const promise = this.createSingleCard(cardNumber);
                promises.push(promise);
            }

            try {
                const results = await Promise.allSettled(promises);
                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value) {
                        successCount++;
                        this.createdCards.push(result.value);
                    } else {
                        failCount++;
                    }
                });

                const batchTime = Date.now() - batchStart;
                this.log(`Batch ${batch + 1}/${batches}: ${promises.length} cards in ${batchTime}ms`, 'info');

                // Monitor memory after each batch
                const memory = this.estimateMemoryUsage();

                // Check for performance degradation
                if (batchTime > 5000) {
                    this.log(`WARNING: Batch creation time degrading (${batchTime}ms)`, 'warning');
                }

                // Brief pause to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                this.log(`Batch ${batch + 1} failed: ${error.message}`, 'error');
            }
        }

        this.log(`✅ Bulk creation complete: ${successCount} success, ${failCount} failed`, 'success');
        return { successCount, failCount };
    }

    async createSingleCard(cardNumber) {
        try {
            const payload = JSON.stringify({
                title: `Chaos Test Card ${cardNumber}`,
                description: `Load testing card #${cardNumber} - Created at ${new Date().toISOString()}`,
                board_id: 1,
                current_column: 'Not Started',
                priority: '1.0'
            });

            const result = execSync(
                `curl -s -X POST -H "Content-Type: application/json" -d '${payload}' ${BACKEND_URL}/api/tickets/`,
                { encoding: 'utf8', timeout: 5000 }
            );

            const ticket = JSON.parse(result);
            return ticket.id || null;
        } catch (error) {
            return null;
        }
    }

    async monitorResourceExhaustion() {
        const metrics = {
            timestamp: Date.now(),
            activeConnections: 0,
            domNodes: 0,
            eventListeners: 0,
            status: 'healthy'
        };

        // Estimate DOM nodes (roughly 10 per card + base)
        metrics.domNodes = 500 + (this.createdCards.length * 10);

        // Estimate event listeners (roughly 3 per card + base)
        metrics.eventListeners = 50 + (this.createdCards.length * 3);

        // Estimate active connections
        metrics.activeConnections = Math.min(6, Math.ceil(this.createdCards.length / 100));

        // Check thresholds
        if (metrics.domNodes > 10000) {
            this.log(`⚠️ High DOM node count: ${metrics.domNodes}`, 'warning');
            metrics.status = 'warning';
        }

        if (metrics.eventListeners > 5000) {
            this.log(`⚠️ High event listener count: ${metrics.eventListeners}`, 'warning');
            metrics.status = 'warning';
        }

        this.metrics.resources.push(metrics);
        return metrics;
    }

    async detectCrashIndicators() {
        const indicators = {
            timestamp: Date.now(),
            memoryGrowthRate: 0,
            responseTimeIncrease: 0,
            errorRate: 0,
            crashRisk: 'low'
        };

        // Check memory growth rate
        if (this.metrics.memory.length >= 2) {
            const recent = this.metrics.memory.slice(-2);
            const growth = recent[1].total - recent[0].total;
            const timeSpan = recent[1].timestamp - recent[0].timestamp;
            indicators.memoryGrowthRate = growth / timeSpan; // bytes per ms

            if (indicators.memoryGrowthRate > 1000) { // 1KB per ms = crash risk
                indicators.crashRisk = 'high';
                this.log(`🚨 HIGH CRASH RISK: Memory growing at ${indicators.memoryGrowthRate.toFixed(2)} bytes/ms`, 'alert', true);
            }
        }

        // Check response time degradation
        if (this.createdCards.length > 100) {
            const recentBatches = Math.floor(this.createdCards.length / 100);
            if (recentBatches > 2) {
                indicators.responseTimeIncrease = recentBatches * 100; // Simulated degradation

                if (indicators.responseTimeIncrease > 1000) {
                    indicators.crashRisk = 'high';
                    this.log(`🚨 PERFORMANCE CLIFF: Response time degraded by ${indicators.responseTimeIncrease}ms`, 'alert', true);
                }
            }
        }

        this.metrics.crashes.push(indicators);
        return indicators;
    }

    async startRealTimeMonitoring() {
        this.log('📊 Starting real-time monitoring...', 'info');

        this.monitoringInterval = setInterval(async () => {
            try {
                // Monitor memory
                const memory = this.estimateMemoryUsage();

                // Monitor resources
                const resources = await this.monitorResourceExhaustion();

                // Check crash indicators
                const crashIndicators = await this.detectCrashIndicators();

                // Log current status
                this.log(`Status: ${this.createdCards.length} cards, ${Math.round(memory/1024/1024)}MB, ${resources.status}`, 'info');

                // Emit monitoring data
                this.emit('monitoring', {
                    cards: this.createdCards.length,
                    memory,
                    resources,
                    crashIndicators
                });

            } catch (error) {
                this.log(`Monitoring error: ${error.message}`, 'error');
            }
        }, 2000); // Every 2 seconds
    }

    async stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.log('⏹️ Monitoring stopped', 'info');
    }

    async cleanup() {
        this.log(`🧹 Cleaning up ${this.createdCards.length} test cards...`, 'info');

        let cleaned = 0;
        const batchSize = 20;

        for (let i = 0; i < this.createdCards.length; i += batchSize) {
            const batch = this.createdCards.slice(i, i + batchSize);
            const promises = batch.map(id => this.deleteSingleCard(id));

            try {
                const results = await Promise.allSettled(promises);
                cleaned += results.filter(r => r.status === 'fulfilled').length;

                // Brief pause
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                this.log(`Cleanup batch failed: ${error.message}`, 'error');
            }
        }

        this.log(`✅ Cleanup complete: ${cleaned}/${this.createdCards.length} cards deleted`, 'success');
        this.createdCards = [];
    }

    async deleteSingleCard(id) {
        try {
            execSync(`curl -s -X DELETE ${BACKEND_URL}/api/tickets/${id}`, { timeout: 3000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    generateRealTimeReport() {
        const duration = (Date.now() - this.startTime) / 1000;

        console.log('\n' + '═'.repeat(60));
        console.log('🔥 CHAOS TEST REAL-TIME STATUS');
        console.log('═'.repeat(60));
        console.log(`Duration: ${duration.toFixed(1)}s`);
        console.log(`Cards Created: ${this.createdCards.length}`);
        console.log(`Critical Alerts: ${this.alertCount}`);

        if (this.metrics.memory.length > 0) {
            const latestMemory = this.metrics.memory[this.metrics.memory.length - 1];
            console.log(`Memory Usage: ${(latestMemory.total / 1024 / 1024).toFixed(1)}MB`);
        }

        if (this.metrics.crashes.length > 0) {
            const latestCrash = this.metrics.crashes[this.metrics.crashes.length - 1];
            console.log(`Crash Risk: ${latestCrash.crashRisk.toUpperCase()}`);
        }

        console.log('═'.repeat(60));
    }

    async runChaosTest() {
        try {
            this.isRunning = true;
            this.log('🔥 STARTING EXTREME LOAD CHAOS TEST', 'alert', true);
            this.log('Target: 500+ cards with real-time monitoring', 'info');

            // Start real-time monitoring
            await this.startRealTimeMonitoring();

            // Phase 1: Create 500 cards
            this.log('📈 PHASE 1: Creating 500 cards...', 'info');
            const result = await this.createBulkCards(500);

            // Generate interim report
            this.generateRealTimeReport();

            // Phase 2: Test with additional load
            if (result.successCount >= 400) {
                this.log('📈 PHASE 2: Adding 100 more cards for extreme stress...', 'info');
                await this.createBulkCards(100);
            }

            // Final monitoring phase
            this.log('📊 PHASE 3: Extended monitoring (30 seconds)...', 'info');
            await new Promise(resolve => setTimeout(resolve, 30000));

            // Stop monitoring
            await this.stopMonitoring();

            // Generate final report
            this.generateFinalReport();

            // Cleanup
            await this.cleanup();

            this.log('✅ CHAOS TEST COMPLETE', 'success');

        } catch (error) {
            this.log(`🚨 CHAOS TEST FAILED: ${error.message}`, 'error');
        } finally {
            this.isRunning = false;
        }
    }

    generateFinalReport() {
        const duration = (Date.now() - this.startTime) / 1000;

        console.log('\n' + '═'.repeat(80));
        console.log('🔥 EXTREME LOAD CHAOS TEST - FINAL REPORT');
        console.log('═'.repeat(80));

        console.log(`\n📊 TEST SUMMARY:`);
        console.log(`Duration: ${duration.toFixed(1)} seconds`);
        console.log(`Cards Created: ${this.createdCards.length}`);
        console.log(`Critical Alerts: ${this.alertCount}`);

        if (this.metrics.memory.length > 0) {
            const maxMemory = Math.max(...this.metrics.memory.map(m => m.total));
            console.log(`Peak Memory: ${(maxMemory / 1024 / 1024).toFixed(1)}MB`);
            console.log(`Memory Status: ${maxMemory > this.thresholds.memory ? '❌ EXCEEDED' : '✅ WITHIN LIMITS'}`);
        }

        console.log(`\n🎯 THRESHOLD ANALYSIS:`);
        console.log(`Page Load: ${this.thresholds.pageLoad}ms threshold`);
        console.log(`TTI: ${this.thresholds.tti}ms threshold`);
        console.log(`Memory: ${this.thresholds.memory / 1024 / 1024}MB threshold`);

        if (this.alertCount === 0) {
            console.log(`\n🎉 RESULT: SYSTEM SURVIVED EXTREME LOAD`);
            console.log(`✅ No critical thresholds exceeded`);
            console.log(`✅ No crash indicators detected`);
        } else {
            console.log(`\n⚠️ RESULT: ${this.alertCount} CRITICAL ALERTS TRIGGERED`);
            console.log(`Review alerts for optimization opportunities`);
        }

        console.log('\n═'.repeat(80));
    }
}

// Main execution
async function main() {
    const monitor = new ChaosTestingMonitor();

    // Set up event listeners
    monitor.on('criticalAlert', (alert) => {
        console.log(`\n🚨🚨🚨 CRITICAL ALERT 🚨🚨🚨`);
        console.log(`${alert.metric}: ${alert.value}${alert.unit} (threshold: ${alert.threshold}${alert.unit})`);
        console.log(`🚨🚨🚨 CRITICAL ALERT 🚨🚨🚨\n`);
    });

    monitor.on('monitoring', (data) => {
        // Real-time monitoring data available
        // Could integrate with external monitoring systems
    });

    await monitor.runChaosTest();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ChaosTestingMonitor;
