/**
 * GameDialog — Vitest/RTL tests (Story 22-6 / Equoria-o5hub.13)
 *
 * Tests cover:
 * - Radix-backed behaviours (Escape close, focus restoration, single overlay blur)
 * - Capability parity additions: size variants, GameDialogBody scrollable region
 * - Visual: glass-panel-heavy, rounded-[var(--radius-xl)] on content panel
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  GameDialog,
  GameDialogTrigger,
  GameDialogContent,
  GameDialogBody,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogHeader,
  GameDialogFooter,
} from '../GameDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SimpleDialog({
  size,
  defaultOpen = false,
}: {
  size?: import('../GameDialog').GameDialogSize;
  defaultOpen?: boolean;
}) {
  return (
    <GameDialog defaultOpen={defaultOpen}>
      <GameDialogTrigger>Open</GameDialogTrigger>
      <GameDialogContent size={size} data-testid="dlg-content">
        <GameDialogTitle>Dialog Title</GameDialogTitle>
        <GameDialogDescription>Description text</GameDialogDescription>
      </GameDialogContent>
    </GameDialog>
  );
}

// ---------------------------------------------------------------------------
// Original Story 22-6 tests (preserved)
// ---------------------------------------------------------------------------

describe('GameDialog — Story 22-6 (original)', () => {
  it('(a) dialog content has glass-panel-heavy class when open', async () => {
    const user = userEvent.setup();
    render(<SimpleDialog />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('dlg-content').className).toContain('glass-panel-heavy');
  });

  it('(c) dialog is open after trigger click', async () => {
    const user = userEvent.setup();
    render(<SimpleDialog />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('(b) Escape key closes the dialog', async () => {
    const user = userEvent.setup();
    render(<SimpleDialog />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Equoria-o5hub.13 capability-parity additions
// ---------------------------------------------------------------------------

describe('GameDialog — Equoria-o5hub.13 capability parity', () => {
  // Size variants map to correct max-w classes
  describe('size variants', () => {
    const cases: [import('../GameDialog').GameDialogSize, string][] = [
      ['sm', 'max-w-md'],
      ['md', 'max-w-2xl'],
      ['lg', 'max-w-4xl'],
      ['xl', 'max-w-6xl'],
      ['full', 'max-w-[95vw]'],
    ];

    it.each(cases)('size="%s" sets class %s on content panel', async (size, cls) => {
      const user = userEvent.setup();
      render(<SimpleDialog size={size} />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByTestId('dlg-content').className).toContain(cls);
    });

    it('no size prop → default max-w-lg (preserves existing consumers)', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByTestId('dlg-content').className).toContain('max-w-lg');
    });
  });

  // GameDialogBody — scrollable middle region
  describe('GameDialogBody', () => {
    it('renders with overflow-y-auto class (scrollable)', async () => {
      const user = userEvent.setup();
      render(
        <GameDialog>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent>
            <GameDialogTitle>T</GameDialogTitle>
            <GameDialogDescription>D</GameDialogDescription>
            <GameDialogBody data-testid="dialog-body">Body content</GameDialogBody>
          </GameDialogContent>
        </GameDialog>
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const body = screen.getByTestId('dialog-body');
      expect(body.className).toContain('overflow-y-auto');
    });

    it('renders with max-h class (bounded height so long content scrolls)', async () => {
      const user = userEvent.setup();
      render(
        <GameDialog>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent>
            <GameDialogTitle>T</GameDialogTitle>
            <GameDialogDescription>D</GameDialogDescription>
            <GameDialogBody data-testid="dialog-body">Body content</GameDialogBody>
          </GameDialogContent>
        </GameDialog>
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const body = screen.getByTestId('dialog-body');
      expect(body.className).toContain('max-h');
    });
  });

  // Radius — content panel must have rounded-[var(--radius-xl)]
  describe('radius (DECISIONS §3/§4)', () => {
    it('content panel has rounded-[var(--radius-xl)] class', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByTestId('dlg-content').className).toContain('rounded-[var(--radius-xl)]');
    });
  });

  // Overlay blur — only overlay should carry backdrop-blur-sm
  describe('overlay single blur (DECISIONS §4)', () => {
    it('overlay element has backdrop-blur-sm class', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      // The overlay is the fixed inset-0 element with bg-black/60
      const overlay = document.querySelector('.backdrop-blur-sm');
      expect(overlay).not.toBeNull();
    });

    it('content panel does NOT have backdrop-blur class (no nested blur)', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const content = screen.getByTestId('dlg-content');
      expect(content.className).not.toContain('backdrop-blur');
    });
  });

  // Escape close — Radix behaviour (covered in Story 22-6 but repeated here for parity context)
  describe('Escape close (Radix-provided)', () => {
    it('Escape closes the dialog', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // Focus restoration — Radix behaviour
  describe('focus restoration (Radix-provided)', () => {
    it('focus returns to trigger after dialog closes', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog />);
      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // Radix restores focus to the trigger element
      expect(document.activeElement).toBe(trigger);
    });
  });

  // Header / Footer primitives render correctly
  describe('GameDialogHeader / GameDialogFooter', () => {
    it('renders header with border-b class', async () => {
      const user = userEvent.setup();
      render(
        <GameDialog>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent>
            <GameDialogHeader data-testid="dlg-header">
              <GameDialogTitle>Title</GameDialogTitle>
            </GameDialogHeader>
            <GameDialogDescription>Desc</GameDialogDescription>
          </GameDialogContent>
        </GameDialog>
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const header = screen.getByTestId('dlg-header');
      expect(header.className).toContain('border-b');
    });

    it('renders footer with border-t class', async () => {
      const user = userEvent.setup();
      render(
        <GameDialog>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent>
            <GameDialogTitle>Title</GameDialogTitle>
            <GameDialogDescription>Desc</GameDialogDescription>
            <GameDialogFooter data-testid="dlg-footer">
              <button>OK</button>
            </GameDialogFooter>
          </GameDialogContent>
        </GameDialog>
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const footer = screen.getByTestId('dlg-footer');
      expect(footer.className).toContain('border-t');
    });
  });

  describe('noDescription (Radix aria-describedby opt-out, Equoria-o5hub ratchet)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('SENTINEL-POSITIVE: a description-less dialog WITHOUT noDescription triggers the Radix dev warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      render(
        <GameDialog>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent data-testid="dlg-content">
            <GameDialogTitle>Title only</GameDialogTitle>
          </GameDialogContent>
        </GameDialog>
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(
        warnSpy.mock.calls.some((args) => String(args[0]).includes('Missing `Description`'))
      ).toBe(true);
    });

    it('noDescription suppresses the Radix warning and omits aria-describedby', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      render(
        <GameDialog>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent data-testid="dlg-content" noDescription>
            <GameDialogTitle>Title only</GameDialogTitle>
          </GameDialogContent>
        </GameDialog>
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByTestId('dlg-content')).not.toHaveAttribute('aria-describedby');
      expect(
        warnSpy.mock.calls.some((args) => String(args[0]).includes('Missing `Description`'))
      ).toBe(false);
    });

    it('default (no prop): dialogs WITH a description keep Radix aria-describedby wiring (existing consumers unchanged)', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const content = screen.getByTestId('dlg-content');
      const describedBy = content.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      // The id must resolve to the rendered GameDialogDescription element
      expect(document.getElementById(describedBy as string)?.textContent).toBe('Description text');
    });
  });

  // Native-primitive parity behaviours (Equoria-rkgq9.1: @radix-ui/react-dialog
  // replaced with the in-house dialog). These lock the behaviours Radix used to
  // provide — a regression here breaks every modal in the app.
  describe('native dialog parity (Equoria-rkgq9.1)', () => {
    function FocusTrapDialog() {
      // hideCloseButton so the only focusables are the two buttons under test —
      // otherwise the built-in X close button is the real last focusable.
      return (
        <GameDialog defaultOpen>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent data-testid="dlg-content" hideCloseButton>
            <GameDialogTitle>Title</GameDialogTitle>
            <GameDialogDescription>Desc</GameDialogDescription>
            <button data-testid="first-btn">First</button>
            <button data-testid="last-btn">Last</button>
          </GameDialogContent>
        </GameDialog>
      );
    }

    it('exposes role="dialog" with aria-modal and aria-labelledby wired to the title', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy as string)?.textContent).toBe('Dialog Title');
    });

    it('the built-in X close button has an accessible name and closes the dialog', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog defaultOpen />);
      const closeBtn = screen.getByRole('button', { name: 'Close' });
      expect(closeBtn).toBeInTheDocument();
      await user.click(closeBtn);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Tab from the last focusable element cycles back to the first (focus trap)', async () => {
      const user = userEvent.setup();
      render(<FocusTrapDialog />);
      const first = screen.getByTestId('first-btn');
      const last = screen.getByTestId('last-btn');
      last.focus();
      expect(document.activeElement).toBe(last);
      await user.tab();
      // Wraps within the dialog rather than escaping to the document body.
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(first);
    });

    it('Shift+Tab from the first focusable element wraps to the last (focus trap)', async () => {
      const user = userEvent.setup();
      render(<FocusTrapDialog />);
      const first = screen.getByTestId('first-btn');
      const last = screen.getByTestId('last-btn');
      first.focus();
      expect(document.activeElement).toBe(first);
      await user.tab({ shift: true });
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(last);
    });

    it('clicking the overlay backdrop closes the dialog (modal outside-dismiss)', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog defaultOpen />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      const overlay = document.querySelector('.backdrop-blur-sm');
      expect(overlay).not.toBeNull();
      await user.click(overlay as Element);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('clicking INSIDE the content panel does NOT close the dialog', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog defaultOpen />);
      const content = screen.getByTestId('dlg-content');
      await user.click(content);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('locks body scroll while open and restores it on close', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog defaultOpen />);
      expect(document.body).toHaveAttribute('data-scroll-locked');
      expect(document.body.style.overflow).toBe('hidden');
      await user.keyboard('{Escape}');
      expect(document.body).not.toHaveAttribute('data-scroll-locked');
      expect(document.body.style.overflow).toBe('');
    });

    it('overlay and content carry data-state="open" while open (CSS animation hook)', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog defaultOpen />);
      expect(screen.getByTestId('dlg-content')).toHaveAttribute('data-state', 'open');
      const overlay = document.querySelector('.backdrop-blur-sm');
      expect(overlay).toHaveAttribute('data-state', 'open');
      // sanity: closing removes the dialog entirely
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('hideCloseButton (BaseModal showCloseButton={false} parity, Equoria-o5hub.13)', () => {
    it('renders the built-in X close button by default', async () => {
      const user = userEvent.setup();
      render(
        <GameDialog>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent>
            <GameDialogTitle>Title</GameDialogTitle>
            <GameDialogDescription>Desc</GameDialogDescription>
          </GameDialogContent>
        </GameDialog>
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('omits the built-in X entirely when hideCloseButton is set (not just visually hidden)', async () => {
      const user = userEvent.setup();
      render(
        <GameDialog>
          <GameDialogTrigger>Open</GameDialogTrigger>
          <GameDialogContent hideCloseButton>
            <GameDialogTitle>Title</GameDialogTitle>
            <GameDialogDescription>Desc</GameDialogDescription>
          </GameDialogContent>
        </GameDialog>
      );
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    });
  });
});
