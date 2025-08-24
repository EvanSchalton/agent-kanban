# Team Plan: Persistent UI Bug Fix Team
## Mission: Fix bugs iteratively with continuous QA testing

### Project Manager Configuration
```yaml
name: bugfix-pm
session: bugfix:1
goal: Maintain persistent team to fix UI bugs as discovered, DO NOT DISBAND
priority: HIGH - User actively testing
estimated_time: Ongoing until told to stop
special_instructions: DO NOT close session or kill agents. Keep team on standby.
```

## Team Composition

### 1. QA Engineer (qa-eng) - LEAD
**Role:** Proactive testing and bug discovery
```yaml
name: qa-eng
expertise: Testing, Playwright, Browser DevTools, Bug Documentation
responsibilities:
  - Test all UI features systematically
  - Use browser console to catch errors
  - Document reproduction steps
  - Create Playwright tests if possible
  - Test card creation immediately (known bug)
  - Monitor for WebSocket issues
  - Check all modals work correctly
  - Verify drag and drop
  - Report all issues to PM
tools: browser, devtools, playwright, testing
```

### 2. Frontend Developer (fe-dev)
**Role:** Fix bugs as they're reported
```yaml
name: fe-dev
expertise: React, TypeScript, API Integration, Debugging
responsibilities:
  - Fix card creation API issue immediately
  - Respond to bug reports from QA
  - Ensure TypeScript compliance
  - Test fixes locally
  - Handle API endpoint issues
  - Fix state management bugs
  - Resolve console errors
tools: react, typescript, debugging
```

### 3. Test Engineer (test-eng)
**Role:** Automated testing and verification
```yaml
name: test-eng
expertise: Playwright, E2E Testing, Test Automation
responsibilities:
  - Write Playwright tests for critical paths
  - Create regression test suite
  - Verify each fix doesn't break other features
  - Monitor application performance
  - Test WebSocket real-time updates
  - Check accessibility
  - Run tests continuously while idle
tools: playwright, testing, automation
```

## Immediate Actions (First 10 minutes)

### Priority 1: Fix Card Creation Bug
**Lead:** Frontend Developer

```typescript
// In /frontend/src/services/api.ts line 146
// Current (BROKEN):
async create(ticket: Partial<Ticket>): Promise<Ticket> {
  const { data } = await api.post('/api/tickets', ticket);

// FIXED:
async create(ticket: Partial<Ticket>): Promise<Ticket> {
  // Transform column_id to current_column name
  const columnMap: Record<string, string> = {
    'not_started': 'Not Started',
    'in_progress': 'In Progress',
    'blocked': 'Blocked',
    'ready_for_qc': 'Ready for QC',
    'done': 'Done'
  };

  const payload = {
    title: ticket.title,
    description: ticket.description,
    acceptance_criteria: ticket.acceptance_criteria,
    priority: ticket.priority || '1.0',
    assignee: ticket.assignee,
    board_id: ticket.board_id,
    current_column: columnMap[ticket.column_id!] || 'Not Started'
  };

  const { data } = await api.post('/api/tickets/', payload);
```

### Priority 2: Systematic Testing
**Lead:** QA Engineer

1. **Test Board Operations:**
   - Create board
   - Edit board
   - Delete board
   - Navigate between boards

2. **Test Card Operations:**
   - Create card in each column (especially after fix)
   - Edit card details
   - Move cards via drag and drop
   - Delete cards
   - Add comments

3. **Test Navigation:**
   - Dashboard to board
   - Board to dashboard
   - Direct URL access
   - 404 handling

## Ongoing Workflow

### When User Reports Bug:
1. PM receives bug report
2. PM assigns to appropriate team member
3. Developer implements fix
4. Test engineer verifies fix
5. QA engineer confirms resolution
6. PM reports back completion

### When Idle (No Active Bugs):
1. **QA Engineer:**
   - Systematic feature testing
   - Edge case exploration
   - Performance monitoring
   - Console error checking

2. **Test Engineer:**
   - Write new Playwright tests
   - Run regression suite
   - Test cross-browser compatibility
   - Check accessibility

3. **Frontend Developer:**
   - Code review
   - Performance optimizations
   - Refactoring for maintainability
   - TypeScript strict mode fixes

## Bug Priority Levels
- **P0 (Critical):** Feature completely broken - Fix immediately
- **P1 (High):** Major functionality impaired - Fix within 5 min
- **P2 (Medium):** Minor issues - Fix within 10 min
- **P3 (Low):** Cosmetic/nice-to-have - Fix when idle

## Testing Checklist
- [ ] Board CRUD operations
- [ ] Card CRUD operations
- [ ] Drag and drop
- [ ] All modals (Create, Edit, Delete confirmations)
- [ ] Navigation and routing
- [ ] WebSocket real-time updates
- [ ] Error handling and recovery
- [ ] Loading states
- [ ] Empty states
- [ ] Form validations
- [ ] Keyboard navigation
- [ ] Mobile responsiveness

## Communication Rules
1. **All bugs go through PM first**
2. **PM prioritizes and assigns**
3. **Team confirms when starting fix**
4. **Team reports when complete**
5. **QA verifies before closing**

## Session Management
- **DO NOT** use `tmux kill-session`
- **DO NOT** exit agents
- **KEEP** session alive indefinitely
- **WAIT** for explicit instruction to close
- **STAY** responsive to new issues

## Success Metrics
- Response time < 1 minute
- Fix time < 5 minutes for P0/P1
- No regression bugs
- Clean console output
- All tests passing

---
*This team remains active until explicitly disbanded by orchestrator*
