// src/components/ErrorBoundary.tsx (New file: Add global error boundary)
import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service (e.g., Sentry)
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
          <p className="text-2xl mb-4">Something went wrong</p>
          <p className="text-slate-400 mb-6">{this.state.error?.message || "Unknown error"}</p>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;