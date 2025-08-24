import React from "react";
import { useBoard } from "../context/useBoardHook";
import "./BulkActions.css";

interface BulkActionsProps {
  selectedTicketIds: Set<string>;
  onClearSelection: () => void;
  onBulkMove: (targetColumnId: string) => void;
  onBulkAssign: (assignee: string) => void;
  onBulkDelete: () => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedTicketIds,
  onClearSelection,
  onBulkMove,
  onBulkAssign,
  onBulkDelete,
}) => {
  const { board } = useBoard();
  const [showMoveMenu, setShowMoveMenu] = React.useState(false);
  const [showAssignMenu, setShowAssignMenu] = React.useState(false);
  const [assigneeInput, setAssigneeInput] = React.useState("");

  if (selectedTicketIds.size === 0) {
    return null;
  }

  const handleMove = (columnId: string) => {
    onBulkMove(columnId);
    setShowMoveMenu(false);
  };

  const handleAssign = () => {
    if (assigneeInput.trim()) {
      onBulkAssign(assigneeInput.trim());
      setAssigneeInput("");
      setShowAssignMenu(false);
    }
  };

  return (
    <div className="bulk-actions">
      <div className="bulk-actions-info">
        <span className="bulk-count">
          {selectedTicketIds.size} tickets selected
        </span>
        <button
          className="bulk-clear"
          onClick={onClearSelection}
          aria-label="Clear selection"
        >
          Clear
        </button>
      </div>

      <div className="bulk-actions-buttons">
        <div className="bulk-action-group">
          <button
            className="bulk-action-btn bulk-move"
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            aria-expanded={showMoveMenu}
          >
            Move to...
          </button>
          {showMoveMenu && board && (
            <div className="bulk-dropdown">
              {board.columns.map((column) => (
                <button
                  key={column.id}
                  className="bulk-dropdown-item"
                  onClick={() => handleMove(column.id)}
                >
                  {column.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bulk-action-group">
          <button
            className="bulk-action-btn bulk-assign"
            onClick={() => setShowAssignMenu(!showAssignMenu)}
            aria-expanded={showAssignMenu}
          >
            Assign to...
          </button>
          {showAssignMenu && (
            <div className="bulk-dropdown">
              <input
                type="text"
                className="bulk-assign-input"
                placeholder="Enter assignee name"
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAssign()}
                autoFocus
              />
              <button
                className="bulk-dropdown-item"
                onClick={handleAssign}
                disabled={!assigneeInput.trim()}
              >
                Assign
              </button>
              <button
                className="bulk-dropdown-item"
                onClick={() => onBulkAssign("")}
              >
                Unassign
              </button>
            </div>
          )}
        </div>

        <button
          className="bulk-action-btn bulk-delete"
          onClick={() => {
            if (confirm(`Delete ${selectedTicketIds.size} tickets?`)) {
              onBulkDelete();
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default BulkActions;
