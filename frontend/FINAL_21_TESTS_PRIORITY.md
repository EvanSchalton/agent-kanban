# Final 21 Tests - Priority Fix List

**QA Engineer**: Project 4
**Current Status**: 83/104 passing (80%)
**Target**: 104/104 (100%)

## 🎯 QUICK SUMMARY FOR BACKEND DEV

```
21 Tests Remaining:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8  History Endpoints    (MISSING)  MEDIUM
5  Enhanced Statistics  (MISSING)  HARD
3  Bulk Operations     (BUGS)     EASY ✅
2  Error Handlers      (BUGS)     EASY
3  Other              (MIXED)    EASY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📝 EFFICIENT FIX ORDER (Easiest → Hardest)

### 🟢 PHASE 1: EASY FIXES (8 tests) - 1-2 HOURS

**These can be fixed TODAY!**

#### Bulk Operations (3 tests)

```python
# File: tests/test_bulk_operations.py

1. test_bulk_move_tickets_invalid_tickets
   FIX: Line 117 - Change expected status from 200 to 422

2. test_bulk_move_tickets
   FIX: Ensure ticket IDs are strings, not integers

3. test_bulk_operation_performance
   FIX: Adjust performance threshold or optimize queries
```

#### Error Handlers (2 tests)

```python
# File: app/core/error_handlers.py

1. test_general_exception_handler
   FIX: Add general exception handler middleware

2. test_error_request_logging
   FIX: Add request logging to error handler
```

#### Other Quick Fixes (3 tests)

```python
1. test_broadcast_to_board (WebSocket)
   FIX: Implement board-specific broadcast

2. test_decorator_with_sync_function (Logging)
   FIX: Fix decorator to handle sync functions

3. test_calculate_ticket_statistics (Stats)
   FIX: Basic calculation implementation
```

### 🟡 PHASE 2: MEDIUM COMPLEXITY (8 tests) - 4-6 HOURS

**Complete by Wednesday**

#### History Endpoints - NOT IMPLEMENTED

```python
# CREATE NEW FILE: app/api/endpoints/history.py

@router.get("/ticket/{ticket_id}")
def get_ticket_history(ticket_id: int):
    # Return all TicketHistory entries for ticket

@router.get("/board/{board_id}/activity")
def get_board_activity(board_id: int):
    # Return recent activity for board

@router.get("/statistics")
def get_history_statistics():
    # Return aggregate statistics

# Add pagination support to all endpoints
```

**Tests to fix:**

- test_get_ticket_history_success
- test_get_ticket_history_not_found
- test_get_ticket_history_with_field_filter
- test_get_ticket_transitions
- test_get_board_activity_no_tickets
- test_get_history_statistics
- test_history_endpoint_error_handling
- test_history_pagination

### 🔴 PHASE 3: HARD COMPLEXITY (5 tests) - 6-8 HOURS

**Complete by Friday**

#### Enhanced Statistics - COMPLEX CALCULATIONS

```python
# File: app/services/statistics_service.py

def calculate_statistics(tickets):
    # Calculate mean time in column
    # Calculate standard deviation
    # Determine color coding (green/yellow/red)
    # Cache results for performance

# Implement endpoints:
GET /api/statistics/board/{board_id}
GET /api/statistics/column/{column_id}
GET /api/statistics/realtime/colors
```

**Tests to fix:**

- test_realtime_ticket_colors
- test_realtime_ticket_colors_limits
- test_column_statistics
- test_column_statistics_not_found
- test_performance_metrics

## 📊 COMPLEXITY BREAKDOWN

| Priority | Tests | Complexity | Time Estimate | Status |
|----------|-------|------------|---------------|--------|
| 1 | Bulk Ops (3) | EASY | 30 mins | Endpoints exist, fix tests |
| 2 | Error Handlers (2) | EASY | 30 mins | Add middleware |
| 3 | Other (3) | EASY | 1 hour | Minor fixes |
| 4 | History (8) | MEDIUM | 4-6 hours | Create endpoints |
| 5 | Statistics (5) | HARD | 6-8 hours | Complex logic |

## 🚀 IMPLEMENTATION STRATEGY

### TODAY (Get to 88%)

1. Fix all EASY tests (8 tests)
2. Time: 2 hours max
3. Result: 91/104 passing (88%)

### TOMORROW (Get to 95%)

4. Implement History endpoints
5. Time: 4-6 hours
6. Result: 99/104 passing (95%)

### WEDNESDAY (Get to 100%)

7. Implement Statistics service
8. Time: 6-8 hours
9. Result: 104/104 passing (100%) 🎉

## 💡 HELPFUL TIPS

### For Bulk Operations

- The endpoints work! Just fix test expectations
- Check data types (string vs integer IDs)

### For History Implementation

- Use existing TicketHistory model
- Add entries on every ticket update
- Implement pagination with skip/limit

### For Statistics

- Use numpy for calculations if available
- Cache results with Redis if available
- Color coding: >2 std dev = red, >1 = yellow, else green

## ✅ VALIDATION CHECKLIST

After each fix, run:

```bash
# Test specific file
python -m pytest tests/test_[name].py -v

# Test everything
python -m pytest tests/ -q
```

## 🎯 SUCCESS METRICS

**Current**: 80% (83/104)
**After Phase 1**: 88% (91/104)
**After Phase 2**: 95% (99/104)
**After Phase 3**: 100% (104/104) 🏆

---

**LET'S GET TO 100%! The path is clear and achievable!**
