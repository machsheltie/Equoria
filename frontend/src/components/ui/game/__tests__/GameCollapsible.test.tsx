/**
 * GameCollapsible — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import {
  GameCollapsible,
  GameCollapsibleTrigger,
  GameCollapsibleContent,
} from '../GameCollapsible';

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

  it('(a) content area has glass-panel-subtle class', () => {
    renderCollapsible(true);
    expect(screen.getByTestId('content').className).toContain('glass-panel-subtle');
  });
});
