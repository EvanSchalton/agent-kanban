# Team Plan: Card Navigation & UX Improvements
## Mission: Add arrow navigation and fix drag-and-drop UX issues

### Project Manager Configuration
```yaml
name: ux-improvements-pm
session: ux-improve:1
goal: Add left/right/up/down arrow buttons to cards for navigation and fix drag-and-drop rotation/functionality issues
priority: HIGH - User experience enhancement
estimated_time: 2-3 hours
```

## Team Composition

### 1. Frontend Developer (fe) - LEAD
**Role:** Implement arrow navigation and fix drag-and-drop
```yaml
name: frontend-dev
expertise: React, TypeScript, CSS, React-DND, User Interface Design
responsibilities:
  - Add arrow buttons to card components
  - Implement left/right column movement
  - Implement up/down position reordering
  - Remove annoying card rotation during drag
  - Fix drag-and-drop drop zones
  - Add visual feedback and animations
  - Ensure responsive design
tools: react, typescript, css, react-dnd, browser devtools
```

### 2. UX/UI Designer (ux)
**Role:** Design intuitive card navigation interface
```yaml
name: ux-designer
expertise: UI/UX Design, Accessibility, CSS, User Interaction Design
responsibilities:
  - Design arrow button placement and styling
  - Create hover states and visual feedback
  - Ensure accessibility compliance
  - Design smooth animations
  - Create disabled states for edge cases
  - Test usability across devices
tools: css, figma/design tools, accessibility testing
```

### 3. Backend Developer (be)
**Role:** Support any API changes needed for reordering
```yaml
name: backend-dev
expertise: Python, FastAPI, Database, API Design
responsibilities:
  - Ensure move API supports position parameter
  - Add reorder endpoint if needed
  - Optimize for multiple rapid moves
  - Add proper validation
  - Monitor performance
tools: python, fastapi, database
```

## Workflow Phases

### Phase 1: Design & Planning (30 min)
**Lead:** UX Designer

1. **Design arrow button layout:**
```
┌─────────────────┐
│  Card Title     │ ← → (hover to show)
│  Description    │ ↑ ↓ (hover to show)
│  Details        │
└─────────────────┘
```

2. **Plan button states:**
```css
.card-arrows {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.card:hover .card-arrows {
  opacity: 1;
}

.arrow-btn {
  background: rgba(255,255,255,0.9);
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  margin: 1px;
}

.arrow-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

### Phase 2: Arrow Implementation (60 min)
**Lead:** Frontend Developer

1. **Add arrow buttons to card component:**
```tsx
const CardArrows = ({ card, onMove, onReorder }) => {
  const columns = ['Not Started', 'In Progress', 'Review', 'Done'];
  const currentIndex = columns.indexOf(card.current_column);
  const cardsInColumn = getCardsInColumn(card.current_column);
  const cardIndex = cardsInColumn.findIndex(c => c.id === card.id);

  return (
    <div className="card-arrows">
      <button
        className="arrow-btn"
        onClick={() => onMove(card.id, columns[currentIndex - 1])}
        disabled={currentIndex === 0}
        title="Move to previous column"
      >
        ←
      </button>
      <button
        className="arrow-btn"
        onClick={() => onMove(card.id, columns[currentIndex + 1])}
        disabled={currentIndex === columns.length - 1}
        title="Move to next column"
      >
        →
      </button>
      <button
        className="arrow-btn"
        onClick={() => onReorder(card.id, cardIndex - 1)}
        disabled={cardIndex === 0}
        title="Move up in column"
      >
        ↑
      </button>
      <button
        className="arrow-btn"
        onClick={() => onReorder(card.id, cardIndex + 1)}
        disabled={cardIndex === cardsInColumn.length - 1}
        title="Move down in column"
      >
        ↓
      </button>
    </div>
  );
};
```

2. **Integrate into existing card:**
```tsx
const TicketCard = ({ ticket }) => {
  return (
    <div className="card" onMouseEnter={showArrows} onMouseLeave={hideArrows}>
      <CardArrows
        card={ticket}
        onMove={handleColumnMove}
        onReorder={handlePositionReorder}
      />
      {/* existing card content */}
    </div>
  );
};
```

### Phase 3: Movement Logic (45 min)
**Lead:** Frontend Developer

1. **Column movement handler:**
```tsx
const handleColumnMove = async (cardId, newColumn) => {
  try {
    // Optimistic update
    updateCardColumn(cardId, newColumn);

    // API call
    await api.moveCard(cardId, {
      column: newColumn,
      position: 0 // Add to top of new column
    });

    // Refresh board state
    refreshBoard();
  } catch (error) {
    // Revert optimistic update
    revertCardMove(cardId);
    showError('Failed to move card');
  }
};
```

2. **Position reorder handler:**
```tsx
const handlePositionReorder = async (cardId, newPosition) => {
  try {
    // Optimistic update
    reorderCardInColumn(cardId, newPosition);

    // API call (may need new endpoint)
    await api.reorderCard(cardId, {
      position: newPosition,
      column: card.current_column
    });

    refreshBoard();
  } catch (error) {
    revertCardReorder(cardId);
    showError('Failed to reorder card');
  }
};
```

### Phase 4: Fix Drag-and-Drop (30 min)
**Lead:** Frontend Developer

1. **Remove rotation effect:**
```css
/* Find and modify/remove this */
.card.dragging {
  /* transform: rotate(5deg); <- REMOVE THIS */
  opacity: 0.8;
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  z-index: 1000;
  /* Keep helpful effects, remove annoying ones */
}
```

2. **Fix drop zones:**
```css
.column {
  position: relative;
  min-height: 400px;
}

