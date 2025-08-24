import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Column as ColumnType, Ticket } from "../types";
import TicketCard from "./TicketCard";
import AddCardModal from "./AddCardModal";
import "./Column.css";

interface ColumnProps {
  column: ColumnType;
  tickets: Ticket[];
}

const Column: React.FC<ColumnProps> = React.memo(({ column, tickets }) => {
  const [showAddCard, setShowAddCard] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      columnId: column.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`column ${isOver ? "column--over" : ""}`}
      role="region"
      aria-label={`${column.name} column with ${tickets.length} tickets`}
    >
      <div className="column-header">
        <h2 className="column-title" id={`column-${column.id}-title`}>
          {column.name}
        </h2>
        <div className="column-header-right">
          <span
            className="column-count"
            aria-label={`${tickets.length} tickets`}
          >
            {tickets.length}
          </span>
          <button
            className="add-card-btn"
            onClick={() => setShowAddCard(true)}
            aria-label={`Add card to ${column.name}`}
            title="Add new card"
          >
            +
          </button>
        </div>
      </div>

      <div
        className="column-content"
        role="list"
        aria-labelledby={`column-${column.id}-title`}
        aria-describedby={isOver ? `column-${column.id}-drop-hint` : undefined}
      >
        <SortableContext
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </SortableContext>

        {tickets.length === 0 && (
          <div className="column-empty">Drop tickets here</div>
        )}
      </div>

      {showAddCard && (
        <AddCardModal
          columnId={column.id}
          onClose={() => setShowAddCard(false)}
        />
      )}
    </div>
  );
});

Column.displayName = "Column";

export default Column;
