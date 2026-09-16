import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Top-level error boundary.
 *
 * Replaces Sentry.ErrorBoundary, which wrapped the whole app until Sentry was
 * removed from the project on 2026-09-16 (Equoria-94bix). The boundary itself
 * is player-facing resilience, not telemetry: without it an uncaught render
 * error unmounts the tree and leaves a blank page. Dropping the vendor must not
 * cost players the fallback, so the same fallback is kept here with no
 * third-party dependency.
 *
 * React requires a class component for error boundaries; there is no hook
 * equivalent for componentDidCatch.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // The browser console is the only sink now. Keep the component stack: it is
    // what makes an uncaught render error diagnosable from a bug report.
    console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
