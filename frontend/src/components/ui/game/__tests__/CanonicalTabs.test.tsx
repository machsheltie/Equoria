/**
 * CanonicalTabs — Vitest/RTL tests (Equoria-o5hub.11)
 *
 * Coverage:
 *  (a) Variant rendering — underline and segmented apply correct token classes
 *  (b) Array API — renders tabs/content from `tabs` prop
 *  (c) Controlled mode — respects value/onValueChange
 *  (d) Uncontrolled mode — internal state via defaultValue
 *  (e) Keyboard navigation — ArrowRight/ArrowLeft (via Radix roving focus)
 *  (f) Overflow classes — overflow-x-auto + flex-nowrap present on TabsList
 *  (g) Zero raw-color regression — component source has no rgba( or text-slate class
 */

import React, { useState } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { CanonicalTabs, Tabs, TabsList, TabsTrigger, TabsContent } from '../CanonicalTabs';

// ─── helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_TABS = [
  { value: 'alpha', label: 'Alpha', content: <p>alpha-body</p> },
  { value: 'beta', label: 'Beta', content: <p>beta-body</p> },
  { value: 'gamma', label: 'Gamma', content: <p>gamma-body</p> },
];

function renderComposable(defaultValue = 'alpha') {
  return render(
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="alpha">Alpha</TabsTrigger>
        <TabsTrigger value="beta">Beta</TabsTrigger>
      </TabsList>
      <TabsContent value="alpha">alpha-body</TabsContent>
      <TabsContent value="beta">beta-body</TabsContent>
    </Tabs>
  );
}

// ─── (a) Variant rendering ────────────────────────────────────────────────────

describe('CanonicalTabs — underline variant (default)', () => {
  it('TabsList has overflow-x-auto and flex-nowrap for horizontal scrolling', () => {
    render(<CanonicalTabs tabs={SAMPLE_TABS} />);
    const list = screen.getByRole('tablist');
    expect(list.className).toContain('overflow-x-auto');
    expect(list.className).toContain('flex-nowrap');
  });

  it('active trigger has gold-400 token class (GoldTabsTrigger base)', () => {
    render(<CanonicalTabs tabs={SAMPLE_TABS} defaultValue="alpha" />);
    const trigger = screen.getByRole('tab', { name: /alpha/i });
    // GoldTabsTrigger applies data-[state=active]:text-[var(--gold-400)]
    expect(trigger.className).toContain('data-[state=active]:text-[var(--gold-400)]');
  });

  it('TabsList has bottom border from GoldTabsList base', () => {
    render(<CanonicalTabs tabs={SAMPLE_TABS} />);
    const list = screen.getByRole('tablist');
    expect(list.className).toContain('border-b');
  });
});

describe('CanonicalTabs — segmented variant', () => {
  it('TabsList has glass-surface-subtle-bg token container', () => {
    render(<CanonicalTabs variant="segmented" tabs={SAMPLE_TABS} />);
    const list = screen.getByRole('tablist');
    expect(list.className).toContain('bg-[var(--glass-surface-subtle-bg)]');
  });

  it('active segmented trigger has btn-gold-bg token', () => {
    render(<CanonicalTabs variant="segmented" tabs={SAMPLE_TABS} defaultValue="alpha" />);
    const trigger = screen.getByRole('tab', { name: /alpha/i });
    expect(trigger.className).toContain('data-[state=active]:bg-[var(--btn-gold-bg)]');
  });

  it('inactive segmented trigger uses text-secondary token', () => {
    render(<CanonicalTabs variant="segmented" tabs={SAMPLE_TABS} defaultValue="alpha" />);
    const inactiveTrigger = screen.getByRole('tab', { name: /beta/i });
    expect(inactiveTrigger.className).toContain('text-[var(--text-secondary)]');
  });
});

// ─── (b) Array API ────────────────────────────────────────────────────────────

describe('CanonicalTabs — array API', () => {
  it('renders all tab triggers from tabs prop', () => {
    render(<CanonicalTabs tabs={SAMPLE_TABS} />);
    expect(screen.getByRole('tab', { name: /alpha/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /beta/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /gamma/i })).toBeInTheDocument();
  });

  it('renders tab icon when provided', () => {
    const tabsWithIcon = [
      {
        value: 'icon-tab',
        label: 'Iconic',
        icon: <span data-testid="tab-icon">★</span>,
        content: <p>body</p>,
      },
    ];
    render(<CanonicalTabs tabs={tabsWithIcon} />);
    expect(screen.getByTestId('tab-icon')).toBeInTheDocument();
  });

  it('clicking a tab shows its content and hides others', async () => {
    const user = userEvent.setup();
    render(<CanonicalTabs tabs={SAMPLE_TABS} defaultValue="alpha" />);
    expect(screen.getByText('alpha-body')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /beta/i }));
    expect(screen.getByText('beta-body')).toBeInTheDocument();
    expect(screen.queryByText('alpha-body')).not.toBeInTheDocument();
  });
});

// ─── (c) Controlled mode ──────────────────────────────────────────────────────

