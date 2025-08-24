# Critical Drag & Drop Bug - Deep Analysis

## Executive Summary

The drag & drop fix attempted by Frontend Dev did NOT resolve the issue. The bug persists because the code incorrectly determines the target column when a ticket is dropped on another ticket.

## Root Cause Analysis

### The Bug Location

**File:** `/frontend/src/components/Board.tsx`
**Lines:** 128-131
**Function:** `handleDragEnd`

### The Problem Code

```typescript
// Lines 128-131 in Board.tsx
} else {
  // Dropped on a ticket - find which column that ticket is in
  const targetTicket = filteredTickets.find(t => t.id === over.id);
  if (targetTicket) {
    targetColumnId = targetTicket.column_id;  // BUG: This gets the WRONG column!
  }
```

### What's Happening

1. User drags ticket #14 from "Not Started" column
2. User drops it on the "In Progress" column area
3. If the drop happens to land on another ticket (e.g., ticket #2 which is IN "In Progress"):
   - `over.id` = 2 (the ticket it landed on)
   - The code finds ticket #2 in `filteredTickets`
   - It uses `targetTicket.column_id` which is "in_progress" ✅ CORRECT

4. BUT if the drop lands on empty space or between tickets:
   - `over.id` = 14 (the dragged ticket itself!)
   - The code finds ticket #14 in `filteredTickets`
   - It uses ticket #14's `column_id` which is "not_started" ❌ WRONG!

## Console Evidence

```javascript
[LOG] Drag ended: {activeId: 14, overId: 14, overData: Object}
[LOG] Processing move: {ticketId: 14, targetColumnId: not_started, droppedOn: ticket, overId: 14}
[LOG] Same column - no move needed
```

The `overId: 14` shows the system thinks the card was dropped on itself!

## DOM Investigation Results

```
=== DOM INSPECTION: Droppable Areas ===
Column "Not Started": droppableId = No droppableId found
Column "In Progress": droppableId = No droppableId found
...
=== Draggable Items ===
Found 0 draggable cards
```

The DOM inspection reveals:

- No `data-droppable-id` attributes on columns
- No `data-draggable-id` attributes on cards
- This suggests the @dnd-kit library isn't properly initializing

## The Actual Issue

The drag & drop library (@dnd-kit) is detecting the dragged item itself as the drop target when dropping on empty column space. This is a known issue with nested drop zones where:

1. The ticket card is draggable (via `useSortable`)
2. The column is droppable (via `useDroppable`)
3. When dragging over empty column space, the library incorrectly identifies the dragged item as the closest drop target

## Recommended Fix

### Option 1: Fix the Column Detection Logic

```typescript
// In handleDragEnd function, replace lines 128-135 with:
} else {
  // Dropped on a ticket - need to find the column containing this position
  // Check if over.id is the same as active.id (dropped on itself)
  if (over.id === active.id) {
    // Card dropped on itself - likely dropped in empty column space
    // Need to determine which column from cursor position or cancel
    console.log('Card dropped on itself - need better column detection');
    return; // For now, cancel the operation
  }

  // Otherwise find the target ticket's column
  const targetTicket = filteredTickets.find(t => t.id === over.id);
  if (targetTicket) {
    targetColumnId = targetTicket.column_id;
  } else {
    targetColumnId = over.id as string;
  }
}
```

### Option 2: Ensure Columns are Proper Drop Targets

The columns need to be the primary drop targets, not the tickets. Check that:

1. Column `useDroppable` is properly configured
2. Column drop areas cover the full column height
3. Tickets are sortable within columns but not droppable themselves

### Option 3: Use DndContext Collision Detection

Configure @dnd-kit's collision detection to prefer columns over tickets:

```typescript
import { closestCenter, closestCorners, rectIntersection } from '@dnd-kit/core';

// In DndContext setup:
<DndContext
  collisionDetection={closestCorners} // or rectIntersection
  // ... other props
>
```

## Testing After Fix

1. Drag ticket from "Not Started" to empty space in "In Progress"
2. Drag ticket from "Not Started" to land on another ticket in "In Progress"
3. Both should move the ticket to "In Progress" column

## Status

- **Bug Status:** STILL ACTIVE after Frontend Dev's fix attempt
- **Severity:** P0 - Critical (core functionality broken)
- **Impact:** Users cannot organize their work - primary feature unusable
