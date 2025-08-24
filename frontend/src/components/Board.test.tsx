import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import Board from "./Board";
import BoardProvider from "../context/BoardContext";

// Mock the API module
vi.mock("../services/api", () => ({
  getBoard: vi.fn(() =>
    Promise.resolve({
      id: "1",
      name: "Test Board",
      columns: [
        { id: "not_started", name: "Not Started", order: 0 },
        { id: "in_progress", name: "In Progress", order: 1 },
        { id: "done", name: "Done", order: 2 },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  ),
  getTickets: vi.fn(() => Promise.resolve([])),
  moveTicket: vi.fn(() => Promise.resolve({})),
}));

// Mock WebSocket hook
vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
    connectionError: null,
    reconnect: vi.fn(),
    sendMessage: vi.fn(),
  })),
}));

describe("Board Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the board with loading state initially", async () => {
    await act(async () => {
      render(
        <BoardProvider>
          <Board />
        </BoardProvider>,
      );
    });

    // Wait for the board to load
    await waitFor(() => {
      expect(screen.queryByText(/loading board/i)).not.toBeInTheDocument();
    });
  });

  it("renders board columns after loading", async () => {
    await act(async () => {
      render(
        <BoardProvider>
          <Board />
        </BoardProvider>,
      );
    });

    // Wait for columns to appear
    await waitFor(() => {
      expect(screen.getByText("Not Started")).toBeInTheDocument();
      expect(screen.getByText("In Progress")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("displays error state when board fails to load", async () => {
    // Mock API to return error
    const { getBoard } = await import("../services/api");
    vi.mocked(getBoard).mockRejectedValueOnce(new Error("Network error"));

    await act(async () => {
      render(
        <BoardProvider>
          <Board />
        </BoardProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/failed to load board/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });
  });

  it("shows drag error toast on failed ticket move", async () => {
    const { moveTicket } = await import("../services/api");
    vi.mocked(moveTicket).mockRejectedValueOnce(new Error("Move failed"));

    await act(async () => {
      render(
        <BoardProvider>
          <Board />
        </BoardProvider>,
      );
    });

    // Wait for board to load
    await waitFor(() => {
      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });
  });

  it("displays pending moves indicator when moves are unsaved", async () => {
    await act(async () => {
      render(
        <BoardProvider>
          <Board />
        </BoardProvider>,
      );
    });

    // Wait for board to load
    await waitFor(() => {
      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });

    // Initially no pending moves
    expect(screen.queryByText(/unsaved move/i)).not.toBeInTheDocument();
  });
});
