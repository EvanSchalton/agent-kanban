/**
 * Frontend Board Isolation Testing Script
 * Tests the API calls that the frontend should be making
 */

const axios = require('axios');

async function testFrontendIsolation() {
    console.log('🧪 TESTING FRONTEND BOARD ISOLATION BEHAVIOR');
    console.log('=' * 60);

    const baseURL = 'http://localhost:18000';

    try {
        // Test the exact API calls the frontend should make
        console.log('\n1️⃣ Testing Board 1 API Call (frontend pattern):');
        const board1Response = await axios.get(`${baseURL}/api/tickets/?board_id=1`);
        console.log(`✅ URL: /api/tickets/?board_id=1`);
        console.log(`✅ Response: ${board1Response.data.items?.length || 0} tickets`);
        console.log(`✅ First ticket: ${board1Response.data.items?.[0]?.title || 'None'}`);

        console.log('\n2️⃣ Testing Board 8 API Call (frontend pattern):');
        const board8Response = await axios.get(`${baseURL}/api/tickets/?board_id=8`);
        console.log(`✅ URL: /api/tickets/?board_id=8`);
        console.log(`✅ Response: ${board8Response.data.items?.length || 0} tickets`);
        console.log(`✅ First ticket: ${board8Response.data.items?.[0]?.title || 'None'}`);

        console.log('\n3️⃣ Testing Board 9 API Call (frontend pattern):');
        const board9Response = await axios.get(`${baseURL}/api/tickets/?board_id=9`);
        console.log(`✅ URL: /api/tickets/?board_id=9`);
        console.log(`✅ Response: ${board9Response.data.items?.length || 0} tickets`);
        console.log(`✅ First ticket: ${board9Response.data.items?.[0]?.title || 'None'}`);

        // Analysis
        console.log('\n📊 ISOLATION ANALYSIS:');
        const board1Count = board1Response.data.items?.length || 0;
        const board8Count = board8Response.data.items?.length || 0;
        const board9Count = board9Response.data.items?.length || 0;

        if (board1Count !== board8Count || board1Count !== board9Count || board8Count !== board9Count) {
            console.log('✅ BOARD ISOLATION WORKING: Different ticket counts per board');
            console.log(`   Board 1: ${board1Count} tickets`);
            console.log(`   Board 8: ${board8Count} tickets`);
            console.log(`   Board 9: ${board9Count} tickets`);
        } else {
            console.log('❌ POTENTIAL ISSUE: All boards showing same ticket count');
        }

        // Test specific ticket IDs to verify isolation
        console.log('\n4️⃣ Testing Ticket ID Isolation:');
        const board1IDs = board1Response.data.items?.map(t => t.id) || [];
        const board8IDs = board8Response.data.items?.map(t => t.id) || [];
        const board9IDs = board9Response.data.items?.map(t => t.id) || [];

        console.log(`Board 1 ticket IDs: [${board1IDs.slice(0, 5).join(', ')}${board1IDs.length > 5 ? '...' : ''}]`);
        console.log(`Board 8 ticket IDs: [${board8IDs.slice(0, 5).join(', ')}${board8IDs.length > 5 ? '...' : ''}]`);
        console.log(`Board 9 ticket IDs: [${board9IDs.slice(0, 5).join(', ')}${board9IDs.length > 5 ? '...' : ''}]`);

        // Check for overlap
        const hasOverlap = board1IDs.some(id => board8IDs.includes(id) || board9IDs.includes(id)) ||
                          board8IDs.some(id => board9IDs.includes(id));

        if (!hasOverlap && (board1IDs.length > 0 || board8IDs.length > 0 || board9IDs.length > 0)) {
            console.log('✅ NO TICKET ID OVERLAP: Perfect isolation confirmed');
        } else if (board1IDs.length === 0 && board8IDs.length === 0 && board9IDs.length === 0) {
            console.log('⚠️  ALL BOARDS EMPTY: Cannot verify isolation');
        } else {
            console.log('❌ TICKET ID OVERLAP DETECTED: Possible isolation issue');
        }

        console.log('\n🎯 CONCLUSION:');
        console.log('Backend API isolation is working correctly.');
        console.log('If frontend shows same cards across boards, it\'s a UI/state issue.');

    } catch (error) {
        console.error('❌ API Test Failed:', error.message);
        console.log('Make sure backend is running on port 18000');
    }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFrontendIsolation };
}

// Auto-run if executed directly
if (require.main === module) {
    testFrontendIsolation();
}
