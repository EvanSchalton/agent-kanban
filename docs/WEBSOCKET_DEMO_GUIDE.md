# 🎯 Agent Kanban - WebSocket Multi-User Demo Guide

**Version:** 1.0.0
**Date:** August 20, 2025
**Duration:** 5-10 minutes

---

## 🚀 QUICK START

### Option 1: Automated Demo (Recommended)

```bash
./launch-demo.sh
```

This will:

- Start backend and frontend if needed
- Open 3 browser windows
- Provide step-by-step instructions

### Option 2: Manual Demo

1. Start backend: `cd backend && python -m uvicorn app.main:app --port 18000`
2. Start frontend: `cd frontend && npm run dev`
3. Open 3 browser windows to `http://localhost:15184`

### Option 3: HTML Simulation

Open `demo-multi-user-websocket.html` in a browser for a visual simulation

---

## 📋 DEMO SCENARIOS

### Scenario 1: User Attribution Setup (2 min)

**Goal:** Set up three different users to demonstrate attribution

1. **Window 1 - Alice:**
   - Click user icon (top-right) 👤
   - Select "Change Username"
   - Enter "Alice"
   - Click "Save & Reconnect"

2. **Window 2 - Bob:**
   - Click user icon 👤
   - Change username to "Bob"
   - Save & Reconnect

3. **Window 3 - Charlie:**
   - Click user icon 👤
   - Change username to "Charlie"
   - Save & Reconnect

**✅ Success Indicators:**

- Each window shows different username in navbar
- Avatar shows correct initials (A, B, C)
- WebSocket reconnects with new username

---

### Scenario 2: Real-Time Synchronization (3 min)

**Goal:** Demonstrate instant updates across all windows

1. **Alice Creates a Ticket:**
   - In Alice's window, click "Add Card" button
   - Title: "Implement user authentication"
   - Description: "Add login system with JWT"
   - Click "Create"

   **Observe:** Ticket appears instantly in Bob's and Charlie's windows

2. **Bob Moves the Ticket:**
   - In Bob's window, drag the ticket to "In Progress"

   **Observe:**
   - Card moves in all windows simultaneously
   - Attribution shows "moved by Bob"

3. **Charlie Updates the Ticket:**
   - In Charlie's window, click on the ticket
   - Edit priority or description
   - Save changes

   **Observe:** Updates reflect in all windows with "updated by Charlie"

**✅ Success Indicators:**

- No page refresh needed
- Changes appear within 50ms
- User attribution visible in events

---

### Scenario 3: Board Isolation (2 min)

**Goal:** Prove that different boards are isolated

1. **Create a Second Board:**
   - In any window, create "Board 2: Marketing"

2. **Split Users Across Boards:**
   - Alice & Bob: Stay on Board 1
   - Charlie: Switch to Board 2

3. **Test Isolation:**
   - Charlie creates ticket in Board 2: "Launch social media campaign"
   - Alice creates ticket in Board 1: "Fix bug #123"

   **Observe:**
   - Charlie sees only Board 2 tickets
   - Alice & Bob see only Board 1 tickets
   - No cross-board pollution

**✅ Success Indicators:**

- Board-specific WebSocket subscriptions
- Events filtered by board_id
- Clean separation of data

---

### Scenario 4: Concurrent Operations (2 min)

**Goal:** Show system handles simultaneous actions

1. **Simultaneous Ticket Creation:**
   - Count down: "3, 2, 1, GO!"
   - All three users create tickets at once

   **Observe:** All tickets appear in order, no conflicts

2. **Concurrent Drag & Drop:**
   - Multiple users move different cards simultaneously

   **Observe:** Smooth updates, no data corruption

3. **Stress Test:**
   - Rapidly create/move/update tickets

   **Observe:** System remains responsive

**✅ Success Indicators:**

- No race conditions
- Proper event ordering
- Stable WebSocket connections

---

## 🔍 WHAT TO OBSERVE

### WebSocket Features

1. **Connection Status:**
   - Green dot = Connected
   - Red dot = Disconnected
   - Auto-reconnection on network issues

2. **User Attribution:**
   - Every action shows username
   - "Created by Alice"
   - "Moved by Bob"
   - "Updated by Charlie"

3. **Real-Time Events:**
   - ticket_created
   - ticket_moved
   - ticket_updated
   - ticket_deleted

