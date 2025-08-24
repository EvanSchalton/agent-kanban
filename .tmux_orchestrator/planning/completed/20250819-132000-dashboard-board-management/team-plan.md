# Team Plan: Dashboard & Board Management
## Mission: Create dashboard view for multi-board management

### Project Manager Configuration
```yaml
name: dashboard-pm
session: dashboard:1
goal: Implement dashboard view with board creation, listing, and navigation to fix 404 error
priority: CRITICAL - App unusable without boards
estimated_time: 2-3 hours
```

## Team Composition

### 1. Frontend Developer (fe) - LEAD
**Role:** Create dashboard UI and routing
```yaml
name: frontend-dev
expertise: React, TypeScript, React Router, UI/UX
responsibilities:
  - Create Dashboard component
  - Implement board listing grid
  - Add create board modal
  - Set up React Router for navigation
  - Handle empty state (no boards)
  - Add board statistics display
  - Implement back navigation from board view
tools: react, typescript, react-router, css
```

### 2. Backend Developer (be)
**Role:** Implement board management API
```yaml
name: backend-dev
expertise: Python, FastAPI, SQLAlchemy, REST APIs
responsibilities:
  - Verify/implement GET /api/boards endpoint
  - Implement POST /api/boards for creation
  - Add PUT /api/boards/{id} for updates
  - Add DELETE /api/boards/{id} with cascade
  - Create default board on startup if none exist
  - Add board statistics (ticket counts)
tools: python, fastapi, sqlalchemy
```

### 3. Full-Stack Developer (fs)
**Role:** Integration and state management
```yaml
name: fullstack-dev
expertise: React, TypeScript, Python, API Integration
responsibilities:
  - Update API client for board endpoints
  - Implement board context/state management
  - Fix current board loading logic
  - Handle board switching
  - Ensure proper error handling
  - Test full flow from dashboard to board
tools: full stack development tools
```

## Workflow Phases

### Phase 1: Backend API Setup (30 min)
**Lead:** Backend Developer

1. **Check existing board endpoints:**
```bash
curl http://localhost:8000/docs | grep -i board
```

2. **Implement missing endpoints:**
```python
# app/api/endpoints/boards.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models import Board, Ticket
from app.schemas import BoardCreate, BoardUpdate, BoardResponse

router = APIRouter()

@router.get("/boards", response_model=List[BoardResponse])
async def list_boards(db: Session = Depends(get_db)):
    boards = db.query(Board).all()
    for board in boards:
        board.ticket_count = db.query(Ticket).filter(
            Ticket.board_id == board.id
        ).count()
    return boards

@router.post("/boards", response_model=BoardResponse)
async def create_board(
    board_data: BoardCreate,
    db: Session = Depends(get_db)
):
    board = Board(**board_data.dict())
    db.add(board)
    db.commit()
    db.refresh(board)
    return board

@router.get("/boards/{board_id}", response_model=BoardResponse)
async def get_board(
    board_id: int,
    db: Session = Depends(get_db)
):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board

@router.put("/boards/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: int,
    board_data: BoardUpdate,
    db: Session = Depends(get_db)
):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    for key, value in board_data.dict(exclude_unset=True).items():
        setattr(board, key, value)

    db.commit()
    db.refresh(board)
    return board

@router.delete("/boards/{board_id}")
async def delete_board(
    board_id: int,
    db: Session = Depends(get_db)
):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    # Delete all tickets for this board
    db.query(Ticket).filter(Ticket.board_id == board_id).delete()
    db.delete(board)
    db.commit()

    return {"message": "Board deleted successfully"}
```

3. **Create default board on startup:**
```python
# app/main.py
@app.on_event("startup")
async def startup_event():
    # Ensure at least one board exists
    with SessionLocal() as db:
        if db.query(Board).count() == 0:
            default_board = Board(
                name="My First Board",
                description="Welcome to your kanban board!"
            )
            db.add(default_board)
            db.commit()
            logger.info("Created default board")
```

### Phase 2: Frontend Dashboard Component (45 min)
**Lead:** Frontend Developer

1. **Install React Router:**
```bash
cd frontend
npm install react-router-dom @types/react-router-dom
```

