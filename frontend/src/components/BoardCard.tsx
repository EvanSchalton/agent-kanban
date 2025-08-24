import type { Board } from "../types";
import "./BoardCard.css";

interface BoardCardProps {
  board: Board;
  ticketCount?: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const BoardCard = ({
  board,
  ticketCount = 0,
  onView,
  onEdit,
  onDelete,
}: BoardCardProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="board-card">
      <div className="board-card-header">
        <h3 className="board-card-title">{board.name}</h3>
        <div className="board-card-actions">
          <button className="action-btn" onClick={onEdit} title="Edit board">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className="action-btn delete"
            onClick={onDelete}
            title="Delete board"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="board-card-stats">
        <div className="stat-item">
          <svg
            className="stat-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="stat-value">{ticketCount}</span>
          <span className="stat-label">tickets</span>
        </div>

        <div className="stat-item">
          <svg
            className="stat-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="stat-value">{board.columns?.length || 0}</span>
          <span className="stat-label">columns</span>
        </div>
      </div>

      <div className="board-card-footer">
        <span className="board-date">
          Created {formatDate(board.created_at)}
        </span>
        <button className="btn-view" onClick={onView}>
          View Board
          <svg
            className="btn-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BoardCard;
