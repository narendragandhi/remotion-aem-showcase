import React, { Component, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { SpotlightError, getErrorMessage } from "../errors";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component for catching and displaying errors gracefully.
 * Renders a styled fallback UI instead of crashing the entire composition.
 */
export class SpotlightErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[SpotlightErrorBoundary] Caught error:", error);
    console.error("[SpotlightErrorBoundary] Component stack:", errorInfo.componentStack);

    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallbackUI
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackUIProps {
  error: Error | null;
  onRetry?: () => void;
}

/**
 * Default fallback UI displayed when an error is caught.
 * Styled to be visually appropriate within a video composition.
 */
export const ErrorFallbackUI: React.FC<ErrorFallbackUIProps> = ({ error }) => {
  const isRecoverable = error instanceof SpotlightError && error.recoverable;
  const errorCode = error instanceof SpotlightError ? error.code : "UNKNOWN_ERROR";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "4rem",
          marginBottom: "1rem",
        }}
      >
        {isRecoverable ? "⚠️" : "❌"}
      </div>
      <h1
        style={{
          fontSize: "2rem",
          margin: "0 0 0.5rem 0",
          fontWeight: 600,
        }}
      >
        {isRecoverable ? "Content Temporarily Unavailable" : "Rendering Error"}
      </h1>
      <p
        style={{
          fontSize: "1rem",
          opacity: 0.8,
          margin: "0 0 1rem 0",
          maxWidth: "40rem",
          textAlign: "center",
        }}
      >
        {getErrorMessage(error)}
      </p>
      <div
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: "0.25rem",
          fontSize: "0.875rem",
          fontFamily: "monospace",
        }}
      >
        Error Code: {errorCode}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Loading state component for async operations.
 */
export const LoadingFallback: React.FC<{ message?: string }> = ({
  message = "Loading...",
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0E3B5A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          width: "3rem",
          height: "3rem",
          border: "3px solid rgba(255, 255, 255, 0.2)",
          borderTopColor: "#ffffff",
          borderRadius: "50%",
          marginBottom: "1rem",
          animation: "spin 1s linear infinite",
        }}
      />
      <p style={{ fontSize: "1.25rem", opacity: 0.9 }}>{message}</p>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </AbsoluteFill>
  );
};

/**
 * Asset error placeholder for failed image/Lottie loads.
 */
export const AssetErrorPlaceholder: React.FC<{
  assetType: "image" | "lottie" | "svg";
  width?: string | number;
  height?: string | number;
}> = ({ assetType, width = "100%", height = "100%" }) => {
  const icons = {
    image: "🖼️",
    lottie: "🎬",
    svg: "📐",
  };

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "rgba(0, 0, 0, 0.2)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "0.5rem",
        border: "2px dashed rgba(255, 255, 255, 0.3)",
      }}
    >
      <span style={{ fontSize: "2rem" }}>{icons[assetType]}</span>
      <span
        style={{
          fontSize: "0.75rem",
          opacity: 0.6,
          marginTop: "0.5rem",
          textTransform: "uppercase",
        }}
      >
        {assetType} unavailable
      </span>
    </div>
  );
};
