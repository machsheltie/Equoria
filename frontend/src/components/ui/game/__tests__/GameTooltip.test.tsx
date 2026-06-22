/**
 * GameTooltip — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import {
  GameTooltip,
  GameTooltipTrigger,
  GameTooltipContent,
  GameTooltipProvider,
} from '../GameTooltip';

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
      expect(screen.getByTestId('tip').className).toContain('bg-[var(--bg-midnight)]');
    });
  });

  it('(a11y) tooltip appears on keyboard focus and content has role="tooltip"', async () => {
    const user = userEvent.setup();
    render(
      <GameTooltipProvider delayDuration={0}>
        <GameTooltip>
          <GameTooltipTrigger asChild>
            <button>Focus me</button>
          </GameTooltipTrigger>
          <GameTooltipContent>Focus tip</GameTooltipContent>
        </GameTooltip>
      </GameTooltipProvider>
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.tab(); // keyboard focus onto the trigger
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Focus tip');
    });
  });

  it('(a11y) aria-describedby links the trigger to the content while open', async () => {
    const user = userEvent.setup();
    render(
      <GameTooltipProvider delayDuration={0}>
        <GameTooltip>
          <GameTooltipTrigger asChild>
            <button>Describe me</button>
          </GameTooltipTrigger>
          <GameTooltipContent>Described content</GameTooltipContent>
        </GameTooltip>
      </GameTooltipProvider>
    );
    const trigger = screen.getByRole('button', { name: 'Describe me' });
    expect(trigger).not.toHaveAttribute('aria-describedby');
    await user.hover(trigger);
    await waitFor(() => {
      const describedBy = trigger.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(screen.getByRole('tooltip').id).toBe(describedBy);
    });
  });

  it('(a11y) hides on mouseleave and on Escape', async () => {
    const user = userEvent.setup();
    render(
      <GameTooltipProvider delayDuration={0}>
        <GameTooltip>
          <GameTooltipTrigger asChild>
            <button>Dismiss me</button>
          </GameTooltipTrigger>
          <GameTooltipContent>Dismiss tip</GameTooltipContent>
        </GameTooltip>
      </GameTooltipProvider>
    );
    const trigger = screen.getByRole('button', { name: 'Dismiss me' });

    // mouseleave hides
    await user.hover(trigger);
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    await user.unhover(trigger);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

    // Escape hides while focused
    trigger.focus();
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });
});
