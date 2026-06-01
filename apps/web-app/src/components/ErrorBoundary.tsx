"use client";

import { Component, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";

/**
 * Props and State types
 */
type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * React Error Boundary Class Component
 *
 * Required because error boundaries must be class components
 */
class ErrorBoundaryClass extends Component<
  ErrorBoundaryProps & { onReset?: () => void },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to error reporting service
    console.error("Error caught by boundary:", error, errorInfo);
  }

  handleReset = () => {
    // Call TanStack Query reset if provided
    this.props.onReset?.();

    // Reset error boundary state
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default error UI
      return (
        <div className="bg-[#1a1a1a] border border-[#334eac] rounded p-6 m-4">
          <div className="flex flex-col items-center text-center">
            <span className="text-3xl mb-3">⚠️</span>
            <h2 className="text-white text-lg font-semibold">Something went wrong</h2>
            <p className="text-[#bad6eb] mt-2 text-sm max-w-md">
              {this.state.error.message || "An unexpected error occurred."}
            </p>
            <details className="w-full text-left mt-4 text-[#bad6eb] text-xs">
              <summary className="cursor-pointer mb-2">Technical details</summary>
              <div className="p-3 bg-black/20 rounded overflow-x-auto border border-[#334eac]/30">
                {this.state.error.stack}
              </div>
            </details>
            <button
              onClick={this.handleReset}
              className="mt-5 px-4 py-2 bg-[#294cab] hover:bg-[#7096d1] text-white rounded text-sm transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error Boundary with TanStack Query Reset
 *
 * Wraps components and catches errors thrown by queries
 * with throwOnError: true
 */
export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundaryClass onReset={reset} fallback={fallback}>
          {children}
        </ErrorBoundaryClass>
      )}
    </QueryErrorResetBoundary>
  );
}
