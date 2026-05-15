/**
 * MarkingsPanel — unit tests (Equoria-ga5g / 31E-3 follow-up)
 *
 * AC coverage:
 *   AC1: shows face marking when phenotype.faceMarking is present
 *   AC2: shows all 4 leg markings (or 'None' when 'none')
 *   AC3: advanced markings render only when present (true)
 *   AC4: modifier chips render only when true
 *
 * Plus:
 *   - returns null for legacy horses (no markings)
 *   - returns null when every sub-field is empty/absent
 *   - capitalizes face/leg marking names
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkingsPanel from '../MarkingsPanel';
import type { HorseMarkings } from '@/pages/horse-detail/HorseDetailPageTypes';

describe('MarkingsPanel', () => {
  it('renders nothing when markings is null (legacy horse)', () => {
    const { container } = render(<MarkingsPanel markings={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when markings is undefined', () => {
    const { container } = render(<MarkingsPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all sub-fields are absent', () => {
    const { container } = render(<MarkingsPanel markings={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('AC1: shows face marking when faceMarking is present', () => {
    const markings: HorseMarkings = { faceMarking: 'blaze' };
    render(<MarkingsPanel markings={markings} />);
    expect(screen.getByTestId('markings-panel')).toBeTruthy();
    expect(screen.getByTestId('markings-face-value').textContent).toBe('Blaze');
  });

  it('capitalizes face marking strings (snip -> Snip)', () => {
    const markings: HorseMarkings = { faceMarking: 'snip' };
    render(<MarkingsPanel markings={markings} />);
    expect(screen.getByTestId('markings-face-value').textContent).toBe('Snip');
  });

  it("shows 'None' for face marking value 'none'", () => {
    const markings: HorseMarkings = { faceMarking: 'none' };
    render(<MarkingsPanel markings={markings} />);
    expect(screen.getByTestId('markings-face-value').textContent).toBe('None');
  });

  it('AC2: renders all 4 leg markings (FL, FR, HL, HR) with capitalization', () => {
    const markings: HorseMarkings = {
      legMarkings: {
        frontLeft: 'sock',
        frontRight: 'pastern',
        hindLeft: 'none',
        hindRight: 'stocking',
      },
    };
    render(<MarkingsPanel markings={markings} />);
    const legsEl = screen.getByTestId('markings-legs');
    expect(legsEl.textContent).toMatch(/FL: Sock/);
    expect(legsEl.textContent).toMatch(/FR: Pastern/);
    expect(legsEl.textContent).toMatch(/HL: None/);
    expect(legsEl.textContent).toMatch(/HR: Stocking/);
  });

  it('AC3: renders only present advanced markings (true flags)', () => {
    const markings: HorseMarkings = {
      advancedMarkings: {
        bloodyShoulderPresent: true,
        snowflakePresent: false,
        frostPresent: true,
      },
    };
    render(<MarkingsPanel markings={markings} />);
    expect(screen.getByTestId('markings-advanced-bloodyShoulderPresent')).toBeTruthy();
    expect(screen.getByTestId('markings-advanced-frostPresent')).toBeTruthy();
    // snowflake is false — must NOT render
    expect(screen.queryByTestId('markings-advanced-snowflakePresent')).toBeNull();
  });

  it('AC3: renders nothing for advanced markings when all flags are false', () => {
    const markings: HorseMarkings = {
      advancedMarkings: {
        bloodyShoulderPresent: false,
        snowflakePresent: false,
        frostPresent: false,
      },
    };
    const { container } = render(<MarkingsPanel markings={markings} />);
    // No advanced chips
    expect(container.querySelector('[data-testid="markings-advanced"]')).toBeNull();
    // And — since face/legs/modifiers are also empty — the whole panel is null
    expect(container.firstChild).toBeNull();
  });

  it('AC4: renders only true modifier chips', () => {
    const markings: HorseMarkings = {
      modifiers: {
        isSooty: true,
        isFlaxen: false,
        hasPangare: true,
        isRabicano: false,
      },
    };
    render(<MarkingsPanel markings={markings} />);
    expect(screen.getByTestId('markings-modifier-isSooty')).toBeTruthy();
    expect(screen.getByTestId('markings-modifier-hasPangare')).toBeTruthy();
    expect(screen.queryByTestId('markings-modifier-isFlaxen')).toBeNull();
    expect(screen.queryByTestId('markings-modifier-isRabicano')).toBeNull();
  });

  it('AC4: hides modifier panel entirely when no modifiers are true', () => {
    const markings: HorseMarkings = {
      modifiers: { isSooty: false, isFlaxen: false, hasPangare: false, isRabicano: false },
    };
    const { container } = render(<MarkingsPanel markings={markings} />);
    expect(container.querySelector('[data-testid="markings-modifiers"]')).toBeNull();
  });

  it('renders all 4 sections together when a horse has every marking type', () => {
    const markings: HorseMarkings = {
      faceMarking: 'star',
      legMarkings: { frontLeft: 'sock', frontRight: 'none', hindLeft: 'none', hindRight: 'none' },
      advancedMarkings: {
        bloodyShoulderPresent: true,
        snowflakePresent: false,
        frostPresent: false,
      },
      modifiers: { isSooty: true, isFlaxen: false, hasPangare: false, isRabicano: false },
    };
    render(<MarkingsPanel markings={markings} />);
    expect(screen.getByTestId('markings-face')).toBeTruthy();
    expect(screen.getByTestId('markings-legs')).toBeTruthy();
    expect(screen.getByTestId('markings-advanced')).toBeTruthy();
    expect(screen.getByTestId('markings-modifiers')).toBeTruthy();
  });
});
