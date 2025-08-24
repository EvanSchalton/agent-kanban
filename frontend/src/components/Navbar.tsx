import React, { useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BoardContext } from "../context/BoardContext";
import ConnectionStatus from "./ConnectionStatus";
import "./Navbar.css";

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId?: string }>();

  // Safe context access - don't use useBoard hook which throws errors
  const context = useContext(BoardContext);
  const board = context?.board || null;

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {boardId && (
          <button
            className="nav-back-button"
            onClick={() => navigate("/")}
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <svg
              className="back-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="back-text">Dashboard</span>
          </button>
        )}
      </div>

      <div className="navbar-center">
        {board ? (
          <h1 className="navbar-title">{board.name}</h1>
        ) : (
          <h1 className="navbar-title">Agent Kanban Board</h1>
        )}
      </div>

      <div className="navbar-right">
        <ConnectionStatus />
      </div>
    </nav>
  );
};

export default Navbar;
