import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import BoardProvider from "./context/BoardContext";
import Dashboard from "./components/Dashboard";
import Board from "./components/Board";
import Navbar from "./components/Navbar";
import SearchFilter from "./components/SearchFilter";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

function BoardView() {
  return (
    <BoardProvider>
      <div className="app">
        <Navbar />
        <main className="app-main">
          <ErrorBoundary>
            <SearchFilter />
          </ErrorBoundary>
          <ErrorBoundary>
            <Board />
          </ErrorBoundary>
        </main>
      </div>
    </BoardProvider>
  );
}

function DashboardView() {
  return (
    <div className="app">
      <Navbar />
      <main className="app-main">
        <ErrorBoundary>
          <Dashboard />
        </ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/board/:boardId" element={<BoardView />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
