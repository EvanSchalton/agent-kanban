# UI Bug Fix Team - Persistent Session Briefing
## Agent Kanban Board - Continuous QA and Bug Fixing

**Date:** 2025-08-19
**Project Status:** Core features implemented, needs bug fixes
**Mission:** Fix UI bugs as they're discovered, with persistent team for iterative testing

## CRITICAL INSTRUCTIONS FOR PM

### ⚠️ DO NOT DISBAND THE TEAM
- **Keep the session alive** until explicitly told to close
- Team should remain on standby between bug reports
- QA/Test engineers should proactively test while idle
- Wait for user feedback and relay fixes immediately

## CRITICAL ISSUES - UPDATED 2025-08-20

### P0 CRITICAL: Board Isolation Bug 🚨
- **Symptom:** All boards show identical cards - complete data corruption
- **Root Cause:** Backend not filtering tickets by board_id
- **Data Loss:** Deleting card from one board removes from ALL boards
- **Fix Required:** Backend API must filter by board_id in GET /api/boards/{id}/tickets
- **PRIORITY:** Fix immediately - blocks all testing

### P0 CRITICAL: WebSocket Multi-User Sync 🚨
- **Symptom:** Two browser windows - one connects, other doesn't sync changes
- **Expected:** WebSocket should push changes between windows
- **Fallback:** Show "outdated data" warning with refresh option
- **Fix Required:** Investigate connection limits, implement sync or fallback

### P1 HIGH: User Attribution System
- **Symptom:** Comments show "user" instead of actual names
- **Required:** User icon in top-right navbar to set name (localStorage)
- **Backend:** Use provided name in comments instead of hardcoded "user"
- **MCP Requirement:** Agents must provide window/role name in MCP calls
- **Fix Required:** Add user management UI + update comment system

### P1 HIGH: MCP Server Integration
- **Requirement:** Demonstrate agent collaboration via MCP
- **Command:** `claude mcp add kanban <start command>`
- **Demo Goal:** Agents create/edit/comment on cards via MCP server
- **Fix Required:** Complete MCP integration and test workflows

### P2 MEDIUM: Card Creation "Method Not Allowed" Error
- **Symptom:** Clicking "+" to add card shows "Method not allowed"
- **Root Cause:** API endpoint issues
  - Missing trailing slash: `/api/tickets/` not `/api/tickets`
  - Wrong field: Backend expects `current_column` (e.g., "Not Started") not `column_id` (e.g., "not_started")
- **File:** `/frontend/src/services/api.ts` line 146
- **Fix Required:**
  ```typescript
  // Change from:
  const { data } = await api.post('/api/tickets', ticket);

  // To:
  const { data } = await api.post('/api/tickets/', {
    ...ticket,
    current_column: columnIdToName(ticket.column_id),
    // Remove column_id from payload
  });
  ```

### 2. Proactive Testing Required
While waiting for user feedback, QA should test:
- All CRUD operations for boards
- All CRUD operations for tickets
- Drag and drop functionality
- WebSocket real-time updates
- Modal interactions
- Navigation flows
- Edge cases and error handling

## Team Composition Needed

### 1. QA Engineer (LEAD)
- Use Playwright to automate testing if possible
- Manually test all features systematically
- Document all bugs found
- Create test scenarios
- Report issues immediately

### 2. Frontend Developer
- Fix bugs as reported
- Ensure TypeScript compliance
- Test fixes locally
- Coordinate with QA

### 3. Test Engineer
- Write Playwright tests for critical paths
- Automate regression testing
- Verify fixes don't break existing features
- Monitor console for errors

## Testing Priorities

### Critical User Paths
1. **Board Management**
   - Create new board
   - Edit board details
   - Delete board
   - Navigate between boards

2. **Card Management**
   - Create card in each column
   - Edit card details
   - Move card between columns (drag & drop)
   - Delete card
   - Add comments

3. **Real-time Features**
   - WebSocket updates
   - Multi-user scenarios
   - Offline/online transitions

## Bug Reporting Format
When bugs are found, document:
- **Steps to Reproduce**
- **Expected Behavior**
- **Actual Behavior**
- **Error Messages** (console, network tab)
- **Affected Files**
- **Proposed Fix**

## Idle Time Activities
When no active bugs:
1. Run existing test suites
2. Create new Playwright tests
3. Test edge cases
4. Performance testing
5. Accessibility testing
6. Cross-browser testing

## Communication Protocol
- PM coordinates all fixes
- QA reports directly to PM
- PM relays user feedback immediately
- Team acknowledges and fixes ASAP
- PM reports completion back

## Success Metrics
- All reported bugs fixed within 5 minutes
- No regression issues
- Clean console (no errors)
- All TypeScript checks pass
- Smooth user experience

## REMEMBER
- **DO NOT close the session**
- **DO NOT kill agents after fixes**
- **REMAIN on standby for more issues**
- **PROACTIVELY test while waiting**

---
*This is a persistent session for continuous QA and bug fixing*
