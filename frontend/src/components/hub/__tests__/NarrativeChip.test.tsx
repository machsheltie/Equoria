/**
 * NarrativeChip Component Tests
 *
 * Tests the contextual chip component and deriveHorseChip helper.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NarrativeChip, deriveHorseChip } from '../NarrativeChip';

describe('NarrativeChip', () => {
  // Story 23.2 AC (Equoria-oey96.52): a chip's text can change as the stable's
  // state changes, so assistive tech must be told.
  it('is announced as a status region', () => {
    render(<NarrativeChip text="Ready to compete!" />);
    expect(screen.getByRole('status')).toHaveTextContent('Ready to compete!');
  });

  it('renders the text content', () => {
    render(<NarrativeChip text="Ready to compete!" />);
    expect(screen.getByText('Ready to compete!')).toBeInTheDocument();
  });

  it('defaults to neutral variant', () => {
    render(<NarrativeChip text="Some text" />);
    const chip = screen.getByText('Some text');
    // Neutral variant includes bg-transparent
    expect(chip.className).toContain('bg-transparent');
  });

  it('applies ready variant styling', () => {
    render(<NarrativeChip text="Go!" variant="ready" />);
    const chip = screen.getByText('Go!');
    // Ready variant migrated from --gold-300 to --gold-light token
    expect(chip.className).toContain('text-[var(--gold-light)]');
  });

  it('applies active variant styling', () => {
    render(<NarrativeChip text="In progress" variant="active" />);
    const chip = screen.getByText('In progress');
    // Active variant migrated from --electric-blue-300 to --status-info token
    expect(chip.className).toContain('text-[var(--status-info)]');
  });

  it('applies cooldown variant styling', () => {
    render(<NarrativeChip text="Cooling down" variant="cooldown" />);
    const chip = screen.getByText('Cooling down');
    expect(chip.className).toContain('text-[var(--text-muted)]');
  });

  it('applies warning variant styling', () => {
    render(<NarrativeChip text="Danger!" variant="warning" />);
    const chip = screen.getByText('Danger!');
    expect(chip.className).toContain('text-[var(--status-warning)]');
  });

  it('applies custom className', () => {
    render(<NarrativeChip text="Test" className="extra-class" />);
    const chip = screen.getByText('Test');
    expect(chip).toHaveClass('extra-class');
  });
});

describe('deriveHorseChip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Equoria-2uqdg: health reads the owner's five health words (ruling 2026-10-23,
  // Equoria-u0jop). Old contract: healthStatus 'healthy' | 'injured' | 'recovering'
  // and the copy 'Injured — needs vet'; those words are not stored or sent.
  it('returns warning chip for a horse in Bad health', () => {
    const result = deriveHorseChip({ health: 'Bad' });
    expect(result).toEqual({
      text: 'In Bad health — needs feeding and the vet',
      variant: 'warning',
    });
  });

  it('returns cooldown chip when training cooldown is active', () => {
    const result = deriveHorseChip({
      trainingCooldownEndsAt: '2026-03-13T12:00:00Z', // 3 days away
    });
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('cooldown');
    expect(result!.text).toContain('Training:');
    expect(result!.text).toContain('3d');
  });

  it('returns ready chip when eligible for competition', () => {
    const result = deriveHorseChip({ isEligibleForCompetition: true });
    expect(result).toEqual({ text: 'Ready to compete!', variant: 'ready' });
  });

  it('returns active chip for foals in development', () => {
    const result = deriveHorseChip({ hasFoalsInDevelopment: 2 });
    expect(result).toEqual({ text: '2 foals developing', variant: 'active' });
  });

  it('returns singular foal text for 1 foal', () => {
    const result = deriveHorseChip({ hasFoalsInDevelopment: 1 });
    expect(result!.text).toBe('1 foal developing');
  });

  it('returns null when no action state matches', () => {
    const result = deriveHorseChip({});
    expect(result).toBeNull();
  });

  it('returns null when horse is in Excellent health with no cooldowns', () => {
    const result = deriveHorseChip({ health: 'Excellent' });
    expect(result).toBeNull();
  });

  it('prioritizes Bad health over other states', () => {
    const result = deriveHorseChip({
      health: 'Bad',
      isEligibleForCompetition: true,
      hasFoalsInDevelopment: 3,
    });
    expect(result!.variant).toBe('warning');
    expect(result!.text).toContain('Bad health');
  });
});
