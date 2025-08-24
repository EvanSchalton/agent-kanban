# Team Plan: Timezone, AC, Movement & UX Fixes
## Mission: Fix timing display, AC persistence, column movements, and drag-drop UX

### Project Manager Configuration
```yaml
name: multi-fix-pm
session: multi-fix:1
goal: Fix timezone issues showing "in 4 hours", AC field not persisting, column movements failing, and drag-drop zone too small
priority: HIGH - Multiple core issues
estimated_time: 2-3 hours
```

## Team Composition

### 1. Backend Developer (be)
**Role:** Fix timezone handling and AC persistence
```yaml
name: backend-dev
expertise: Python, FastAPI, SQLAlchemy, Timezone handling, Database
responsibilities:
  - Fix timezone issues in API responses
  - Ensure all timestamps use proper timezone (not UTC for display)
  - Debug why acceptance_criteria field not persisting
  - Check field name mapping (acceptanceCriteria vs acceptance_criteria)
  - Verify database column for AC exists and maps correctly
  - Fix move endpoint if returning wrong status
  - Add proper timezone configuration
tools: python, fastapi, datetime, pytz, database
```

### 2. Frontend Developer (fe)
**Role:** Fix UI issues and field mappings
```yaml
name: frontend-dev
expertise: React, TypeScript, Moment.js, Drag-and-drop, CSS
responsibilities:
  - Fix timezone display (use local time not UTC)
  - Fix "Time in Column" negative values
  - Ensure AC field included in update payload
  - Fix field name mapping for AC
  - Fix WebSocket connection status detection
  - Expand drag-drop zones to full column width
  - Add visual feedback for drop zones
tools: react, typescript, moment/date-fns, css, react-dnd
```

### 3. QA Engineer (qa)
**Role:** Test all fixes thoroughly
```yaml
name: qa-engineer
expertise: Testing, Timezone validation, API testing, UI testing
responsibilities:
  - Test timezone displays across different timezones
  - Verify AC field saves and persists
  - Test column movements work reliably
  - Verify drag-drop works across entire column
  - Create regression tests for all fixes
  - Test with different browsers
tools: playwright, postman, browser devtools, timezone testing
```

## Workflow Phases

### Phase 1: Quick Diagnosis (30 min)
**All team members investigate in parallel:**

1. **Backend checks:**
```python
# Check what timezone backend sends
print(f"Created at: {ticket.created_at}")
print(f"Timezone: {ticket.created_at.tzinfo}")
```

2. **Frontend checks:**
```javascript
// Check field names in payload
console.log("Update payload:", updateData);
// Should include: acceptanceCriteria or acceptance_criteria?
```

3. **Database check:**
```sql
-- Check AC column name
PRAGMA table_info(tickets);
-- Look for acceptance_criteria column
```

4. **Network inspection:**
```javascript
// Check move request/response
// Look for connection status errors
```

### Phase 2: Timezone Fix (30 min)
**Lead:** Backend & Frontend Developers

#### Backend Fix:
```python
from datetime import datetime
from zoneinfo import ZoneInfo  # Python 3.9+

# Instead of
created_at = datetime.utcnow()

# Use timezone-aware
created_at = datetime.now(ZoneInfo("UTC"))

# Or send as ISO with timezone
return {
    "created_at": ticket.created_at.isoformat(),  # Includes timezone
}
```

#### Frontend Fix:
```javascript
// Fix relative time display
import moment from 'moment';

// Ensure parsing includes timezone
const createdAt = moment(ticket.created_at); // Should parse timezone
const timeAgo = createdAt.fromNow(); // Should show "just now" not "in 4 hours"

// Fix time in column
const timeInColumn = moment().diff(moment(ticket.moved_at), 'seconds');
// Should be positive, not negative
```

### Phase 3: AC Persistence Fix (30 min)
**Lead:** Backend Developer

1. **Check field mapping:**
```python
# In update endpoint
print(f"Received fields: {update_data.keys()}")
# Is it acceptanceCriteria or acceptance_criteria?

# Ensure mapping
if "acceptanceCriteria" in update_data:
    ticket.acceptance_criteria = update_data["acceptanceCriteria"]
```

