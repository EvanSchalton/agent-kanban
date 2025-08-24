#!/usr/bin/env node

/**
 * FRONTEND PERFORMANCE MONITORING SYSTEM
 * Monitors application performance and stability
 * Focus: Page load times, Component rendering, Memory usage, Network optimization
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = 'http://localhost:5173';
const LOG_FILE = 'frontend-performance-log.json';
const MONITORING_INTERVAL = 15 * 60 * 1000; // 15 minutes

class PerformanceMonitor {
    constructor() {
        this.measurements = [];
        this.startTime = new Date();
        this.logFile = path.join(__dirname, LOG_FILE);
        this.loadExistingData();
    }

    loadExistingData() {
        try {
            if (fs.existsSync(this.logFile)) {
                const data = fs.readFileSync(this.logFile, 'utf8');
                this.measurements = JSON.parse(data);
                console.log(`📊 Loaded ${this.measurements.length} existing measurements`);
            }
        } catch (error) {
            console.log('📝 Starting fresh performance log');
            this.measurements = [];
        }
    }

    async measurePageLoadTime() {
        try {
            const curlCommand = `curl -s -w "time_namelookup: %{time_namelookup}\\ntime_connect: %{time_connect}\\ntime_appconnect: %{time_appconnect}\\ntime_pretransfer: %{time_pretransfer}\\ntime_redirect: %{time_redirect}\\ntime_starttransfer: %{time_starttransfer}\\ntime_total: %{time_total}\\nsize_download: %{size_download}\\nsize_header: %{size_header}\\nspeed_download: %{speed_download}\\nhttp_code: %{http_code}" -o /dev/null ${FRONTEND_URL}`;

            const result = execSync(curlCommand, { encoding: 'utf8' });
            const lines = result.split('\\n').filter(line => line.trim());

            const metrics = {};
            lines.forEach(line => {
                const [key, value] = line.split(': ');
                if (key && value) {
                    metrics[key] = value;
                }
            });

            return {
                namelookup: parseFloat(metrics.time_namelookup) * 1000,
                connect: parseFloat(metrics.time_connect) * 1000,
                starttransfer: parseFloat(metrics.time_starttransfer) * 1000,
                total: parseFloat(metrics.time_total) * 1000,
                downloadSize: parseInt(metrics.size_download),
                headerSize: parseInt(metrics.size_header),
                downloadSpeed: parseInt(metrics.speed_download),
                httpCode: parseInt(metrics.http_code)
            };
        } catch (error) {
            console.error('❌ Failed to measure page load time:', error.message);
            return null;
        }
    }

    async checkNetworkRequests() {
        try {
            // Check API endpoints
            const apiTests = [
                { name: 'health', url: `${FRONTEND_URL.replace('5173', '8000')}/health` },
                { name: 'boards', url: `${FRONTEND_URL}/api/boards/1` },
                { name: 'tickets', url: `${FRONTEND_URL}/api/boards/1/tickets` }
            ];

            const networkMetrics = {};

            for (const test of apiTests) {
                try {
                    const start = Date.now();
                    const result = execSync(`curl -s -w "%{http_code}" -o /dev/null ${test.url}`, { encoding: 'utf8' });
                    const duration = Date.now() - start;
                    const statusCode = parseInt(result.trim());

                    networkMetrics[test.name] = {
                        duration,
                        statusCode,
                        success: statusCode >= 200 && statusCode < 300
                    };
                } catch (error) {
                    networkMetrics[test.name] = {
                        duration: -1,
                        statusCode: 0,
                        success: false,
                        error: error.message
                    };
                }
            }

            return networkMetrics;
        } catch (error) {
            console.error('❌ Failed to check network requests:', error.message);
            return {};
        }
    }

    async checkApplicationHealth() {
        try {
            // Check if frontend is responsive
            const frontendCheck = execSync(`curl -s -w "%{http_code}" -o /dev/null ${FRONTEND_URL}`, { encoding: 'utf8' });
            const frontendStatus = parseInt(frontendCheck.trim());

            // Check backend health
            const backendCheck = execSync(`curl -s -w "%{http_code}" -o /dev/null ${FRONTEND_URL.replace('5173', '8000')}/health`, { encoding: 'utf8' });
            const backendStatus = parseInt(backendCheck.trim());

            return {
                frontend: {
                    status: frontendStatus,
                    healthy: frontendStatus === 200
                },
                backend: {
                    status: backendStatus,
                    healthy: backendStatus === 200
                }
            };
        } catch (error) {
            console.error('❌ Failed to check application health:', error.message);
            return {
                frontend: { status: 0, healthy: false },
                backend: { status: 0, healthy: false }
            };
        }
    }

    async runPerformanceCheck() {
        const timestamp = new Date().toISOString();
        console.log(`\\n🔍 Performance Check at ${timestamp}`);
        console.log('='.repeat(60));

        const measurement = {
            timestamp,
            pageLoad: await this.measurePageLoadTime(),
            network: await this.checkNetworkRequests(),
            health: await this.checkApplicationHealth()
        };

        this.measurements.push(measurement);
        this.saveData();
        this.analyzePerformance(measurement);

        return measurement;
    }

    analyzePerformance(current) {
        console.log('📊 PERFORMANCE ANALYSIS:');

        // Page Load Analysis
        if (current.pageLoad) {
            console.log(`⏱️  Page Load Time: ${current.pageLoad.total.toFixed(2)}ms`);
            console.log(`🔗 Connection Time: ${current.pageLoad.connect.toFixed(2)}ms`);
            console.log(`📦 Download Size: ${(current.pageLoad.downloadSize / 1024).toFixed(2)}KB`);
            console.log(`🚀 Download Speed: ${(current.pageLoad.downloadSpeed / 1024).toFixed(2)}KB/s`);

            // Performance thresholds
            if (current.pageLoad.total > 3000) {
                console.log('⚠️  WARNING: Page load time exceeds 3 seconds');
            }
            if (current.pageLoad.downloadSize > 1024 * 1024) {
                console.log('⚠️  WARNING: Large download size detected');
            }
        }

        // Network Analysis
        console.log('\\n🌐 NETWORK PERFORMANCE:');
        Object.entries(current.network).forEach(([name, metrics]) => {
            const status = metrics.success ? '✅' : '❌';
            console.log(`${status} ${name}: ${metrics.duration}ms (HTTP ${metrics.statusCode})`);

            if (metrics.duration > 1000) {
                console.log(`⚠️  WARNING: ${name} API slow response (${metrics.duration}ms)`);
            }
        });

        // Health Analysis
        console.log('\\n🏥 APPLICATION HEALTH:');
        console.log(`Frontend: ${current.health.frontend.healthy ? '✅' : '❌'} (${current.health.frontend.status})`);
        console.log(`Backend: ${current.health.backend.healthy ? '✅' : '❌'} (${current.health.backend.status})`);

        // Historical comparison
        if (this.measurements.length > 1) {
            this.compareWithPrevious(current);
        }
    }

    compareWithPrevious(current) {
        const previous = this.measurements[this.measurements.length - 2];
        console.log('\\n📈 TREND ANALYSIS:');

        if (current.pageLoad && previous.pageLoad) {
            const loadTimeDiff = current.pageLoad.total - previous.pageLoad.total;
            const trend = loadTimeDiff > 0 ? '📈' : '📉';
            console.log(`${trend} Page load time change: ${loadTimeDiff.toFixed(2)}ms`);
        }

        // Network trends
        Object.keys(current.network).forEach(api => {
            if (previous.network[api]) {
                const timeDiff = current.network[api].duration - previous.network[api].duration;
                const trend = timeDiff > 0 ? '📈' : '📉';
                console.log(`${trend} ${api} API response change: ${timeDiff}ms`);
            }
        });
    }

    generateOptimizationRecommendations() {
        console.log('\\n🔧 OPTIMIZATION RECOMMENDATIONS:');

        const recent = this.measurements.slice(-5); // Last 5 measurements

        // Analyze patterns
        const avgLoadTime = recent.reduce((sum, m) => sum + (m.pageLoad?.total || 0), 0) / recent.length;
        const slowAPIs = {};

        recent.forEach(m => {
            Object.entries(m.network).forEach(([api, metrics]) => {
                if (!slowAPIs[api]) slowAPIs[api] = [];
                slowAPIs[api].push(metrics.duration);
            });
        });

        // Generate recommendations
        if (avgLoadTime > 2000) {
            console.log('🎯 Consider implementing code splitting for faster initial loads');
            console.log('🎯 Optimize bundle size and enable compression');
        }

        Object.entries(slowAPIs).forEach(([api, times]) => {
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            if (avgTime > 500) {
                console.log(`🎯 ${api} API optimization needed (avg: ${avgTime.toFixed(0)}ms)`);
            }
        });

        console.log('🎯 Consider implementing service worker for caching');
        console.log('🎯 Monitor memory usage during user interactions');
    }

    saveData() {
        try {
            fs.writeFileSync(this.logFile, JSON.stringify(this.measurements, null, 2));
        } catch (error) {
            console.error('❌ Failed to save performance data:', error.message);
        }
    }

    generateReport() {
        console.log('\\n📋 PERFORMANCE MONITORING REPORT');
        console.log('='.repeat(60));
        console.log(`Monitoring Duration: ${((Date.now() - this.startTime.getTime()) / 1000 / 60).toFixed(1)} minutes`);
        console.log(`Total Measurements: ${this.measurements.length}`);

        if (this.measurements.length > 0) {
            const latest = this.measurements[this.measurements.length - 1];
            console.log(`Last Check: ${latest.timestamp}`);
            console.log(`Current Status: ${latest.health.frontend.healthy && latest.health.backend.healthy ? 'Healthy' : 'Issues Detected'}`);
        }

        this.generateOptimizationRecommendations();
    }
}

// Main execution
async function main() {
    console.log('🚀 FRONTEND PERFORMANCE MONITORING SYSTEM');
    console.log('==========================================');
    console.log(`Monitoring: ${FRONTEND_URL}`);
    console.log(`Interval: 15 minutes`);
    console.log(`Log file: ${LOG_FILE}`);

    const monitor = new PerformanceMonitor();

    // Initial measurement
    await monitor.runPerformanceCheck();
    monitor.generateReport();

    // Set up periodic monitoring
    console.log('\\n⏰ Starting periodic monitoring...');
    setInterval(async () => {
        await monitor.runPerformanceCheck();
        monitor.generateReport();
    }, MONITORING_INTERVAL);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = PerformanceMonitor;
