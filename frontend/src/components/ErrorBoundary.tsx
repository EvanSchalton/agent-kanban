import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isNetworkError =
        this.state.error?.message?.includes("Network Error") ||
        this.state.error?.message?.includes("Failed to fetch") ||
        this.state.error?.message?.includes("Connection refused");

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">{isNetworkError ? "🔌" : "⚠️"}</div>
            <h3>
              {isNetworkError
                ? "Backend Connection Lost"
                : "Something went wrong"}
            </h3>
            <p>
              {isNetworkError
                ? "Unable to connect to the backend server. The server may have crashed or restarted."
                : "An error occurred while rendering this component."}
            </p>
            <details className="error-details">
              <summary>Error details</summary>
              <pre className="error-stack">
                {this.state.error?.stack || this.state.error?.message}
              </pre>
            </details>
            <div className="error-actions">
              <button
                className="retry-button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                }}
              >
                {isNetworkError ? "Retry Connection" : "Try Again"}
              </button>
              <button
                className="reload-button"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
