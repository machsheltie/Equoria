/**
 * RewardToastProvider Tests (Equoria-vcar, Spec 11.3.10)
 *
 * The trigger layer that wires the (previously orphaned) RewardToast to
 * meaningful-progress events. Verifies:
 *   - meaningful events surface a toast (level-up, trait, threshold cross…)
 *   - routine gains (routine === true) do NOT toast
 *   - multiple events queue sequentially (one visible at a time)
 *   - role=status / aria-live=polite preserved
 *   - manual dismiss works
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RewardToastProvider, useRewardToast } from '../RewardToastProvider';

function Harness() {
  const { notify } = useRewardToast();
  return (
    <div>
      <button
        onClick={() => notify({ type: 'level-up', title: 'Level 5 reached!', meaningful: true })}
      >
        meaningful
      </button>
      <button
        onClick={() => notify({ type: 'level-up', title: 'Routine +5 XP', meaningful: false })}
      >
        routine
      </button>
      <button
        onClick={() => {
          notify({ type: 'trait', title: 'First toast', meaningful: true });
          notify({ type: 'milestone', title: 'Second toast', meaningful: true });
        }}
      >
        burst
      </button>
    </div>
  );
}

describe('RewardToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast for a meaningful event', () => {
    render(
      <RewardToastProvider>
        <Harness />
      </RewardToastProvider>
    );
    fireEvent.click(screen.getByText('meaningful'));
    const status = document.body.querySelector('[role="status"]');
    expect(status).toBeInTheDocument();
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('Level 5 reached!')).toBeInTheDocument();
  });

  it('does NOT show a toast for a routine (non-meaningful) gain', () => {
    render(
      <RewardToastProvider>
        <Harness />
      </RewardToastProvider>
    );
    fireEvent.click(screen.getByText('routine'));
    expect(document.body.querySelector('[role="status"]')).toBeNull();
  });

  it('queues multiple events sequentially — only one visible at a time', () => {
    render(
      <RewardToastProvider>
        <Harness />
      </RewardToastProvider>
    );
    fireEvent.click(screen.getByText('burst'));
    expect(document.body.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.queryByText('Second toast')).not.toBeInTheDocument();

    // Auto-dismiss first (3s, Spec 11.3.10) + 0.5s inter-toast gap → second.
    act(() => {
      vi.advanceTimersByTime(3000 + 500 + 50);
    });
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('auto-dismisses after 3s by default (Spec 11.3.10 "visible 3 seconds")', () => {
    render(
      <RewardToastProvider>
        <Harness />
      </RewardToastProvider>
    );
    fireEvent.click(screen.getByText('meaningful'));
    expect(screen.getByText('Level 5 reached!')).toBeInTheDocument();
    // Still visible just before 3s.
    act(() => {
      vi.advanceTimersByTime(2900);
    });
    expect(screen.getByText('Level 5 reached!')).toBeInTheDocument();
    // Gone after 3s.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Level 5 reached!')).not.toBeInTheDocument();
  });

  it('manual dismiss removes the toast', () => {
    render(
      <RewardToastProvider>
        <Harness />
      </RewardToastProvider>
    );
    fireEvent.click(screen.getByText('meaningful'));
    expect(screen.getByText('Level 5 reached!')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByText('Level 5 reached!')).not.toBeInTheDocument();
  });
});
