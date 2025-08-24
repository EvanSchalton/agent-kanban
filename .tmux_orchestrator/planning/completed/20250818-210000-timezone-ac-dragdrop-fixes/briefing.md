# Timezone, AC Persistence & UI/UX Fixes Briefing
## Agent Kanban Board - Multiple Critical Issues

**Date:** 2025-08-18
**Project Status:** Partially Working - Multiple Bugs
**Mission:** Fix timezone issues, AC persistence, column movements, and drag-drop UX

## Critical Issues Identified

### 1. Timezone/Timing Issues 🕐
**Symptoms:**
- Comments show "in about 4 hours" immediately after creation
- "Time in Column" shows negative values (-14328s)
- Clear UTC/Local timezone mismatch

**Impact:** Confusing user experience, incorrect analytics
**Root Cause:** Server using UTC, client expecting local time (or vice versa)

### 2. Acceptance Criteria Not Persisting ❌
**Issue:** AC field doesn't save despite other fields working
**Likely Causes:**
- Field name mismatch (acceptanceCriteria vs acceptance_criteria)
- Missing from update payload
- Backend not mapping this field
- Database column issue

### 3. Column Movement Failures ❌
**Symptoms:**
- "Will retry when backend reconnects" despite backend connected
- Move operations failing silently
- Frontend thinks backend is disconnected

**Likely Causes:**
- WebSocket connection status not properly tracked
- Move endpoint returning unexpected response
- Optimistic updates without proper error handling

### 4. Drag-Drop UX Issue 🎯
**Problem:** Drop zone only activates at right edge of column
**Expected:** Entire column should be droppable
**Cause:** CSS/Component drop zone too small

## Technical Analysis

### Timezone Issues
```javascript
// Frontend showing relative time
moment(ticket.created_at).fromNow() // "in 4 hours" if timezone wrong

// Backend sending UTC
created_at = datetime.utcnow() // Should be datetime.now() with timezone

// Fix needed: Consistent timezone handling
```

### AC Field Investigation
```javascript
// Check field names
Frontend: acceptanceCriteria? acceptance_criteria? ac?
Backend: acceptance_criteria? acceptanceCriteria?
Database: What's the actual column name?
```

### Column Movement
```javascript
// Frontend checking connection wrong way?
if (!isConnected) {
  showError("Will retry when backend reconnects")
}
// But isConnected might be stale or wrong
```

### Drop Zone CSS
```css
/* Current - probably too narrow */
.column-drop-zone {
  width: 10px; /* Too small! */
}

/* Should be */
.column {
  position: relative;
  /* Entire column should accept drops */
}
```

## Investigation Steps

### 1. Timezone Debugging
- Check server timezone settings
- Verify database stores UTC or local
- Check frontend timezone handling
- Ensure consistent ISO 8601 format

### 2. AC Field Tracing
- Log the update payload in frontend
- Check network tab for field name
- Verify backend receives field
- Check database column name
- Trace through update endpoint

### 3. Move Operation Testing
- Check WebSocket connection status
- Test move endpoint directly with curl
- Verify response format
- Check error handling

### 4. Drag-Drop Zone
- Inspect drop zone elements
- Check CSS for column width
- Verify drag-drop library configuration

## Fix Requirements

### Timezone Fixes
1. **Backend:** Send timezone-aware timestamps
2. **Frontend:** Handle timezone conversion properly
3. **Database:** Store with timezone info
4. **Display:** Use local time for users

### AC Persistence
1. **Map field names** correctly frontend → backend
2. **Include in update payload**
3. **Verify database column** exists
4. **Test persistence** explicitly

### Column Movement
1. **Fix connection detection**
2. **Improve error messages**
3. **Add retry logic**
4. **Verify endpoint working**

### Drag-Drop UX
1. **Expand drop zone** to full column width
2. **Add visual feedback** on hover
3. **Improve drag preview**
4. **Test on different screen sizes**

## Success Criteria

### Must Fix
- ✅ Times display correctly (no "in 4 hours" for recent items)
- ✅ Time in column shows positive values
- ✅ AC field saves and persists
- ✅ Column movements work reliably
- ✅ Entire column is droppable

### Should Fix
- ✅ Consistent timezone handling
- ✅ Better error messages
- ✅ Visual feedback for drag-drop
- ✅ Connection status accurate

## Testing Requirements

### Timezone Tests
```javascript
// Create item and verify time
const created = new Date();
createTicket();
// Should show "just now" not "in 4 hours"
```

### AC Persistence Test
```javascript
// Update AC
updateTicket({ acceptanceCriteria: "Test AC" });
// Refresh page
// AC should still be "Test AC"
```

### Move Test
```javascript
// Move ticket to new column
moveTicket(ticketId, "In Progress");
// Should succeed without "retry" message
// Should persist after refresh
```

## Priority Order
1. **FIRST:** AC persistence (data loss)
2. **SECOND:** Column movements (core functionality)
3. **THIRD:** Timezone issues (confusing but not blocking)
4. **FOURTH:** Drag-drop UX (usability)

---

*This briefing addresses multiple critical issues affecting usability and data integrity*
