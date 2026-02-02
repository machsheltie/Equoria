import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CooldownCountdown from '../CooldownCountdown';

describe('CooldownCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders countdown text', () => {
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
    render(<CooldownCountdown endsAt={futureDate} />);

    expect(screen.getByTestId('cooldown-countdown')).toBeInTheDocument();
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('formats days and hours correctly', () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days
    render(<CooldownCountdown endsAt={futureDate} />);

    expect(screen.getByText(/2d.*remaining/)).toBeInTheDocument();
  });

  it('formats hours and minutes correctly', () => {
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
    render(<CooldownCountdown endsAt={futureDate} />);

    expect(screen.getByText(/2h.*remaining/)).toBeInTheDocument();
  });

  it('formats minutes only when less than 1 hour', () => {
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    render(<CooldownCountdown endsAt={futureDate} />);

    expect(screen.getByText(/30m remaining/)).toBeInTheDocument();
  });

  it('shows "Ready now" when cooldown has expired', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    render(<CooldownCountdown endsAt={pastDate} />);

    expect(screen.getByText('Ready now')).toBeInTheDocument();
  });

  it('has clock icon', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { container } = render(<CooldownCountdown endsAt={futureDate} />);

    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { container } = render(
      <CooldownCountdown endsAt={futureDate} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
