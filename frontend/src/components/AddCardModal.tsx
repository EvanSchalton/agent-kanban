import { useState, useEffect, useRef } from "react";
import { useBoard } from "../context/useBoardHook";
import "./AddCardModal.css";

interface AddCardModalProps {
  columnId: string;
  onClose: () => void;
}

const AddCardModal = ({ columnId, onClose }: AddCardModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { createTicket, board } = useBoard();
  const column = board?.columns.find((col: any) => col.id === columnId);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Card title is required");
      return;
    }

    if (!board) {
      setError("Board information not available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createTicket({
        title: title.trim(),
        description: description.trim() || undefined,
        acceptance_criteria: acceptanceCriteria.trim() || undefined,
        priority,
        assignee: assignee.trim() || undefined,
        column_id: columnId,
        board_id: board.id,
      });
      onClose();
    } catch (error: any) {
      setError(error?.message || "Failed to create card. Please try again.");
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="modal">
        <div className="modal-header">
          <h2>Add New Card to {column?.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="card-title">Title *</label>
            <input
              ref={titleInputRef}
              id="card-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement user authentication"
              disabled={loading}
              maxLength={200}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="card-description">Description</label>
            <textarea
              id="card-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a detailed description..."
              disabled={loading}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="form-group">
            <label htmlFor="card-acceptance">Acceptance Criteria</label>
            <textarea
              id="card-acceptance"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder="Define the acceptance criteria..."
              disabled={loading}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="card-priority">Priority</label>
              <select
                id="card-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="card-assignee">Assignee</label>
              <input
                id="card-assignee"
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g., John Doe"
                disabled={loading}
                maxLength={100}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <svg
                className="error-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !title.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner-small"></span>
                  Creating...
                </>
              ) : (
                "Add Card"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCardModal;