.column-drop-zone {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px dashed transparent;
  transition: border-color 0.2s;
}

.column-drop-zone.drag-over {
  border-color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.05);
}
```

3. **Improve drag-and-drop logic:**
```tsx
const [{ isDragging }, dragRef] = useDrag({
  type: 'CARD',
  item: { id: card.id, column: card.current_column },
  collect: (monitor) => ({
    isDragging: monitor.isDragging(),
  }),
});

// Ensure refs are properly applied
<div ref={dragRef} className={`card ${isDragging ? 'dragging' : ''}`}>
```

### Phase 5: Backend Support (30 min)
**Lead:** Backend Developer

1. **Check/enhance move endpoint:**
```python
@router.post("/tickets/{ticket_id}/move")
async def move_ticket(
    ticket_id: int,
    move_data: dict,  # Should accept: column, position
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    # Update column
    if "column" in move_data:
        ticket.current_column = move_data["column"]
        ticket.column_entered_at = datetime.now(timezone.utc)

    # Update position if provided
    if "position" in move_data:
        ticket.position = move_data["position"]
        # Reorder other cards in column
        reorder_cards_in_column(db, ticket.current_column, ticket_id, move_data["position"])

    db.commit()
    return ticket
```

2. **Add reorder helper:**
```python
def reorder_cards_in_column(db: Session, column: str, moved_card_id: int, new_position: int):
    cards = db.query(Ticket).filter(
        Ticket.current_column == column,
        Ticket.id != moved_card_id
    ).order_by(Ticket.position).all()

    # Update positions
    for i, card in enumerate(cards):
        if i >= new_position:
            card.position = i + 1
        else:
            card.position = i

    db.commit()
```

### Phase 6: Testing & Polish (30 min)
**Lead:** UX Designer + Frontend Developer

1. **Test all movements:**
   - Left/right arrows move between columns ✅
   - Up/down arrows reorder within column ✅
   - Buttons disabled at edges ✅
   - Drag-and-drop still works ✅
   - No rotation during drag ✅

2. **Add animations:**
```css
.card {
  transition: all 0.3s ease;
}

.card.moving {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

3. **Keyboard shortcuts:**
```tsx
useEffect(() => {
  const handleKeyPress = (e) => {
    if ((e.ctrlKey || e.metaKey) && selectedCard) {
      switch(e.key) {
        case 'ArrowLeft':
          handleColumnMove(selectedCard.id, getPreviousColumn());
          break;
        case 'ArrowRight':
          handleColumnMove(selectedCard.id, getNextColumn());
          break;
        // etc.
      }
    }
  };

  document.addEventListener('keydown', handleKeyPress);
  return () => document.removeEventListener('keydown', handleKeyPress);
}, [selectedCard]);
```

## Success Metrics
- [ ] Arrow buttons appear on card hover
- [ ] Left/right arrows move cards between columns
- [ ] Up/down arrows reorder cards within column
- [ ] Buttons disabled appropriately at edges
- [ ] No card rotation during drag
- [ ] Drag-and-drop zones work properly
- [ ] Smooth animations
- [ ] Responsive on mobile

## Testing Checklist
- [ ] Move card from first to last column using arrows
- [ ] Reorder cards within same column
- [ ] Test disabled states (first column ←, last column →)
- [ ] Verify drag-and-drop still works alongside arrows
- [ ] No rotation during drag
- [ ] Test on mobile/tablet
- [ ] Keyboard shortcuts work

## Timeline
- Phase 1: Design (30 min)
- Phase 2: Arrow implementation (90 min)
- Phase 3: Movement logic (135 min)
- Phase 4: Drag-and-drop fixes (165 min)
- Phase 5: Backend support (195 min)
- Phase 6: Testing & polish (225 min)

**Total: ~3.5 hours**

---
*UX improvement team for enhanced card navigation and drag-and-drop experience*
