# Team Plan: Comprehensive QA Testing & Critical Fixes
## Mission: Test with Playwright and fix all missing functionality

### Project Manager Configuration
```yaml
name: qa-fix-pm
session: qa-fix:1
goal: Execute comprehensive Playwright testing and fix critical issues - edit persistence, move persistence, and missing delete functionality
priority: CRITICAL - Core features broken
estimated_time: 3-4 hours
```

## Team Composition

### 1. QA Engineer (qa)
**Role:** Comprehensive testing with Playwright
```yaml
name: qa-engineer
expertise: Playwright, E2E Testing, Bug Documentation, Test Automation
responsibilities:
  - Set up Playwright test suite
  - Write tests for all CRUD operations
  - Test persistence after refresh
  - Test multi-user scenarios
  - Document all bugs found
  - Create regression test suite
  - Verify fixes work correctly
tools: playwright, browser, test runners
```

### 2. Backend Developer (be)
**Role:** Fix API and persistence issues
```yaml
name: backend-dev
expertise: Python, FastAPI, SQLAlchemy, Database, REST APIs
responsibilities:
  - Debug why edits don't persist
  - Fix move operation persistence
  - Implement DELETE endpoint
  - Fix database transactions
  - Ensure proper commits
  - Add missing API endpoints
  - Fix validation issues
tools: python, fastapi, database tools, logs
```

### 3. Frontend Developer (fe)
**Role:** Fix UI state and integrate with backend
```yaml
name: frontend-dev
expertise: React, TypeScript, State Management, API Integration
responsibilities:
  - Fix state sync after edits
  - Implement delete UI functionality
  - Fix optimistic updates
  - Ensure API responses update UI
  - Fix refresh persistence issues
  - Add proper error handling
  - Implement loading states
tools: react, typescript, browser devtools
```

## Workflow Phases

### Phase 1: Playwright Setup & Initial Testing (45 min)
**Lead:** QA Engineer
1. Install Playwright dependencies
2. Create test structure:
   ```typescript
   tests/
   ├── crud.spec.ts      // Create, Read, Update, Delete
   ├── persistence.spec.ts // Refresh persistence
   ├── board.spec.ts     // Move operations
   └── integration.spec.ts // Multi-user scenarios
   ```
3. Write core test cases
4. Run initial test suite
5. Document all failures

### Phase 2: Critical Bug Investigation (30 min)
**Lead:** Backend Developer
**Parallel:** Frontend Developer
1. Backend: Check API logs for edit/move requests
2. Backend: Verify database commits
3. Frontend: Check if API calls are made
4. Frontend: Verify state updates
5. Both: Identify disconnect points

### Phase 3: Fix Implementation (90 min)
**Parallel Work:**

#### Backend Fixes:
1. Fix edit endpoint:
   ```python
   @app.put("/api/tickets/{id}")
   async def update_ticket(id: int, data: dict):
       # Ensure proper commit
       db.commit()
       return updated_ticket
   ```
2. Fix move endpoint persistence
3. Implement DELETE endpoint:
   ```python
   @app.delete("/api/tickets/{id}")
   async def delete_ticket(id: int):
       # Soft or hard delete
       return {"deleted": True}
   ```

#### Frontend Fixes:
1. Fix edit save:
   ```typescript
   const handleSave = async (data) => {
     const response = await api.updateTicket(id, data);
     // Update local state with response
     setTicket(response.data);
   };
   ```
2. Add delete button and handler
3. Fix move persistence with proper API call

### Phase 4: Playwright Test Verification (30 min)
**Lead:** QA Engineer
1. Run full test suite
2. Verify all fixes work
3. Test edge cases
4. Document remaining issues
5. Create regression tests

### Phase 5: Final Integration Testing (30 min)
**Lead:** All Team
1. Manual testing of all features
2. Multi-browser testing
3. Performance testing
4. Final bug sweep

## Test Cases (Playwright)

### Critical Test Suite
```typescript
// Edit Persistence Test
test('edits should persist after refresh', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="card-1"]');
  await page.fill('[name="title"]', 'Updated Title');
  await page.fill('[name="acceptanceCriteria"]', 'New AC');
  await page.click('[data-testid="save-btn"]');
  await page.reload();
  await expect(page.locator('[data-testid="card-1"]')).toContainText('Updated Title');
  await expect(page.locator('[data-testid="card-1"]')).toContainText('New AC');
});

// Move Persistence Test
test('moves should persist after refresh', async ({ page }) => {
  await page.goto('/');
  await page.dragAndDrop('[data-testid="card-1"]', '[data-testid="column-in-progress"]');
  await page.reload();
  await expect(page.locator('[data-testid="column-in-progress"]')).toContainText('Card 1');
});

// Delete Test
test('delete should remove card permanently', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="card-1-menu"]');
  await page.click('[data-testid="delete-option"]');
  await page.click('[data-testid="confirm-delete"]');
  await page.reload();
  await expect(page.locator('[data-testid="card-1"]')).not.toBeVisible();
});
```

## Success Metrics
- [ ] 100% of Playwright tests passing
- [ ] Edit persistence working
- [ ] Move persistence working
- [ ] Delete functionality implemented
- [ ] No data loss scenarios
- [ ] All CRUD operations functional
- [ ] Performance <1s per operation

## Bug Tracking Template
```markdown
### Bug #X: [Title]
**Severity:** Critical/High/Medium/Low
**Component:** Frontend/Backend/Database
**Steps to Reproduce:**
1.
2.
**Expected:**
**Actual:**
**Fix Status:** Pending/In Progress/Fixed
```

## Communication Protocol
- Use session `qa-fix:1`
- Report critical bugs immediately
- Share test results in real-time
- Coordinate API changes

## Contingency Plans

### If Persistence Unfixable Quickly
- Implement manual save button
- Add auto-save indicator
- Cache changes locally

### If Delete Complex
- Implement soft delete first
- Archive instead of delete
- Add undo functionality

### If Tests Keep Failing
- Focus on critical path first
- Fix one issue at a time
- Add more logging

## Resource Allocation
- QA Engineer: 35% (testing focus)
- Backend Developer: 35% (persistence fixes)
- Frontend Developer: 30% (UI integration)

## Timeline
- Total estimated: 3-4 hours
- Checkpoint 1: Tests written (45 min)
- Checkpoint 2: Bugs identified (1.5 hr)
- Checkpoint 3: Fixes implemented (3 hr)
- Checkpoint 4: All tests passing (4 hr)

## Handoff Criteria
Project complete when:
1. All Playwright tests passing
2. Edit persistence verified
3. Move persistence verified
4. Delete functionality working
5. No critical bugs remaining
6. Regression test suite ready

---
*Comprehensive QA and fix team for critical functionality gaps*
