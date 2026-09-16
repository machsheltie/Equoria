/**
 * Behavioural coverage for the top-level error boundary (Codex review
 * 2026-09-16, item 6).
 *
 * This component replaced Sentry.ErrorBoundary when Sentry was removed
 * (Equoria-94bix). The boundary is player-facing resilience, not telemetry:
 * without it an uncaught render error unmounts the tree and leaves a blank
 * page. These cases pin the two behaviours that matter — normal children render
 * untouched, and a throwing descendant produces the fallback instead of nothing.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

function Boom(): JSX.Element {
  throw new Error('render exploded');
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs the caught error itself; silence it so a PASSING run has clean
    // output, while still asserting our own componentDidCatch call below.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<p>Something went wrong.</p>}>
        <p>stable content</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('stable content')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();
  });

  it('renders the fallback when a descendant throws during render', () => {
    render(
      <ErrorBoundary fallback={<p>Something went wrong.</p>}>
        <Boom />
      </ErrorBoundary>
    );

    // The fallback is shown rather than an empty document — this is the whole
    // point of keeping a boundary after dropping the vendor one.
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });

  it('reports the caught error so an uncaught render error stays diagnosable', () => {
    render(
      <ErrorBoundary fallback={<p>Something went wrong.</p>}>
        <Boom />
      </ErrorBoundary>
    );

    const reported = consoleError.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('[ErrorBoundary]')
    );
    expect(reported).toBe(true);
  });
});
