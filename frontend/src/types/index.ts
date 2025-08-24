export interface Board {
  id: string;
  name: string;
  description?: string;
  columns: Column[];
  created_at: string;
  updated_at: string;
  ticket_count?: number;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  priority: string;
  assignee?: string;
  created_at: string;
  updated_at: string;
  time_in_column?: number;
  comments?: Comment[];
  history?: TicketHistory[];
  current_column?: string; // Added for backend compatibility
}

export interface Comment {
  id: string;
  ticket_id: string;
  text: string;
  author: string;
  created_at: string;
}

export interface TicketHistory {
  id: string;
  ticket_id: string;
  from_column_id?: string;
  to_column_id: string;
  timestamp: string;
  duration_in_previous?: number;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  changed_by?: string;
}

export interface BoardState {
  board: Board | null;
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  selectedTicket: Ticket | null;
}

export interface WebSocketMessage {
  type:
    | "ticket_created"
    | "ticket_updated"
    | "ticket_deleted"
    | "ticket_moved"
    | "comment_added"
    | "ticket_claimed"
    | "board_created"
    | "board_updated"
    | "board_deleted";
  data: any;
}
