import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { boardApi } from "../services/api";
import CreateBoardModal from "./CreateBoardModal";
import EditBoardModal from "./EditBoardModal";
import BoardCard from "./BoardCard";
import type { Board } from "../types";
import "./Dashboard.css";

interface BoardWithStats extends Board {
  ticket_count?: number;
}

const Dashboard = () => {
  const [boards, setBoards] = useState<BoardWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState<BoardWithStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      setError(null);
      const data = await boardApi.list();
      setBoards(data as BoardWithStats[]);
    } catch (error) {
      console.error("Failed to load boards:", error);
      setError("Failed to load boards. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async (boardData: {
    name: string;
    description?: string;
  }) => {
    try {
      const newBoard = await boardApi.create(boardData);
      setBoards([...boards, newBoard as BoardWithStats]);
      setShowCreateModal(false);
    } catch (error: any) {
      console.error("Failed to create board:", error);
      const errorMessage =
        error.message || "Failed to create board. Please try again.";
      setError(errorMessage);
      throw error; // Re-throw to let CreateBoardModal handle it
    }
  };

  const handleViewBoard = (boardId: string) => {
    navigate(`/board/${boardId}`);
  };

  const handleEditBoard = (board: BoardWithStats) => {
    setEditingBoard(board);
  };

  const handleBoardUpdated = (updatedBoard: Board) => {
    setBoards(
      boards.map((b) =>
        b.id === updatedBoard.id
          ? ({
              ...updatedBoard,
              ticket_count: b.ticket_count,
            } as BoardWithStats)
          : b,
      ),
    );
    setEditingBoard(null);
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this board? All tickets will be deleted.",
      )
    ) {
      return;
    }

    try {
      await boardApi.delete(boardId);
      setBoards(boards.filter((b) => b.id !== boardId));
    } catch (error) {
      console.error("Failed to delete board:", error);
      setError("Failed to delete board. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading boards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={loadBoards} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="dashboard">
        <div className="empty-state">
          <svg
            className="empty-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <h2>No boards yet</h2>
          <p>Create your first board to get started organizing your tasks</p>
          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create Your First Board
          </button>
          {showCreateModal && (
            <CreateBoardModal
              onClose={() => setShowCreateModal(false)}
              onCreate={handleCreateBoard}
            />
          )}
          {editingBoard && (
            <EditBoardModal
              board={editingBoard}
              onClose={() => setEditingBoard(null)}
              onSaved={handleBoardUpdated}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Kanban Dashboard</h1>
          <p className="dashboard-subtitle">Manage your boards and projects</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <svg
            className="btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Board
        </button>
      </header>

      <div className="board-grid">
        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            ticketCount={board.ticket_count}
            onView={() => handleViewBoard(board.id)}
            onEdit={() => handleEditBoard(board)}
            onDelete={() => handleDeleteBoard(board.id)}
          />
        ))}
      </div>

      {showCreateModal && (
        <CreateBoardModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateBoard}
        />
      )}

      {editingBoard && (
        <EditBoardModal
          board={editingBoard}
          onClose={() => setEditingBoard(null)}
          onSaved={handleBoardUpdated}
        />
      )}
    </div>
  );
};

export default Dashboard;
