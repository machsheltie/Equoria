/**
 * ErrorCard / ErrorState — focus moves to the error heading (Equoria-3r6n3;
 * FRONTEND_ASYNC_STATE_DOCTRINE section 5).
 *
 * ErrorState's own documentation promised a focusable heading while ErrorCard
 * rendered a plain h3. A keyboard or screen-reader user who triggered a load
 * that failed was left on a removed control with nothing announced where they
 * were. These tests pin the shipped behaviour: the heading takes focus when the
 * error appears, unless the player is already working in another control or the
 * caller opts out.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorCard } from '../ErrorCard';
import { ErrorState } from '../state/ErrorState';

describe('ErrorCard focus management (Equoria-3r6n3)', () => {
  it('moves focus to its heading on mount and stays an alert', () => {
    render(<ErrorCard title="Could not load horses" message="Try again soon." />);

    const heading = screen.getByRole('heading', { name: 'Could not load horses' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading).toHaveFocus();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('leaves focus alone when the caller opts out (inline, non-blocking contexts)', () => {
    render(<ErrorCard title="Could not load horses" focusOnMount={false} />);

    expect(screen.getByRole('heading', { name: 'Could not load horses' })).not.toHaveFocus();
  });

  it('does not pull focus out of a control the player is already using', () => {
    const field = (
      <>
        <label htmlFor="search">Search</label>
        <input id="search" />
      </>
    );
    const { rerender } = render(
      <>
        {field}
        {null}
      </>
    );
    screen.getByLabelText('Search').focus();

    // The error appears while she is typing in the search box.
    rerender(
      <>
        {field}
        <ErrorCard title="Could not load horses" />
      </>
    );

    expect(screen.getByLabelText('Search')).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Could not load horses' })).not.toHaveFocus();
  });

  it('ErrorState passes the heading focus through, and its opt-out too', () => {
    const { unmount } = render(<ErrorState title="Section failed" message="Please retry." />);
    expect(screen.getByRole('heading', { name: 'Section failed' })).toHaveFocus();
    unmount();

    render(<ErrorState title="Quiet failure" focusOnMount={false} />);
    expect(screen.getByRole('heading', { name: 'Quiet failure' })).not.toHaveFocus();
  });
});
