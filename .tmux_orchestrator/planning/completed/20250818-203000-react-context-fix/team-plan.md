# Team Plan: React Context Fix
## Mission: Fix component structure to resolve Context Provider error

### Project Manager Configuration
```yaml
name: context-fix-pm
session: context-fix:1
goal: Fix React Context error by restructuring component tree so ConnectionStatus is inside BoardProvider
priority: CRITICAL - UI completely broken
estimated_time: 10 minutes
```

## Team Composition

### Single Agent Team (Quick Fix)

### 1. Frontend Developer (fe)
**Role:** Fix component structure and Context error
```yaml
name: frontend-dev
expertise: React, TypeScript, Context API, Component Architecture
responsibilities:
  - Locate App.tsx or main.tsx entry point
  - Find where BoardProvider wraps components
  - Move ConnectionStatus inside BoardProvider
  - Verify all components using useBoard are wrapped
  - Test UI loads without errors
  - Ensure no regression in functionality
tools: code editor, browser, react devtools
```

## Workflow Phases

### Phase 1: Diagnosis (2 minutes)
1. Find the main App component
2. Locate ConnectionStatus component usage
3. Identify current BoardProvider structure
4. Confirm the error source

### Phase 2: Fix Implementation (3 minutes)
1. Move ConnectionStatus inside BoardProvider
2. Ensure proper component hierarchy:
   ```tsx
   <BoardProvider>
     <ConnectionStatus />
     <Board />
     {/* Other components needing board context */}
   </BoardProvider>
   ```
3. Check for any other components outside provider

### Phase 3: Testing (3 minutes)
1. Start frontend server
2. Open browser - verify no errors
3. Check ConnectionStatus displays
4. Test board drag-and-drop works
5. Verify WebSocket connection status shows

### Phase 4: Cleanup (2 minutes)
1. Remove any unused imports
2. Ensure code formatting is correct
3. Document the fix if needed

## Critical Path

```
1. Find App.tsx/main.tsx
    ↓
2. Locate BoardProvider and ConnectionStatus
    ↓
3. Move ConnectionStatus inside BoardProvider
    ↓
4. Test UI loads
```

## Success Metrics
- [ ] No Context error in console
- [ ] UI renders completely
- [ ] ConnectionStatus component visible
- [ ] Board functionality works
- [ ] WebSocket status updates display

## Quick Fix Example

### Before (Broken):
```tsx
function App() {
  return (
    <div className="app">
      <Header />
      <ConnectionStatus />  // ❌ Outside provider
      <BoardProvider>
        <Board />
      </BoardProvider>
    </div>
  );
}
```

### After (Fixed):
```tsx
function App() {
  return (
    <div className="app">
      <BoardProvider>
        <Header />
        <ConnectionStatus />  // ✅ Inside provider
        <Board />
      </BoardProvider>
    </div>
  );
}
```

## Debugging Commands

### Check Current Structure
```bash
# Find where BoardProvider is used
grep -r "BoardProvider" frontend/src/

# Find ConnectionStatus usage
grep -r "ConnectionStatus" frontend/src/

# Find useBoard hook usage
grep -r "useBoard" frontend/src/
```

### Test Fix
```bash
cd frontend
npm run dev
# Open http://localhost:15173
# Check browser console for errors
```

## Communication Protocol
- Single agent task - minimal coordination needed
- Report immediately when fixed
- Share any unexpected issues

## Contingency Plans

### If Multiple Components Affected
- Wrap entire App in BoardProvider
- Move provider to highest level needed

### If ConnectionStatus Has Special Requirements
- Create a wrapper component
- Pass only needed data as props
- Consider splitting into two components

### If Fix Causes Layout Issues
- Adjust CSS/styling as needed
- Ensure provider doesn't affect layout
- Use Fragment if needed

## Resource Allocation
- Frontend Developer: 100% (single agent task)

## Timeline
- Total estimated time: 10 minutes
- Checkpoint 1: Error identified (2 min)
- Checkpoint 2: Fix applied (5 min)
- Checkpoint 3: Testing complete (10 min)

## Handoff Criteria
Task complete when:
1. No Context errors in console
2. UI renders fully
3. All components functional
4. ConnectionStatus shows correctly
5. No regression in features

---
*Quick fix team for critical React Context error*
