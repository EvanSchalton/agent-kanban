# MCP Middleware Architecture & Frontend Fixes Briefing
## Agent Kanban Board - Final Integration Issues

**Date:** 2025-08-18
**Project Status:** Backend Working, MCP Protocol Wrong, Frontend Has Errors
**Mission:** Implement proper MCP middleware architecture and fix frontend error handling

## Architecture Clarification

### Current (Wrong) Architecture
```
Claude Desktop <--HTTP?--> FastAPI (with embedded MCP)
```

### Target (Correct) Architecture
```
Claude Desktop <--stdio--> MCP Server <--HTTP--> FastAPI REST API
                (JSON-RPC)   (middleware)        (port 8000)
```

The MCP server should be a **separate process** that:
1. Receives commands from Claude via stdio/JSON-RPC
2. Translates MCP tool calls to REST API calls
3. Makes HTTP requests to FastAPI backend
4. Returns results back through stdio

## Issue 1: MCP Server Protocol

### Current Problem
- `run_mcp.py` may be trying to serve over HTTP
- Claude CLI expects stdio communication (stdin/stdout)
- Connection shows as "Failed" in `claude mcp list`

### Required Implementation
The MCP server needs to:
```python
# Correct pattern
import sys
import json
from fastmcp import FastMCP

# Read from stdin, write to stdout
mcp = FastMCP("agent-kanban-mcp")
mcp.run_stdio()  # Not run_http()!
```

### MCP Tools Should Call REST API
Each MCP tool should make HTTP calls:
```python
@mcp.tool()
async def create_task(title: str, description: str):
    # Make HTTP call to backend
    response = requests.post(
        "http://localhost:8000/api/tickets",
        json={"title": title, "description": description}
    )
    return response.json()
```

## Issue 2: Frontend Problems

### WebSocket Issue
```
WebSocket connection to 'ws://localhost:15173/ws/connect' failed
WebSocket disconnected: 1006
```
- Initial connection succeeds
- Then immediately disconnects
- Reconnection works but unstable

### Error Handler Bug
```
Failed to move ticket: TypeError: Cannot read properties of undefined (reading 'formatValidationError')
```
Location: `errorHandler.ts:27`
- Error handler crashes when processing 422 validation errors
- `formatValidationError` method is undefined
- Prevents proper error display to users

### API Move Endpoint Issue
```
POST http://localhost:15173/api/tickets/55/move 422 (Unprocessable Entity)
```
- Move operations returning validation errors
- Could be missing required fields
- Or business logic validation failing

## Required Fixes

### 1. MCP Server Rewrite
- Implement proper stdio transport
- Add HTTP client for REST API calls
- Handle JSON-RPC protocol correctly
- Test with Claude CLI

### 2. Frontend Error Handler
Fix `errorHandler.ts`:
```typescript
// Check if method exists before calling
if (error.response?.data && typeof error.response.data.formatValidationError === 'function') {
    return error.response.data.formatValidationError();
} else if (error.response?.status === 422) {
    // Handle validation errors without the method
    return formatValidationErrorManually(error.response.data);
}
```

### 3. WebSocket Stability
- Check CORS configuration for WebSocket
- Verify heartbeat/ping-pong implementation
- Add connection state management
- Implement proper cleanup on unmount

### 4. Move Endpoint Validation
- Check what fields the move endpoint requires
- Ensure frontend sends all required data
- Add proper validation error messages

## Success Criteria

### MCP Working
- ✅ `claude mcp list` shows "Connected"
- ✅ All 9 tools accessible in Claude
- ✅ Tools successfully call REST API
- ✅ Responses properly formatted

### Frontend Fixed
- ✅ WebSocket maintains stable connection
- ✅ Error handler doesn't crash
- ✅ Validation errors display properly
- ✅ Tickets can be moved without errors

## Testing Plan

### MCP Testing
```bash
# Test standalone
python /workspaces/agent-kanban/backend/run_mcp.py

# Should see JSON-RPC on stdout
echo '{"jsonrpc":"2.0","method":"initialize","id":1}' | python run_mcp.py

# Test with Claude
claude mcp list  # Should show "Connected"
```

### Frontend Testing
1. Open browser console
2. Try moving tickets
3. Verify no TypeError in error handler
4. Check WebSocket stays connected
5. Confirm error messages display

## Priority Order
1. **FIRST**: Fix error handler (blocking user actions)
2. **SECOND**: Fix move endpoint validation
3. **THIRD**: Stabilize WebSocket
4. **FOURTH**: Implement proper MCP stdio server

---

*This briefing addresses the final integration issues to achieve full system functionality*
