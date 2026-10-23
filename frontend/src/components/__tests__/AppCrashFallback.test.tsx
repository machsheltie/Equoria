/**
 * The app-level crash fallback is the restyled ErrorCard, not a bare paragraph
 * (Equoria-oey96.57, Story 30.2, FRONTEND_ASYNC_STATE_DOCTRINE §3 render-crash row).
 *
 * The boundary sits ABOVE every provider (QueryClient, Auth, Router), so these
 * cases render with no providers at all: the fallback must survive a crashed
 * provider tree. Real ErrorBoundary and real fallback; only the child throws.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';
import AppCrashFallback from '../AppCrashFallback';

let shouldThrow = true;

function SometimesBoom() {
  if (shouldThrow) throw new Error('render exploded');
  return <p>stable is back</p>;
}

function renderBoundary() {
  return render(
    <ErrorBoundary fallback={({ reset }) => <AppCrashFallback onRetry={reset} />}>
      <SometimesBoom />
    </ErrorBoundary>
  );
}

describe('AppCrashFallback inside ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    shouldThrow = true;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders the announced ErrorCard with Try Again and Go Home when a descendant throws', () => {
    renderBoundary();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(alert).not.toHaveTextContent('render exploded');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  it('Try Again resets the boundary and the children render again', async () => {
    renderBoundary();
    expect(screen.queryByText('stable is back')).not.toBeInTheDocument();

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('stable is back')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Try Again shows the card again when the child still throws', async () => {
    renderBoundary();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('Go Home leaves the crashed tree for the root address', async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, assign },
    });
    try {
      renderBoundary();
      await userEvent.click(screen.getByRole('button', { name: /go home/i }));
      expect(assign).toHaveBeenCalledWith('/');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});
