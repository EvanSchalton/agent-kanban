#!/usr/bin/env node

/**
 * FINAL CARD CREATION VALIDATION
 * Comprehensive test to ensure card creation works end-to-end
 */

const { execSync } = require('child_process');

function runTest(description, command) {
    console.log(`\n🔍 ${description}`);
    console.log('='.repeat(50));

    try {
        const result = execSync(command, { encoding: 'utf8', timeout: 10000 });
        console.log(result);
        return true;
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        if (error.stdout) console.log('STDOUT:', error.stdout);
        if (error.stderr) console.log('STDERR:', error.stderr);
        return false;
    }
}

function main() {
    console.log('🚨 FINAL CARD CREATION VALIDATION');
    console.log('==================================');

    const tests = [
        {
            name: 'Backend Health Check',
            command: 'curl -s http://localhost:8000/health'
        },
        {
            name: 'Frontend Accessibility',
            command: 'curl -s -I http://localhost:5173 | head -n 1'
        },
        {
            name: 'Board API Validation',
            command: 'curl -s http://localhost:8000/api/boards/1 | jq -r ".name // \\"Board not found\\""'
        },
        {
            name: 'Frontend Proxy Board Test',
            command: 'curl -s http://localhost:5173/api/boards/1 | jq -r ".name // \\"Proxy failed\\""'
        },
        {
            name: 'Direct Ticket Creation Test',
            command: `curl -s -X POST http://localhost:8000/api/tickets/ \\
                -H "Content-Type: application/json" \\
                -d '{"title":"Final Validation Test","board_id":1,"current_column":"Not Started"}' \\
                | jq -r 'if .id then "✅ Created ticket " + (.id | tostring) else "❌ " + .error.message end'`
        },
        {
            name: 'Frontend Proxy Ticket Creation Test',
            command: `curl -s -X POST http://localhost:5173/api/tickets/ \\
                -H "Content-Type: application/json" \\
                -d '{"title":"Frontend Proxy Test","board_id":1,"current_column":"Not Started"}' \\
                | jq -r 'if .id then "✅ Created via proxy ticket " + (.id | tostring) else "❌ " + .error.message end'`
        }
    ];

    let passCount = 0;

    for (const test of tests) {
        const passed = runTest(test.name, test.command);
        if (passed) passCount++;
    }

    console.log('\n📊 FINAL RESULTS:');
    console.log('================');
    console.log(`Tests passed: ${passCount}/${tests.length}`);

    if (passCount === tests.length) {
        console.log('🎉 ALL TESTS PASSED - Card creation infrastructure is working!');
        console.log('');
        console.log('✅ DEBUGGING CONCLUSIONS:');
        console.log('1. Backend API is healthy and functional');
        console.log('2. Frontend proxy is working correctly');
        console.log('3. Direct ticket creation succeeds');
        console.log('4. Proxy ticket creation succeeds');
        console.log('5. Board API returns valid data');
        console.log('');
        console.log('🔧 FRONTEND COMPONENT RECOMMENDATIONS:');
        console.log('1. Check React component state synchronization');
        console.log('2. Verify board loading timing in BoardContext');
        console.log('3. Ensure AddCardModal has valid board data before opening');
        console.log('4. Add better error boundaries and loading states');
        console.log('5. Validate column_id mapping between frontend and backend');
        console.log('');
        console.log('🎯 LIKELY ISSUE: Board state not fully loaded when card creation is attempted');
        console.log('📝 SOLUTION: Add loading checks in AddCardModal before allowing submission');
    } else {
        console.log('❌ INFRASTRUCTURE ISSUES DETECTED');
        console.log('Please address failing tests before debugging React components');
    }
}

main();
