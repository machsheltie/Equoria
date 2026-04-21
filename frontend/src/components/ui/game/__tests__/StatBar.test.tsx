/**
 * StatBar — Vitest/RTL tests (Story 22-6)
 * Covers the 3-criteria audit: gold gradient fill, midnight track, max glow.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatBar } from '../StatBar';

describe('StatBar', () => {
  it('(a) AC1: fill indicator has gold gradient classes', () => {
    render(<StatBar label="Speed" value={75} />);
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

  it('(a) AC3: glow token class appears when value equals max', () => {
    render(<StatBar label="Agility" value={100} max={100} />);
    const indicator = document.querySelector('[class*="shadow-[var(--glow-stat-max)]"]');
    expect(indicator).not.toBeNull();
  });

  it('(a) AC3: no glow class when value is below max', () => {
    render(<StatBar label="Agility" value={99} max={100} />);
    const indicator = document.querySelector('[class*="shadow-[var(--glow-stat-max)]"]');
    expect(indicator).toBeNull();
  });

  it('(a) track uses --stat-bar-track-border token', () => {
    render(<StatBar label="Speed" value={50} />);
    const track = document.querySelector('[class*="stat-bar-track-border"]');
    expect(track).not.toBeNull();
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
    expect(document.querySelector('[class*="h-2"]')).not.toBeNull();
  });

  it('(a) size=lg applies h-4 track class', () => {
    render(<StatBar label="Stat" value={50} size="lg" />);
    expect(document.querySelector('[class*="h-4"]')).not.toBeNull();
  });

  it('(b) has accessible aria-label on progress root', () => {
    render(<StatBar label="Precision" value={80} />);
    expect(screen.getByRole('progressbar', { name: 'Precision' })).toBeInTheDocument();
  });
});
