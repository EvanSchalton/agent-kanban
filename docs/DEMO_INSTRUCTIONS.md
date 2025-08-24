# 🤖 Agent Collaboration Demo Instructions

## Overview

This demo shows how two AI agents collaborate in real-time using MCP (Model Context Protocol) to manage kanban tickets. You'll see:

- **Agent Alpha**: Development Agent that creates, claims, and works on tasks
- **Agent Beta**: QA Review Agent that reviews, approves, or blocks tasks

## Quick Start

### 1. Ensure Services are Running

Make sure both services are running:

```bash
# Backend (port 18000)
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 18000 --reload

# Frontend (port 15182)
cd frontend && npm run dev
```

### 2. Open Demo Interface

**Option A: Browser Demo (Recommended)**

1. Open browser to: `http://localhost:15182/agent-collaboration-demo.html`
2. Click "🚀 Start Collaboration Demo" to see automated agent collaboration
3. Watch as agents create, move, and review tickets in real-time
4. Both agent windows update simultaneously via WebSocket

**Option B: Command Line Demo**

```bash
# Run for 30 seconds
python mcp-agent-demo.py 30
```

### 3. Two Browser Windows Demo

For the full experience, open **two browser windows side by side**:

**Window 1 (Agent Alpha - Development)**

- URL: `http://localhost:15182/agent-collaboration-demo.html`
- Focus on the left panel showing Agent Alpha
- Use manual controls to create and move tasks

**Window 2 (Agent Beta - QA Review)**

- URL: `http://localhost:15182/agent-collaboration-demo.html`
- Focus on the right panel showing Agent Beta
- Use manual controls to review and approve/block tasks

## Demo Features

### Automated Collaboration

- Click "Start Demo" to watch agents work together automatically
- Agent Alpha creates tasks and moves them through development
- Agent Beta reviews completed tasks and approves or blocks them
- Real-time synchronization between all browser windows

### Manual Controls

**Agent Alpha (Development) Actions:**

- **Create Task**: Generate new development tasks
- **Claim Next**: Assign unassigned tasks to Agent Alpha
- **Move to Progress**: Advance tasks through development stages

**Agent Beta (QA Review) Actions:**

- **Review QC Task**: Add review comments to tasks ready for QC
- **Approve Task**: Move reviewed tasks to "Done"
- **Block Task**: Move problematic tasks to "Blocked" with reasons

### Real-Time Features

- **WebSocket Sync**: All actions instantly update across browser windows
- **Live Statistics**: Track each agent's performance metrics
- **Activity Logs**: See timestamped actions from each agent
- **Visual Kanban**: Watch tickets move between columns in real-time

## What You'll See

### Agent Collaboration Patterns

1. **Task Creation Flow**:
   - Agent Alpha creates development tasks
   - Tasks appear in "Not Started" column
   - Both windows update immediately

2. **Development Workflow**:
   - Agent Alpha claims unassigned tasks
   - Tasks move: Not Started → In Progress → Ready for QC
   - Comments added at each stage

3. **QA Review Process**:
   - Agent Beta reviews tasks in "Ready for QC"
   - Approves: moves to "Done"
   - Blocks: moves to "Blocked" with reasons
   - Resolves blocks: moves back to "In Progress"

4. **Real-Time Synchronization**:
   - Actions in one window instantly appear in others
   - WebSocket events show in activity logs
   - Statistics update live across all windows

### Performance Metrics

- Tasks Created/Claimed/Moved/Completed per agent
- Collaboration efficiency percentage
- Real-time activity logs with timestamps

## Testing MCP Integration

The demo validates that:

- ✅ MCP agents can create tickets via API
- ✅ MCP agents can update ticket status
- ✅ MCP agents can claim/assign tickets
- ✅ MCP agents can add comments
- ✅ All operations trigger WebSocket broadcasts
- ✅ Frontend receives real-time updates
- ✅ Multiple clients stay synchronized

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Agent Alpha   │    │   MCP Server     │    │   Agent Beta    │
│  (Development)  │◄──►│     (stdio)      │◄──►│     (QA)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌──────────────────┐
                    │   REST API       │
                    │  (port 18000)    │
                    └──────────────────┘
                                 ▲
                    ┌──────────────────┐
                    │   WebSocket      │
                    │   Broadcasts     │
                    └──────────────────┘
                                 ▲
                    ┌──────────────────┐
                    │   Frontend       │
                    │  (port 15182)    │
                    └──────────────────┘
```

## Troubleshooting

### If Demo Doesn't Work

1. Check backend is running on port 18000
2. Check frontend is running on port 15182
3. Ensure WebSocket connections are established
4. Check browser console for errors

### Common Issues

- **Port conflicts**: Make sure ports 18000 and 15182 are free
- **WebSocket errors**: Refresh browser if connection fails
- **API errors**: Check backend logs for issues

## Next Steps

After the demo, you can:

1. Examine `/mcp-agent-demo.py` for MCP integration code
2. Look at `/agent-collaboration-demo.html` for frontend implementation
3. Test the actual MCP server: `python backend/run_mcp.py`
4. Build your own agents using the MCP tools

---

**Enjoy watching AI agents collaborate! 🤖✨**