2. **Frontend ensure field sent:**
```javascript
const updateData = {
  title: formData.title,
  description: formData.description,
  acceptanceCriteria: formData.acceptanceCriteria, // MUST include
  // or acceptance_criteria depending on backend
};
```

3. **Database verify column:**
```sql
ALTER TABLE tickets
ADD COLUMN acceptance_criteria TEXT IF NOT EXISTS;
```

### Phase 4: Column Movement Fix (30 min)
**Lead:** Frontend Developer

1. **Fix connection detection:**
```javascript
// Don't rely on stale connection status
const moveTicket = async (ticketId, newColumn) => {
  try {
    const response = await api.moveTicket(ticketId, newColumn);
    // Success - update UI
  } catch (error) {
    if (error.code === 'NETWORK_ERROR') {
      // Only show reconnect message for real network errors
      setRetryQueue([...retryQueue, { ticketId, newColumn }]);
    } else {
      // Show actual error
      showError(error.message);
    }
  }
};
```

2. **Backend ensure proper response:**
```python
@router.post("/tickets/{id}/move")
async def move_ticket(id: int, data: MoveRequest):
    # ... move logic
    db.commit()
    return {"success": True, "ticket": ticket}  # Clear success response
```

### Phase 5: Drag-Drop UX Fix (20 min)
**Lead:** Frontend Developer

```css
/* Fix drop zone to cover entire column */
.kanban-column {
  position: relative;
  min-height: 500px;
  width: 100%;
}

.column-drop-zone {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;  /* Full width */
  bottom: 0;
  z-index: 1;
}

.column-drop-zone.drag-over {
  background-color: rgba(0, 123, 255, 0.1);
  border: 2px dashed #007bff;
}
```

```javascript
// Add visual feedback
const [{ isOver }, dropRef] = useDrop({
  accept: 'TICKET',
  drop: (item) => handleDrop(item),
  collect: (monitor) => ({
    isOver: monitor.isOver(),
  }),
});

// Apply class when hovering
<div
  ref={dropRef}
  className={`kanban-column ${isOver ? 'drag-over' : ''}`}
>
```

### Phase 6: Integration Testing (30 min)
**Lead:** QA Engineer

1. **Timezone tests:**
   - Create ticket, verify shows "just now"
   - Move ticket, verify positive time in column
   - Test in different timezones

2. **AC persistence:**
   - Update AC field
   - Refresh page
   - Verify AC still there

3. **Movement tests:**
   - Move tickets between all columns
   - No false "reconnect" messages
   - Movements persist

4. **Drag-drop UX:**
   - Can drop anywhere in column
   - Visual feedback on hover
   - Works on different screen sizes

## Success Metrics
- [ ] No "in 4 hours" for recent items
- [ ] Time in column always positive
- [ ] AC field persists after refresh
- [ ] Column movements work without errors
- [ ] Can drop tickets anywhere in column
- [ ] Visual feedback for drop zones

## Critical Debug Commands

### Check Timezone
```bash
# Backend timezone
python -c "from datetime import datetime; print(datetime.now()); print(datetime.utcnow())"

# Database times
sqlite3 kanban.db "SELECT created_at, updated_at FROM tickets LIMIT 5"
```

### Test AC Field
```bash
# Update with AC
curl -X PUT http://localhost:8000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{"acceptanceCriteria":"Test AC"}'

# Check database
sqlite3 kanban.db "SELECT acceptance_criteria FROM tickets WHERE id=1"
```

### Test Move
```bash
# Move ticket
curl -X POST http://localhost:8000/api/tickets/1/move \
  -H "Content-Type: application/json" \
  -d '{"column":"Done","position":0}'
```

## Timeline
- Total estimated: 2-3 hours
- Checkpoint 1: Issues diagnosed (30 min)
- Checkpoint 2: Timezone fixed (1 hr)
- Checkpoint 3: AC persistence fixed (1.5 hr)
- Checkpoint 4: Movements working (2 hr)
- Checkpoint 5: All tests passing (2.5 hr)

## Handoff Criteria
Project complete when:
1. Times display correctly (no future times)
2. AC field saves and persists
3. Column movements work reliably
4. Drag-drop works on full column
5. All tests passing

---
*Multi-issue fix team for timezone, persistence, and UX problems*
