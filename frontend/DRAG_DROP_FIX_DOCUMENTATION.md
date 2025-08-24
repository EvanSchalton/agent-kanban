# Drag & Drop Fix Documentation

**Date:** August 20, 2025
**Developer:** Frontend Developer
**Status:** ✅ VERIFIED WORKING

## Problem Statement

The drag & drop functionality was failing when cards were dropped on empty column space. The @dnd-kit library was incorrectly reporting the dragged card's ID as the drop target instead of the column ID.

## Root Cause

When a card was dropped on empty column space:

- `over.id` would equal `active.id` (the dragged card's ID)
- The code would look up this card's original column
- Result: "Same column - no move needed" (incorrect behavior)

## Solution Implemented

### File: `/frontend/src/components/Board.tsx`

### 1. Added Collision Detection (line 102)

```typescript
const { active, over, collisions, delta } = event;
```

Extract collision data from the drag event to detect what elements the dragged item overlapped.

### 2. Created Valid Column IDs Constant (line 37)

```typescript
const VALID_COLUMN_IDS = ['not_started', 'in_progress', 'blocked', 'ready_for_qc', 'done'];
```

Central list of valid column identifiers for validation.

### 3. Enhanced Drop Logic (lines 128-176)

```typescript
if (over.id === active.id) {
  // Card dropped on itself - check collisions for actual column
  if (collisions && collisions.length > 0) {
    for (const collision of collisions) {
      if (VALID_COLUMN_IDS.includes(collision.id)) {
        targetColumnId = collision.id;
        break;
      }
    }
  }
}
```

### 4. Removed Unnecessary SortableContext (lines 256-264)

Columns are droppable but not sortable. Removed the SortableContext wrapper around columns that was causing confusion in the drag hierarchy.

## How It Works

### Scenario 1: Drop on Empty Column Space

1. Detects `over.id === active.id` (card dropped on itself)
2. Checks `collisions` array for column IDs
3. Finds and uses the column ID from collisions
4. Moves card to correct column

### Scenario 2: Drop on Another Card

1. Detects `over.id !== active.id` (different card)
2. Looks up target card's `column_id`
3. Moves dragged card to that column

### Scenario 3: Drop Directly on Column Header

1. Column data available in `over.data.current.columnId`
2. Uses column ID directly
3. Moves card to that column

## Technical Details

### @dnd-kit Library Configuration

- **DndContext:** Uses `closestCorners` collision detection
- **Columns:** Use `useDroppable` hook (droppable zones)
- **Cards:** Use `useSortable` hook (draggable + sortable within columns)

### Column ID Format

- Frontend uses snake_case: `not_started`, `in_progress`, etc.
- Backend expects title case: `Not Started`, `In Progress`, etc.
- Mapping handled by `COLUMN_MAP` constant in `api.ts`

## API Integration

### Move Endpoint

```
POST /api/tickets/{id}/move
Body: { column: "Column Name" }
```

### Column Mapping

```typescript
const COLUMN_MAP = {
  'not_started': 'Not Started',
  'in_progress': 'In Progress',
  'blocked': 'Blocked',
  'ready_for_qc': 'Ready for QC',
  'done': 'Done'
};
```

## Testing Verification

### Test Results

- ✅ Drop on empty column space - Working
- ✅ Drop on another card - Working
- ✅ Drop on column header - Working
- ✅ API calls use correct column IDs - Verified
- ✅ TypeScript compilation - Passing

### Console Logging

The fix includes comprehensive logging for debugging:

```
"Card dropped on itself - checking for column collisions..."
"Found column from collisions: in_progress"
"Processing move: {ticketId: 14, targetColumnId: in_progress}"
```

## Files Modified

1. `/frontend/src/components/Board.tsx` - Main drag & drop logic
2. Removed unnecessary SortableContext wrapper

## Port Information

- Frontend running on: **15175** (as of latest update)
- Backend API on: **18000**

## Future Improvements

1. Could enhance collision detection algorithm
2. Consider using `rectIntersection` instead of `closestCorners` for collision detection
3. Add visual feedback during drag operations
4. Implement card reordering within columns

## Dependencies

```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```

## Troubleshooting

If drag & drop stops working:

1. Check browser console for errors
2. Verify backend is running on port 18000
3. Check network tab for failed API calls
4. Ensure column IDs match VALID_COLUMN_IDS
5. Verify @dnd-kit libraries are installed

---
**Note:** This fix has been thoroughly tested and verified working in all drag & drop scenarios.
