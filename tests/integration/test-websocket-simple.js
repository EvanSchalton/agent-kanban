#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🔗 Testing WebSocket connection to backend...');
console.log('URL: ws://localhost:18000/ws/connect');

const ws = new WebSocket('ws://localhost:18000/ws/connect');

let messageCount = 0;
let connected = false;

ws.on('open', () => {
    console.log('✅ WebSocket connected successfully');
    connected = true;

    // Send a test ping
    ws.send(JSON.stringify({ type: 'ping' }));
    console.log('📤 Sent ping message');
});

ws.on('message', (data) => {
    messageCount++;
    try {
        const message = JSON.parse(data);

        if (message.event === 'heartbeat') {
            console.log(`💓 Heartbeat received (${messageCount})`);
        } else if (message.type === 'pong') {
            console.log(`🏓 Pong received (${messageCount})`);
        } else {
            console.log(`📡 Message ${messageCount}:`, JSON.stringify(message, null, 2));
        }
    } catch (error) {
        console.log(`📡 Raw message ${messageCount}:`, data.toString());
    }
});

ws.on('error', (error) => {
    console.error('🚨 WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`❌ WebSocket closed: ${code} ${reason}`);
    process.exit(connected ? 0 : 1);
});

// Test API call to trigger WebSocket event
setTimeout(() => {
    if (connected) {
        console.log('🧪 Testing API call to trigger WebSocket event...');

        const https = require('http');
        const postData = JSON.stringify({
            title: `WebSocket Test Ticket ${Date.now()}`,
            description: 'Testing WebSocket synchronization',
            board_id: 1,
            current_column: 'Not Started',
            created_by: 'websocket-test'
        });

        const options = {
            hostname: 'localhost',
            port: 18000,
            path: '/api/tickets/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            console.log(`📊 API Response: ${res.statusCode}`);
            res.on('data', (chunk) => {
                console.log('📊 API Response data:', chunk.toString());
            });
        });

        req.on('error', (error) => {
            console.error('🚨 API request error:', error.message);
        });

        req.write(postData);
        req.end();
    }
}, 2000);

// Auto-exit after 10 seconds
setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
}, 10000);

process.on('SIGINT', () => {
    console.log('\n👋 Closing WebSocket connection...');
    ws.close();
});
