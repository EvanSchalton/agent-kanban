import React, { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { TicketHistory } from "../types";
import "./TicketHistory.css";

interface TicketHistoryProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
}

const TicketHistoryComponent: React.FC<TicketHistoryProps> = ({
  ticketId,
  isOpen,
  onClose,
}) => {
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchHistory();
    }
  }, [isOpen, ticketId]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/history/tickets/${ticketId}/history`);
      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }
      const data = await response.json();
      // Convert the backend response to the expected format
      const convertedHistory = data.map((entry: any) => ({
        id: entry.id.toString(),
        ticket_id: entry.ticket_id.toString(),
        field_name: entry.field_name,
        old_value: entry.old_value,
        new_value: entry.new_value,
        changed_by: entry.changed_by,
        timestamp: entry.changed_at,
        from_column_id:
          entry.field_name === "column" || entry.field_name === "current_column"
            ? entry.old_value
            : undefined,
        to_column_id:
          entry.field_name === "column" || entry.field_name === "current_column"
            ? entry.new_value
            : undefined,
        duration_in_previous: null,
      }));
      setHistory(convertedHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Fallback to mock data for demo
      setHistory([
        {
          id: "1",
          ticket_id: ticketId,
          from_column_id: "not_started",
          to_column_id: "in_progress",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          duration_in_previous: 43200000,
        },
        {
          id: "2",
          ticket_id: ticketId,
          from_column_id: "in_progress",
          to_column_id: "done",
          timestamp: new Date().toISOString(),
          duration_in_previous: 86400000,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getColumnName = (columnId: string | undefined) => {
    if (!columnId) return "Unknown";
    return columnId
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="ticket-history-overlay" onClick={onClose}>
      <div
        className="ticket-history-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ticket-history-header">
          <h3>Ticket Movement History</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="ticket-history-content">
          {loading && <div className="loading">Loading history...</div>}

          {error && (
            <div className="error-message">
              <span>⚠️ Using demo data (history endpoint not ready)</span>
            </div>
          )}

          {!loading && history.length === 0 && (
            <div className="no-history">No movement history available</div>
          )}

          {!loading && history.length > 0 && (
            <div className="history-timeline">
              {history.map((entry) => (
                <div key={entry.id} className="history-entry">
                  <div className="history-dot"></div>
                  <div className="history-content">
                    {entry.field_name === "column" ||
                    entry.field_name === "current_column" ? (
                      <div className="history-movement">
                        <span className="column-badge from">
                          {getColumnName(entry.old_value || "created")}
                        </span>
                        <span className="arrow">→</span>
                        <span className="column-badge to">
                          {getColumnName(entry.new_value)}
                        </span>
                      </div>
                    ) : (
                      <div className="history-change">
                        <span className="change-field">{entry.field_name}</span>
                        <span className="change-details">
                          changed from "{entry.old_value || "None"}" to "
                          {entry.new_value || "None"}"
                        </span>
                      </div>
                    )}
                    <div className="history-meta">
                      <span className="history-time">
                        {formatDistanceToNow(new Date(entry.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                      <span className="history-user">
                        by {entry.changed_by}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ticket-history-footer">
          <div className="history-stats">
            <div className="stat">
              <span className="stat-label">Total Changes:</span>
              <span className="stat-value">{history.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Column Moves:</span>
              <span className="stat-value">
                {
                  history.filter(
                    (h) =>
                      h.field_name === "column" ||
                      h.field_name === "current_column",
                  ).length
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketHistoryComponent;
