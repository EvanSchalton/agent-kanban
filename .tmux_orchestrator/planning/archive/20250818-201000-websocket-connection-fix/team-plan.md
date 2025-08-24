# Team Plan: WebSocket Connection Fix
## Mission: Fix frontend-backend connection issues for Agent Kanban Board

### Project Manager Configuration
```yaml
name: websocket-fix-pm
session: websocket-fix:1
goal: Fix critical connection issues between React frontend and FastAPI backend preventing board functionality
priority: CRITICAL - Blocks all functionality
```

## Team Composition

### 1. Frontend Developer (fe)
**Role:** Fix frontend configuration and connection logic
```yaml
name: frontend-dev
expertise: React, TypeScript, Vite, WebSocket clients
responsibilities:
  - Review vite.config.ts for proxy settings
  - Check environment variables for API URL
  - Fix port configuration (15173 → 8000)
  - Update useWebSocket.ts hook
  - Configure api.ts base URL
  - Test connection after fixes
tools: code editor, browser devtools, npm
```

### 2. Backend Developer (be)
**Role:** Ensure backend is running and accessible
```yaml
name: backend-dev
expertise: Python, FastAPI, WebSocket servers, CORS
responsibilities:
  - Start FastAPI server on port 8000
  - Verify WebSocket endpoint at /ws/connect
  - Check CORS configuration
  - Ensure all API endpoints accessible
  - Monitor server logs for errors
tools: python, uvicorn, curl, logs
```

### 3. DevOps Engineer (do)
**Role:** Network and configuration troubleshooting
```yaml
name: devops-eng
expertise: Networking, Docker, ports, environment setup
responsibilities:
  - Verify port 8000 is available
  - Check for port conflicts
  - Test connectivity between services
  - Configure environment variables
  - Ensure proper localhost resolution
tools: netstat, lsof, curl, environment configs
```

## Workflow Phases

### Phase 1: Immediate Diagnosis (10 minutes)
**Lead:** DevOps Engineer
1. Check if backend is running: `lsof -i :8000`
2. Check if port 15173 is in use: `lsof -i :15173`
3. Test backend API: `curl http://localhost:8000/docs`
4. Share findings immediately

### Phase 2: Backend Startup (15 minutes)
**Lead:** Backend Developer
1. Navigate to `/workspaces/agent-kanban/backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Start server: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Verify WebSocket endpoint available
5. Check CORS allows localhost:3000

### Phase 3: Frontend Configuration Fix (20 minutes)
**Lead:** Frontend Developer
1. Update vite.config.ts proxy configuration:
   ```typescript
   proxy: {
     '/api': 'http://localhost:8000',
     '/ws': {
       target: 'ws://localhost:8000',
       ws: true
     }
   }
   ```
2. Fix useWebSocket.ts to use correct URL
3. Update api.ts base URL configuration
4. Set proper environment variables
5. Restart frontend: `npm run dev`

### Phase 4: Integration Testing (15 minutes)
**Lead:** All Team
1. Frontend Dev: Open board in browser
2. Backend Dev: Monitor server logs
3. DevOps: Watch network traffic
4. Test operations:
   - Load board state
   - Create new ticket
   - Move ticket between columns
   - Verify WebSocket updates

### Phase 5: Documentation (10 minutes)
**Lead:** Frontend Developer
1. Document configuration changes
2. Update README with correct ports
3. Add troubleshooting guide
4. Create environment template file

## Success Metrics
- [ ] Backend running on port 8000
- [ ] No WebSocket connection errors
- [ ] API calls successful
- [ ] Tickets can be created/moved
- [ ] Real-time updates working
- [ ] Configuration documented

## Critical Path
1. **FIRST**: Get backend running (blocks everything)
2. **SECOND**: Fix frontend configuration
3. **THIRD**: Test integration
4. **LAST**: Document changes

## Communication Protocol
- Use session `websocket-fix:1`
- Immediate notification of blockers
- Share all error messages
- Coordinate before service restarts

## Quick Fixes to Try

### Backend Not Running
```bash
cd /workspaces/agent-kanban/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Wrong Port
Check and update:
- `/workspaces/agent-kanban/frontend/src/config/api.config.ts`
- `/workspaces/agent-kanban/frontend/.env.local`
- `/workspaces/agent-kanban/frontend/vite.config.ts`

### Test Connectivity
```bash
# Test API
curl http://localhost:8000/api/board

# Test WebSocket (using wscat if available)
wscat -c ws://localhost:8000/ws/connect
```

## Contingency Plans

### If Port 8000 Blocked
- Try alternative port (8001)
- Update all configurations
- Check Docker port mappings

### If CORS Issues
- Add explicit CORS middleware
- Allow all origins temporarily for testing
- Use proxy through Vite

### If WebSocket Protocol Mismatch
- Check ws:// vs wss://
- Verify upgrade headers
- Test with simple WebSocket client first

## Resource Allocation
- Frontend Developer: 40% (configuration focus)
- Backend Developer: 40% (server startup and monitoring)
- DevOps Engineer: 20% (network troubleshooting)

## Timeline
- Total estimated time: 1 hour
- Checkpoint 1: Backend accessible (20 min)
- Checkpoint 2: Frontend configured (40 min)
- Checkpoint 3: Full integration working (60 min)

## Handoff Criteria
Project complete when:
1. WebSocket connects without errors
2. All API calls successful
3. Board fully functional
4. Configuration documented
5. Can proceed with MCP testing

---
*Critical fix team assembled for immediate connection issue resolution*
