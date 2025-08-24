import React, { useState, useEffect } from "react";
import { useBoard } from "../context/useBoardHook";
import { updateTicket, addComment, ticketApi } from "../services/api";
import { formatTimeInColumn } from "../utils/statistics";
import TicketHistoryComponent from "./TicketHistory";
import "./TicketDetail.css";

const TicketDetail: React.FC = () => {
  const {
    selectedTicket,
    selectTicket,
    updateTicket: updateTicketInState,
    dispatch,
  } = useBoard();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTicket, setEditedTicket] = useState(selectedTicket);
  const [newComment, setNewComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setEditedTicket(selectedTicket);
  }, [selectedTicket]);

  if (!selectedTicket || !editedTicket) {
    return null;
  }

  const handleClose = () => {
    selectTicket(null);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedTicket(selectedTicket);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editedTicket) return;

    setIsSaving(true);
    try {
      const updated = await updateTicket(editedTicket.id, {
        title: editedTicket.title,
        description: editedTicket.description,
        acceptance_criteria: editedTicket.acceptance_criteria,
        priority: editedTicket.priority,
        assignee: editedTicket.assignee,
      });

      // The API now returns properly transformed data with column_id
      // The context's UPDATE_TICKET action will handle merging
      updateTicketInState(updated);
      setIsEditing(false);

      // Also update the local editedTicket to reflect the saved state
      setEditedTicket(updated);
    } catch (error) {
      console.error("Failed to update ticket:", error);
      alert("Failed to update ticket");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTicket) return;

    try {
      const comment = await addComment(selectedTicket.id, newComment, "User");

      const updatedTicket = {
        ...selectedTicket,
        comments: [...(selectedTicket.comments || []), comment],
      };

      updateTicketInState(updatedTicket);
      setNewComment("");
    } catch (error) {
      console.error("Failed to add comment:", error);
      alert("Failed to add comment");
    }
  };

  const handleFieldChange = (
    field: keyof typeof editedTicket,
    value: string,
  ) => {
    setEditedTicket({
      ...editedTicket,
      [field]: value,
    });
  };

  const handleDelete = async () => {
    if (!selectedTicket) return;

    setIsDeleting(true);
    try {
      await ticketApi.delete(selectedTicket.id);
      dispatch({ type: "DELETE_TICKET", payload: selectedTicket.id });
      selectTicket(null);
    } catch (error) {
      console.error("Failed to delete ticket:", error);
      alert("Failed to delete ticket");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="ticket-detail-overlay" onClick={handleClose}>
      <div className="ticket-detail" onClick={(e) => e.stopPropagation()}>
        <div className="ticket-detail-header">
          <h2>Ticket Details</h2>
          <button className="close-button" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="ticket-detail-content">
          <div className="ticket-detail-main">
            <div className="field-group">
              <label>Title</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedTicket.title}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  className="field-input"
                />
              ) : (
                <p className="field-value">{selectedTicket.title}</p>
              )}
            </div>

            <div className="field-group">
              <label>Description</label>
              {isEditing ? (
                <textarea
                  value={editedTicket.description || ""}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  className="field-textarea"
                  rows={4}
                />
              ) : (
                <p className="field-value">
                  {selectedTicket.description || "No description"}
                </p>
              )}
            </div>

            <div className="field-group">
              <label>Acceptance Criteria</label>
              {isEditing ? (
                <textarea
                  value={editedTicket.acceptance_criteria || ""}
                  onChange={(e) =>
                    handleFieldChange("acceptance_criteria", e.target.value)
                  }
                  className="field-textarea"
                  rows={3}
                />
              ) : (
                <p className="field-value">
                  {selectedTicket.acceptance_criteria ||
                    "No acceptance criteria"}
                </p>
              )}
            </div>

            <div className="field-row">
              <div className="field-group">
                <label>Priority</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTicket.priority}
                    onChange={(e) =>
                      handleFieldChange("priority", e.target.value)
                    }
                    className="field-input"
                    placeholder="e.g., 1.0.1.0.0.1"
                  />
                ) : (
                  <p className="field-value">{selectedTicket.priority}</p>
                )}
              </div>

              <div className="field-group">
                <label>Assignee</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTicket.assignee || ""}
                    onChange={(e) =>
                      handleFieldChange("assignee", e.target.value)
                    }
                    className="field-input"
                    placeholder="Agent ID or name"
                  />
                ) : (
                  <p className="field-value">
                    {selectedTicket.assignee || "Unassigned"}
                  </p>
                )}
              </div>
            </div>

            <div className="field-row">
              <div className="field-group">
                <label>Time in Column</label>
                <p className="field-value">
                  {formatTimeInColumn(
                    selectedTicket.time_in_column ||
                      Date.now() -
                        new Date(selectedTicket.updated_at).getTime(),
                  )}
                </p>
              </div>

              <div className="field-group">
                <label>Created</label>
                <p className="field-value">
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="ticket-detail-sidebar">
            <div className="comments-section">
              <h3>Comments</h3>
              <div className="comments-list">
                {selectedTicket.comments?.map((comment) => (
                  <div key={comment.id} className="comment">
                    <div className="comment-header">
                      <span className="comment-author">{comment.author}</span>
                      <span className="comment-time">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="comment-text">{comment.text}</p>
                  </div>
                ))}

                {(!selectedTicket.comments ||
                  selectedTicket.comments.length === 0) && (
                  <p className="no-comments">No comments yet</p>
                )}
              </div>

              <div className="add-comment">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="comment-input"
                  rows={3}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="comment-button"
                >
                  Add Comment
                </button>
              </div>
            </div>

            {selectedTicket.history && selectedTicket.history.length > 0 && (
              <div className="history-section">
                <h3>History</h3>
                <div className="history-list">
                  {selectedTicket.history.map((entry) => (
                    <div key={entry.id} className="history-entry">
                      <span className="history-time">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <span className="history-action">
                        Moved to column {entry.to_column_id}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ticket-detail-footer">
          {showDeleteConfirm ? (
            <>
              <span style={{ color: "#dc3545", marginRight: "auto" }}>
                Are you sure you want to delete this ticket?
              </span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="button button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="button button-danger"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </>
          ) : isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="button button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="button button-primary"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="button button-danger"
                style={{ marginRight: "auto" }}
              >
                Delete Ticket
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="button button-secondary"
              >
                View History
              </button>
              <button onClick={handleEdit} className="button button-primary">
                Edit Ticket
              </button>
            </>
          )}
        </div>
      </div>

      <TicketHistoryComponent
        ticketId={selectedTicket.id}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
};

export default TicketDetail;
