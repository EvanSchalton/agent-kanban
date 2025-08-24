# Team Plan: MCP Middleware & Frontend Fixes
## Mission: Implement proper MCP stdio server and fix frontend issues

### Project Manager Configuration
```yaml
name: integration-fix-pm
session: integration-fix:1
goal: Fix MCP server to use stdio protocol as middleware to REST API, and resolve frontend error handling and WebSocket issues
priority: HIGH - Final fixes for full system integration
```

## Team Composition

### 1. MCP Developer (mcp)
**Role:** Rewrite MCP server as proper stdio middleware
```yaml
name: mcp-developer
expertise: Python, MCP Protocol, JSON-RPC, stdio communication
responsibilities:
  - Rewrite run_mcp.py to use stdio transport (not HTTP)
  - Implement JSON-RPC message handling
  - Add HTTP client to call REST API endpoints
  - Map all 9 MCP tools to REST API calls
  - Test with echo commands and Claude CLI
  - Ensure proper error handling and response formatting
tools: python, fastmcp, requests, json-rpc
```

### 2. Frontend Developer (fe)
**Role:** Fix error handler and WebSocket stability
```yaml
name: frontend-dev
expertise: React, TypeScript, WebSocket, Error Handling
responsibilities:
  - Fix errorHandler.ts TypeError issue
  - Handle 422 validation errors properly
  - Stabilize WebSocket connection
  - Fix move endpoint request payload
  - Add proper cleanup on component unmount
  - Test all error scenarios
tools: typescript, react devtools, browser console
```

### 3. Backend Developer (be)
**Role:** Ensure API and WebSocket endpoints work correctly
```yaml
name: backend-dev
expertise: Python, FastAPI, WebSocket, Validation
responsibilities:
  - Verify move endpoint validation rules
  - Check WebSocket implementation
  - Add better error messages for 422 responses
  - Ensure CORS configured for WebSocket
  - Add heartbeat/keepalive if missing
  - Monitor server logs during testing
tools: python, fastapi, uvicorn, logs
```

## Workflow Phases

### Phase 1: Frontend Critical Fix (20 minutes)
**Lead:** Frontend Developer
**Priority:** HIGHEST - Users blocked
1. Fix errorHandler.ts immediately:
   ```typescript
   // Safe error handling
   if (error.response?.status === 422) {
       const data = error.response.data;
       // Handle validation errors safely
       if (data?.detail) {
           return { message: data.detail };
       }
       return { message: 'Validation error' };
   }
   ```
2. Test ticket movement works
3. Deploy fix immediately

### Phase 2: API Validation Fix (15 minutes)
**Lead:** Backend Developer
1. Check move endpoint requirements:
   ```python
   # What fields are required?
   # column_id? position? both?
   ```
2. Add clear validation messages
3. Test with frontend
4. Document required fields

### Phase 3: WebSocket Stabilization (20 minutes)
**Lead:** Frontend & Backend Developers
1. Backend: Add heartbeat mechanism
2. Frontend: Improve reconnection logic
3. Add connection state management
4. Test stability over time
5. Handle component cleanup properly

### Phase 4: MCP Stdio Implementation (30 minutes)
**Lead:** MCP Developer
1. Rewrite run_mcp.py structure:
   ```python
   import sys
   import json
   import asyncio
   from fastmcp import FastMCP
   import httpx

   mcp = FastMCP("agent-kanban-mcp")
   API_BASE = "http://localhost:8000"

   @mcp.tool()
   async def list_tasks(status: str = None):
       async with httpx.AsyncClient() as client:
           params = {"status": status} if status else {}
           response = await client.get(f"{API_BASE}/api/tickets", params=params)
           return response.json()

   # Run with stdio transport
   if __name__ == "__main__":
       mcp.run_stdio()  # NOT run() or run_http()
   ```
2. Implement all 9 tools with HTTP calls
3. Test with echo commands
4. Validate with Claude CLI

### Phase 5: Integration Testing (15 minutes)
**Lead:** All Team
1. Frontend: Test all user interactions
2. Backend: Monitor logs for errors
3. MCP: Test all tools through Claude
4. Document any remaining issues

## Critical Path & Dependencies

```
1. Fix Error Handler (BLOCKS EVERYTHING)
    ↓
2. Fix Move Validation
    ↓
3. Stabilize WebSocket
    ↓
4. Implement MCP Stdio (INDEPENDENT - can be parallel)
```

## Success Metrics
- [ ] No TypeError in error handler
- [ ] Tickets can be moved without errors
- [ ] WebSocket stays connected
- [ ] MCP server uses stdio protocol
- [ ] Claude CLI shows "Connected"
- [ ] All 9 MCP tools work via REST API

## Quick Debug Commands

### Test MCP Stdio
```bash
# Should output JSON-RPC response
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{}}' | python run_mcp.py

# Check Claude connection
claude mcp list
```

### Test Frontend Fixes
```javascript
// In browser console
// Try to trigger error handler
api.move(999, 'invalid-column')
```

### Monitor Backend
```bash
# Watch for validation errors
uvicorn app.main:app --reload 2>&1 | grep -E "422|validation"
```

## Communication Protocol
- Use session `integration-fix:1`
- Report critical fixes immediately
- Share error messages and stack traces
- Coordinate before deploying changes

## Contingency Plans

### If Error Handler Fix Complex
- Add try-catch wrapper as temporary fix
- Log errors to console for debugging
- Show generic message to user

### If MCP Stdio Fails
- Check FastMCP documentation
- Try simpler JSON-RPC implementation
- Test with minimal tool set first

### If WebSocket Unfixable
- Implement polling as fallback
- Increase reconnection intervals
- Add manual refresh button

## Resource Allocation
- Frontend Developer: 40% (critical fixes)
- MCP Developer: 35% (stdio implementation)
- Backend Developer: 25% (support & validation)

## Timeline
- Total estimated time: 1.5 hours
- Checkpoint 1: Error handler fixed (20 min)
- Checkpoint 2: Move tickets working (35 min)
- Checkpoint 3: WebSocket stable (55 min)
- Checkpoint 4: MCP stdio complete (90 min)

## Handoff Criteria
Project complete when:
1. Frontend fully functional without errors
2. WebSocket connection stable
3. MCP server runs with stdio protocol
4. All tools successfully call REST API
5. System ready for production use

---
*Final integration team to complete the Agent Kanban Board system*
