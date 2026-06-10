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
import { describe, it, expect } from 'vitest';
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
