/**
 * GoldTabs — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { GoldTabs, GoldTabsList, GoldTabsTrigger, GoldTabsContent } from '../GoldTabs';

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
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('data-state', 'inactive');
  });

  it('(b) clicking Tab 2 switches data-state to active', async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('data-state', 'inactive');
  });

  it('(b) ArrowRight key navigates between tabs', async () => {
    // Workaround retained from the retired Radix roving-focus v1 era (packages removed
    // in Equoria-rkgq9): that implementation called `setTimeout(() => focusFirst(...))`,
    // a timer firing after userEvent's `keyboard` promise resolved, whose `.focus()`
    // triggered a React state update structurally outside any act() boundary that
    // userEvent or RTL could wrap.
    //
    // Suppress the console.error act() warning for this specific test only. We verify the
    // observable DOM outcome (Tab 2 has focus) which is the only behaviour that matters.
    // Kept defensively after the in-house tabs migration; safe to remove if the warning
    // never fires against the native implementation.
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((msg: unknown, ...args: unknown[]) => {
        if (typeof msg === 'string' && msg.includes('not wrapped in act')) return;
        console.warn(msg, ...args);
      });
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole('tab', { name: 'Tab 1' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveFocus();
    errorSpy.mockRestore();
  });
});
