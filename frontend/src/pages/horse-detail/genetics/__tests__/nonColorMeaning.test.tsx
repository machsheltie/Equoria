/**
 * Genetics-tab non-colour-meaning coverage (task 23, fix round 1).
 *
 * WHY THIS FILE EXISTS. The four Genetics-tab sections had no suite of their
 * own, and the suite that appeared to cover them could not: the shared fixture
 * `pages/horse-detail/__tests__/pageDetail.testHelpers.tsx` serves
 * `traits: []`, `interactions: []` and `timeline: []`, so every section hits its
 * empty guard and returns `null`. Nothing in these components executed under
 * test. `tsc` and `eslint` were the only real guards on the palette migration.
 *
 * WHAT IT ASSERTS. Not colours — the design audit already enforces the absence
 * of raw palette classes, and asserting the replacement class strings would
 * just pin styling. It asserts the thing the retired exceptions actually
 * demanded: that every distinction colour used to carry alone is now carried by
 * text, an accessible name, or a per-phase shape. Delete a band label, drop a
 * phase icon, or unlabel a contribution segment and a test here fails.
 *
 * These four components are pure props-in/markup-out, so there is nothing to
 * mock: real components, real data shapes from `hooks/useHorseGenetics`.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type {
  EpigeneticTrait,
  TraitInteraction,
  TraitTimelineEntry,
} from '../../../../hooks/useHorseGenetics';
import type { Horse } from '../../HorseDetailPageTypes';
import GeneticOverviewCard from '../GeneticOverviewCard';
import LineageSection from '../LineageSection';
import TraitInteractionsSection from '../TraitInteractionsSection';
import TraitTimelineSection from '../TraitTimelineSection';

/* ── fixtures ───────────────────────────────────────────────────────────── */

function trait(over: Partial<EpigeneticTrait> = {}): EpigeneticTrait {
  return {
    name: 'Bold',
    type: 'epigenetic',
    description: 'Confident under pressure.',
    rarity: 'common',
    strength: 50,
    impact: {},
    ...over,
  };
}

/**
 * Metric bands are derived, so each case pins the arithmetic it relies on:
 *   avgScore      = mean of rarity scores (legendary 100 / rare 70 / common 40)
 *   avgStrength   = mean of trait.strength
 *   breedingValue = min(100, legendary*30 + rare*10 + count*2)
 */
const THREE_LEGENDARY_STRONG = [
  trait({ name: 'A', rarity: 'legendary', strength: 90 }),
  trait({ name: 'B', rarity: 'legendary', strength: 90 }),
  trait({ name: 'C', rarity: 'legendary', strength: 90 }),
]; // avgScore 100 → Exceptional · avgStrength 90 → Strong · breeding 96 → Exceptional

const ONE_COMMON_WEAK = [trait({ name: 'A', rarity: 'common', strength: 10 })];
// avgScore 40 → Good · avgStrength 10 → Mild · breeding 32 → Below Average

const RARE_MIDDLING = [
  trait({ name: 'A', rarity: 'rare', strength: 60 }),
  trait({ name: 'B', rarity: 'rare', strength: 60 }),
];
// avgScore 70 → Excellent · avgStrength 60 → Moderate · breeding 24 → Below Average

function horse(over: Partial<Horse> = {}): Horse {
  return {
    id: 1,
    name: 'Moonlight',
    breed: 'Thoroughbred',
    age: 4,
    gender: 'Mare',
    dateOfBirth: '2022-04-01',
    healthStatus: 'Healthy',
    stats: {
      precision: 50,
      strength: 50,
      speed: 50,
      agility: 50,
      endurance: 50,
      intelligence: 50,
      stamina: 50,
      balance: 50,
      boldness: 50,
      flexibility: 50,
      obedience: 50,
      focus: 50,
    },
    disciplineScores: {},
    parentIds: { sireId: 10, damId: 11 },
    ...over,
  };
}

/** The card whose label is `label`, for scoped band assertions. */
function metricCard(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  const card = labelEl.parentElement;
  if (!card) throw new Error(`no card wrapper for metric "${label}"`);
  return card;
}

/* ── GeneticOverviewCard ────────────────────────────────────────────────── */

describe('GeneticOverviewCard — band is readable without colour', () => {
  it.each([
    {
      name: 'top bands',
      traits: THREE_LEGENDARY_STRONG,
      potential: 'Exceptional',
      strength: 'Strong',
      breeding: 'Exceptional',
    },
    {
      name: 'middle bands',
      traits: RARE_MIDDLING,
      potential: 'Excellent',
      strength: 'Moderate',
      breeding: 'Below Average',
    },
    {
      name: 'bottom bands',
      traits: ONE_COMMON_WEAK,
      potential: 'Good',
      strength: 'Mild',
      breeding: 'Below Average',
    },
  ])('prints each band as text ($name)', ({ traits, potential, strength, breeding }) => {
    render(<GeneticOverviewCard allTraits={traits} interactions={[]} />);

    expect(within(metricCard('Genetic Potential')).getByText(potential)).toBeInTheDocument();
    expect(within(metricCard('Avg Trait Strength')).getByText(strength)).toBeInTheDocument();
    expect(within(metricCard('Breeding Value')).getByText(breeding)).toBeInTheDocument();
  });

  it('keeps the tier bars out of the accessibility tree, because the band is real text', () => {
    render(<GeneticOverviewCard allTraits={THREE_LEGENDARY_STRONG} interactions={[]} />);

    // An aria-label on the bar would only duplicate the visible band + figure.
    // Every bar must therefore be decorative, not an exposed img.
    for (const label of ['Genetic Potential', 'Avg Trait Strength', 'Breeding Value']) {
      expect(within(metricCard(label)).queryByRole('img')).toBeNull();
    }
  });

  it('renders the prime-breeding callout as text, not as a colour cue', () => {
    render(
      <GeneticOverviewCard
        allTraits={THREE_LEGENDARY_STRONG}
        interactions={[{ trait1: 'A', trait2: 'B', effect: 'Synergy', strength: 90 }]}
      />
    );

    expect(screen.getByText(/Prime Breeding Candidate/)).toBeInTheDocument();
  });
});

