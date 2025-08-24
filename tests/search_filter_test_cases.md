# Search & Filter Feature Test Cases - Sprint Week Aug 10-17

## Test Suite Overview

**Feature:** Search & Filter Functionality
**Priority:** HIGH
**Timeline:** Day 5-6 of Sprint
**Dependencies:** Authentication system must be functional

---

## 1. Basic Search Functionality Tests

### TC-SEARCH-001: Global Search by Title

**Priority:** P0
**Precondition:** Board contains tickets with various titles
**Test Steps:**

1. Enter "bug" in search bar
2. Press Enter or wait for debounce (300ms)
3. Verify results show only tickets with "bug" in title

**Test Data:**

- Ticket 1: "Critical bug in login"
- Ticket 2: "Feature request"
- Ticket 3: "Debug logging needed"

**Expected Results:**

- Tickets 1 and 3 displayed
- Ticket 2 hidden
- Match text highlighted

### TC-SEARCH-002: Search by Description

**Priority:** P0
**Test Steps:**

1. Search for text that exists only in description
2. Verify tickets with matching descriptions appear
3. Verify description preview shows with highlighted text

**Expected Results:**

- Correct tickets filtered
- Description snippet visible
- Search term highlighted

### TC-SEARCH-003: Search by Ticket ID

**Priority:** P0
**Test Steps:**

1. Enter ticket ID (e.g., "TICK-123")
2. Verify exact match appears first
3. Verify partial matches also shown

**Expected Results:**

- Exact ID match at top
- Partial matches below
- ID highlighted in results

### TC-SEARCH-004: Real-time Search (Debounced)

**Priority:** P1
**Test Steps:**

1. Type search query character by character
2. Verify no search triggered until typing stops
3. Verify search executes after 300ms debounce

**Expected Results:**

- No premature API calls
- Smooth user experience
- Results update after debounce

### TC-SEARCH-005: Empty Search Results

**Priority:** P1
**Test Steps:**

1. Search for non-existent term
2. Verify empty state message
3. Verify suggestions (if implemented)

**Expected Results:**

- "No results found" message
- Clear search option visible
- Possible suggestions shown

### TC-SEARCH-006: Search History

**Priority:** P2
**Test Steps:**

1. Perform 5 different searches
2. Click search bar
3. Verify last 5 searches displayed
4. Click history item
5. Verify search executed

**Expected Results:**

- History dropdown appears
- Most recent first
- Clicking executes search

### TC-SEARCH-007: Keyboard Shortcut (Cmd/Ctrl+K)

**Priority:** P2
**Test Steps:**

1. Press Cmd+K (Mac) or Ctrl+K (Windows)
2. Verify search bar focused
3. Press Escape
4. Verify search bar unfocused

**Expected Results:**

- Shortcut focuses search
- Escape clears/unfocuses
- Works from any page state

### TC-SEARCH-008: Search Performance

**Priority:** P1
**Test Scenarios:**

| Dataset Size | Expected Response Time |
|-------------|----------------------|
| 100 tickets | < 100ms |
| 500 tickets | < 200ms |
| 1000 tickets | < 500ms |
| 5000 tickets | < 1s |

### TC-SEARCH-009: Special Characters in Search

**Priority:** P2
**Test Queries:**

```
"ticket (urgent)"
"user@email.com"
"feature: new"
"#hashtag"
"$price"
```

**Expected Results:**

- Special characters handled correctly
- No errors or crashes
- Accurate results

### TC-SEARCH-010: Case Sensitivity

**Priority:** P1
**Test Steps:**

1. Create ticket with "BUG" in title
2. Search for "bug" (lowercase)
3. Search for "Bug" (mixed case)
4. Verify all return same results

**Expected Results:**

- Case-insensitive search
- All variations find matches

---

## 2. Advanced Filtering Tests

### TC-FILTER-001: Filter by Single Assignee

**Priority:** P0
**Test Steps:**

1. Click filter button
2. Select assignee "John Doe"
3. Apply filter
4. Verify only John's tickets shown

**Expected Results:**

- Only selected assignee's tickets
- Filter badge shows "1 filter"
- URL updated with filter params

### TC-FILTER-002: Filter by Multiple Assignees

**Priority:** P0
**Test Steps:**

1. Select multiple assignees
2. Apply filter
3. Verify OR logic applied

**Test Data:**

- Select: John, Jane, Bob
- John has 3 tickets
- Jane has 2 tickets
- Bob has 4 tickets

**Expected Results:**

- Total 9 tickets shown
- Multi-select UI works
- Clear individuals option

### TC-FILTER-003: Filter by Priority Levels

**Priority:** P0
**Test Matrix:**

| Filter Selection | Expected Tickets |
|-----------------|------------------|
| Critical only | Show critical |
| High + Critical | Show both |
| Medium + Low | Show both |
| All priorities | Show all |