describe('CanonicalTabs — controlled mode', () => {
  it('renders the tab specified by value prop', () => {
    const seen: string[] = [];
    render(<CanonicalTabs tabs={SAMPLE_TABS} value="beta" onValueChange={(v) => seen.push(v)} />);
    expect(screen.getByText('beta-body')).toBeInTheDocument();
    expect(screen.queryByText('alpha-body')).not.toBeInTheDocument();
  });

  it('calls onValueChange when trigger is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<CanonicalTabs tabs={SAMPLE_TABS} value="alpha" onValueChange={onValueChange} />);
    await user.click(screen.getByRole('tab', { name: /beta/i }));
    expect(onValueChange).toHaveBeenCalledWith('beta');
  });

  it('does not change internal state in controlled mode', async () => {
    const user = userEvent.setup();
    // Controlled: value stays "alpha" because parent doesn't update
    render(<CanonicalTabs tabs={SAMPLE_TABS} value="alpha" onValueChange={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /beta/i }));
    // Still shows alpha content because value prop hasn't changed
    expect(screen.getByText('alpha-body')).toBeInTheDocument();
  });

  it('updates displayed content when value prop changes', async () => {
    const ControlledWrapper = () => {
      const [tab, setTab] = useState('alpha');
      return (
        <div>
          <button onClick={() => setTab('gamma')}>Switch to gamma</button>
          <CanonicalTabs tabs={SAMPLE_TABS} value={tab} onValueChange={setTab} />
        </div>
      );
    };
    const user = userEvent.setup();
    render(<ControlledWrapper />);
    expect(screen.getByText('alpha-body')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /switch to gamma/i }));
    expect(screen.getByText('gamma-body')).toBeInTheDocument();
  });
});

// ─── (d) Uncontrolled mode ────────────────────────────────────────────────────

describe('CanonicalTabs — uncontrolled mode', () => {
  it('defaults to first tab when no defaultValue', () => {
    render(<CanonicalTabs tabs={SAMPLE_TABS} />);
    expect(screen.getByText('alpha-body')).toBeInTheDocument();
  });

  it('defaults to the specified defaultValue', () => {
    render(<CanonicalTabs tabs={SAMPLE_TABS} defaultValue="gamma" />);
    expect(screen.getByText('gamma-body')).toBeInTheDocument();
  });

  it('maintains internal state across clicks', async () => {
    const user = userEvent.setup();
    render(<CanonicalTabs tabs={SAMPLE_TABS} defaultValue="alpha" />);
    await user.click(screen.getByRole('tab', { name: /beta/i }));
    expect(screen.getByText('beta-body')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /gamma/i }));
    expect(screen.getByText('gamma-body')).toBeInTheDocument();
  });
});

// ─── (e) Keyboard navigation ──────────────────────────────────────────────────

describe('CanonicalTabs — keyboard navigation', () => {
  it('ArrowRight moves focus to next tab', async () => {
    // Suppress Radix roving-focus act() warning (see GoldTabs.test.tsx comment)
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((msg: unknown, ...args: unknown[]) => {
        if (typeof msg === 'string' && msg.includes('not wrapped in act')) return;
        console.warn(msg, ...args);
      });

    const user = userEvent.setup();
    renderComposable();
    screen.getByRole('tab', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus();

    errorSpy.mockRestore();
  });

  it('ArrowLeft moves focus to previous tab', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((msg: unknown, ...args: unknown[]) => {
        if (typeof msg === 'string' && msg.includes('not wrapped in act')) return;
        console.warn(msg, ...args);
      });

    const user = userEvent.setup();
    renderComposable();
    screen.getByRole('tab', { name: 'Beta' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveFocus();

    errorSpy.mockRestore();
  });
});

// ─── (f) Overflow classes ─────────────────────────────────────────────────────

describe('CanonicalTabs — overflow classes', () => {
  it('composable TabsList has overflow-x-auto', () => {
    renderComposable();
    const list = screen.getByRole('tablist');
    expect(list.className).toContain('overflow-x-auto');
  });

  it('composable TabsList has flex-nowrap', () => {
    renderComposable();
    const list = screen.getByRole('tablist');
    expect(list.className).toContain('flex-nowrap');
  });
});

// ─── (g) Zero raw-color regression ───────────────────────────────────────────

describe('CanonicalTabs — zero raw-color regression', () => {
  const srcPath = join(process.cwd(), 'src', 'components', 'ui', 'game', 'CanonicalTabs.tsx');
  const source = readFileSync(srcPath, 'utf8');

  it('source contains no raw rgba() literals', () => {
    // This confirms all colors go through CSS custom property tokens
    expect(source).not.toMatch(/\brgba\s*\(/);
  });

  it('source contains no raw rgb() literals (outside comments)', () => {
    // Strip single-line and block comments before checking
    const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(noComments).not.toMatch(/\brgb\s*\(/);
  });

  it('source contains no raw text-slate-* Tailwind classes', () => {
    expect(source).not.toMatch(/text-slate-\d+/);
  });

  it('source contains no raw text-blue-* Tailwind classes', () => {
    expect(source).not.toMatch(/text-blue-\d+/);
  });
});

// ─── Barrel export ────────────────────────────────────────────────────────────

describe('CanonicalTabs — barrel export', () => {
  it('is exported from the game component barrel', async () => {
    const barrel = await import('../index');
    expect(barrel).toHaveProperty('CanonicalTabs');
    expect(barrel).toHaveProperty('Tabs');
    expect(barrel).toHaveProperty('TabsList');
    expect(barrel).toHaveProperty('TabsTrigger');
    expect(barrel).toHaveProperty('TabsContent');
  });
});
