import { useState, useEffect, useRef } from "react";
import type { Board } from "../types";
import "./EditBoardModal.css";

interface EditBoardModalProps {
  board: Board;
  onClose: () => void;
  onSaved: (board: Board) => void;
}

const EditBoardModal = ({ board, onClose, onSaved }: EditBoardModalProps) => {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on name input when modal opens
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Board name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { boardApi } = await import("../services/api");
      const updatedBoard = await boardApi.update(board.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onSaved(updatedBoard);
      onClose();
    } catch (error: any) {
      const errorMessage =
        error.message || "Failed to update board. Please try again.";
      setError(errorMessage);
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

  const hasChanges =
    name !== board.name || description !== (board.description || "");

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Board</h2>
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
            <label htmlFor="board-name">Board Name *</label>
            <input
              ref={nameInputRef}
              id="board-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sprint Planning, Product Roadmap"
              disabled={loading}
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="board-description">Description (Optional)</label>
            <textarea
              id="board-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for your board..."
              disabled={loading}
              rows={3}
              maxLength={500}
            />
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
              disabled={loading || !name.trim() || !hasChanges}
            >
              {loading ? (
                <>
                  <span className="spinner-small"></span>
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBoardModal;
