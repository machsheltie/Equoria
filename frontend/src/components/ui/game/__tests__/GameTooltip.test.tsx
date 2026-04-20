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
});
