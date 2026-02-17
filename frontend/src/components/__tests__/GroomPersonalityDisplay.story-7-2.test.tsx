/**
 * Story 7-2: Groom Personality Display
 * Acceptance Criteria Tests
 *
 * FR-G2: Players understand their groom's personality and its effects
 * so they can assign grooms to compatible horses.
 *
 * AC1: Personality type and trait influences visible
 * AC2: Personality affects specific horse traits
 * AC3: Compatibility with horse personalities shown
 * AC4: Effectiveness ratings displayed
 * AC5: Personality develops over career
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GroomPersonalityBadge from '../groom/GroomPersonalityBadge';
import GroomPersonalityDisplay from '../groom/GroomPersonalityDisplay';
import {
  getPersonalityInfo,
  compatibilityLabel,
  compatibilityColorClass,
  magnitudeColorClass,
  PERSONALITY_DATA,
} from '../../types/groomPersonality';

// ──────────────────────────────────────────────────────────────────────────────
// Helper function tests (inline — must test now per testing strategy)
// ──────────────────────────────────────────────────────────────────────────────

describe('groomPersonality helpers', () => {
  describe('getPersonalityInfo', () => {
    it('returns gentle personality info', () => {
      const info = getPersonalityInfo('gentle');
      expect(info.label).toBe('Gentle');
      expect(info.icon).toBe('🌿');
      expect(info.traitInfluences.length).toBeGreaterThan(0);
    });

    it('returns energetic personality info', () => {
      const info = getPersonalityInfo('energetic');
      expect(info.label).toBe('Energetic');
      expect(info.icon).toBe('⚡');
    });

    it('returns patient personality info', () => {
      const info = getPersonalityInfo('patient');
      expect(info.label).toBe('Patient');
    });

    it('returns strict personality info', () => {
      const info = getPersonalityInfo('strict');
      expect(info.label).toBe('Strict');
    });

    it('falls back to patient for unknown personality', () => {
      const info = getPersonalityInfo('unknown_personality');
      expect(info.label).toBe('Patient');
    });

    it('handles case-insensitive lookup', () => {
      expect(getPersonalityInfo('GENTLE').label).toBe('Gentle');
      expect(getPersonalityInfo('Energetic').label).toBe('Energetic');
    });
  });

  describe('compatibilityLabel', () => {
    it('returns High Compatibility for high rating', () => {
      expect(compatibilityLabel('high')).toBe('High Compatibility');
    });

    it('returns Moderate Compatibility for medium rating', () => {
      expect(compatibilityLabel('medium')).toBe('Moderate Compatibility');
    });

    it('returns Low Compatibility for low rating', () => {
      expect(compatibilityLabel('low')).toBe('Low Compatibility');
    });
  });

  describe('compatibilityColorClass', () => {
    it('returns green for high compatibility', () => {
      expect(compatibilityColorClass('high')).toContain('green');
    });

    it('returns amber for medium compatibility', () => {
      expect(compatibilityColorClass('medium')).toContain('amber');
    });

    it('returns red for low compatibility', () => {
      expect(compatibilityColorClass('low')).toContain('red');
    });
  });

  describe('magnitudeColorClass', () => {
    it('returns green bold for high magnitude', () => {
      const cls = magnitudeColorClass('high');
      expect(cls).toContain('green');
      expect(cls).toContain('bold');
    });

    it('returns amber for medium magnitude', () => {
      expect(magnitudeColorClass('medium')).toContain('amber');
    });

    it('returns slate for low magnitude', () => {
      expect(magnitudeColorClass('low')).toContain('slate');
    });
  });

  describe('PERSONALITY_DATA completeness', () => {
    it('all four personalities have traitInfluences', () => {
      for (const personality of Object.keys(PERSONALITY_DATA)) {
        const info = PERSONALITY_DATA[personality as keyof typeof PERSONALITY_DATA];
        expect(info.traitInfluences.length).toBeGreaterThan(0);
      }
    });

    it('all personalities have compatibilityRatings', () => {
      for (const personality of Object.keys(PERSONALITY_DATA)) {
        const info = PERSONALITY_DATA[personality as keyof typeof PERSONALITY_DATA];
        expect(info.compatibilityRatings.length).toBeGreaterThan(0);
      }
    });

    it('all personalities have a development note', () => {
      for (const personality of Object.keys(PERSONALITY_DATA)) {
        const info = PERSONALITY_DATA[personality as keyof typeof PERSONALITY_DATA];
        expect(info.developmentNote.length).toBeGreaterThan(10);
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC1: Personality type and trait influences visible
// ──────────────────────────────────────────────────────────────────────────────

describe('AC1: Personality type and trait influences visible', () => {
  it('GroomPersonalityBadge shows personality label', () => {
    render(<GroomPersonalityBadge personality="gentle" />);
    expect(screen.getByText('Gentle')).toBeInTheDocument();
  });

  it('GroomPersonalityBadge shows personality icon', () => {
    render(<GroomPersonalityBadge personality="gentle" />);
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  it('GroomPersonalityBadge has accessible aria-label', () => {
    render(<GroomPersonalityBadge personality="energetic" />);
    expect(screen.getByLabelText('Personality: Energetic')).toBeInTheDocument();
  });

  it('GroomPersonalityDisplay shows personality label heading', () => {
    render(<GroomPersonalityDisplay personality="patient" />);
    expect(screen.getByTestId('personality-label')).toHaveTextContent('Patient Personality');
  });

  it('GroomPersonalityDisplay shows personality description', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    const desc = screen.getByTestId('personality-description');
    expect(desc.textContent).toMatch(/calm|trust/i);
  });

  it('GroomPersonalityDisplay shows trait influences section', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    expect(screen.getByTestId('trait-influences')).toBeInTheDocument();
  });

  it('displays multiple trait influences for gentle personality', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    // Gentle has: Bonding, Stress Reduction, Obedience
    expect(screen.getByText('Bonding')).toBeInTheDocument();
    expect(screen.getByText('Stress Reduction')).toBeInTheDocument();
    expect(screen.getByText('Obedience')).toBeInTheDocument();
  });

  it('all four personality badges render without error', () => {
    const personalities = ['gentle', 'energetic', 'patient', 'strict'];
    personalities.forEach((p) => {
      const { unmount } = render(<GroomPersonalityBadge personality={p} />);
      expect(
        screen.getByLabelText(`Personality: ${getPersonalityInfo(p).label}`)
      ).toBeInTheDocument();
      unmount();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC2: Personality affects specific horse traits
// ──────────────────────────────────────────────────────────────────────────────

describe('AC2: Personality affects specific horse traits', () => {
  it('energetic personality boosts Agility (high)', () => {
    render(<GroomPersonalityDisplay personality="energetic" />);
    const agilityCell = screen.getByTestId('trait-agility');
    expect(agilityCell.textContent).toMatch(/high/i);
  });

  it('patient personality boosts Intelligence (high)', () => {
    render(<GroomPersonalityDisplay personality="patient" />);
    const intelligenceCell = screen.getByTestId('trait-intelligence');
    expect(intelligenceCell.textContent).toMatch(/high/i);
  });

  it('strict personality boosts Discipline (high)', () => {
    render(<GroomPersonalityDisplay personality="strict" />);
    const disciplineCell = screen.getByTestId('trait-discipline');
    expect(disciplineCell.textContent).toMatch(/high/i);
  });

  it('gentle personality boosts Bonding (high)', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    const bondingCell = screen.getByTestId('trait-bonding');
    expect(bondingCell.textContent).toMatch(/high/i);
  });

  it('different personalities show different trait sets', () => {
    const { unmount } = render(<GroomPersonalityDisplay personality="gentle" />);
    expect(screen.queryByText('Agility')).not.toBeInTheDocument();
    unmount();

    render(<GroomPersonalityDisplay personality="energetic" />);
    expect(screen.getByText('Agility')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC3: Compatibility with horse personalities shown
// ──────────────────────────────────────────────────────────────────────────────

describe('AC3: Compatibility with horse personalities shown', () => {
  it('shows compatibility ratings section', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    expect(screen.getByTestId('compatibility-ratings')).toBeInTheDocument();
  });

  it('gentle personality shows high compatibility with Nervous/Shy horses', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    const nervousCell = screen.getByTestId('compatibility-nervous-shy');
    expect(nervousCell.textContent).toBe('High Compatibility');
  });

  it('energetic personality shows low compatibility with Nervous/Shy horses', () => {
    render(<GroomPersonalityDisplay personality="energetic" />);
    const nervousCell = screen.getByTestId('compatibility-nervous-shy');
    expect(nervousCell.textContent).toBe('Low Compatibility');
  });

  it('patient personality shows high compatibility with Any Temperament', () => {
    render(<GroomPersonalityDisplay personality="patient" />);
    const anyCell = screen.getByTestId('compatibility-any-temperament');
    expect(anyCell.textContent).toBe('High Compatibility');
  });

  it('strict personality shows high compatibility with Competition Horses', () => {
    render(<GroomPersonalityDisplay personality="strict" />);
    const compCell = screen.getByTestId('compatibility-competition-horses');
    expect(compCell.textContent).toBe('High Compatibility');
  });

  it('compatibility section is hidden in compact mode', () => {
    render(<GroomPersonalityDisplay personality="gentle" compact />);
    expect(screen.queryByTestId('compatibility-ratings')).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC4: Effectiveness ratings displayed
// ──────────────────────────────────────────────────────────────────────────────

describe('AC4: Effectiveness ratings displayed', () => {
  it('shows effectiveness rating badge', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    expect(screen.getByTestId('effectiveness-rating')).toBeInTheDocument();
  });

  it('gentle personality shows high effectiveness', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    expect(screen.getByTestId('effectiveness-rating').textContent).toMatch(/high/i);
  });

  it('energetic personality shows high effectiveness', () => {
    render(<GroomPersonalityDisplay personality="energetic" />);
    expect(screen.getByTestId('effectiveness-rating').textContent).toMatch(/high/i);
  });

  it('patient personality shows high effectiveness', () => {
    render(<GroomPersonalityDisplay personality="patient" />);
    expect(screen.getByTestId('effectiveness-rating').textContent).toMatch(/high/i);
  });

  it('strict personality shows high effectiveness', () => {
    render(<GroomPersonalityDisplay personality="strict" />);
    expect(screen.getByTestId('effectiveness-rating').textContent).toMatch(/high/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC5: Personality develops over career
// ──────────────────────────────────────────────────────────────────────────────

describe('AC5: Personality develops over career', () => {
  it('shows career development note section', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    expect(screen.getByTestId('development-note')).toBeInTheDocument();
  });

  it('development note contains career-relevant text', () => {
    render(<GroomPersonalityDisplay personality="gentle" />);
    const note = screen.getByTestId('development-note');
    expect(note.textContent).toMatch(/career|over|time|years/i);
  });

  it('shows experience level label for experienced groom', () => {
    render(<GroomPersonalityDisplay personality="energetic" experience={7} />);
    const note = screen.getByTestId('development-note');
    expect(note.textContent).toMatch(/experienced|7/i);
  });

  it('shows Veteran label for 10+ years experience', () => {
    render(<GroomPersonalityDisplay personality="strict" experience={12} />);
    const note = screen.getByTestId('development-note');
    expect(note.textContent).toMatch(/veteran|12/i);
  });

  it('shows Early Career for 0 or 1 year experience', () => {
    render(<GroomPersonalityDisplay personality="patient" experience={1} />);
    const note = screen.getByTestId('development-note');
    expect(note.textContent).toMatch(/early career|1/i);
  });

  it('development note is personality-specific', () => {
    const { unmount } = render(<GroomPersonalityDisplay personality="gentle" />);
    const gentleNote = screen.getByTestId('development-note').textContent;
    unmount();

    render(<GroomPersonalityDisplay personality="strict" />);
    const strictNote = screen.getByTestId('development-note').textContent;

    expect(gentleNote).not.toBe(strictNote);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Integration: Badge rendering in list context
// ──────────────────────────────────────────────────────────────────────────────

describe('Integration: Personality badge in groom list', () => {
  it('renders badge for all personality types without throwing', () => {
    const { container } = render(
      <div>
        <GroomPersonalityBadge personality="gentle" />
        <GroomPersonalityBadge personality="energetic" />
        <GroomPersonalityBadge personality="patient" />
        <GroomPersonalityBadge personality="strict" />
      </div>
    );
    expect(container.querySelectorAll('[data-testid="personality-badge"]')).toHaveLength(4);
  });

  it('badge tooltip shows description', () => {
    render(<GroomPersonalityBadge personality="energetic" showTooltip />);
    const badge = screen.getByTestId('personality-badge');
    expect(badge.getAttribute('title')).toMatch(/active|engaged|athletic|training/i);
  });

  it('medium size badge renders correctly', () => {
    render(<GroomPersonalityBadge personality="patient" size="md" />);
    expect(screen.getByText('Patient')).toBeInTheDocument();
  });
});
