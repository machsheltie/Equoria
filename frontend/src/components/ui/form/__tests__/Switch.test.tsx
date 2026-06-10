/**
 * Switch — accessible toggle tests (Equoria-o5hub.12)
 */
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Switch } from '../Switch';

function Controlled() {
  const [checked, setChecked] = useState(false);
  return (
    <Switch checked={checked} onCheckedChange={setChecked} aria-label="Enable notifications" />
  );
}

describe('Switch', () => {
  it('renders with role=switch', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('aria-checked is false by default', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking toggles aria-checked to true', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking again toggles back to false', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" />);
    const sw = screen.getByRole('switch');
    await user.click(sw);
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('Space key toggles', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" />);
    const sw = screen.getByRole('switch');
    sw.focus();
    await user.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('Enter key toggles', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" />);
    const sw = screen.getByRole('switch');
    sw.focus();
    await user.keyboard('{Enter}');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('controlled mode responds to external state', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('disabled switch does not toggle on click', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" disabled />);
    const sw = screen.getByRole('switch');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('disabled has opacity-40 class', () => {
    render(<Switch aria-label="Toggle" disabled />);
    expect(screen.getByRole('switch').className).toContain('disabled:opacity-40');
  });

  it('gold focus ring class present', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch').className).toContain(
      'focus-visible:ring-[var(--gold-primary)]'
    );
  });

  it('gold track when checked', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" />);
    const sw = screen.getByRole('switch');
    await user.click(sw);
    expect(sw.className).toContain('bg-[var(--gold-primary)]');
  });
});
