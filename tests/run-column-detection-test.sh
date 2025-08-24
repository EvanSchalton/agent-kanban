#!/bin/bash

# Test runner for Board.tsx lines 128-131 column detection bug
# Bug: System uses dragged card's column instead of target column

echo "=========================================="
echo "🔴 P0: COLUMN DETECTION BUG TEST"
echo "=========================================="
echo ""
echo "Bug Location: Board.tsx lines 128-131"
echo "Issue: Dragged card's column used instead of target column"
echo ""
echo "Test Scenarios:"
echo "  1. Drop on empty column space"
echo "  2. Drop on another card"
echo "  3. Drop between cards"
echo ""
echo "Starting tests..."
echo ""

# Run smoke test first
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SMOKE TEST: Quick validation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx playwright test drag-drop-column-detection-bug.spec.ts -g "SMOKE:" --config=playwright-no-server.config.ts --reporter=list

SMOKE_RESULT=$?

if [ $SMOKE_RESULT -eq 0 ]; then
    echo ""
    echo "✅ SMOKE TEST PASSED!"
    echo "Column detection is working correctly."
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "FULL TEST SUITE: Running all scenarios..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Run full column detection test suite
    npx playwright test drag-drop-column-detection-bug.spec.ts --config=playwright-no-server.config.ts --reporter=list

    FULL_RESULT=$?

    if [ $FULL_RESULT -eq 0 ]; then
        echo ""
        echo "=========================================="
        echo "✅✅✅ ALL TESTS PASSED! ✅✅✅"
        echo "=========================================="
        echo ""
        echo "Bug Fix Verified:"
        echo "  ✅ Empty column drops use target column"
        echo "  ✅ Card-on-card drops use target column"
        echo "  ✅ Between-cards drops use target column"
        echo "  ✅ API receives correct column IDs"
        echo ""
        echo "The Board.tsx column detection bug is FIXED!"
        echo ""
        echo "Next Steps:"
        echo "  1. Run full drag & drop regression suite"
        echo "  2. Test nested drop zones fix"
        echo "  3. Verify no side effects"
        echo ""
        echo "Commands:"
        echo "  ./tests/run-drop-zone-tests.sh"
        echo "  npx playwright test drag-drop-p0-regression.spec.ts"
    else
        echo ""
        echo "=========================================="
        echo "⚠️ SOME TESTS FAILED"
        echo "=========================================="
        echo ""
        echo "Review the test output above for details."
        echo "Common failures:"
        echo "  - API still receiving source column"
        echo "  - Cards not moving to target column"
        echo "  - Drop zones not properly detected"
        echo ""
        echo "Check Board.tsx lines 128-131 for the fix."
    fi
else
    echo ""
    echo "=========================================="
    echo "❌ SMOKE TEST FAILED!"
    echo "=========================================="
    echo ""
    echo "The column detection bug is NOT fixed."
    echo ""
    echo "Problem: When dropping on empty column space,"
    echo "the system is using the dragged card's original"
    echo "column instead of the target column."
    echo ""
    echo "Expected: API should receive target column"
    echo "Actual: API receives source column"
    echo ""
    echo "Frontend Dev needs to fix Board.tsx lines 128-131"
fi

echo ""
echo "Test completed at $(date)"
echo ""

# Generate summary report
REPORT_FILE="tests/results/column-detection-test-$(date +%Y%m%d-%H%M%S).txt"
echo "Generating report: $REPORT_FILE"

{
    echo "Column Detection Bug Test Report"
    echo "================================="
    echo "Date: $(date)"
    echo "Bug Location: Board.tsx lines 128-131"
    echo ""
    echo "Test Results:"
    echo "  Smoke Test: $([ $SMOKE_RESULT -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
    if [ $SMOKE_RESULT -eq 0 ]; then
        echo "  Full Suite: $([ $FULL_RESULT -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
    fi
    echo ""
    echo "Scenarios Tested:"
    echo "  1. Drop on empty column space"
    echo "  2. Drop on another card"
    echo "  3. Drop between cards"
    echo "  4. Multiple drops on empty columns"
    echo "  5. Rapid drop operations"
    echo ""
} > $REPORT_FILE

echo "Report saved to: $REPORT_FILE"
