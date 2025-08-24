# Team Plan: Actually Fix Frontend Integration Issues
## Mission: Fix the issues IN THE BROWSER, not just APIs

### Project Manager Configuration
```yaml
name: real-fix-pm
session: real-fix:1
goal: Actually fix all 4 issues that users can see in the browser - timezone display, AC persistence, movement errors, drag-drop zones
priority: CRITICAL - Previous "fixes" didn't work
approach: Test everything in the actual browser UI
estimated_time: 2 hours
```

## Team Composition

### 1. Frontend Developer (fe) - LEAD
**Role:** Fix the actual React components and UI
```yaml
name: frontend-dev
expertise: React, TypeScript, Moment.js, Browser DevTools, CSS
responsibilities:
  - Open http://localhost:15173 in browser
  - Reproduce each issue in the UI
  - Fix timezone display in the component that shows time
  - Fix AC field in TicketDetail component
  - Fix WebSocket connection detection
  - Fix drag-drop CSS zones
  - Test each fix in the browser
  - Use browser DevTools extensively
tools: browser, react devtools, network tab, console
```

### 2. Full-Stack Developer (fs)
**Role:** Debug frontend-backend integration
```yaml
name: fullstack-dev
expertise: React, TypeScript, Python, FastAPI, Integration debugging
responsibilities:
  - Trace data flow from UI to backend and back
  - Fix field name mismatches
  - Ensure WebSocket properly connected
  - Debug why AC not displaying
  - Fix any backend issues blocking frontend
  - Monitor network requests in browser
tools: browser devtools, backend logs, full stack debugging
```

### 3. QA Engineer (qa)
**Role:** Verify fixes in actual browser
```yaml
name: qa-engineer
expertise: Browser testing, UI/UX testing, Manual testing
responsibilities:
  - Test each fix in the browser
  - Verify issues are actually fixed for users
  - Test across different scenarios
  - Ensure no regressions
  - Document exact steps to reproduce/verify
tools: browser, multiple browser tabs, screen recording
```

## Workflow Phases

### Phase 1: Reproduce All Issues (20 min)
**Lead:** Frontend Developer
**MUST DO IN BROWSER:**

1. **Create a new ticket:**
   - Note it shows "in about 4 hours" ❌
   - Screenshot the issue

2. **Try to add AC to a ticket:**
   - Type in AC field
   - Save
   - Note AC doesn't persist ❌

3. **Try to move a card:**
   - Drag to new column
   - Note "will retry when backend reconnects" error ❌

4. **Try drag-drop in middle of column:**
   - Note it only works at right edge ❌

### Phase 2: Fix Timezone Display (30 min)
**Lead:** Frontend Developer

1. **Find the component showing time:**
```bash
grep -r "fromNow\|hours ago\|Time in Column" frontend/src/
```

2. **Fix the timezone parsing:**
```javascript
// Find code like:
const timeAgo = moment.utc(ticket.created_at).fromNow();

// Change to:
const timeAgo = moment(ticket.created_at).fromNow();
// OR
const timeAgo = moment(ticket.created_at).local().fromNow();
```

3. **Fix "Time in Column" calculation:**
```javascript
// Find negative time calculation
// Ensure using correct timestamps
const timeInColumn = moment().diff(moment(ticket.column_entered_at), 'seconds');
// Should be positive
```

4. **Test in browser:**
   - Create new ticket
   - Should show "just now" ✅

### Phase 3: Fix AC Field (30 min)
**Lead:** Full-Stack Developer

1. **Check what field name is used:**
```javascript
// In TicketDetail.tsx or similar
console.log('Update payload:', updateData);
// Is AC field included?
```

2. **Fix field inclusion:**
```javascript
const handleSave = async () => {
  const updateData = {
    title: formData.title,
    description: formData.description,
    acceptance_criteria: formData.acceptanceCriteria, // ENSURE THIS LINE EXISTS
    // or acceptanceCriteria: formData.acceptanceCriteria
  };

  console.log('Sending update:', updateData); // Debug
  const response = await api.updateTicket(id, updateData);
  console.log('Received:', response); // Debug
};
```

