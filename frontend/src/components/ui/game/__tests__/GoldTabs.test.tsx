/**
 * GoldTabs — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
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
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole('tab', { name: 'Tab 1' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveFocus();
  });
});
