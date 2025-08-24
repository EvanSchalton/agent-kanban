# CRITICAL ISSUES UPDATE - 2025-08-20

## New Critical Bugs Discovered

### P0 CRITICAL: Board Isolation Bug
**Impact:** Data corruption - all boards show same cards
- **Symptom:** Opening any board shows identical cards across all boards
- **Root Cause:** Backend not filtering tickets by board_id
- **Data Loss Risk:** Deleting card from one board removes it from all boards
- **Fix Required:** Backend API must filter tickets by board_id in GET /api/boards/{id}/tickets

### P0 CRITICAL: WebSocket Real-Time System Broken 🚨
**Impact:** No real-time updates - critical for agent-human collaboration
- **Current Issue:** WebSocket doesn't broadcast any events between windows
- **Architecture Required:**
  - API changes → WebSocket broadcast → UI updates
  - MCP agent actions → API → WebSocket → Real-time UI updates
  - Two browser windows should see changes instantly
- **End Goal:** Agents use MCP to modify board, humans monitor real-time progress
- **Fix Required:** Backend WebSocket broadcasting + Frontend event handling

### P1 HIGH: User Attribution Missing
**Impact:** Comments show "user" instead of actual names
- **Requirement:** User icon in top-right navbar to set name (localStorage)
- **Backend:** Comments should use provided name instead of hardcoded "user"
- **MCP Integration:** Agents must provide their window/role name when using MCP
- **Fix Required:** Add user management UI and update comment system

### P1 HIGH: MCP Integration Required
**Impact:** Need to demonstrate agent collaboration via MCP
- **Requirement:** Add kanban MCP server to Claude Code
- **Command:** `claude mcp add kanban <start command>`
- **Demo:** Agents create/edit/comment on cards via MCP server
- **Fix Required:** Complete MCP server integration and test agent workflows

### P1 HIGH: Board Deletion Failure
**Impact:** Cannot delete boards - CRUD operation broken
- **Symptom:** Deleting a board fails
- **Root Cause:** Unknown - need error investigation
- **Fix Required:** Debug board deletion API endpoint and error handling

### P0 CRITICAL: Card Creation "Resource Not Found" 🚨
**Impact:** Core functionality completely broken
- **Symptom:** Adding a card now raises "resource not found" error
- **Status:** NEW - Just discovered during user testing
- **Root Cause:** API endpoint issue or backend failure
- **Fix Required:** IMMEDIATE debugging of POST /api/tickets/ endpoint

### P1 HIGH: Playwright Browser Window Proliferation ✅
**Impact:** Active disruption - browser creating excessive blank windows
- **Status:** RESOLVED - Test Engineer fixed configuration
- **Action:** Completed - Playwright processes stopped and config fixed

## Priority Order
1. **Board Isolation Bug** - IMMEDIATE (blocks all testing)
2. **Playwright Window Proliferation** - IMMEDIATE (active disruption)
3. **WebSocket Sync** - HIGH (core multi-user feature)
4. **Board Deletion Failure** - HIGH (core CRUD operation)
5. **User Attribution** - HIGH (needed for MCP demo)
6. **MCP Integration** - HIGH (demonstration requirement)

## PM Instructions
- **FIX BOARD BUG FIRST** - This blocks all other testing
- Keep persistent session active
- Coordinate with backend team on API fixes
- Test multi-user scenarios thoroughly
- Prepare for MCP server integration testing

---
*Updated: 2025-08-20 - Relay to PM immediately*
