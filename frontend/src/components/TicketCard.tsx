import React, { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Ticket } from "../types";
import { useBoard } from "../context/useBoardHook";
import {
  calculateColumnStatistics,
  getTicketColorClass,
  getTicketTooltip,
  formatTimeInColumn,
} from "../utils/statistics";
import "./TicketCard.css";

interface TicketCardProps {
  ticket: Ticket;
  isDragging?: boolean;
  isSelected?: boolean;
  onSelect?: (ticketId: string, ctrlKey: boolean) => void;
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  isDragging = false,
}) => {
  const { selectTicket, tickets } = useBoard();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: ticket.id,
  });

  // Calculate statistical color class
  const { colorClass, tooltip } = useMemo(() => {
    const excludedColumns = ["not_started", "done"]; // Exclude these from statistical analysis
    const isExcluded = excludedColumns.includes(ticket.column_id);

    const stats = calculateColumnStatistics(
      tickets,
      ticket.column_id,
      excludedColumns,
    );
    const timeInColumn = ticket.time_in_column || 0;

    const color = getTicketColorClass(
      timeInColumn,
      stats,
      isExcluded,
      ticket,
      tickets,
    );
    const tip = getTicketTooltip(timeInColumn, stats, isExcluded, ticket);

    return { colorClass: color, tooltip: tip };
  }, [ticket, tickets]);

  // Show time in column if available
  const timeDisplay = useMemo(() => {
    if (!ticket.time_in_column) return null;
    return formatTimeInColumn(ticket.time_in_column);
  }, [ticket.time_in_column]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectTicket(ticket);
  };

  const priorityDisplay = ticket.priority
    .split(".")
    .filter((p) => p !== "0")
    .join(".");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ticket-card ${isDragging ? "ticket-card--dragging" : ""} ${colorClass}`}
      onClick={handleClick}
      data-id={ticket.id}
      title={tooltip}
      {...attributes}
      {...listeners}
    >
      <div className="ticket-header">
        <span className="ticket-id">#{ticket.id.toString().slice(0, 8)}</span>
        <span className="ticket-priority">P{priorityDisplay || "0"}</span>
      </div>

      <h3 className="ticket-title">{ticket.title}</h3>

      {timeDisplay && (
        <div className="ticket-time-in-column">
          <span className="time-icon">⏱️</span>
          <span className="time-value">{timeDisplay}</span>
        </div>
      )}

      <div className="ticket-footer">
        <div className="ticket-assignee">
          {ticket.assignee ? (
            <>
              <span className="assignee-icon">👤</span>
              <span className="assignee-name">{ticket.assignee}</span>
            </>
          ) : (
            <span className="unassigned">Unassigned</span>
          )}
        </div>
      </div>
    </div>
  );
};

TicketCard.displayName = "TicketCard";

export default TicketCard;
