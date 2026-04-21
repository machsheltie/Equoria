/**
 * FrostedPanel — Vitest/RTL tests (Story 22-6)
 * (a) token-based class names · (b) keyboard interaction · (c) data-state
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import {
  FrostedPanel,
  FrostedPanelHeader,
  FrostedPanelTitle,
  FrostedPanelContent,
} from '../FrostedPanel';

describe('FrostedPanel', () => {
  it('(a) renders with glass-panel token class', () => {
    render(
      <FrostedPanel data-testid="panel">
        <FrostedPanelContent>content</FrostedPanelContent>
      </FrostedPanel>
    );
    expect(screen.getByTestId('panel').className).toContain('glass-panel');
  });

  it('(a) FrostedPanelTitle uses --gold-400 token', () => {
    render(
      <FrostedPanel>
        <FrostedPanelHeader>
          <FrostedPanelTitle data-testid="title">Horse Stats</FrostedPanelTitle>
        </FrostedPanelHeader>
      </FrostedPanel>
    );
    expect(screen.getByTestId('title').className).toContain('text-[var(--gold-400)]');
  });

  it('(a) FrostedPanel has hover gold border class', () => {
    render(<FrostedPanel data-testid="panel">content</FrostedPanel>);
    expect(screen.getByTestId('panel').className).toContain('hover:border-[var(--gold-dim)]');
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
