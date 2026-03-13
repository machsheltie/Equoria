/**
 * RewardToast Component Tests
 *
 * Tests the portal-based reward toast notification with auto-dismiss.
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RewardToast, type RewardType } from '../RewardToast';

describe('RewardToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders as a portal in document.body', () => {
    const onDismiss = vi.fn();
    render(<RewardToast type="prize" title="You won!" onDismiss={onDismiss} />);
    // The toast should be rendered in body, not in the render container
    const status = document.body.querySelector('[role="status"]');
    expect(status).toBeInTheDocument();
  });

  it('displays the title', () => {
    const onDismiss = vi.fn();
    render(<RewardToast type="prize" title="Prize Won" onDismiss={onDismiss} />);
    expect(screen.getByText('Prize Won')).toBeInTheDocument();
  });

  it('displays the message when provided', () => {
    const onDismiss = vi.fn();
    render(
      <RewardToast type="prize" title="Won!" message="1st place in Dressage" onDismiss={onDismiss} />
    );
    expect(screen.getByText('1st place in Dressage')).toBeInTheDocument();
  });

  it('does not render message when not provided', () => {
    const onDismiss = vi.fn();
    render(<RewardToast type="prize" title="Won!" onDismiss={onDismiss} />);
    // Only title should be visible
    expect(screen.getByText('Won!')).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    const onDismiss = vi.fn();
    render(<RewardToast type="prize" title="Won!" onDismiss={onDismiss} />);
    const status = document.body.querySelector('[role="status"]');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<RewardToast type="prize" title="Won!" onDismiss={onDismiss} />);
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss notification' });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after default duration (4000ms)', () => {
    const onDismiss = vi.fn();
    render(<RewardToast type="prize" title="Won!" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after custom duration', () => {
    const onDismiss = vi.fn();
    render(<RewardToast type="prize" title="Won!" duration={2000} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  describe('Type icons', () => {
    const types: RewardType[] = ['prize', 'level-up', 'trait', 'foal-born', 'milestone'];

    types.forEach((type) => {
      it(`renders ${type} type without errors`, () => {
        const onDismiss = vi.fn();
        render(<RewardToast type={type} title={`Test ${type}`} onDismiss={onDismiss} />);
        expect(screen.getByText(`Test ${type}`)).toBeInTheDocument();
      });
    });
  });
});