2. **Create Dashboard component:**
```tsx
// src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import CreateBoardModal from './CreateBoardModal';
import BoardCard from './BoardCard';

const Dashboard = () => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      const data = await api.getBoards();
      setBoards(data);
    } catch (error) {
      console.error('Failed to load boards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async (boardData) => {
    const newBoard = await api.createBoard(boardData);
    setBoards([...boards, newBoard]);
    setShowCreateModal(false);
  };

  const handleViewBoard = (boardId) => {
    navigate(`/board/${boardId}`);
  };

  if (loading) return <div>Loading boards...</div>;

  if (boards.length === 0) {
    return (
      <div className="empty-state">
        <h2>No boards yet</h2>
        <p>Create your first board to get started</p>
        <button onClick={() => setShowCreateModal(true)}>
          Create Board
        </button>
        {showCreateModal && (
          <CreateBoardModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateBoard}
          />
        )}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Kanban Dashboard</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Board
        </button>
      </header>

      <div className="board-grid">
        {boards.map(board => (
          <BoardCard
            key={board.id}
            board={board}
            onView={() => handleViewBoard(board.id)}
            onEdit={() => handleEditBoard(board)}
            onDelete={() => handleDeleteBoard(board.id)}
          />
        ))}
      </div>

      {showCreateModal && (
        <CreateBoardModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateBoard}
        />
      )}
    </div>
  );
};
```

3. **Create BoardCard component:**
```tsx
// src/components/BoardCard.tsx
const BoardCard = ({ board, onView, onEdit, onDelete }) => {
  return (
    <div className="board-card">
      <h3>{board.name}</h3>
      <p>{board.description}</p>
      <div className="board-stats">
        <span>{board.ticket_count || 0} tickets</span>
      </div>
      <div className="board-actions">
        <button onClick={onView}>View</button>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
};
```

### Phase 3: Routing Implementation (30 min)
**Lead:** Full-Stack Developer

1. **Update App.tsx with routing:**
```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Board from './components/Board';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/board/:boardId" element={<Board />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

2. **Update Board component to use boardId:**
```tsx
// src/components/Board.tsx
import { useParams, useNavigate } from 'react-router-dom';

const Board = () => {
  const { boardId } = useParams();
  const navigate = useNavigate();

  // Update context to use boardId from URL
  useEffect(() => {
    loadBoard(boardId);
  }, [boardId]);

  return (
    <div className="board">
      <button
        className="back-button"
        onClick={() => navigate('/')}
      >
        ← Back to Dashboard
      </button>
      {/* Existing board content */}
    </div>
  );
};
```

### Phase 4: API Client Updates (20 min)
**Lead:** Full-Stack Developer

```typescript
// src/services/api.ts
export const api = {
  // Board endpoints
  getBoards: async () => {
    const response = await axios.get('/api/boards');
    return response.data;
  },

  getBoard: async (boardId: number) => {
    const response = await axios.get(`/api/boards/${boardId}`);
    return response.data;
  },

  createBoard: async (data: { name: string; description: string }) => {
    const response = await axios.post('/api/boards', data);
    return response.data;
  },

  updateBoard: async (boardId: number, data: any) => {
    const response = await axios.put(`/api/boards/${boardId}`, data);
    return response.data;
  },

  deleteBoard: async (boardId: number) => {
    await axios.delete(`/api/boards/${boardId}`);
  },

  // Update ticket endpoints to include boardId
  getTickets: async (boardId: number) => {
    const response = await axios.get(`/api/boards/${boardId}/tickets`);
    return response.data;
  },

  createTicket: async (boardId: number, data: any) => {
    const response = await axios.post(`/api/boards/${boardId}/tickets`, data);
    return response.data;
  }
};
```

### Phase 5: Testing & Polish (30 min)
**Lead:** All Team

1. **Test complete flow:**
   - Open app → See dashboard (empty or with boards)
   - Create new board → Board appears in grid
   - Click board → Navigate to kanban view
   - Click back → Return to dashboard
   - Edit board → Update name/description
   - Delete board → Confirm and remove

2. **Add CSS styling:**
```css
/* Dashboard styles */
.dashboard {
  padding: 2rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.board-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.board-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.empty-state {
  text-align: center;
  padding: 4rem;
}
```

## Success Metrics
- [ ] Dashboard loads without 404 errors
- [ ] Can create new boards
- [ ] Boards persist after refresh
- [ ] Can navigate between dashboard and boards
- [ ] Default board created if none exist
- [ ] Board CRUD operations work
- [ ] Proper empty state handling

## Testing Commands
```bash
# Test board API
curl http://localhost:8000/api/boards
curl -X POST http://localhost:8000/api/boards \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Board","description":"Testing"}'

# Frontend testing
npm run dev
# Navigate to http://localhost:15173
# Should see dashboard, not 404
```

## Timeline
- Phase 1: Backend API (30 min)
- Phase 2: Dashboard component (75 min)
- Phase 3: Routing (105 min)
- Phase 4: API client (125 min)
- Phase 5: Testing (155 min)

**Total: ~2.5 hours**

---
*Dashboard team to fix critical app breakage and enable multi-board support*
