# 🔴 P0: Column Detection Bug - Test Suite Ready

## Bug Details (From QA)

**Location:** Board.tsx lines 128-131
**Issue:** When cards are dropped on empty column space, the system uses the dragged card's own column instead of the target column

## Root Cause

The column detection logic incorrectly references the source card's column when determining the drop target, especially when dropping on empty column areas.

## Test Coverage Created

### File: `drag-drop-column-detection-bug.spec.ts`

#### Critical Test Scenarios

1. **Drop on Empty Column Space** ✅
   - Drags card from TODO to empty DONE column
   - Verifies card appears in DONE
   - Confirms API receives "Done" not "Not Started"

2. **Drop on Another Card** ✅
   - Drags TODO card onto IN PROGRESS card
   - Verifies card moves to IN PROGRESS (target card's column)
   - Confirms API receives correct target column

3. **Drop Between Cards** ✅
   - Drags card to space between two cards in a column
   - Verifies card inserts at correct position
   - Confirms column detection uses target column

4. **Additional Coverage:**
   - Multiple drops on empty columns
   - Drag from empty to empty column
   - Rapid drop operations
   - Edge case handling

## Quick Test Execution

### Instant Smoke Test (30 seconds)

```bash
./tests/run-column-detection-test.sh
```

This will:

1. Run quick smoke test first
2. If passed, run full test suite
3. Generate detailed report

### Manual Test Commands

```bash
# Smoke test only
npx playwright test drag-drop-column-detection-bug.spec.ts -g "SMOKE" --config=playwright-no-server.config.ts

# Full suite
npx playwright test drag-drop-column-detection-bug.spec.ts --config=playwright-no-server.config.ts

# Specific scenario
npx playwright test drag-drop-column-detection-bug.spec.ts -g "empty column" --config=playwright-no-server.config.ts
```

## Expected vs Actual Behavior

### Current (BROKEN)

```javascript
// Board.tsx lines 128-131 (approximate)
handleDrop(e) {
  const targetColumn = draggedCard.column; // ❌ WRONG - uses source column
  updateCard({ ...card, column: targetColumn });
}
```

### Expected (FIXED)

```javascript
handleDrop(e) {
  const targetColumn = getColumnFromDropTarget(e.target); // ✅ Uses actual drop target
  updateCard({ ...card, column: targetColumn });
}
```

## API Payload Verification

### Test monitors API calls for

```json
// Expected when moving TODO card to DONE column:
{
  "current_column": "Done"  // ✅ Correct
}

// NOT:
{
  "current_column": "Not Started"  // ❌ Wrong (source column)
}
```

## Test Results Interpretation

### Success Indicators

- ✅ All cards move to correct visual column
- ✅ API receives target column name
- ✅ No cards remain in source column after drop
- ✅ Drop position accuracy maintained

### Failure Indicators

- ❌ Cards visually move but API gets wrong column
- ❌ Cards snap back to original column
- ❌ Empty column drops fail
- ❌ API receives source column instead of target

## Test Execution Plan

### When Frontend Dev Announces Fix

1. **Phase 1: Column Detection (2 min)**

   ```bash
   ./tests/run-column-detection-test.sh
   ```

2. **Phase 2: Nested Drop Zones (2 min)**

   ```bash
   ./tests/run-drop-zone-tests.sh
   ```

3. **Phase 3: Full Regression (5 min)**

   ```bash
   npx playwright test drag-drop-p0-regression.spec.ts --config=playwright-no-server.config.ts
   ```

4. **Phase 4: Integration (3 min)**

   ```bash
   npx playwright test regression-suite.spec.ts --config=playwright-no-server.config.ts
   ```

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Column Detection Tests | ✅ Ready | 7 test scenarios |
| Nested Drop Zones Tests | ✅ Ready | 8 test scenarios |
| P0 Regression Suite | ✅ Ready | 11 test scenarios |
| Quick Test Runner | ✅ Ready | `run-column-detection-test.sh` |
| Frontend Fix | ⏳ In Progress | Board.tsx lines 128-131 |

## Success Criteria

### Minimum for Bug Resolution

- [ ] Smoke test passes
- [ ] Empty column drops work
- [ ] API receives correct column

### Full Verification

- [ ] All 7 column detection tests pass
- [ ] All 8 nested drop zone tests pass
- [ ] No console errors
- [ ] Performance < 3 seconds

## For Frontend Dev

### Key Files to Check

- `Board.tsx` lines 128-131 (column detection logic)
- Drop event handlers
- Column identification methods

### Quick Validation

1. Fix the column detection logic
2. Run: `./tests/run-column-detection-test.sh`
3. If smoke test passes, the core issue is fixed
4. Run full suite to ensure no regressions

---
**Test Engineer Status:** Ready to validate fix immediately
**Test Execution Time:** ~2 minutes for critical validation
**Full Suite Time:** ~12 minutes for comprehensive testing