### TC-FILTER-004: Filter by Date Range - Created

**Priority:** P1
**Test Steps:**

1. Select "Created Date" filter
2. Choose "Last 7 days"
3. Verify only recent tickets shown
4. Change to custom range
5. Verify date picker works

**Date Range Options:**

- Today
- Yesterday
- Last 7 days
- Last 30 days
- This month
- Custom range

### TC-FILTER-005: Filter by Date Range - Updated

**Priority:** P1
**Test Steps:**

1. Select "Last Updated" filter
2. Choose "Last 24 hours"
3. Verify only recently updated tickets

**Expected Results:**

- Accurate date filtering
- Timezone handled correctly
- Include boundary dates

### TC-FILTER-006: Filter by Tags/Labels

**Priority:** P1
**Test Steps:**

1. Filter by tag "backend"
2. Add tag "critical"
3. Verify AND logic

**Expected Results:**

- Only tickets with both tags
- Tag pills displayed
- Remove individual tags

### TC-FILTER-007: Combine Multiple Filter Types

**Priority:** P0
**Complex Filter Scenario:**

```
Assignee: John OR Jane
Priority: High OR Critical
Date: Last 7 days
Tags: "backend"
```

**Expected Results:**

- Correct AND/OR logic
- All conditions met
- Complex filter saved

### TC-FILTER-008: Clear All Filters

**Priority:** P0
**Test Steps:**

1. Apply multiple filters
2. Click "Clear All"
3. Verify all filters removed
4. Verify all tickets visible

**Expected Results:**

- One click clears all
- URL params cleared
- Board returns to default

### TC-FILTER-009: Filter by Column/Status

**Priority:** P1
**Test Steps:**

1. Filter by "In Progress" column
2. Verify only those tickets shown
3. Add "Review" column
4. Verify OR logic for columns

**Expected Results:**

- Column filter works
- Multiple columns OR'd
- Visual feedback on columns

### TC-FILTER-010: Filter Validation

**Priority:** P2
**Invalid Scenarios:**

1. End date before start date
2. Non-existent assignee
3. Invalid priority value

**Expected Results:**

- Appropriate error messages
- Filters not applied
- UI guides correct input

---

## 3. Saved Views / Filter Combinations

### TC-SAVED-001: Save Custom Filter

**Priority:** P1
**Test Steps:**

1. Apply complex filter set
2. Click "Save View"
3. Name it "My Critical Tasks"
4. Verify saved successfully

**Expected Results:**

- View saved to user profile
- Appears in saved views list
- Can be loaded later

### TC-SAVED-002: Load Saved View

**Priority:** P1
**Test Steps:**

1. Click "Saved Views" dropdown
2. Select previously saved view
3. Verify filters applied correctly

**Expected Results:**

- All filters restored
- Same results as original
- URL updated

### TC-SAVED-003: Default Quick Filters

**Priority:** P0
**Test Predefined Views:**

| View Name | Expected Filter |
|-----------|----------------|
| My Tasks | Assigned to current user |
| Critical & High | Priority >= 3 |
| Stale Tasks | No update > 7 days |
| Recently Created | Created < 24 hours |
| Blocked | Status = Blocked |

### TC-SAVED-004: Edit Saved View

**Priority:** P2
**Test Steps:**

1. Load saved view
2. Modify filters
3. Choose "Update View"
4. Verify changes saved

**Expected Results:**

- Existing view updated
- Not new view created
- Confirmation message

### TC-SAVED-005: Delete Saved View

**Priority:** P2
**Test Steps:**

1. Open saved views manager
2. Delete custom view
3. Verify removed from list
4. Verify cannot load deleted view

**Expected Results:**

- Confirmation before delete
- View removed permanently
- Default views cannot be deleted

---

## 4. Filter Persistence Tests

### TC-PERSIST-001: URL Parameter Persistence

**Priority:** P0
**Test Steps:**

1. Apply filters
2. Copy URL
3. Open new tab with URL
4. Verify same filters applied

**URL Format:**

```
/board/1?assignee=john,jane&priority=3,4&date=7d&tags=backend
```

### TC-PERSIST-002: Browser Refresh Persistence

**Priority:** P0
**Test Steps:**

1. Apply filters
2. Refresh browser (F5)
3. Verify filters maintained
4. Verify same results

**Expected Results:**

- Filters survive refresh
- No data loss
- Quick restoration

### TC-PERSIST-003: Navigation Persistence

**Priority:** P1
**Test Steps:**

1. Apply filters on board
2. Navigate to ticket detail
3. Navigate back to board
4. Verify filters still active

**Expected Results:**

- Filters maintained
- Back button works
- State preserved

### TC-PERSIST-004: Per-Board Filter Memory

**Priority:** P2
**Test Steps:**

