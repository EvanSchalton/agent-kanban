import axios, { type AxiosResponse } from "axios";
import type { Board, Ticket, Column, Comment } from "../types";
import { handleApiError } from "./errorHandler";

// Use Vite proxy - all /api requests go through proxy to backend
const api = axios.create({
  baseURL: "",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 second timeout
});

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    const apiError = handleApiError(error);
    console.error("API Error:", apiError);
    throw apiError;
  },
);

// Helper function to retry API calls
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) except 408 (timeout)
      const status = (error as any)?.status;
      if (status && status >= 400 && status < 500 && status !== 408) {
        throw error;
      }

      if (attempt < maxRetries) {
        console.warn(
          `API call failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
}

export const boardApi = {
  async list(): Promise<Board[]> {
    return withRetry(async () => {
      const { data } = await api.get("/api/boards/");
      const boards = Array.isArray(data) ? data : [];
      // Transform backend board structure to frontend format
      return boards.map((board) => ({
        ...board,
        id: board.id.toString(),
      }));
    });
  },

  async get(id: string): Promise<Board> {
    return withRetry(async () => {
      const { data } = await api.get(`/api/boards/${id}`);

      // Transform string array columns to Column objects if needed
      if (
        data.columns &&
        Array.isArray(data.columns) &&
        typeof data.columns[0] === "string"
      ) {
        data.columns = data.columns.map((name: string, index: number) => ({
          id: name.toLowerCase().replace(/\s+/g, "_"),
          board_id: data.id.toString(),
          name: name,
          position: index,
          created_at: data.created_at,
          updated_at: data.updated_at,
        }));
      }

      return {
        ...data,
        id: data.id.toString(),
      };
    });
  },

  async create(board: Partial<Board>): Promise<Board> {
    const { data } = await api.post("/api/boards/", board);
    return {
      ...data,
      id: data.id.toString(),
    };
  },

  async update(id: string, board: Partial<Board>): Promise<Board> {
    const { data } = await api.put(`/api/boards/${id}`, board);
    return {
      ...data,
      id: data.id.toString(),
    };
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/boards/${id}`);
  },
};

