/**
 * GameScrollArea — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GameScrollArea } from '../GameScrollArea';

describe('GameScrollArea', () => {
  it('(a) renders scroll area with celestial scrollbar token class', () => {
    render(
      <GameScrollArea data-testid="scroll" style={{ height: '100px' }}>
        <div style={{ height: '500px' }}>tall content</div>
      </GameScrollArea>
    );
    const sa = screen.getByTestId('scroll');
    expect(sa.className).toContain('scroll-area-celestial');
    expect(sa.className).toContain('overflow-auto');
    expect(screen.getByText('tall content')).toBeInTheDocument();
  });
});
