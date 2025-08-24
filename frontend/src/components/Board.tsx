import React, { useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
// Removed SortableContext - columns are not sortable, only droppable
import { useBoard } from "../context/useBoardHook";
import Column from "./Column";
import TicketCard from "./TicketCard";
import TicketDetail from "./TicketDetail";
import type { Ticket } from "../types";
import { moveTicket as moveTicketAPI } from "../services/api";
import "./Board.css";

const Board: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  console.log("🔍 Board.tsx - boardId from URL params:", boardId);

  const {
    board,
    filteredTickets,
    loading,
    error,
    selectedTicket,
    moveTicket: updateTicketPosition,
    retryLoad,
    loadBoard,
  } = useBoard();

  // Valid column IDs for drag & drop
  const VALID_COLUMN_IDS = [
    "not_started",
    "in_progress",
    "blocked",
    "ready_for_qc",
    "done",
  ];
  const [activeTicket, setActiveTicket] = React.useState<Ticket | null>(null);
  const [isDragError, setIsDragError] = React.useState<boolean>(false);

  // Load board when boardId changes
  useEffect(() => {
    if (boardId) {
      loadBoard(boardId);
    }
  }, [boardId, loadBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    // Optimized touch sensor for mobile devices
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
  );

  const ticketsByColumn = useMemo(() => {
    const map = new Map<string, Ticket[]>();

    board?.columns.forEach((column) => {
      map.set(column.id, []);
    });

    filteredTickets.forEach((ticket) => {
      const columnTickets = map.get(ticket.column_id) || [];
      columnTickets.push(ticket);
      map.set(ticket.column_id, columnTickets);
    });

    map.forEach((columnTickets) => {
      columnTickets.sort((a, b) => {
        const priorityA = (a.priority || "0").split(".").map(Number);
        const priorityB = (b.priority || "0").split(".").map(Number);

        for (let i = 0; i < Math.max(priorityA.length, priorityB.length); i++) {
          const numA = priorityA[i] || 0;
          const numB = priorityB[i] || 0;
          if (numA !== numB) {
            return numA - numB;
          }
        }
        return 0;
      });
    });

    return map;
  }, [board, filteredTickets]);

  const handleDragStart = (event: DragStartEvent) => {
    const ticketId = event.active.id as string;
    const ticket = filteredTickets.find((t) => t.id === ticketId);
    if (ticket) {
      setActiveTicket(ticket);
      setIsDragError(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, collisions, delta } = event;
    setActiveTicket(null);

    console.log("Drag ended:", {
      activeId: active.id,
      overId: over?.id,
      overData: over?.data,
      collisions: collisions?.map((c) => ({ id: c.id, type: typeof c.id })),
      delta,
    });

    if (!over) {
      console.log("No drop target - cancelling drag");
      return;
    }

    const ticketId = active.id as string;

    // Get the target column ID - could be from column data or need to find from dropped ticket
    let targetColumnId: string;

    if (over.data.current?.columnId) {
      // Dropped directly on a column
      targetColumnId = over.data.current.columnId;
      console.log("✅ Dropped directly on column:", targetColumnId);
    } else if (VALID_COLUMN_IDS.includes(over.id as string)) {
      // Dropped directly on a column ID
      targetColumnId = over.id as string;
      console.log("✅ Dropped on column ID:", targetColumnId);
    } else {
      // Check if dropped on itself (happens when dropping on empty column space)
      if (over.id === active.id) {
        console.log(
          "Card dropped on itself - checking for column collisions...",
        );

        // Try to find column from collisions - prioritize actual column IDs
        if (collisions && collisions.length > 0) {
          console.log(
            "DEBUGGING: Collisions data:",
            collisions.map((c) => ({
              id: c.id,
              type: typeof c.id,
              isValid: VALID_COLUMN_IDS.includes(c.id as string),
            })),
          );

          // Look for a column in the collisions - find the LAST valid column (target)
          const validColumns = collisions
            .filter((c) => VALID_COLUMN_IDS.includes(c.id as string))
            .map((c) => c.id as string);

          if (validColumns.length > 0) {
            // If multiple columns, take the last one (likely the target)
            targetColumnId = validColumns[validColumns.length - 1];
            console.log(
              "✅ Found column from collisions:",
              targetColumnId,
              "from options:",
              validColumns,
            );
          } else {
            console.log("❌ No valid column IDs found in collisions");
            return;
          }
        } else {
          console.log("❌ No collisions data available");
          return;
        }
      } else {
        // Dropped on another ticket - find which column that ticket is in
        const targetTicket = filteredTickets.find((t) => t.id === over.id);
        if (targetTicket) {
          // CRITICAL: Validate the target ticket's column_id to prevent corruption chain
          if (VALID_COLUMN_IDS.includes(targetTicket.column_id)) {
            targetColumnId = targetTicket.column_id;
            console.log(
              "✅ Dropped on ticket, using its column:",
              targetColumnId,
            );
          } else {
            console.error(
              "🚨 CORRUPTION PREVENTED: Target ticket has invalid column_id:",
              targetTicket.column_id,
            );
            console.error("🚨 Ticket data:", targetTicket);
            console.error(
              "🚨 This would have propagated the corruption! Aborting drag.",
            );
            return;
          }
        } else {
          console.log("❌ Unknown drop target:", over.id);
          return;
        }
      }
    }

    // FINAL VALIDATION: Ensure target column is valid before API call
    if (!VALID_COLUMN_IDS.includes(targetColumnId)) {
      console.error(
        "🚨 FINAL CORRUPTION PREVENTION: Invalid targetColumnId:",
        targetColumnId,
      );
      console.error("🚨 Valid columns:", VALID_COLUMN_IDS);
      console.error("🚨 This would have caused data corruption! Aborting.");
      return;
    }

    console.log("Processing move:", {
      ticketId,
      targetColumnId,
      droppedOn: over.data.current?.columnId ? "column" : "ticket",
      overId: over.id,
      overData: over.data,
      expectedFormat:
        "Should be like: not_started, in_progress, blocked, ready_for_qc, done",
    });

    const ticket = filteredTickets.find((t) => t.id === ticketId);
    if (!ticket) {
      console.error("Ticket not found:", ticketId);
      return;
    }

    if (ticket.column_id === targetColumnId) {
      console.log("Same column - no move needed");
      return;
    }

    // Optimistic update
    updateTicketPosition(ticketId, targetColumnId);

    try {
      console.log("Calling moveTicketAPI with:", {
        ticketId,
        targetColumnId,
        ticketIdType: typeof ticketId,
        targetColumnIdType: typeof targetColumnId,
      });
      await moveTicketAPI(ticketId, targetColumnId);
      // Don't dispatch UPDATE_TICKET here - let WebSocket handle the authoritative update
      // The optimistic update is already applied, and WebSocket will confirm/correct it
      setIsDragError(false);

      // Add success feedback - briefly highlight the moved ticket
      const movedTicketElement = document.querySelector(
        `[data-id="${ticketId}"]`,
      );
      if (movedTicketElement) {
        movedTicketElement.classList.add("ticket-card--success");
        setTimeout(() => {
          movedTicketElement.classList.remove("ticket-card--success");
        }, 1000);
      }
    } catch (error: any) {
      console.error("Failed to move ticket:", error);
      console.error("Error details:", {
        ticketId,
        targetColumnId,
        originalColumnId: ticket.column_id,
        errorMessage: error.message,
        errorStack: error.stack,
      });

      // Revert the optimistic update on error
      updateTicketPosition(ticketId, ticket.column_id);
      setIsDragError(true);

      // Add error feedback - shake the ticket
      const errorTicketElement = document.querySelector(
        `[data-id="${ticketId}"]`,
      );
      if (errorTicketElement) {
        errorTicketElement.classList.add("ticket-card--error");
        setTimeout(() => {
          errorTicketElement.classList.remove("ticket-card--error");
        }, 500);
      }

      // Clear error after 5 seconds
      setTimeout(() => setIsDragError(false), 5000);
    }
  };

  if (loading) {
    return (
      <div className="board-loading">
        <div className="loading-spinner"></div>
        <p>Loading board...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="board-error">
        <div className="error-icon">⚠️</div>
        <h3>Failed to load board</h3>
        <p>{error}</p>
        <button onClick={retryLoad} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="board-empty">
        <div className="empty-icon">📋</div>
        <h3>No board found</h3>
        <p>Please create a board to get started</p>
      </div>
    );
  }

  return (
    <>
      {isDragError && (
        <div className="drag-error-toast">
          Failed to move ticket. Please try again.
        </div>
      )}

      <div className="board">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="board-columns">
            {board.columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                tickets={ticketsByColumn.get(column.id) || []}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTicket && (
              <div className="ticket-card-drag-overlay">
                <TicketCard ticket={activeTicket} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedTicket && <TicketDetail />}
    </>
  );
};

export default Board;
