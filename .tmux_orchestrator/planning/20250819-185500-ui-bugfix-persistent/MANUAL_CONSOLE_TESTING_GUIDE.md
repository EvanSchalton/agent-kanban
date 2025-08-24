# 🧪 MANUAL CONSOLE TESTING GUIDE - Board Isolation Debug

**Date:** 2025-08-20
**Time:** 03:22 UTC
**QA Engineer:** Claude (bugfix:2)
**Purpose:** Frontend Developer console testing verification

## 🎯 IMMEDIATE TESTING STEPS

### **Step 1: Open Browser Dev Tools**
1. Navigate to: `http://localhost:15173`
2. Press `F12` or `Ctrl+Shift+I` to open Developer Tools
3. Click on **Console** tab
4. Clear console with `Ctrl+L` or console.clear()

### **Step 2: Navigate to First Board**
1. Go to a specific board URL: `http://localhost:15173/board/1`
2. **Expected Console Output:**
```
🔍 Board.tsx - boardId from URL params: "1"
🔍 BoardContext.loadBoard - received boardId: "1"
🔍 ticketApi.list - calling URL: /api/tickets/?board_id=1
🔍 ticketApi.list - boardId type: string value: 1
🔍 ticketApi.list - response data: {items: [...], total: 23}
```

### **Step 3: Navigate to Different Board**
1. Go to: `http://localhost:15173/board/8`
2. **Expected Console Output:**
```
🔍 Board.tsx - boardId from URL params: "8"
🔍 BoardContext.loadBoard - received boardId: "8"
🔍 ticketApi.list - calling URL: /api/tickets/?board_id=8
🔍 ticketApi.list - boardId type: string value: 8
🔍 ticketApi.list - response data: {items: [...], total: 0}
```

### **Step 4: Verify Network Tab**
1. Open **Network** tab in Dev Tools
2. Filter by "XHR" or "Fetch"
3. Navigate between boards again
4. **Expected Network Calls:**
   - `/api/tickets/?board_id=1` (for board 1)
   - `/api/tickets/?board_id=8` (for board 8)

## 🔍 WHAT TO LOOK FOR

### **✅ CORRECT BEHAVIOR:**
- **Different boardId values** logged for different URLs
- **Different API calls** with different board_id parameters
- **Different response data** (different ticket counts/content)
- **UI updates** showing different tickets per board

### **❌ PROBLEM INDICATORS:**
- **Same boardId** for different URLs → React Router issue
- **Same API calls** with same board_id → State management problem
- **Same response data** → Backend caching (unlikely) or frontend cache
- **UI not updating** → Component re-rendering issue

## 🚨 SPECIFIC DEBUG SCENARIOS

### **Scenario A: Board Isolation Working**
**Console Pattern:**
```
Board 1: boardId="1" → API /api/tickets/?board_id=1 → 23 tickets
Board 8: boardId="8" → API /api/tickets/?board_id=8 → 0 tickets
Board 9: boardId="9" → API /api/tickets/?board_id=9 → 1 ticket
```
**Result:** ✅ **NO BOARD ISOLATION BUG**

### **Scenario B: URL Params Not Updating**
**Console Pattern:**
```
Board 1: boardId="1" → API /api/tickets/?board_id=1
Board 8: boardId="1" → API /api/tickets/?board_id=1  ← PROBLEM!
```
**Issue:** React Router not updating useParams

### **Scenario C: State Not Updating**
**Console Pattern:**
```
Board 1: boardId="1" → API /api/tickets/?board_id=1
Board 8: boardId="8" → (no API call) ← PROBLEM!
```
**Issue:** BoardContext not triggering loadBoard

### **Scenario D: API Calls Correct, UI Wrong**
**Console Pattern:**
```
Board 1: boardId="1" → API call correct → Response: 23 tickets
Board 8: boardId="8" → API call correct → Response: 0 tickets
UI: Shows same tickets for both boards ← PROBLEM!
```
**Issue:** React state or rendering problem

## 📊 EXPECTED BACKEND RESPONSES

Based on QA verification, these are the expected API responses:

### **Board 1 Response:**
```json
{
  "items": [
    {"id": 1, "title": "QA Test - Updated Title", "board_id": 1},
    {"id": 2, "title": "Test Card", "board_id": 1},
    // ... 21 more tickets
  ],
  "total": 23
}
```

### **Board 8 Response:**
```json
{
  "items": [],
  "total": 0
}
```

### **Board 9 Response:**
```json
{
  "items": [
    {"id": 29, "title": "test", "board_id": 9}
  ],
  "total": 1
}
```

## 🎯 TESTING CHECKLIST

- [ ] Console shows different boardId values for different URLs
- [ ] API calls show different board_id parameters
- [ ] Network tab shows separate requests per board
- [ ] Response data shows different ticket counts
- [ ] UI displays different tickets per board
- [ ] No JavaScript errors in console
- [ ] Page loads complete without hanging

## 📝 REPORTING TEMPLATE

```
CONSOLE TEST RESULTS:
===================
Board 1 (http://localhost:15173/board/1):
- boardId logged: [VALUE]
- API URL called: [URL]
- Response tickets: [COUNT]
- UI shows: [DESCRIPTION]

Board 8 (http://localhost:15173/board/8):
- boardId logged: [VALUE]
- API URL called: [URL]
- Response tickets: [COUNT]
- UI shows: [DESCRIPTION]

Issues Found:
- [DESCRIBE ANY PROBLEMS]

Conclusion:
- [ ] Board isolation working correctly
- [ ] Found frontend bug: [DESCRIPTION]
```

---
**QA Engineer (bugfix:2) - Manual Testing Guide Complete**
**Next:** Frontend Developer console verification
**Backend Status:** ✅ Confirmed working (API isolation 100% functional)
