import { useContext } from "react";
import { BoardContext } from "../context/BoardContext";
import "./ConnectionStatus.css";

export default function ConnectionStatus() {
  // Safe context access - don't use useBoard hook which throws errors
  const context = useContext(BoardContext);
  const wsConnected = context?.wsConnected || false;
  const wsError = context?.wsError || false;
  const reconnectWebSocket = context?.reconnectWebSocket || (() => {});

  if (wsConnected) {
    return (
      <div className="connection-status connected">
        <div className="status-indicator"></div>
        <span>Connected</span>
      </div>
    );
  }

  if (wsError) {
    return (
      <div className="connection-status disconnected">
        <div className="status-indicator"></div>
        <span>Disconnected</span>
        <button
          className="reconnect-btn"
          onClick={reconnectWebSocket}
          title="Reconnect to server"
        >
          ↻
        </button>
      </div>
    );
  }

  return (
    <div className="connection-status connecting">
      <div className="status-indicator"></div>
      <span>Connecting...</span>
    </div>
  );
}
