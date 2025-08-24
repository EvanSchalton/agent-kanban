# 🚀 Drag & Drop Test Execution Plan

## Current Status

- **Frontend Dev:** Fix implemented ✅
- **QA:** Manual testing in progress ⏳
- **Test Engineer:** Ready to execute automated tests 🎯

## Pre-Flight Checklist

### Environment Verification

- [ ] Frontend server running on port 5173
- [ ] Backend server running on port 8000
- [ ] Database accessible
- [ ] No console errors on app load

### Test Suite Readiness

- [x] Nested drop zones tests ready (`drag-drop-nested-zones-fix.spec.ts`)
- [x] P0 regression tests ready (`drag-drop-p0-regression.spec.ts`)
- [x] Quick smoke test configured
- [x] Test runner scripts prepared

## Test Execution Sequence

### Phase 1: Quick Smoke Test (30 seconds)

```bash
# Verify basic fix - cards cannot be dropped on cards
npx playwright test drag-drop-nested-zones-fix.spec.ts -g "Quick smoke test" --config=playwright-no-server.config.ts
```

**Expected Result:** Cards remain in original position when dropped on other cards

### Phase 2: Nested Drop Zones Verification (2 minutes)

```bash
# Full verification of root cause fix
npx playwright test drag-drop-nested-zones-fix.spec.ts --config=playwright-no-server.config.ts
```

**Tests:**

1. Cards should NOT be drop zones
2. Only columns should accept drops
3. Correct column IDs sent to API
4. Drop zone visual feedback
5. Prevention of card nesting
6. Drop position accuracy
7. Rapid drag operations
8. Modifier key handling

### Phase 3: Comprehensive Regression (5 minutes)

```bash
# Full drag & drop functionality test
npx playwright test drag-drop-p0-regression.spec.ts --config=playwright-no-server.config.ts
```

**Tests:**

1. Basic drag between all columns
2. Multiple card movements
3. Persistence after refresh
4. Real-time WebSocket sync
5. Drag cancellation
6. Order preservation
7. Error handling
8. Performance metrics
9. Edge cases

### Phase 4: Cross-Browser Validation (3 minutes)

```bash
# Test in Firefox
npx playwright test drag-drop-nested-zones-fix.spec.ts --project=firefox --config=playwright-no-server.config.ts

# Test in WebKit (if available)
npx playwright test drag-drop-nested-zones-fix.spec.ts --project=webkit --config=playwright-no-server.config.ts
```

### Phase 5: Integration Test (2 minutes)

```bash
# Run critical paths including drag & drop
npx playwright test regression-suite.spec.ts --config=playwright-no-server.config.ts
```

## Success Criteria

### Must Pass (P0)

- ✅ Cards cannot be dropped on other cards
- ✅ Cards only move when dropped on columns
- ✅ API receives correct column format
- ✅ No console errors during drag operations

### Should Pass (P1)

- ✅ Visual feedback shows valid drop zones
- ✅ Drag preview appears correctly
- ✅ Changes persist after refresh
- ✅ Performance < 3 seconds per operation

### Nice to Have (P2)

- ✅ Smooth animations
- ✅ Keyboard support
- ✅ Touch device support

## Test Results Template

```markdown
## Drag & Drop Test Results - [DATE]

### Summary
- **Total Tests:** X
- **Passed:** X
- **Failed:** X
- **Skipped:** X
- **Duration:** X minutes

### Critical Tests
| Test | Result | Notes |
|------|--------|-------|
| Cards not drop zones | ✅/❌ | |
| Columns accept drops | ✅/❌ | |
| API payload correct | ✅/❌ | |

### Regression Tests
| Feature | Status | Issues |
|---------|--------|--------|
| Basic drag & drop | | |
| Multi-column movement | | |
| Persistence | | |
| WebSocket sync | | |

### Performance
- Average drag operation: Xms
- Slowest operation: Xms
- Memory usage: Stable/Growing

### Recommendations
- [ ] Fix ready for production
- [ ] Minor issues to address
- [ ] Major issues found
```

## Automated Execution Script

Save as `run-all-drag-tests.sh`:

```bash
#!/bin/bash
echo "Starting comprehensive drag & drop test suite..."
echo "Phase 1: Smoke Test"
npm test -- drag-drop-nested-zones-fix.spec.ts -g "smoke"

if [ $? -eq 0 ]; then
    echo "Phase 2: Nested Drop Zones"
    npm test -- drag-drop-nested-zones-fix.spec.ts

    echo "Phase 3: Full Regression"
    npm test -- drag-drop-p0-regression.spec.ts

    echo "Phase 4: Integration"
    npm test -- regression-suite.spec.ts
fi
```

## Monitoring During Tests

Watch for:

1. Console errors in browser
2. Network failures
3. Slow operations (>3s)
4. Visual glitches
5. State inconsistencies

## Post-Test Actions

1. **If All Pass:**
   - Report success to PM
   - Enable continuous monitoring
   - Document any observations

2. **If Some Fail:**
   - Identify patterns
   - Re-run failed tests
   - Report specific failures

3. **If Critical Failures:**
   - Stop testing
   - Report immediately
   - Provide reproduction steps

---
**Test Engineer Ready** - Awaiting QA confirmation to begin execution
