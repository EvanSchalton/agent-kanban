import React, {
  createContext,
  useReducer,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import type { Board, Ticket, BoardState, WebSocketMessage } from "../types";
import {
  getBoard,
  getTickets,
  createTicket as apiCreateTicket,
} from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

interface BoardContextType extends BoardState {
  dispatch: React.Dispatch<BoardAction>;
  loadBoard: (boardId: string) => Promise<void>;
  selectTicket: (ticket: Ticket | null) => void;
  updateTicket: (ticket: Ticket) => void;
  createTicket: (ticket: Partial<Ticket>) => Promise<Ticket>;
  moveTicket: (ticketId: string, targetColumnId: string) => void;
  retryLoad: () => void;
  searchFilter: string;
  setSearchFilter: (search: string) => void;
  filteredTickets: Ticket[];
  wsConnected: boolean;
  wsError: string | null;
  reconnectWebSocket: () => void;
}

type BoardAction =
  | { type: "SET_BOARD"; payload: Board }
  | { type: "SET_TICKETS"; payload: Ticket[] }
  | { type: "ADD_TICKET"; payload: Ticket }
  | { type: "UPDATE_TICKET"; payload: Ticket }
  | { type: "DELETE_TICKET"; payload: string }
  | { type: "MOVE_TICKET"; payload: { ticketId: string; columnId: string } }
  | { type: "SELECT_TICKET"; payload: Ticket | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null };

const initialState: BoardState = {
  board: null,
  tickets: [],
  loading: false,
  error: null,
  selectedTicket: null,
};

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "SET_BOARD":
      return { ...state, board: action.payload, error: null };

    case "SET_TICKETS":
      return { ...state, tickets: action.payload, error: null };

    case "ADD_TICKET":
      return { ...state, tickets: [...state.tickets, action.payload] };

    case "UPDATE_TICKET":
      return {
        ...state,
        tickets: state.tickets.map((t) =>
          t.id === action.payload.id
            ? { ...t, ...action.payload } // Merge updates to preserve existing data
            : t,
        ),
        selectedTicket:
          state.selectedTicket?.id === action.payload.id
            ? { ...state.selectedTicket, ...action.payload } // Merge for selected ticket too
            : state.selectedTicket,
      };

    case "DELETE_TICKET":
      return {
        ...state,
        tickets: state.tickets.filter((t) => t.id !== action.payload),
        selectedTicket:
          state.selectedTicket?.id === action.payload
            ? null
            : state.selectedTicket,
      };

    case "MOVE_TICKET":
      return {
        ...state,
        tickets: state.tickets.map((t) =>
          t.id === action.payload.ticketId
            ? { ...t, column_id: action.payload.columnId }
            : t,
        ),
      };

    case "SELECT_TICKET":
      return { ...state, selectedTicket: action.payload };

    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };

    default:
      return state;
  }
}

const BoardContext = createContext<BoardContextType | undefined>(undefined);

function BoardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(boardReducer, initialState);
  const [currentBoardId, setCurrentBoardId] = useState<string>("1");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Load board function - defined early to avoid circular dependency
  const loadBoard = useCallback(async (boardId: string) => {
    console.log("🔍 BoardContext.loadBoard - received boardId:", boardId);
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    setCurrentBoardId(boardId);

    try {
      console.log("🔍 BoardContext - calling getBoard with:", boardId);
      console.log("🔍 BoardContext - calling getTickets with:", boardId);
      const [board, tickets] = await Promise.all([
        getBoard(boardId),
        getTickets(boardId),
      ]);
      dispatch({ type: "SET_BOARD", payload: board });
      dispatch({ type: "SET_TICKETS", payload: tickets });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load board";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      console.error("Error loading board:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // Retry load function - depends on loadBoard
  const retryLoad = useCallback(() => {
    if (currentBoardId) {
      loadBoard(currentBoardId);
    }
  }, [currentBoardId, loadBoard]);

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("📡 WebSocket message received:", message.type, message.data);

      switch (message.type) {
        case "ticket_created":
          // Only add if it's for the current board
          if (message.data.board_id === parseInt(currentBoardId)) {
            // Fetch the full ticket data since broadcast only sends minimal info
            if (currentBoardId) {
              retryLoad();
            }
          }
          break;

        case "ticket_updated":
          // Only update if it's for the current board
          if (message.data.board_id === parseInt(currentBoardId)) {
            // Fetch fresh data to get complete ticket information
            if (currentBoardId) {
              retryLoad();
            }
          }
          break;

        case "ticket_deleted":
          // Only delete if it's for the current board
          if (message.data.board_id === parseInt(currentBoardId)) {
            dispatch({
              type: "DELETE_TICKET",
              payload: message.data.id.toString(),
            });
          }
          break;

        case "ticket_moved":
          // Handle drag-drop events with more complete data
          if (message.data.board_id === parseInt(currentBoardId)) {
            dispatch({
              type: "MOVE_TICKET",
              payload: {
                ticketId: message.data.id.toString(),
                columnId: message.data.to_column || message.data.current_column,
              },
            });
          }
          break;

        case "ticket_claimed":
          // Handle agent claiming tickets
          if (message.data.board_id === parseInt(currentBoardId)) {
            const existingTicket = state.tickets.find(
              (t) => t.id === message.data.id.toString(),
            );
            if (existingTicket) {
              dispatch({
                type: "UPDATE_TICKET",
                payload: {
                  ...existingTicket,
                  assignee: message.data.assignee,
                },
              });
            }
          }
          break;

        case "board_created":
          // Board was created - could trigger board list refresh if we had one
          console.log("📊 New board created:", message.data);
          break;

        case "board_updated":
          // Current board was updated - refresh board info
          if (message.data.id === parseInt(currentBoardId)) {
            if (currentBoardId) {
              retryLoad();
            }
          }
          break;

        case "board_deleted":
          // Current board was deleted - handle gracefully
          if (message.data.id === parseInt(currentBoardId)) {
            dispatch({ type: "SET_ERROR", payload: "Board was deleted" });
          }
          break;

        default:
          console.log("📡 Unhandled WebSocket message type:", message.type);
      }
    },
    [currentBoardId, retryLoad],
  );

  // WebSocket connection - use frontend proxy
  const wsUrl = "ws://localhost:5173/ws/connect";
  // Get username from localStorage or environment
  const username =
    localStorage.getItem("username") ||
    "user_" + Math.floor(Math.random() * 1000);
  const {
    isConnected: wsConnected,
    connectionError,
    reconnect,
  } = useWebSocket(wsUrl, handleWebSocketMessage, username);

  const selectTicket = useCallback((ticket: Ticket | null) => {
    dispatch({ type: "SELECT_TICKET", payload: ticket });
  }, []);

  const updateTicket = useCallback(
    (ticket: Partial<Ticket> & { id: string }) => {
      // Just dispatch the update, let the reducer handle the merge
      dispatch({ type: "UPDATE_TICKET", payload: ticket as Ticket });
    },
    [],
  );

  const createTicket = useCallback(
    async (ticket: Partial<Ticket>): Promise<Ticket> => {
      const newTicket = await apiCreateTicket({
        ...ticket,
        board_id: currentBoardId, // API expects string, conversion happens in api.ts
      });
      dispatch({ type: "ADD_TICKET", payload: newTicket });
      return newTicket;
    },
    [currentBoardId],
  );

  const moveTicket = useCallback((ticketId: string, targetColumnId: string) => {
    // Optimistic update
    dispatch({
      type: "MOVE_TICKET",
      payload: { ticketId, columnId: targetColumnId },
    });
  }, []);

  // Simple search filter
  const filteredTickets = useMemo(() => {
    if (!searchFilter.trim()) {
      return state.tickets;
    }

    const searchLower = searchFilter.toLowerCase();
    return state.tickets.filter((ticket) =>
      ticket.title.toLowerCase().includes(searchLower),
    );
  }, [state.tickets, searchFilter]);

  useEffect(() => {
    // Load default board
    loadBoard("1");
  }, []);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to close ticket detail
      if (e.key === "Escape" && state.selectedTicket) {
        selectTicket(null);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.selectedTicket, selectTicket]);

  return (
    <BoardContext.Provider
      value={{
        ...state,
        tickets: state.tickets,
        dispatch,
        loadBoard,
        selectTicket,
        updateTicket,
        createTicket,
        moveTicket,
        retryLoad,
        searchFilter,
        setSearchFilter,
        filteredTickets,
        wsConnected,
        wsError: connectionError,
        reconnectWebSocket: reconnect,
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}

// Export only the provider to comply with React Fast Refresh
export default BoardProvider;
export { BoardContext };
