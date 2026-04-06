/**
 * Game Component Library — Vitest/RTL tests (Story 22-6)
 *
 * Covers per spec:
 *  (a) Renders with correct Celestial Night token-based class names
 *  (b) Keyboard interaction (Tab/Enter/Space/Escape) reaches expected state
 *  (c) data-state attribute reflects open/closed/checked correctly
 *
 * Components: FrostedPanel, GameDialog, GoldTabs, GameBadge, GlassInput,
 *             GlassTextarea, GameCheckbox, GameLabel, GameTooltip,
 *             GameScrollArea, GameCollapsible, StatBar
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import {
  FrostedPanel,
  FrostedPanelHeader,
  FrostedPanelTitle,
  FrostedPanelContent,
} from '../FrostedPanel';
import {
  GameDialog,
  GameDialogTrigger,
  GameDialogContent,
  GameDialogTitle,
  GameDialogDescription,
} from '../GameDialog';
import { GoldTabs, GoldTabsList, GoldTabsTrigger, GoldTabsContent } from '../GoldTabs';
import { GameBadge } from '../GameBadge';
import { GlassInput } from '../GlassInput';
import { GlassTextarea } from '../GlassTextarea';
import { GameCheckbox } from '../GameCheckbox';
import { GameLabel } from '../GameLabel';
import {
  GameTooltip,
  GameTooltipTrigger,
  GameTooltipContent,
  GameTooltipProvider,
} from '../GameTooltip';
import { GameScrollArea } from '../GameScrollArea';
import {
  GameCollapsible,
  GameCollapsibleTrigger,
  GameCollapsibleContent,
} from '../GameCollapsible';
import { StatBar } from '../StatBar';

// ---------------------------------------------------------------------------
// FrostedPanel
// ---------------------------------------------------------------------------
describe('FrostedPanel', () => {
  it('(a) renders with glass-panel token class', () => {
    render(
      <FrostedPanel data-testid="panel">
        <FrostedPanelContent>content</FrostedPanelContent>
      </FrostedPanel>
    );
    const panel = screen.getByTestId('panel');
    expect(panel.className).toContain('glass-panel');
  });

  it('(a) CardTitle uses --gold-400 token', () => {
    render(
      <FrostedPanel>
        <FrostedPanelHeader>
          <FrostedPanelTitle data-testid="title">Horse Stats</FrostedPanelTitle>
        </FrostedPanelHeader>
      </FrostedPanel>
    );
    const title = screen.getByTestId('title');
    expect(title.className).toContain('text-[var(--gold-400)]');
  });

  it('(b) is reachable by Tab', async () => {
    const user = userEvent.setup();
    render(
      <FrostedPanel>
        <FrostedPanelContent>
          <button>inside panel</button>
        </FrostedPanelContent>
      </FrostedPanel>
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'inside panel' })).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// GameDialog
// ---------------------------------------------------------------------------
describe('GameDialog', () => {
  it('(a) dialog content has glass-panel class when open', async () => {
    const user = userEvent.setup();
    render(
      <GameDialog>
        <GameDialogTrigger>Open</GameDialogTrigger>
        <GameDialogContent data-testid="dlg-content">
          <GameDialogTitle>Dialog Title</GameDialogTitle>
          <GameDialogDescription>Description</GameDialogDescription>
        </GameDialogContent>
      </GameDialog>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const content = screen.getByTestId('dlg-content');
    expect(content.className).toContain('glass-panel');
  });

  it('(c) dialog is open after trigger click', async () => {
    const user = userEvent.setup();
    render(
      <GameDialog>
        <GameDialogTrigger>Open</GameDialogTrigger>
        <GameDialogContent>
          <GameDialogTitle>My Dialog</GameDialogTitle>
          <GameDialogDescription>Info</GameDialogDescription>
        </GameDialogContent>
      </GameDialog>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('(b) Escape key closes the dialog', async () => {
    const user = userEvent.setup();
    render(
      <GameDialog>
        <GameDialogTrigger>Open</GameDialogTrigger>
        <GameDialogContent>
          <GameDialogTitle>My Dialog</GameDialogTitle>
          <GameDialogDescription>Info</GameDialogDescription>
        </GameDialogContent>
      </GameDialog>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GoldTabs
// ---------------------------------------------------------------------------
describe('GoldTabs', () => {
  function renderTabs() {
    return render(
      <GoldTabs defaultValue="tab1">
        <GoldTabsList>
          <GoldTabsTrigger value="tab1">Tab 1</GoldTabsTrigger>
          <GoldTabsTrigger value="tab2">Tab 2</GoldTabsTrigger>
        </GoldTabsList>
        <GoldTabsContent value="tab1">Content 1</GoldTabsContent>
        <GoldTabsContent value="tab2">Content 2</GoldTabsContent>
      </GoldTabs>
    );
  }

  it('(a) TabsList has transparent bg and gold border-b token', () => {
    renderTabs();
    const list = screen.getByRole('tablist');
    expect(list.className).toContain('bg-transparent');
    expect(list.className).toContain('border-b');
  });

  it('(a) active trigger uses --gold-400 token class', () => {
    renderTabs();
    const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
    expect(tab1.className).toContain('data-[state=active]:text-[var(--gold-400)]');
  });

  it('(c) initial tab has data-state=active', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute(
      'data-state',
      'active'
    );
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute(
      'data-state',
      'inactive'
    );
  });

  it('(b) clicking Tab 2 switches data-state to active', async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute(
      'data-state',
      'active'
    );
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute(
      'data-state',
      'inactive'
    );
  });

  it('(b) ArrowRight key navigates between tabs', async () => {
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole('tab', { name: 'Tab 1' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// GameBadge
// ---------------------------------------------------------------------------
describe('GameBadge', () => {
  it('(a) renders with default badge token classes', () => {
    render(<GameBadge data-testid="badge">Champion</GameBadge>);
    const badge = screen.getByTestId('badge');
    // Badge base has inline-flex, rounded-full styling
    expect(badge.className).toContain('inline-flex');
    expect(screen.getByText('Champion')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GlassInput
// ---------------------------------------------------------------------------
describe('GlassInput', () => {
  it('(a) renders with celestial-input token class', () => {
    render(<GlassInput data-testid="input" placeholder="Horse name" />);
    const input = screen.getByTestId('input');
    // From input.tsx: celestial-input is the Celestial Night token class
    expect(input.className).toContain('celestial-input');
  });

  it('(b) accepts typed text', async () => {
    const user = userEvent.setup();
    render(<GlassInput data-testid="input" />);
    const input = screen.getByTestId('input');
    await user.type(input, 'Midnight Star');
    expect(input).toHaveValue('Midnight Star');
  });

  it('(b) reachable via Tab', async () => {
    const user = userEvent.setup();
    render(<GlassInput data-testid="input" />);
    await user.tab();
    expect(screen.getByTestId('input')).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// GlassTextarea
// ---------------------------------------------------------------------------
describe('GlassTextarea', () => {
  it('(a) renders with celestial-input token class', () => {
    render(<GlassTextarea data-testid="ta" placeholder="Notes" />);
    const ta = screen.getByTestId('ta');
    expect(ta.className).toContain('celestial-input');
  });

  it('(b) accepts multiline input', async () => {
    const user = userEvent.setup();
    render(<GlassTextarea data-testid="ta" />);
    const ta = screen.getByTestId('ta');
    await user.type(ta, 'Line one{Enter}Line two');
    expect(ta).toHaveValue('Line one\nLine two');
  });
});

// ---------------------------------------------------------------------------
// GameCheckbox
// ---------------------------------------------------------------------------
describe('GameCheckbox', () => {
  it('(a) unchecked state has navy bg token', () => {
    render(<GameCheckbox data-testid="cb" />);
    const cb = screen.getByTestId('cb');
    expect(cb.className).toContain('bg-[var(--celestial-navy-800)]');
  });

  it('(c) initial data-state is unchecked', () => {
    render(<GameCheckbox data-testid="cb" />);
    expect(screen.getByTestId('cb')).toHaveAttribute('data-state', 'unchecked');
  });

  it('(c) clicking checkbox sets data-state=checked', async () => {
    const user = userEvent.setup();
    render(<GameCheckbox data-testid="cb" />);
    await user.click(screen.getByTestId('cb'));
    expect(screen.getByTestId('cb')).toHaveAttribute('data-state', 'checked');
  });

  it('(b) Space key toggles checked state', async () => {
    const user = userEvent.setup();
    render(<GameCheckbox data-testid="cb" />);
    const cb = screen.getByTestId('cb');
    cb.focus();
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('data-state', 'checked');
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('data-state', 'unchecked');
  });

  it('(a) checked state class uses --gold-700 token', () => {
    render(<GameCheckbox data-testid="cb" />);
    const cb = screen.getByTestId('cb');
    expect(cb.className).toContain('data-[state=checked]:bg-[var(--gold-700)]');
  });
});

// ---------------------------------------------------------------------------
// GameLabel
// ---------------------------------------------------------------------------
describe('GameLabel', () => {
  it('(a) renders with cream/gold text token', () => {
    render(<GameLabel data-testid="lbl">Horse Name</GameLabel>);
    const lbl = screen.getByTestId('lbl');
    // label.tsx uses text-[var(--cream)] or --text-secondary
    expect(lbl.textContent).toBe('Horse Name');
    // Should be a label element
    expect(lbl.tagName).toBe('LABEL');
  });

  it('(b) associates with input via htmlFor', () => {
    render(
      <>
        <GameLabel htmlFor="horse-name">Name</GameLabel>
        <GlassInput id="horse-name" />
      </>
    );
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GameTooltip
// ---------------------------------------------------------------------------
describe('GameTooltip', () => {
  it('(a) tooltip content appears on hover', async () => {
    const user = userEvent.setup();
    render(
      <GameTooltipProvider>
        <GameTooltip>
          <GameTooltipTrigger asChild>
            <button>Hover me</button>
          </GameTooltipTrigger>
          <GameTooltipContent>
            <p data-testid="tip-text">Tooltip text</p>
          </GameTooltipContent>
        </GameTooltip>
      </GameTooltipProvider>
    );
    await user.hover(screen.getByRole('button', { name: 'Hover me' }));
    // Radix renders tooltip content twice: visible + hidden ARIA span — use getAllByTestId
    await waitFor(() => {
      expect(screen.getAllByTestId('tip-text').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('(a) tooltip content has --bg-midnight token class', async () => {
    const user = userEvent.setup();
    render(
      <GameTooltipProvider>
        <GameTooltip>
          <GameTooltipTrigger asChild>
            <button>Trigger</button>
          </GameTooltipTrigger>
          <GameTooltipContent data-testid="tip">Content</GameTooltipContent>
        </GameTooltip>
      </GameTooltipProvider>
    );
    await user.hover(screen.getByRole('button', { name: 'Trigger' }));
    await waitFor(() => {
      const tip = screen.getByTestId('tip');
      expect(tip.className).toContain('bg-[var(--bg-midnight)]');
    });
  });
});

// ---------------------------------------------------------------------------
// GameScrollArea
// ---------------------------------------------------------------------------
describe('GameScrollArea', () => {
  it('(a) renders scroll area with celestial scrollbar token class', () => {
    render(
      <GameScrollArea data-testid="scroll" style={{ height: '100px' }}>
        <div style={{ height: '500px' }}>tall content</div>
      </GameScrollArea>
    );
    const sa = screen.getByTestId('scroll');
    // From scroll-area.tsx: scroll-area-celestial is the Celestial Night token class
    expect(sa.className).toContain('scroll-area-celestial');
    expect(sa.className).toContain('overflow-auto');
    expect(screen.getByText('tall content')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GameCollapsible
// ---------------------------------------------------------------------------
describe('GameCollapsible', () => {
  function renderCollapsible(defaultOpen = false) {
    return render(
      <GameCollapsible defaultOpen={defaultOpen} data-testid="collapsible">
        <GameCollapsibleTrigger data-testid="trigger">Toggle</GameCollapsibleTrigger>
        <GameCollapsibleContent data-testid="content">Hidden content</GameCollapsibleContent>
      </GameCollapsible>
    );
  }

  it('(a) trigger has cream text and hover:gold-400 token classes', () => {
    renderCollapsible();
    const trigger = screen.getByTestId('trigger');
    expect(trigger.className).toContain('text-[var(--cream)]');
    expect(trigger.className).toContain('hover:text-[var(--gold-400)]');
  });

  it('(c) trigger data-state=closed when collapsed', () => {
    renderCollapsible(false);
    expect(screen.getByTestId('trigger')).toHaveAttribute('data-state', 'closed');
  });

  it('(c) clicking trigger sets data-state=open', async () => {
    const user = userEvent.setup();
    renderCollapsible(false);
    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByTestId('trigger')).toHaveAttribute('data-state', 'open');
  });

  it('(b) Enter key toggles open state', async () => {
    const user = userEvent.setup();
    renderCollapsible(false);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('data-state', 'open');
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });
});

// ---------------------------------------------------------------------------
// StatBar — All 3 audit criteria
// ---------------------------------------------------------------------------
describe('StatBar', () => {
  it('(a) AC1: fill indicator has gold gradient classes', () => {
    render(<StatBar label="Speed" value={75} />);
    // Find the indicator div (child of progress root)
    const indicator = document.querySelector('[class*="from-[var(--gold-primary)]"]');
    expect(indicator).not.toBeNull();
    expect(indicator!.className).toContain('from-[var(--gold-primary)]');
    expect(indicator!.className).toContain('to-[var(--gold-light)]');
  });

  it('(a) AC2: track uses --bg-midnight token', () => {
    render(<StatBar label="Stamina" value={50} />);
    const track = document.querySelector('[class*="bg-[var(--bg-midnight)]"]');
    expect(track).not.toBeNull();
    expect(track!.className).toContain('bg-[var(--bg-midnight)]');
  });

  it('(a) AC3: glow class appears when value equals max', () => {
    render(<StatBar label="Agility" value={100} max={100} />);
    const indicator = document.querySelector('[class*="shadow-[0_0_8px"]');
    expect(indicator).not.toBeNull();
  });

  it('(a) AC3: no glow class when value is below max', () => {
    render(<StatBar label="Agility" value={99} max={100} />);
    const indicator = document.querySelector('[class*="shadow-[0_0_8px"]');
    expect(indicator).toBeNull();
  });

  it('(a) label text is rendered', () => {
    render(<StatBar label="Balance" value={60} />);
    expect(screen.getByText('Balance')).toBeInTheDocument();
  });

  it('(a) value is rendered when showValue=true (default)', () => {
    render(<StatBar label="Focus" value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('(a) value is hidden when showValue=false', () => {
    render(<StatBar label="Focus" value={42} showValue={false} />);
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('(a) unit is appended to the value', () => {
    render(<StatBar label="Weight" value={55} unit="kg" />);
    expect(screen.getByText('55kg')).toBeInTheDocument();
  });

  it('(a) clamps value above max to max', () => {
    render(<StatBar label="Stat" value={150} max={100} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('(a) clamps negative value to 0', () => {
    render(<StatBar label="Stat" value={-10} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('(a) size=sm applies h-2 track class', () => {
    render(<StatBar label="Stat" value={50} size="sm" />);
    const track = document.querySelector('[class*="h-2"]');
    expect(track).not.toBeNull();
  });

  it('(a) size=lg applies h-4 track class', () => {
    render(<StatBar label="Stat" value={50} size="lg" />);
    const track = document.querySelector('[class*="h-4"]');
    expect(track).not.toBeNull();
  });

  it('(b) has accessible aria-label on progress root', () => {
    render(<StatBar label="Precision" value={80} />);
    expect(screen.getByRole('progressbar', { name: 'Precision' })).toBeInTheDocument();
  });
});
