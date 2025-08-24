# User Attribution Feature Briefing
## Agent Kanban Board - Personal User Names for Actions

**Date:** 2025-08-18
**Project Status:** Feature Request (After Critical Fix)
**Mission:** Add user name setting with localStorage persistence and UI editing

## Feature Overview

### User Request
- Set your name in the UI
- Actions attributed to YOU not "generic user"
- Prompted for name initially
- Stored in localStorage/sessionStorage
- Editable in the UI anytime

### Benefits
- **Accountability** - Know who moved/edited cards
- **Collaboration** - See who's working on what
- **History** - "John moved this to Done" vs "User moved this"
- **Personalization** - Makes the app feel more personal

## User Experience Design

### 1. Initial Prompt (First Visit)
```
┌──────────────────────────────┐
│     Welcome to Kanban!       │
│                              │
│   What's your name?          │
│   ┌────────────────────┐     │
│   │ John Smith         │     │
│   └────────────────────┘     │
│                              │
│   [Continue] [Skip for now]  │
└──────────────────────────────┘
```

### 2. Username Display in Header
```
┌─────────────────────────────────────────────┐
│  🎯 Kanban Board     👤 John Smith [edit]   │
└─────────────────────────────────────────────┘
```

### 3. Edit Username Modal
```
┌──────────────────────────────┐
│      Edit Your Name          │
│   ┌────────────────────┐     │
│   │ John Smith         │     │
│   └────────────────────┘     │
│                              │
│   [Save] [Cancel]            │
└──────────────────────────────┘
```

### 4. Attribution in Actions
- Comments: "**John**: This needs review"
- History: "**John** moved to In Progress (2 min ago)"
- Card footer: "Last edited by **John**"

## Technical Implementation

### Frontend Components

#### 1. UserContext Provider
```tsx
// contexts/UserContext.tsx
const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [username, setUsername] = useState(() => {
    // Load from localStorage
    return localStorage.getItem('kanban_username') || null;
  });

  const [showPrompt, setShowPrompt] = useState(() => {
    // Show prompt if no username
    return !localStorage.getItem('kanban_username');
  });

  const updateUsername = (name) => {
    setUsername(name);
    localStorage.setItem('kanban_username', name);
    setShowPrompt(false);
  };

  return (
    <UserContext.Provider value={{
      username,
      updateUsername,
      showPrompt
    }}>
      {children}
    </UserContext.Provider>
  );
};
```

#### 2. Username Prompt Component
```tsx
// components/UsernamePrompt.tsx
const UsernamePrompt = () => {
  const { updateUsername } = useUser();
  const [name, setName] = useState('');

  return (
    <Modal isOpen={true}>
      <h2>Welcome to Kanban!</h2>
      <p>What's your name?</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
        autoFocus
      />
      <button onClick={() => updateUsername(name)}>
        Continue
      </button>
      <button onClick={() => updateUsername('Anonymous')}>
        Skip for now
      </button>
    </Modal>
  );
};
```

#### 3. Username in Header
```tsx
// components/Header.tsx
const Header = () => {
  const { username, updateUsername } = useUser();
  const [editing, setEditing] = useState(false);

  return (
    <header>
      <h1>Kanban Board</h1>
      <div className="user-info">
        👤 {username || 'Anonymous'}
        <button onClick={() => setEditing(true)}>
          edit
        </button>
      </div>
      {editing && (
        <EditUsernameModal
          currentName={username}
          onSave={updateUsername}
          onClose={() => setEditing(false)}
        />
      )}
    </header>
  );
};
```

### Backend Integration

#### 1. Include Username in API Calls
```typescript
// api.ts
const api = {
  moveCard: async (cardId, column) => {
    const username = localStorage.getItem('kanban_username');
    return fetch(`/api/tickets/${cardId}/move`, {
      method: 'POST',
      body: JSON.stringify({
        column,
        moved_by: username || 'Anonymous'
      })
    });
  },

  updateCard: async (cardId, data) => {
    const username = localStorage.getItem('kanban_username');
    return fetch(`/api/tickets/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...data,
        updated_by: username || 'Anonymous'
      })
    });
  },

  addComment: async (cardId, text) => {
    const username = localStorage.getItem('kanban_username');
    return fetch(`/api/tickets/${cardId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        author: username || 'Anonymous'
      })
    });
  }
};
```

#### 2. Display Attribution
```tsx
// components/TicketHistory.tsx
const TicketHistory = ({ history }) => {
  return (
    <div className="history">
      {history.map(entry => (
        <div key={entry.id}>
          <strong>{entry.user}</strong> {entry.action}
          <span className="time">{formatTime(entry.timestamp)}</span>
        </div>
      ))}
    </div>
  );
};
```

### Storage Strategy

#### localStorage (Persistent)
```javascript
// Survives browser restart
localStorage.setItem('kanban_username', 'John Smith');
const username = localStorage.getItem('kanban_username');
```

#### sessionStorage (Session Only)
```javascript
// Cleared when tab closes
sessionStorage.setItem('kanban_username', 'John Smith');
```

**Recommendation:** Use localStorage for persistence across sessions

### Edge Cases

1. **No Username Set**
   - Default to "Anonymous"
   - Still track actions

2. **Username Changed**
   - Update immediately in UI
   - Historical actions keep old name

3. **Multiple Tabs**
   - Sync across tabs using storage events
   ```javascript
   window.addEventListener('storage', (e) => {
     if (e.key === 'kanban_username') {
       setUsername(e.newValue);
     }
   });
   ```

## Implementation Phases

### Phase 1: Basic Username Storage
- Add UserContext
- Store in localStorage
- Include in API calls

### Phase 2: UI Components
- Username prompt modal
- Header display with edit
- Edit modal

### Phase 3: Attribution Display
- Show in comments
- Show in history
- Show in card footer

### Phase 4: Polish
- Animations
- Keyboard shortcuts
- Avatar/initials
- Color coding per user

## Success Criteria

- ✅ Username prompted on first visit
- ✅ Username persists across sessions
- ✅ Can edit username anytime
- ✅ All actions attributed to username
- ✅ Works across multiple tabs
- ✅ Graceful handling of no username

## Future Enhancements

1. **User Avatars** - Upload or generate
2. **User Colors** - Unique color per user
3. **User Preferences** - Theme, layout, etc.
4. **Real Authentication** - Actual user accounts
5. **Presence Indicators** - See who's online

---

*NOTE: Implement AFTER critical data loss fix is complete*
