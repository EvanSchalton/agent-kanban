# Agent Kanban Board - Testing Plan

## Current Status

- Backend: Running on port 8000 ✅
- Frontend: Running on port 15173 ✅
- Database: SQLite initialized ✅

## Testing Team Deployed

- **PM (Project Manager)**: Coordinating testing efforts
- **QA Engineer**: Integration and UI testing
- **Developer**: Load testing implementation

## Testing Priorities

### 1. Integration Testing (QA - In Progress)

- [ ] Test all REST API endpoints via <http://localhost:8000/docs>
- [ ] Verify CRUD operations for boards, tickets, comments
- [ ] Test ticket movement between columns
- [ ] Validate priority updates and assignments

### 2. Load Testing (Developer - In Progress)

- [ ] Create load test script with 20 simulated agents
- [ ] Generate 500 tasks distributed across agents
- [ ] Measure API response times (target: < 200ms)
- [ ] Test WebSocket performance under load
- [ ] Monitor database performance

### 3. UI/UX Testing (QA)

- [ ] Drag-and-drop functionality between columns
- [ ] WebSocket real-time updates (multi-tab testing)
- [ ] Statistical color coding (green/yellow/red based on time)
- [ ] Priority reordering within columns
- [ ] Ticket detail modal and inline editing

### 4. Performance Metrics

- API Response Time: Target < 200ms
- WebSocket Latency: Target < 1s
- Concurrent Users: Support 20 agents
- Task Capacity: Handle 500+ tasks

## Known Issues to Verify

- Tmux orchestrator agent spawning inconsistencies
- MCP test script pydantic validation errors

## Test Deliverables

- `/tests/test-results.md` - Integration test results
- `/tests/load_test.py` - Load testing script
- `/tests/performance-metrics.json` - Performance benchmarks
- Bug reports and fixes

## Timeline

- Integration Testing: 30 minutes
- Load Testing Setup: 45 minutes
- UI Testing: 30 minutes
- Bug Fixes: As needed