export const columnApi = {
  async list(boardId: string): Promise<Column[]> {
    const { data } = await api.get(`/api/boards/${boardId}/columns`);
    return data;
  },

  async create(boardId: string, column: Partial<Column>): Promise<Column> {
    const { data } = await api.post(`/api/boards/${boardId}/columns`, column);
    return data;
  },

  async update(id: string, column: Partial<Column>): Promise<Column> {
    const { data } = await api.put(`/api/columns/${id}`, column);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/columns/${id}`);
  },

  async reorder(boardId: string, columnIds: string[]): Promise<void> {
    await api.post(`/api/boards/${boardId}/columns/reorder`, {
      column_ids: columnIds,
    });
  },
};

// Column mapping for frontend <-> backend transformation
// Standard columns for board 1
const COLUMN_MAP: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  ready_for_qc: "Ready for QC",
  done: "Done",
  // Additional mappings for other boards
  backlog: "Backlog",
  active: "Active",
  testing: "Testing",
  completed: "Completed",
  new: "New",
  review: "Review",
  approved: "Approved",
  deployed: "Deployed",
};

export const ticketApi = {
  async list(boardId: string): Promise<Ticket[]> {
    return withRetry(async () => {
      // Use the boards/{id}/tickets endpoint for cleaner board isolation
      const url = `/api/boards/${boardId}/tickets`;
      console.log("🔍 ticketApi.list - calling URL:", url);
      console.log(
        "🔍 ticketApi.list - boardId type:",
        typeof boardId,
        "value:",
        boardId,
      );
      const { data } = await api.get(url);
      console.log("🔍 ticketApi.list - response data:", data);

      // This endpoint returns {board_id, board_name, tickets: [...], total_tickets}
      const tickets = data.tickets || [];

      // Transform backend ticket structure to frontend format
      return tickets.map((ticket: any) => ({
        ...ticket,
        column_id:
          ticket.current_column?.toLowerCase().replace(/\s+/g, "_") ||
          ticket.column_id,
        id: ticket.id.toString(), // Ensure ID is string
      }));
    });
  },

  async get(id: string): Promise<Ticket> {
    return withRetry(async () => {
      const { data } = await api.get(`/api/tickets/${id}`);
      // Transform backend ticket structure to frontend format
      return {
        ...data,
        column_id:
          data.current_column?.toLowerCase().replace(/\s+/g, "_") ||
          data.column_id,
        id: data.id.toString(),
      };
    });
  },

  async create(ticket: Partial<Ticket>): Promise<Ticket> {
    return withRetry(async () => {
      // Validate board_id first
      const boardId = parseInt(ticket.board_id || "0");
      if (!boardId || boardId <= 0 || isNaN(boardId)) {
        throw new Error(
          `Invalid board ID: "${ticket.board_id}". Board ID must be a positive number.`,
        );
      }

      // Transform column_id to current_column name for backend
      let columnName = "Not Started"; // Default column

      if (ticket.column_id) {
        columnName = COLUMN_MAP[ticket.column_id];
        if (!columnName) {
          console.error(
            "Invalid column_id for create:",
            ticket.column_id,
            "Available:",
            Object.keys(COLUMN_MAP),
          );
          // Fallback to Not Started if invalid column_id
          columnName = "Not Started";
        }
      }

      // Build payload with correct field names for backend
      const payload = {
        title: ticket.title,
        description: ticket.description || null,
        acceptance_criteria: ticket.acceptance_criteria || null,
        priority: ticket.priority || "1.0",
        assignee: ticket.assignee || null,
        board_id: boardId,
        current_column: columnName, // Backend expects 'current_column', not 'column_id'
      };

      console.log("📤 Creating ticket with payload:", payload);

      // Ensure trailing slash on endpoint
      const { data } = await api.post("/api/tickets/", payload);

      // Transform backend ticket structure to frontend format
      return {
        ...data,
        column_id:
          data.current_column?.toLowerCase().replace(/\s+/g, "_") ||
          "not_started",
        id: data.id.toString(),
      };
    });
  },

  async update(id: string, ticket: Partial<Ticket>): Promise<Ticket> {
    return withRetry(async () => {
      // Transform column_id to current_column if present
      const payload = { ...ticket };
      if (ticket.column_id) {
        const columnName = COLUMN_MAP[ticket.column_id];
        if (!columnName) {
          throw new Error(
            `Invalid column ID: ${ticket.column_id}. Must be one of: ${Object.keys(COLUMN_MAP).join(", ")}`,
          );
        }
        payload.current_column = columnName;
        delete payload.column_id;
      }
      const { data } = await api.put(`/api/tickets/${id}`, payload);
      // Transform backend ticket structure to frontend format
      return {
        ...data,
        column_id:
          data.current_column?.toLowerCase().replace(/\s+/g, "_") ||
          data.column_id,
        id: data.id.toString(),
      };
    });
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/tickets/${id}`);
  },

  async move(id: string, columnId: string): Promise<Ticket> {
    return withRetry(async () => {
      console.log("API move() called with:", {
        ticketId: id,
        columnId,
        columnIdType: typeof columnId,
        COLUMN_MAP_keys: Object.keys(COLUMN_MAP),
      });

      // Transform columnId back to column name for backend - NEVER send raw columnId!
      const columnName = COLUMN_MAP[columnId];
      if (!columnName) {
        console.error("Column mapping failed:", {
          receivedColumnId: columnId,
          availableKeys: Object.keys(COLUMN_MAP),
          COLUMN_MAP,
        });
        throw new Error(
          `Invalid column ID: ${columnId}. Must be one of: ${Object.keys(COLUMN_MAP).join(", ")}`,
        );
      }

      console.log("Sending to backend:", {
        endpoint: `/api/tickets/${id}/move`,
        payload: { column: columnName },
      });

      // Backend expects 'column' field with full column name
      const { data } = await api.post(`/api/tickets/${id}/move`, {
        column: columnName,
      });
      // Transform backend ticket structure to frontend format
      return {
        ...data,
        column_id:
          data.current_column?.toLowerCase().replace(/\s+/g, "_") ||
          data.column_id,
        id: data.id.toString(),
      };
    });
  },

  async claim(id: string, assignee: string): Promise<Ticket> {
    const { data } = await api.post(`/api/tickets/${id}/claim`, { assignee });
    // Transform backend ticket structure to frontend format
    return {
      ...data,
      column_id:
        data.current_column?.toLowerCase().replace(/\s+/g, "_") ||
        data.column_id,
      id: data.id.toString(),
    };
  },

  async updatePriority(id: string, priority: string): Promise<Ticket> {
    const { data } = await api.put(`/api/tickets/${id}`, {
      priority,
      changed_by: "frontend",
    });
    // Transform backend ticket structure to frontend format
    return {
      ...data,
      column_id:
        data.current_column?.toLowerCase().replace(/\s+/g, "_") ||
        data.column_id,
      id: data.id.toString(),
    };
  },
};

export const commentApi = {
  async list(ticketId: string): Promise<Comment[]> {
    const { data } = await api.get(`/api/comments/ticket/${ticketId}`);
    return data;
  },

  async create(
    ticketId: string,
    text: string,
    author: string,
  ): Promise<Comment> {
    return withRetry(async () => {
      const { data } = await api.post("/api/comments/", {
        ticket_id: parseInt(ticketId),
        text,
        author,
      });
      return {
        ...data,
        id: data.id.toString(),
        ticket_id: data.ticket_id.toString(),
      };
    });
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/comments/${id}`);
  },
};

export const getBoard = boardApi.get;
export const getTickets = ticketApi.list;
export const createTicket = ticketApi.create;
export const updateTicket = ticketApi.update;
export const moveTicket = ticketApi.move;
export const addComment = commentApi.create;
