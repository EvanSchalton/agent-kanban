# UI Improvements Briefing
## Agent Kanban Board - Critical UI/UX Fixes

**Date:** 2025-08-19
**Project Status:** Functional but needs UI improvements
**Mission:** Fix critical UI issues and improve user experience

## Critical Issues to Fix

### 1. Remove localStorage/Offline Caching
- **Problem:** localStorage offline caching not working properly
- **Example:** Moving cards offline doesn't retry from localStorage
- **Solution:** Remove all localStorage functionality - not needed for local app
- **Files to modify:**
  - `/workspaces/agent-kanban/frontend/src/context/BoardContext.tsx`
  - `/workspaces/agent-kanban/frontend/src/services/api.ts`

### 2. Add Card Creation Feature
- **Problem:** No way to create new cards on the board
- **Solution:** Add "+" button in each column header to create cards
- **Requirements:**
  - Modal or inline form for new card
  - Fields: Title (required), Description, Priority, Assigned To
  - Default to current column
  - Use existing createTicket API

### 3. Move "Back to Dashboard" to Navbar
- **Problem:** Navigation button in wrong location
- **Current:** In board header
- **Solution:** Create proper navbar component
- **Requirements:**
  - Navbar at top of app
  - "Dashboard" link on left
  - Board name in center when viewing board
  - User settings on right (future)

### 4. Add Board Edit UI
- **Problem:** No way to edit board name/description
- **Solution:** Add edit button on dashboard board cards
- **Requirements:**
  - Edit modal with name and description fields
  - Use existing updateBoard API
  - Update immediately on save

### 5. Fix Board Creation Failure
- **Problem:** Creating boards is failing
- **Investigation needed:** Check API endpoint and request format
- **Likely issues:**
  - Missing required fields
  - API endpoint mismatch
  - Validation errors

## Technical Details

### Current API Endpoints
```typescript
// Board operations
boardApi.create(board: Partial<Board>): Promise<Board>
boardApi.update(id: string, board: Partial<Board>): Promise<Board>

// Ticket operations
ticketApi.create(ticket: Partial<Ticket>): Promise<Ticket>
```

### localStorage to Remove
```typescript
// In BoardContext.tsx
localStorage.getItem('kanban_pending_moves')
localStorage.setItem('kanban_pending_moves', ...)
localStorage.removeItem('kanban_pending_moves')
localStorage.getItem('kanban_current_board')
localStorage.setItem('kanban_current_board', ...)
```

## Priority Order
1. **Fix board creation** - Blocking feature
2. **Add card creation** - Core functionality missing
3. **Remove localStorage** - Cleanup broken code
4. **Move navigation** - UX improvement
5. **Add board edit** - Nice to have

## Success Metrics
- [ ] Board creation works without errors
- [ ] Can create cards in any column
- [ ] No localStorage code remains
- [ ] Navigation in proper navbar
- [ ] Can edit board name/description
- [ ] All changes persist to database
- [ ] No console errors
- [ ] Clean, intuitive UI

## Testing Requirements
- Test board CRUD operations
- Test card creation in all columns
- Verify no localStorage usage
- Check responsive navbar
- Test with multiple boards
- Verify WebSocket updates still work

## Team Composition Needed
- **Frontend Lead**: React, TypeScript expert
- **UI/UX Developer**: Component design and modals
- **Integration Developer**: API connections and state management

---
*This briefing addresses critical UI/UX issues reported by the user*
