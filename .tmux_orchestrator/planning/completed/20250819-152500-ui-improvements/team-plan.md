# Team Plan: UI Improvements & Fixes
## Mission: Fix critical UI issues and add missing features

### Project Manager Configuration
```yaml
name: ui-fix-pm
session: ui-fix:1
goal: Fix 5 critical UI issues - board creation, card creation, localStorage removal, navbar, board edit
priority: HIGH - Core functionality missing/broken
estimated_time: 2-3 hours
```

## Team Composition

### 1. Frontend Lead (fe-lead) - LEAD
**Role:** Remove localStorage and coordinate overall fixes
```yaml
name: fe-lead
expertise: React, TypeScript, State Management, Context API
responsibilities:
  - Remove all localStorage code from BoardContext
  - Remove pending moves tracking
  - Simplify retry logic in api.ts
  - Ensure WebSocket still works
  - Coordinate with other developers
  - Test all changes
tools: react, typescript, context api
```

### 2. UI Developer (ui-dev)
**Role:** Create card creation UI and navbar
```yaml
name: ui-dev
expertise: React Components, Modals, Forms, CSS
responsibilities:
  - Add "+" button to column headers
  - Create AddCardModal component
  - Create Navbar component
  - Move "Back to Dashboard" to navbar
  - Style all new components
  - Ensure responsive design
tools: react, css, component design
```

### 3. API Developer (api-dev)
**Role:** Fix board creation and add edit functionality
```yaml
name: api-dev
expertise: API Integration, Error Handling, TypeScript
responsibilities:
  - Debug board creation failure
  - Fix API endpoint/request format
  - Add board edit UI on dashboard
  - Integrate createTicket API
  - Handle all error cases
  - Ensure persistence
tools: axios, api integration, debugging
```

## Workflow Phases

### Phase 1: Remove localStorage (30 min)
**Lead:** Frontend Lead

1. **Remove from BoardContext.tsx:**
```typescript
// Remove all:
- localStorage.getItem('kanban_pending_moves')
- localStorage.setItem('kanban_pending_moves', ...)
- localStorage.removeItem('kanban_pending_moves')
- localStorage.getItem('kanban_current_board')
- localStorage.setItem('kanban_current_board', ...)
- pendingMoves state
- completeMoveTicket method
- revertMoveTicket method
- pendingMovesCount
```

2. **Simplify api.ts:**
- Keep withRetry but remove localStorage logic
- Remove offline queue handling

### Phase 2: Fix Board Creation (30 min)
**Lead:** API Developer

1. **Debug current failure:**
```bash
# Check browser console for errors
# Check network tab for request/response
# Verify API endpoint matches backend
```

2. **Common issues to check:**
- Missing required fields (name, description)
- CORS issues
- API path mismatch
- Request format (JSON vs form data)

3. **Fix CreateBoardModal.tsx:**
```typescript
const handleCreate = async () => {
  try {
    const board = await boardApi.create({
      name: name.trim(),
      description: description.trim()
    });
    onCreated(board);
    onClose();
  } catch (error) {
    setError(error.message);
  }
};
```

### Phase 3: Add Card Creation (45 min)
**Lead:** UI Developer

1. **Update Column.tsx header:**
```tsx
<div className="column-header">
  <h3>{column.name}</h3>
  <button
    className="add-card-btn"
    onClick={() => setShowAddCard(true)}
  >
    +
  </button>
</div>
```

2. **Create AddCardModal.tsx:**
```tsx
interface AddCardModalProps {
  columnId: string;
  boardId: string;
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}

const AddCardModal = ({ columnId, boardId, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('');

  const handleCreate = async () => {
    const ticket = await createTicket({
      title,
      description,
      priority,
      assigned_to: assignedTo,
      column_id: columnId,
      board_id: parseInt(boardId)
    });
    onCreated(ticket);
    onClose();
  };

  return (
    <Modal>
      {/* Form fields */}
    </Modal>
  );
};
```

3. **Update BoardContext to add createTicket:**
```typescript
const createTicket = useCallback(async (ticket: Partial<Ticket>) => {
  const newTicket = await apiCreateTicket({
    ...ticket,
    board_id: parseInt(currentBoardId)
  });
  dispatch({ type: 'ADD_TICKET', payload: newTicket });
  return newTicket;
}, [currentBoardId]);
```

### Phase 4: Create Navbar (30 min)
**Lead:** UI Developer

1. **Create Navbar.tsx:**
```tsx
const Navbar = () => {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const { board } = useBoard();

  return (
    <nav className="navbar">
      <div className="nav-left">
        <button onClick={() => navigate('/')}>
          ← Dashboard
        </button>
      </div>
      <div className="nav-center">
        {board && <h2>{board.name}</h2>}
      </div>
      <div className="nav-right">
        {/* Future: User settings */}
      </div>
    </nav>
  );
};
```

2. **Update App.tsx structure:**
```tsx
function BoardView() {
  return (
    <BoardProvider>
      <div className="app">
        <Navbar />
        <Header />
        <main className="app-main">
          <SearchFilter />
          <Board />
        </main>
      </div>
    </BoardProvider>
  );
}
```

### Phase 5: Add Board Edit UI (30 min)
**Lead:** API Developer

1. **Update BoardCard.tsx:**
```tsx
const [showEdit, setShowEdit] = useState(false);

// Add edit button
<button onClick={() => setShowEdit(true)}>Edit</button>

// Add edit modal
{showEdit && (
  <EditBoardModal
    board={board}
    onClose={() => setShowEdit(false)}
    onSaved={onRefresh}
  />
)}
```

2. **Create EditBoardModal.tsx:**
```tsx
const EditBoardModal = ({ board, onClose, onSaved }) => {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);

  const handleSave = async () => {
    const updated = await boardApi.update(board.id, {
      name,
      description
    });
    onSaved(updated);
    onClose();
  };

  return (
    <Modal>
      {/* Edit form */}
    </Modal>
  );
};
```

### Phase 6: Testing & Integration (15 min)
**Lead:** All Team

1. **Test all features:**
- Board creation works
- Card creation in all columns
- No localStorage errors in console
- Navbar navigation works
- Board edit saves correctly
- WebSocket updates still work

2. **Fix any integration issues**

3. **Clean up console errors**

## Success Metrics
- [ ] Board creation works without errors
- [ ] Can create cards in any column
- [ ] No localStorage code remains
- [ ] Navigation in proper navbar
- [ ] Can edit board name/description
- [ ] All changes persist to database
- [ ] No console errors
- [ ] TypeScript compilation passes

## Testing Commands
```bash
# Frontend tests
cd frontend
npm run build
npm run type-check

# Check for localStorage
grep -r "localStorage" src/

# Test in browser
- Create new board
- Create cards in each column
- Edit board details
- Navigate with navbar
- Check console for errors
```

## Timeline
- Phase 1: localStorage removal (30 min)
- Phase 2: Fix board creation (60 min)
- Phase 3: Card creation UI (105 min)
- Phase 4: Navbar (135 min)
- Phase 5: Board edit (165 min)
- Phase 6: Testing (180 min)

**Total: ~3 hours**

---
*UI improvement team to fix critical issues and add missing features*
