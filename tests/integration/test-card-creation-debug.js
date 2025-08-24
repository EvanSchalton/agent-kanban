#!/usr/bin/env node

/**
 * Emergency Card Creation Debug Test
 * Tests the full frontend card creation flow to identify "resource not found" errors
 */

const fetch = require('node-fetch');

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:8000';

async function testBackendDirectly() {
    console.log('🔧 Testing backend API directly...');

    try {
        // Test health
        const healthResponse = await fetch(`${BACKEND_URL}/health`);
        const health = await healthResponse.json();
        console.log('✅ Backend health:', health);

        // Test board existence
        const boardResponse = await fetch(`${BACKEND_URL}/api/boards/1`);
        if (!boardResponse.ok) {
            console.error('❌ Board 1 not found:', boardResponse.status, await boardResponse.text());
            return false;
        }
        const board = await boardResponse.json();
        console.log('✅ Board 1 exists:', board.name);

        // Test ticket creation
        const testTicket = {
            title: 'Debug Test Card',
            description: 'Testing card creation flow',
            acceptance_criteria: 'Should create successfully',
            priority: '1.0',
            assignee: 'debug-agent',
            board_id: 1,
            current_column: 'Not Started'
        };

        console.log('📤 Creating test ticket:', testTicket);
        const createResponse = await fetch(`${BACKEND_URL}/api/tickets/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testTicket)
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('❌ Failed to create ticket:', createResponse.status, errorText);
            return false;
        }

        const createdTicket = await createResponse.json();
        console.log('✅ Ticket created successfully:', createdTicket.id, createdTicket.title);

        // Clean up
        await fetch(`${BACKEND_URL}/api/tickets/${createdTicket.id}`, { method: 'DELETE' });
        console.log('🗑️ Test ticket cleaned up');

        return true;
    } catch (error) {
        console.error('❌ Backend test failed:', error.message);
        return false;
    }
}

async function testFrontendAPI() {
    console.log('🎯 Testing frontend API calls...');

    try {
        // Test the frontend's API proxy
        const boardResponse = await fetch(`${FRONTEND_URL}/api/boards/1`);
        if (!boardResponse.ok) {
            console.error('❌ Frontend proxy failed for board:', boardResponse.status, await boardResponse.text());
            return false;
        }

        const board = await boardResponse.json();
        console.log('✅ Frontend proxy working for board:', board.name);

        // Test ticket creation through frontend proxy
        const testTicket = {
            title: 'Frontend Debug Test Card',
            description: 'Testing frontend proxy',
            acceptance_criteria: 'Should work through proxy',
            priority: '1.0',
            assignee: 'frontend-debug',
            board_id: 1,
            current_column: 'Not Started'
        };

        const createResponse = await fetch(`${FRONTEND_URL}/api/tickets/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testTicket)
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('❌ Frontend proxy failed for ticket creation:', createResponse.status, errorText);
            return false;
        }

        const createdTicket = await createResponse.json();
        console.log('✅ Ticket created through frontend proxy:', createdTicket.id);

        // Clean up
        await fetch(`${FRONTEND_URL}/api/tickets/${createdTicket.id}`, { method: 'DELETE' });
        console.log('🗑️ Frontend test ticket cleaned up');

        return true;
    } catch (error) {
        console.error('❌ Frontend proxy test failed:', error.message);
        return false;
    }
}

async function analyzeCommonErrors() {
    console.log('🔍 Analyzing common error patterns...');

    // Test with invalid board_id
    try {
        const invalidBoardResponse = await fetch(`${BACKEND_URL}/api/boards/999`);
        if (invalidBoardResponse.status === 404) {
            console.log('✅ Correct 404 for invalid board');
        } else {
            console.log('⚠️ Unexpected response for invalid board:', invalidBoardResponse.status);
        }
    } catch (error) {
        console.log('❌ Error testing invalid board:', error.message);
    }

    // Test with malformed ticket data
    try {
        const badTicket = {
            title: '', // Empty title
            board_id: 'invalid' // String instead of number
        };

        const badResponse = await fetch(`${BACKEND_URL}/api/tickets/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(badTicket)
        });

        if (badResponse.status === 422) {
            const error = await badResponse.json();
            console.log('✅ Correct validation error for bad data:', error.detail);
        } else {
            console.log('⚠️ Unexpected response for bad ticket data:', badResponse.status);
        }
    } catch (error) {
        console.log('❌ Error testing bad ticket data:', error.message);
    }
}

async function main() {
    console.log('🚨 EMERGENCY CARD CREATION DEBUG TEST');
    console.log('=====================================');

    const backendOk = await testBackendDirectly();
    const frontendOk = await testFrontendAPI();

    await analyzeCommonErrors();

    console.log('\n📊 SUMMARY:');
    console.log('Backend API:', backendOk ? '✅ Working' : '❌ Failed');
    console.log('Frontend Proxy:', frontendOk ? '✅ Working' : '❌ Failed');

    if (backendOk && frontendOk) {
        console.log('🎉 Card creation should be working! Check React component state.');
    } else {
        console.log('🚨 Found infrastructure issues that need fixing.');
    }
}

main().catch(console.error);
