# UI Bug Report - August 19, 2025

## QA Testing Session

### Critical Issue #1: Application Crash on Load

**Severity:** CRITICAL - Application is completely unusable
**Status:** Active
**First Detected:** 18:57 UTC

#### Description

The application crashes immediately upon loading the dashboard (root URL) with a React Context error.

#### Error Details

```
Error: useBoard must be used within a BoardProvider
    at useBoard (http://localhost:15174/src/context/useBoardHook.ts:6:11)
    at Navbar (http://localhost:15174/src/components/Navbar.tsx:27:21)
```

#### Root Cause Analysis

The `Navbar` component in `DashboardView` is trying to use the `useBoard` hook which requires BoardProvider context. The BoardProvider is only wrapping the `BoardView` component, not the `DashboardView`.

**File:** `/workspaces/agent-kanban/frontend/src/App.tsx`

- Line 31: `<Navbar />` is rendered in `DashboardView` without BoardProvider
- Line 10: `const { board } = useBoard();` in Navbar.tsx fails

#### Reproduction Steps

1. Start frontend server (running on port 15174)
2. Navigate to <http://localhost:15174/>
3. Application immediately crashes with ErrorBoundary showing "Something went wrong"

#### Impact

- Users cannot access the dashboard
- Users cannot create or manage boards
- Application is completely non-functional

#### Suggested Fix

Either:

1. Make the `useBoard` hook optional in Navbar when not in board context
2. Wrap DashboardView with BoardProvider (may not be semantically correct)
3. Create a separate NavbarWithoutBoard component for dashboard view

---

### Critical Issue #2: Card Disappears During Drag and Drop

**Severity:** CRITICAL - Data loss
**Status:** Active
**First Detected:** 19:03 UTC

#### Description

When dragging a card between columns, the card completely disappears from the board. The card is not placed in the target column and is removed from the source column.

#### Details

- Card #3 "Test Card Creation Bug" was dragged from "Not Started" to "In Progress"
- Card disappeared completely - not visible in any column
- Status message shows: "Draggable item 3 was dropped over droppable area 3"
- Card count decreased in source column but didn't increase in target column

#### Impact

- Data loss - cards disappear when users try to move them
- Makes the kanban board unusable for workflow management
- Users lose their work when attempting to update card status

---

### Successfully Tested Features

✅ **Card Creation** - FIXED! Cards can now be created successfully in all columns:

- Created card #3 in "Not Started" column
- Created card #4 in "In Progress" column
- Created card #5 in "Done" column (later deleted for testing)
- Created card #6 "Drag Test - Post Fix"
- All cards were created with correct data and persisted

✅ **Modal Functionality** - Working:

- Add Card modal opens and closes correctly
- Ticket Detail modal displays card information
- Edit mode activates (though was interrupted by hot reload)

✅ **Delete Functionality** - Working:

- Delete confirmation dialog appears
- Cards are successfully deleted from columns
- Tested with card #5 - removed from Done column

✅ **Comment Functionality** - Working:

- Comments can be added to tickets
- Comments display with author and timestamp
- Add Comment button enables/disables correctly

✅ **Search/Filter Functionality** - Working:

- Search filters cards by title successfully
- Clear button (×) restores all cards
- Real-time filtering as user types

✅ **Drag-Drop Data Loss Fix** - PARTIALLY FIXED:

- 🎯 **CRITICAL IMPROVEMENT**: Cards no longer vanish completely!
- Cards remain visible during drag operations
- However: Drag operations timeout and don't complete successfully
- Status messages indicate drag detection is working
- Much better than previous complete data loss

### Testing Blocked

Cannot fully test the following due to critical issues:

- Board management (dashboard crashes on load)
- Full edit/delete functionality (needs more testing)

### Additional Issues Discovered During Extended Testing

#### Issue #3: Development Environment Instability

**Severity:** Medium - Development Impact
**Status:** Active
**Observed:** 19:09 UTC onwards

**Description:**
Excessive hot module replacement activity causing testing instability:

- HMR cycles every 3-5 seconds
- Repeated BoardProvider errors during each cycle
- WebSocket disconnections/reconnections with each HMR
- Page elements frequently becoming stale during testing

**Impact:**

- Makes comprehensive testing difficult
- Suggests active development work in progress
- May indicate performance issues in development builds

#### Issue #4: Modal System Resilience

**Severity:** Low
**Status:** Tested and Stable

**Findings:**

- Modals handle rapid open/close correctly
- No memory leaks detected during modal stress testing
- HMR events properly close modals (as expected)
- Modal state management appears robust

### Environment Details

- Frontend: Vite running on port 15174
- Backend: Uvicorn running on port 8000
- Testing Tool: Playwright via MCP
- Time: 18:57 - 19:10 UTC, August 19, 2025
- Development Status: Active (frequent HMR cycles observed)

### Next Steps

1. Fix the critical context provider issue
2. Resume systematic testing once application loads
3. Priority focus on card creation bug once accessible

---
*Report generated by QA Engineer*