1. Apply filters on Board A
2. Switch to Board B
3. Apply different filters
4. Switch back to Board A
5. Verify Board A filters restored

**Expected Results:**

- Each board remembers filters
- Independent filter states
- Stored in localStorage

### TC-PERSIST-005: Share Filtered View

**Priority:** P1
**Test Steps:**

1. Apply filters
2. Click "Share View"
3. Copy shareable link
4. Open link in incognito
5. Verify same filters (if public)

**Expected Results:**

- Shareable URL generated
- Works for other users
- Respects permissions

---

## 5. Search & Filter Integration Tests

### TC-INT-001: Search + Filter Combination

**Priority:** P0
**Test Steps:**

1. Search for "bug"
2. Filter by priority "High"
3. Verify both conditions applied

**Expected Results:**

- Shows high priority bugs only
- Both search and filter active
- Clear individually

### TC-INT-002: Filter Affects Search Results

**Priority:** P0
**Test Steps:**

1. Apply assignee filter
2. Search within filtered results
3. Verify search only in filtered set

**Expected Results:**

- Search scoped to filter
- Accurate result count
- Clear indication of scope

### TC-INT-003: Search Persistence with Filters

**Priority:** P1
**Test Steps:**

1. Search for term
2. Apply filters
3. Clear search
4. Verify filters remain
5. Re-enter search
6. Verify both active

**Expected Results:**

- Independent controls
- Can clear separately
- State management correct

---

## 6. Performance & Edge Cases

### TC-PERF-001: Large Dataset Filtering

**Priority:** P1
**Test With:**

- 1000 tickets
- 10 complex filters
- Measure response time

**Performance Targets:**

- Initial load: < 2s
- Filter apply: < 500ms
- Search: < 300ms

### TC-EDGE-001: No Results After Filter

**Priority:** P1
**Test Steps:**

1. Apply very restrictive filters
2. Verify "No results" message
3. Verify suggestion to broaden filter

**Expected Results:**

- Helpful empty state
- Clear filters option
- Suggestions provided

### TC-EDGE-002: Maximum Filters Applied

**Priority:** P2
**Test Steps:**

1. Apply maximum number of filters
2. Verify system handles gracefully
3. Check performance impact

**Expected Results:**

- No crashes
- Performance acceptable
- UI remains responsive

### TC-EDGE-003: Conflicting Filters

**Priority:** P2
**Test Scenario:**

- Filter by "Done" status
- Filter by "Created Today"
- (Unlikely to have tickets)

**Expected Results:**

- System allows combination
- Shows empty results
- No errors

---

## 7. Accessibility Tests

### TC-A11Y-001: Keyboard Navigation

**Priority:** P1
**Test Steps:**

1. Tab through filter controls
2. Use arrow keys in dropdowns
3. Space/Enter to select
4. Escape to close

**Expected Results:**

- Full keyboard access
- Focus indicators visible
- Logical tab order

### TC-A11Y-002: Screen Reader Support

**Priority:** P1
**Test With:** NVDA/JAWS
**Verify:**

- Filter labels announced
- Results count announced
- State changes announced

### TC-A11Y-003: Color Contrast

**Priority:** P2
**Test Steps:**

1. Check filter badges contrast
2. Check active filter states
3. Verify WCAG AA compliance

**Expected Results:**

- Minimum 4.5:1 ratio
- Clear visual indicators
- Not only color-dependent

---

## 8. Mobile Responsiveness

### TC-MOBILE-001: Touch-Friendly Filters

**Priority:** P2
**Test Devices:**

- iPhone 12 (Safari)
- Samsung Galaxy (Chrome)
- iPad (Safari)

**Test Points:**

- Filter dropdowns usable
- Touch targets 44x44px min
- Responsive layout

### TC-MOBILE-002: Search on Mobile

**Priority:** P2
**Test Steps:**

1. Tap search on mobile
2. Verify keyboard appears
3. Verify search works
4. Verify can clear

**Expected Results:**

- Mobile-optimized UI
- Appropriate keyboard
- Smooth interaction

---

## Test Execution Priority

### Day 5 - Basic Features

1. Global search functionality
2. Basic filters (assignee, priority)
3. URL persistence
4. Clear filters

### Day 6 - Advanced Features

1. Complex filter combinations
2. Saved views
3. Date range filtering
4. Performance testing

### Integration with Auth (Day 5-6)

- Verify filters respect permissions
- Saved views per user
- Role-based filter options

---

## Success Criteria

✅ All P0 test cases passing
✅ Search response < 300ms
✅ Filter response < 500ms
✅ URL sharing works
✅ Accessibility WCAG AA
✅ Mobile responsive
✅ 85% code coverage

---

**Document Version:** 1.0
**Created:** Aug 10, 2025
**Sprint:** Week of Aug 10-17
**Next Review:** Day 6 Sprint