/* ── LineageSection ─────────────────────────────────────────────────────── */

describe('LineageSection — sire/dam split is readable without colour', () => {
  const inherited: EpigeneticTrait[] = [
    trait({ name: 'S1', source: 'sire' }),
    trait({ name: 'S2', source: 'sire' }),
    trait({ name: 'S3', source: 'sire' }),
    trait({ name: 'S4', source: 'sire' }),
    trait({ name: 'D1', source: 'dam' }),
    trait({ name: 'D2', source: 'dam' }),
    trait({ name: 'D3', source: 'dam' }),
  ]; // 4 sire / 3 dam of 7 → 57% / 43%

  it('names each bar segment in words beside its share', () => {
    render(<LineageSection horse={horse()} allTraits={inherited} />);

    expect(screen.getByText('Sire 57%')).toBeInTheDocument();
    expect(screen.getByText('Dam 43%')).toBeInTheDocument();
  });

  it('gives the bar a spoken summary naming both parents and both counts', () => {
    render(<LineageSection horse={horse()} allTraits={inherited} />);

    expect(
      screen.getByRole('img', {
        name: 'Genetic contribution: sire 4 traits (57%), dam 3 traits (43%)',
      })
    ).toBeInTheDocument();
  });

  it('singularises a one-trait share in the spoken summary', () => {
    render(
      <LineageSection
        horse={horse()}
        allTraits={[trait({ name: 'S1', source: 'sire' }), trait({ name: 'D1', source: 'dam' })]}
      />
    );

    expect(
      screen.getByRole('img', {
        name: 'Genetic contribution: sire 1 trait (50%), dam 1 trait (50%)',
      })
    ).toBeInTheDocument();
  });

  it('keeps the legend words that pair with the swatches', () => {
    render(
      <LineageSection
        horse={horse()}
        allTraits={[...inherited, trait({ name: 'M1', source: 'mutation' })]}
      />
    );

    expect(screen.getByText(/^Sire:/)).toBeInTheDocument();
    expect(screen.getByText(/^Dam:/)).toBeInTheDocument();
    expect(screen.getByText(/^Mutations:/)).toBeInTheDocument();
  });
});

/* ── TraitInteractionsSection ───────────────────────────────────────────── */

describe('TraitInteractionsSection — strength band is readable without colour', () => {
  const interactions: TraitInteraction[] = [
    { trait1: 'Bold', trait2: 'Athletic', effect: 'Amplifies jumping', strength: 82 },
    { trait1: 'Calm', trait2: 'Focused', effect: 'Steadier schooling', strength: 60 },
    { trait1: 'Shy', trait2: 'Stubborn', effect: 'Slower to settle', strength: 20 },
  ];

  it.each([
    { strength: 82, label: 'Strong', glyph: '⬆⬆' },
    { strength: 60, label: 'Moderate', glyph: '⬆' },
    { strength: 20, label: 'Mild', glyph: '→' },
  ])('spells out the $label band next to $strength', ({ strength, label, glyph }) => {
    render(<TraitInteractionsSection interactions={interactions} />);

    expect(screen.getByText(`${label} · ${strength}`)).toBeInTheDocument();
    expect(screen.getByText(glyph)).toBeInTheDocument();
  });

  it('gives each badge a spoken name that says what the number measures', () => {
    render(<TraitInteractionsSection interactions={interactions} />);

    expect(screen.getByLabelText('Interaction strength 82 of 100 — Strong')).toBeInTheDocument();
    expect(screen.getByLabelText('Interaction strength 20 of 100 — Mild')).toBeInTheDocument();
  });
});

/* ── TraitTimelineSection ───────────────────────────────────────────────── */

describe('TraitTimelineSection — phase is readable without colour', () => {
  function entry(id: string, eventType: string): TraitTimelineEntry {
    return {
      id,
      traitName: `Trait ${id}`,
      eventType,
      timestamp: '2026-05-01T00:00:00.000Z',
    };
  }

  const timeline = [
    entry('1', 'Trait Discovery'),
    entry('2', 'Significant Interaction'),
    entry('3', 'Mutation Recorded'),
    entry('4', 'Event'),
  ];

  it('keeps every phase label as visible text', () => {
    render(<TraitTimelineSection timeline={timeline} />);

    for (const label of [
      'Trait Discovery',
      'Significant Interaction',
      'Mutation Recorded',
      'Event',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('gives each phase a distinct decorative shape alongside its label', () => {
    render(<TraitTimelineSection timeline={timeline} />);

    const shapes = timeline.map((e) => {
      const badge = screen.getByText(e.eventType);
      const svg = badge.querySelector('svg');
      expect(svg, `phase "${e.eventType}" has no icon`).not.toBeNull();
      // Decorative: the adjacent label already names the phase, so the icon
      // must not be announced a second time.
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      return svg?.getAttribute('class') ?? '';
    });

    // Four phases must not share one glyph, or the shape carries nothing.
    expect(new Set(shapes).size).toBe(4);
  });
});
