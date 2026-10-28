/**
 * The phone menu keeps keyboard focus (Equoria-ct39p, NAV-05).
 *
 * Opening the menu moves focus into it; Tab and Shift+Tab wrap inside it; the
 * page behind is inert; Escape and the close button return focus to the button
 * that opened it. Real NavPanel, real router, no mocks.
 */

import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { NavPanel } from '../NavPanel';

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <main data-testid="page-behind">
        <button type="button" onClick={() => setOpen(true)}>
          Open menu
        </button>
        <a href="#elsewhere">Something on the page</a>
      </main>
      <NavPanel isOpen={open} onClose={() => setOpen(false)} />
    </MemoryRouter>
  );
}

/** The menu's links and buttons, in document (Tab) order. */
function focusablesIn(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>('a[href], button'));
}

describe('NavPanel — keyboard focus (Equoria-ct39p)', () => {
  it('moves focus into the menu when it opens', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('keeps Tab and Shift+Tab inside the menu', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog');
    const focusable = focusablesIn(dialog);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('makes the page behind inert while open, and live again after', async () => {
    const user = userEvent.setup();
    const { container } = render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(container).toHaveAttribute('inert');

    await user.keyboard('{Escape}');
    expect(container).not.toHaveAttribute('inert');
  });

  it('returns focus to the opener on Escape', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Open menu' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it('returns focus to the opener when the close button is used', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Open menu' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(document.activeElement).toBe(opener);
  });
});