3. **Fix display:**
```javascript
// Ensure AC displays after save
<div>{ticket.acceptance_criteria || ticket.acceptanceCriteria}</div>
```

4. **Test in browser:**
   - Edit ticket
   - Add AC text
   - Save
   - See AC displayed ✅
   - Refresh page
   - AC still there ✅

### Phase 4: Fix Movement Errors (30 min)
**Lead:** Frontend Developer

1. **Find connection check code:**
```bash
grep -r "retry when backend\|reconnect" frontend/src/
```

2. **Fix connection detection:**
```javascript
// Find code checking connection
const handleMove = async (ticketId, newColumn) => {
  // Remove or fix faulty connection check
  // if (!isConnected) { // DELETE or fix this

  try {
    await api.moveTicket(ticketId, newColumn);
    // Update UI
  } catch (error) {
    // Only show reconnect for actual network errors
    if (error.code === 'NETWORK_ERROR') {
      showError('Will retry when reconnected');
    }
  }
};
```

3. **Test in browser:**
   - Move card to new column
   - No false error messages ✅
   - Movement succeeds ✅

### Phase 5: Fix Drag-Drop Zones (20 min)
**Lead:** Frontend Developer

1. **Find drop zone CSS:**
```bash
grep -r "drop\|drag\|column" frontend/src/**/*.css frontend/src/**/*.scss
```

2. **Fix CSS:**
```css
/* Find the column drop zone */
.kanban-column,
.column-content,
.column-drop-zone {
  position: relative;
  width: 100% !important; /* Full width */
  min-height: 400px;
}

/* Ensure drop area covers entire column */
.column-drop-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0; /* All the way to right */
  bottom: 0;
  pointer-events: auto; /* Can receive drops */
}

/* Visual feedback */
.column-drag-over {
  background-color: rgba(59, 130, 246, 0.1);
  border: 2px dashed #3b82f6;
}
```

3. **Test in browser:**
   - Drag card over middle of column
   - Column highlights ✅
   - Can drop anywhere ✅

### Phase 6: Browser Testing (20 min)
**Lead:** QA Engineer
**ALL TESTING IN BROWSER:**

1. **Timezone test:**
   - Create ticket → Shows "just now" ✅
   - Move ticket → Positive time in column ✅

2. **AC test:**
   - Add AC → Saves ✅
   - Refresh → Still there ✅

3. **Movement test:**
   - Move cards → No errors ✅
   - Refresh → Position saved ✅

4. **Drag-drop test:**
   - Drop in column center → Works ✅
   - Visual feedback → Shows ✅

## Critical Testing Commands

### Browser Console Tests
```javascript
// Test timezone
new Date().toISOString() // Compare with ticket timestamps

// Test AC field
document.querySelector('[name="acceptanceCriteria"]').value

// Test WebSocket
window.WebSocket ? 'supported' : 'not supported'

// Test drop zones
document.querySelectorAll('.column-drop-zone').forEach(z => z.style.border = '2px solid red')
```

## Success Metrics - IN THE BROWSER
- [ ] Create ticket shows "just now" not "in 4 hours"
- [ ] AC field saves and displays after refresh
- [ ] Move cards without false error messages
- [ ] Drop cards anywhere in column
- [ ] All fixes verified by QA in browser

## DO NOT CLOSE until verified in browser!

## Timeline
- Phase 1: Reproduce issues (20 min)
- Phase 2: Fix timezone (50 min)
- Phase 3: Fix AC (80 min)
- Phase 4: Fix movements (110 min)
- Phase 5: Fix drag-drop (130 min)
- Phase 6: Full testing (150 min)

---
*Team focused on actual browser fixes, not just API testing*
