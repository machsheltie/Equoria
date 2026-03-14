/**
 * CooldownTimer Component Tests
 *
 * Tests countdown display, ready state, compact mode, labels, and accessibility.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('lucide-react', () => ({
  Clock: (props: any) => <svg data-testid="icon-clock" {...props} />,
}));

import { CooldownTimer } from '../CooldownTimer';

describe('CooldownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Ready state (no cooldown)', () => {
    it('shows "Ready!" when endsAt is null', () => {
      render(<CooldownTimer endsAt={null} />);
      expect(screen.getByText('Ready!')).toBeInTheDocument();
    });

    it('shows "Ready!" when endsAt is undefined', () => {
      render(<CooldownTimer endsAt={undefined} />);
      expect(screen.getByText('Ready!')).toBeInTheDocument();
    });

    it('shows "Ready!" when endsAt is in the past', () => {
      render(<CooldownTimer endsAt="2026-03-14T11:00:00Z" />);
      expect(screen.getByText('Ready!')).toBeInTheDocument();
    });

    it('shows pulse indicator when ready', () => {
      render(<CooldownTimer endsAt={null} />);
      expect(screen.getByText('Available now')).toBeInTheDocument();
    });

    it('has assertive aria-live when ready', () => {
      render(<CooldownTimer endsAt={null} />);
      expect(screen.getByTestId('cooldown-timer')).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Active countdown', () => {
    it('shows days and hours for multi-day cooldown', () => {
      // 3 days from now
      render(<CooldownTimer endsAt="2026-03-17T12:00:00Z" />);
      expect(screen.getByText('3d 0h')).toBeInTheDocument();
    });

    it('shows hours and minutes for sub-day cooldown', () => {
      // 5 hours from now
      render(<CooldownTimer endsAt="2026-03-14T17:00:00Z" />);
      expect(screen.getByText('5h 0m')).toBeInTheDocument();
    });

    it('shows minutes for sub-hour cooldown', () => {
      // 30 minutes from now
      render(<CooldownTimer endsAt="2026-03-14T12:30:00Z" />);
      expect(screen.getByText('30m')).toBeInTheDocument();
    });

    it('renders day/hour/minute breakdown grid for multi-day', () => {
      render(<CooldownTimer endsAt="2026-03-17T14:30:00Z" />);
      expect(screen.getByText('days')).toBeInTheDocument();
      expect(screen.getByText('hrs')).toBeInTheDocument();
      expect(screen.getByText('min')).toBeInTheDocument();
    });

    it('has polite aria-live when counting down', () => {
      render(<CooldownTimer endsAt="2026-03-17T12:00:00Z" />);
      expect(screen.getByTestId('cooldown-timer')).toHaveAttribute('aria-live', 'polite');
    });

    it('has role="timer"', () => {
      render(<CooldownTimer endsAt="2026-03-17T12:00:00Z" />);
      expect(screen.getByTestId('cooldown-timer')).toHaveAttribute('role', 'timer');
    });
  });

  describe('Compact mode', () => {
    it('renders as inline chip when compact=true', () => {
      render(<CooldownTimer endsAt={null} compact />);
      const el = screen.getByTestId('cooldown-timer');
      expect(el.tagName).toBe('SPAN');
    });

    it('renders as div when compact=false', () => {
      render(<CooldownTimer endsAt={null} />);
      const el = screen.getByTestId('cooldown-timer');
      expect(el.tagName).toBe('DIV');
    });

    it('shows countdown text in compact mode', () => {
      render(<CooldownTimer endsAt="2026-03-17T12:00:00Z" compact />);
      expect(screen.getByText('3d 0h')).toBeInTheDocument();
    });

    it('shows Ready! in compact mode when expired', () => {
      render(<CooldownTimer endsAt={null} compact />);
      expect(screen.getByText('Ready!')).toBeInTheDocument();
    });
  });

  describe('Label prop', () => {
    it('renders label text in full mode', () => {
      render(<CooldownTimer endsAt="2026-03-17T12:00:00Z" label="Training cooldown" />);
      expect(screen.getByText('Training cooldown')).toBeInTheDocument();
    });

    it('includes label in aria-label', () => {
      render(<CooldownTimer endsAt={null} label="Breeding cooldown" />);
      expect(screen.getByTestId('cooldown-timer')).toHaveAttribute(
        'aria-label',
        'Breeding cooldown: Ready!'
      );
    });

    it('includes label in compact aria-label', () => {
      render(<CooldownTimer endsAt={null} label="Training" compact />);
      expect(screen.getByTestId('cooldown-timer')).toHaveAttribute(
        'aria-label',
        'Training: Ready!'
      );
    });
  });

  describe('className prop', () => {
    it('applies custom className in full mode', () => {
      render(<CooldownTimer endsAt={null} className="my-class" />);
      expect(screen.getByTestId('cooldown-timer')).toHaveClass('my-class');
    });

    it('applies custom className in compact mode', () => {
      render(<CooldownTimer endsAt={null} compact className="my-class" />);
      expect(screen.getByTestId('cooldown-timer')).toHaveClass('my-class');
    });
  });
});
