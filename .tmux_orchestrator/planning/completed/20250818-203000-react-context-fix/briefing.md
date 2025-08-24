# React Context Provider Error Briefing
## Agent Kanban Board - Frontend Component Structure Issue

**Date:** 2025-08-18
**Project Status:** Frontend Crashing on Load
**Mission:** Fix React Context error preventing UI from rendering

## Error Details

### Stack Trace
```
Error: useBoard must be used within a BoardProvider
    at useBoard (useBoardHook.ts:6:11)
    at ConnectionStatus (ConnectionStatus.tsx:22:56)
```

### Root Cause
The `ConnectionStatus` component is trying to access the `useBoard` hook, but it's being rendered **outside** of the `BoardProvider` context wrapper.

## Component Tree Issue

### Current (Broken) Structure
```jsx
<App>
  <ConnectionStatus />  // ❌ Outside BoardProvider
  <BoardProvider>
    <Board />
  </BoardProvider>
</App>
```

### Required Structure
```jsx
<App>
  <BoardProvider>
    <ConnectionStatus />  // ✅ Inside BoardProvider
    <Board />
  </BoardProvider>
</App>
```

## Technical Explanation

### What's Happening
1. `ConnectionStatus` component calls `useBoard()` hook
2. `useBoard` expects to find `BoardContext` in the component tree
3. Since `ConnectionStatus` is outside `BoardProvider`, context is undefined
4. Hook throws error: "must be used within a BoardProvider"

### Why It Matters
- **Blocks entire UI** - Nothing renders when this error occurs
- **Critical functionality** - Connection status needs board state
- **Simple fix** - Just restructure component tree

## Files to Check

1. **App.tsx** or **main.tsx**
   - Main app component structure
   - Where BoardProvider wraps components

2. **ConnectionStatus.tsx**
   - Component using useBoard hook
   - May need to be moved or wrapped

3. **useBoardHook.ts**
   - Hook implementation (likely correct)
   - Error thrown at line 6

## Fix Options

### Option 1: Move ConnectionStatus Inside Provider (Recommended)
```jsx
// App.tsx
function App() {
  return (
    <BoardProvider>
      <div className="app">
        <ConnectionStatus />
        <Board />
      </div>
    </BoardProvider>
  );
}
```

### Option 2: Create Separate Context for Connection
```jsx
// If ConnectionStatus needs to be outside for layout reasons
<ConnectionProvider>
  <ConnectionStatus />
  <BoardProvider>
    <Board />
  </BoardProvider>
</ConnectionProvider>
```

### Option 3: Make ConnectionStatus Not Depend on Board Context
Remove the `useBoard()` call and get connection info another way.

## Success Criteria

- ✅ UI loads without errors
- ✅ ConnectionStatus component renders
- ✅ Board functionality intact
- ✅ All hooks work within proper context

## Testing Steps

1. Start frontend: `npm run dev`
2. Open browser to http://localhost:15173
3. Check console - no Context errors
4. Verify ConnectionStatus shows
5. Test board functionality

## Priority

**CRITICAL** - UI completely broken, users cannot access application

## Estimated Fix Time

5-10 minutes - Simple component restructuring

---

*This briefing addresses the React Context error blocking the entire UI*
