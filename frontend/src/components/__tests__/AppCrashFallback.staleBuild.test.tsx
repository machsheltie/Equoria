/**
 * A tab left open across a deploy asks for a page chunk that no longer exists
 * (Equoria-bvddn.32). Real ErrorBoundary, real AppCrashFallback, a real lazy
 * import that rejects the way the browser rejects it.
 */
import { lazy, Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';
import AppCrashFallback from '../AppCrashFallback';

const STALE = 'Failed to fetch dynamically imported module: https://x/assets/HorsePage-abc.js';

function renderTree(error: Error) {
  const Page = lazy(() => Promise.reject(error));
  return render(
    <ErrorBoundary
      fallback={({ reset, error: caught }) => <AppCrashFallback onRetry={reset} error={caught} />}
    >
      <Suspense fallback={<p>loading</p>}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  );
}

describe('AppCrashFallback after a deploy', () => {
  let reload: ReturnType<typeof vi.fn>;
  const original = window.location;

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('reloads once for the new build instead of showing the crash card', async () => {
    renderTree(new TypeError(STALE));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('after a reload already happened, says the game was updated and offers a reload, not "something went wrong"', async () => {
    window.sessionStorage.setItem('equoria:staleBuildReloadAt', String(Date.now()));
    renderTree(new TypeError(STALE));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/updated/i);
    expect(alert).not.toHaveTextContent(/something went wrong/i);
    expect(reload).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('an ordinary render error still shows the generic card and never reloads', async () => {
    renderTree(new Error('Cannot read properties of undefined'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(reload).not.toHaveBeenCalled();
  });
});
