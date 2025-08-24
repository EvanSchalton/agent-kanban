import { useEffect, useRef, useState, useCallback } from "react";
import type { WebSocketMessage } from "../types";

export function useWebSocket(
  url: string,
  onMessage: (message: WebSocketMessage) => void,
  username?: string,
) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastPongRef = useRef<number>(Date.now());

  const connect = useCallback(
    (resetAttempts = false) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      if (resetAttempts) {
        reconnectAttemptsRef.current = 0;
        setConnectionError(null);
      }

      try {
        // Add username to WebSocket URL if provided
        const wsUrl = username
          ? `${url}?username=${encodeURIComponent(username)}`
          : url;
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log("WebSocket connected");
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
          lastPongRef.current = Date.now();

          // Start heartbeat mechanism
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }

          heartbeatIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              // Check if we haven't received any keep-alive in 45 seconds (backend heartbeat is every 30s)
              if (Date.now() - lastPongRef.current > 45000) {
                console.warn(
                  "No keep-alive received in 45 seconds, reconnecting...",
                );
                wsRef.current?.close();
                return;
              }

              // Send ping every 20 seconds (backend sends heartbeat every 30s)
              wsRef.current.send(JSON.stringify({ type: "ping" }));
            }
          }, 20000); // Send ping every 20 seconds
        };

        wsRef.current.onclose = (event) => {
          console.log("WebSocket disconnected:", event.code, event.reason);
          setIsConnected(false);

          // Auto-reconnect unless it's a normal closure
          if (event.code !== 1000 && reconnectAttemptsRef.current < 10) {
            const backoffDelay = Math.min(
              1000 * Math.pow(1.5, reconnectAttemptsRef.current),
              30000,
            );
            reconnectAttemptsRef.current++;

            console.log(
              `Scheduling reconnect attempt ${reconnectAttemptsRef.current}/10 in ${backoffDelay}ms`,
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(
                `Attempting to reconnect... (attempt ${reconnectAttemptsRef.current})`,
              );
              connect();
            }, backoffDelay);
          } else if (reconnectAttemptsRef.current >= 10) {
            console.error("Max reconnection attempts reached");
            setConnectionError("Connection failed after multiple attempts");
          }
        };

        wsRef.current.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionError("WebSocket connection failed");
          setIsConnected(false);
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Handle pong messages for heartbeat
            if (message.type === "pong") {
              lastPongRef.current = Date.now();
              return;
            }

            // Handle server heartbeat messages
            if (message.event === "heartbeat") {
              lastPongRef.current = Date.now(); // Count heartbeat as keep-alive

              // Respond to server heartbeat if expected
              if (
                message.expect_response &&
                wsRef.current?.readyState === WebSocket.OPEN
              ) {
                wsRef.current.send(
                  JSON.stringify({
                    type: "heartbeat_response",
                    heartbeat_id: message.heartbeat_id,
                    timestamp: new Date().toISOString(),
                  }),
                );
              }
              return;
            }

            // Handle heartbeat acknowledgments
            if (message.event === "heartbeat_ack") {
              lastPongRef.current = Date.now();
              return;
            }

            // Handle different message formats from backend
            if (message.event) {
              // Backend sends events in format: { event: "ticket_updated", data: {...} }
              onMessage({ type: message.event, data: message.data });
            } else if (message.type) {
              // Direct message format
              onMessage(message);
            }
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };
      } catch (error) {
        console.error("Failed to initialize WebSocket:", error);
        setConnectionError("Failed to initialize WebSocket connection");
      }
    },
    [url, onMessage, username],
  );

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    } else {
      console.warn("Cannot send message: WebSocket is not connected");
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const manualReconnect = useCallback(() => {
    console.log("Manual reconnect requested");
    disconnect();
    setTimeout(() => connect(true), 100);
  }, [disconnect, connect]);

  return {
    isConnected,
    connectionError,
    sendMessage,
    reconnect: manualReconnect,
    disconnect,
  };
}
