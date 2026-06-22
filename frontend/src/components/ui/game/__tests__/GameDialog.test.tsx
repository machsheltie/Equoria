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
  GameDialogClose,
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

  // Exit-animation presence layer — Equoria-mased. On close the content node
  // must stay mounted (data-state="closed") for one animation frame so the
  // `data-[state=closed]:animate-out` classes play, THEN unmount on animationend.
  // jsdom runs no real CSS animation, so we drive the deferred path explicitly by
  // faking getAnimations + dispatching animationend.
  describe('exit animation presence (Equoria-mased)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('no animation (jsdom default): closes synchronously — instant-close contract preserved', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog defaultOpen />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      // jsdom has no getAnimations → synchronous fast-path unmount.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('with a running exit animation: node lingers as data-state="closed", unmounts on animationend', async () => {
      const user = userEvent.setup();
      render(<SimpleDialog defaultOpen />);
      const content = screen.getByTestId('dlg-content');

      // Simulate a real browser: a running CSS animation on the content node.
      const fakeAnimation = { playState: 'running' } as unknown as Animation;
      (content as unknown as { getAnimations: () => Animation[] }).getAnimations = () => [
        fakeAnimation,
      ];

      await user.keyboard('{Escape}');

      // Still mounted, now flagged closed so the exit classes can play.
      expect(screen.getByTestId('dlg-content')).toBeInTheDocument();
      expect(screen.getByTestId('dlg-content')).toHaveAttribute('data-state', 'closed');

      // Animation finishes → node unmounts.
      content.dispatchEvent(new Event('animationend', { bubbles: true }));
      // A microtask/state-flush turn is needed for React to commit the unmount.
      await screen.findByRole('button', { name: 'Open' }); // re-render settled
      expect(screen.queryByTestId('dlg-content')).not.toBeInTheDocument();
    });

    it('reduced-motion: closes synchronously even if getAnimations would report a running animation', async () => {
      // Force prefers-reduced-motion: reduce.
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            matches: query.includes('prefers-reduced-motion'),
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
          }) as unknown as MediaQueryList
      );

      const user = userEvent.setup();
      render(<SimpleDialog defaultOpen />);
      const content = screen.getByTestId('dlg-content');
      (content as unknown as { getAnimations: () => Animation[] }).getAnimations = () => [
        { playState: 'running' } as unknown as Animation,
      ];

      await user.keyboard('{Escape}');
      // Reduced-motion users get instant close, no lingering node.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // Nested-dialog focus restore — Equoria-mased. Dialog A opens dialog B from
  // within A's content. Closing B must return focus to B's opener (inside A);
  // closing A must then return focus to A's opener. Each Dialog owns its own
  // context + triggerRef, so restoration must thread correctly across levels.
  describe('nested dialog focus restore (Equoria-mased)', () => {
    function NestedDialogs() {
      return (
        <GameDialog>
          <GameDialogTrigger data-testid="open-a">Open A</GameDialogTrigger>
          <GameDialogContent data-testid="content-a" hideCloseButton>
            <GameDialogTitle>Dialog A</GameDialogTitle>
            <GameDialogDescription>A body</GameDialogDescription>
            {/* B's trigger lives INSIDE A — it is A's content's focusable and B's opener. */}
            <GameDialog>
              <GameDialogTrigger data-testid="open-b">Open B</GameDialogTrigger>
              <GameDialogContent data-testid="content-b" hideCloseButton>
                <GameDialogTitle>Dialog B</GameDialogTitle>
                <GameDialogDescription>B body</GameDialogDescription>
                <GameDialogClose data-testid="close-b">Close B</GameDialogClose>
              </GameDialogContent>
            </GameDialog>
            <GameDialogClose data-testid="close-a">Close A</GameDialogClose>
          </GameDialogContent>
        </GameDialog>
      );
    }

    it('close B → focus returns to B opener inside A; close A → focus returns to A opener', async () => {
      const user = userEvent.setup();
      render(<NestedDialogs />);

      const openA = screen.getByTestId('open-a');
      await user.click(openA);
      expect(screen.getByTestId('content-a')).toBeInTheDocument();

      // Open B from within A. Its trigger lives inside A's content.
      const openB = screen.getByTestId('open-b');
      await user.click(openB);
      expect(screen.getByTestId('content-b')).toBeInTheDocument();
      // Both dialogs are open simultaneously (stacked).
      expect(screen.getByTestId('content-a')).toBeInTheDocument();

      // Close B via its own close button. Focus must return to B's opener (open-b),
      // which is still mounted inside A — NOT to A's trigger.
      await user.click(screen.getByTestId('close-b'));
      expect(screen.queryByTestId('content-b')).not.toBeInTheDocument();
      // A is still open.
      expect(screen.getByTestId('content-a')).toBeInTheDocument();
      expect(document.activeElement).toBe(openB);

      // Now close A. Focus must return to A's opener (open-a) at the page level.
      await user.click(screen.getByTestId('close-a'));
      expect(screen.queryByTestId('content-a')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(openA);
    });

    it('Escape closes only the TOPMOST dialog (B), leaving A open, and restores focus to B opener', async () => {
      const user = userEvent.setup();
      render(<NestedDialogs />);

      const openA = screen.getByTestId('open-a');
      await user.click(openA);
      const openB = screen.getByTestId('open-b');
      await user.click(openB);
      expect(screen.getByTestId('content-b')).toBeInTheDocument();

      // One Escape press must close ONLY the topmost (B). If both A and B closed
      // on a single Escape, nested focus restoration would be impossible.
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('content-b')).not.toBeInTheDocument();
      expect(screen.getByTestId('content-a')).toBeInTheDocument();
      expect(document.activeElement).toBe(openB);

      // A second Escape closes A and restores focus to A's opener.
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('content-a')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(openA);
    });
  });
});