4. **Board Isolation:**
   - WebSocket URL includes board_id
   - Events filtered per board
   - No cross-contamination

---

## 🛠️ DEVELOPER CONSOLE

### Monitor WebSocket Traffic

Open browser DevTools > Network > WS tab

**Connection:**

```
ws://localhost:18000/ws/connect?username=Alice&board_id=1
```

**Sample Messages:**

```json
// Outgoing
{"type": "ping"}

// Incoming
{
  "event": "ticket_moved",
  "data": {
    "id": 42,
    "title": "Task",
    "moved_by": "Bob",
    "from_column": "Not Started",
    "to_column": "In Progress"
  }
}
```

### Check localStorage

Open DevTools > Application > Local Storage

```javascript
localStorage.getItem('username')  // "Alice"
```

---

## 🎭 DEMO TALKING POINTS

### For Product Managers

- "Real-time collaboration without refresh"
- "See who's doing what instantly"
- "Multiple teams on different boards"
- "Full attribution for accountability"

### For Developers

- "WebSocket with automatic reconnection"
- "Event-driven architecture"
- "Board-level subscriptions"
- "Username in connection handshake"

### For End Users

- "Work together in real-time"
- "No more asking 'who moved this?'"
- "Instant updates, no refresh needed"
- "Your name on every action"

---

## 🚨 TROUBLESHOOTING

### Issue: WebSocket Won't Connect

```bash
# Check backend is running
curl http://localhost:18000/api/boards/

# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:18000/ws/connect
```

### Issue: Username Not Showing

1. Clear localStorage
2. Refresh page
3. Set username again

### Issue: Events Not Syncing

1. Check all windows are on same board
2. Verify WebSocket connected (green dot)
3. Check browser console for errors

---

## 📊 METRICS TO HIGHLIGHT

| Metric | Value | Importance |
|--------|-------|------------|
| **Connection Time** | <1 second | Fast startup |
| **Event Latency** | <50ms | True real-time |
| **Concurrent Users** | Unlimited* | Scalable |
| **Message Size** | ~200 bytes | Efficient |
| **Reconnect Time** | 1-5 seconds | Resilient |

*Limited by server resources

---

## 🎬 DEMO VIDEO SCRIPT

**[0:00-0:30] Introduction**
"Welcome to Agent Kanban's real-time collaboration demo. Today we'll show three key features: user attribution, real-time sync, and board isolation."

**[0:30-1:30] User Setup**
"First, let's set up three users - Alice, Bob, and Charlie. Notice how each gets a unique avatar and their username appears in the navbar."

**[1:30-3:00] Real-Time Sync**
"Watch as Alice creates a ticket - it instantly appears for Bob and Charlie. When Bob drags it to 'In Progress', everyone sees the change with attribution."

**[3:00-4:00] Board Isolation**
"Charlie switches to Board 2. Notice how his actions are isolated - Alice and Bob don't see Board 2 tickets."

**[4:00-4:30] Conclusion**
"Agent Kanban enables true real-time collaboration with full user attribution and board isolation. Perfect for distributed teams."

---

## ✅ DEMO CHECKLIST

Before starting the demo:

- [ ] Backend running on port 18000
- [ ] Frontend running (port 15184 or 5173)
- [ ] 3 browser windows ready
- [ ] Different username per window
- [ ] All windows on Board 1 initially
- [ ] DevTools open (optional)

During the demo:

- [ ] Show user attribution
- [ ] Demonstrate real-time sync
- [ ] Prove board isolation
- [ ] Test concurrent operations
- [ ] Highlight instant updates
- [ ] Show reconnection resilience

After the demo:

- [ ] Answer questions
- [ ] Show WebSocket messages in DevTools
- [ ] Explain technical architecture
- [ ] Discuss scalability

---

## 🎉 DEMO SUCCESS CRITERIA

The demo is successful when viewers understand:

1. **Real-Time Collaboration Works**
   - Multiple users can work simultaneously
   - Changes appear instantly for everyone
   - No refresh button needed

2. **User Attribution is Clear**
   - Every action shows who did it
   - Accountability in team work
   - Activity tracking possible

3. **Board Isolation is Effective**
   - Teams can work independently
   - No data leakage between boards
   - Scalable to many teams

4. **System is Production-Ready**
   - Handles concurrent users
   - Recovers from disconnections
   - Professional user experience

---

*Demo Guide Complete - Ready for presentation!*
