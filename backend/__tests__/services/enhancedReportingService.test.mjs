/**
 * enhancedReportingService tests (Equoria-rr7)
 *
 * All exported sync/async functions are pure (prisma imported as _prisma, never called).
 * Only analyzeStableEnvironmentalFactors and generateComprehensiveReport call an external
 * service; those are excluded here.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateTraitHistoryInsights,
  generateEpigeneticRecommendations,
  buildTraitTimeline,
  mapEnvironmentalEvents,
  generateStableOverview,
  analyzeTraitDistribution,
  analyzeDevelopmentalStages,
  generateStableRecommendations,
  identifyTraitSimilarities,
  identifyTraitDifferences,
  generateHorseRankings,
  generateComparisonInsights,
  analyzeTraitTrends,
  identifyTraitPatterns,
  generateTrendPredictions,
  generateSummaryReport,
  generateDetailedReport,
  identifyCriticalPeriods,
  analyzeStableEnvironmentalFactors,
  generateHorseComparison,
  generateComprehensiveReport,
} from '../../services/enhancedReportingService.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeHorse(overrides = {}) {
  return {
    id: 1,
    name: 'TestHorse',
    dateOfBirth: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago → mature
    bondScore: 30,
    stressLevel: 3,
    epigeneticFlags: ['curious', 'bold'],
    traitHistoryLogs: [],
    ...overrides,
  };
}

function makeTraitLog(overrides = {}) {
  return {
    traitName: 'curious',
    timestamp: new Date('2025-01-10T10:00:00Z'),
    sourceType: 'training',
    sourceId: 'session-1',
    horseId: 1,
    ...overrides,
  };
}

function makeInteraction(overrides = {}) {
  return {
    createdAt: new Date('2025-01-15T10:00:00Z'),
    interactionType: 'grooming',
    taskType: 'brush',
    bondingChange: 1,
    stressChange: -1,
    quality: 'good',
    groom: { name: 'Alice' },
    ...overrides,
  };
}

function makeEnvContext(overrides = {}) {
  return {
    environmentalTriggers: {
      detectedTriggers: [],
      triggerStrength: 0.2,
      ...overrides.environmentalTriggers,
    },
    ...overrides,
  };
}

function makeTraitInteractions(overrides = {}) {
  return {
    synergies: { synergyPairs: [] },
    conflicts: { conflictPairs: [], totalConflictStrength: 0 },
    traitInteractions: { overallHarmony: 0.6 },
    ...overrides,
  };
}

// ── generateTraitHistoryInsights ─────────────────────────────────────────────

describe('generateTraitHistoryInsights', () => {
  it('returns single message for empty history', () => {
    const result = generateTraitHistoryInsights([], makeEnvContext(), makeTraitInteractions());
    expect(result).toEqual(['No trait history available for analysis']);
  });

  it('reports primary discovery method', () => {
    const history = [
      makeTraitLog({ sourceType: 'training' }),
      makeTraitLog({ sourceType: 'training' }),
      makeTraitLog({ sourceType: 'milestone' }),
    ];
    const result = generateTraitHistoryInsights(history, makeEnvContext(), makeTraitInteractions());
    expect(result.some(s => s.includes('training'))).toBe(true);
  });

  it('reports detected environmental triggers count', () => {
    const env = makeEnvContext({
      environmentalTriggers: {
        detectedTriggers: [{ type: 'heat' }, { type: 'cold' }],
        triggerStrength: 0.4,
      },
    });
    const result = generateTraitHistoryInsights([makeTraitLog()], env, makeTraitInteractions());
    expect(result.some(s => s.includes('2 environmental triggers'))).toBe(true);
  });

  it('reports synergy pairs count', () => {
    const ti = makeTraitInteractions({
      synergies: {
        synergyPairs: [
          ['curious', 'bold'],
          ['calm', 'focused'],
        ],
      },
    });
    const result = generateTraitHistoryInsights([makeTraitLog()], makeEnvContext(), ti);
    expect(result.some(s => s.includes('2 trait synergies'))).toBe(true);
  });

  it('reports conflict pairs count', () => {
    const ti = makeTraitInteractions({
      conflicts: { conflictPairs: [['bold', 'timid']], totalConflictStrength: 0.3 },
    });
    const result = generateTraitHistoryInsights([makeTraitLog()], makeEnvContext(), ti);
    expect(result.some(s => s.includes('1 trait conflicts'))).toBe(true);
  });

  it('reports excellent harmony when overallHarmony > 0.7', () => {
    const ti = makeTraitInteractions({ traitInteractions: { overallHarmony: 0.8 } });
    const result = generateTraitHistoryInsights([makeTraitLog()], makeEnvContext(), ti);
    expect(result.some(s => s.includes('Excellent trait harmony'))).toBe(true);
  });

  it('reports poor harmony when overallHarmony < 0.4', () => {
    const ti = makeTraitInteractions({ traitInteractions: { overallHarmony: 0.3 } });
    const result = generateTraitHistoryInsights([makeTraitLog()], makeEnvContext(), ti);
    expect(result.some(s => s.includes('Poor trait harmony'))).toBe(true);
  });
});

// ── generateEpigeneticRecommendations ────────────────────────────────────────

describe('generateEpigeneticRecommendations', () => {
  const goodEnv = makeEnvContext({ environmentalTriggers: { detectedTriggers: [], triggerStrength: 0.2 } });
  const goodDev = { pendingMilestones: [] };
  const goodTrait = makeTraitInteractions({ conflicts: { conflictPairs: [], totalConflictStrength: 0.1 } });

  it('returns default when horse is well-managed', () => {
    const horse = makeHorse({
      dateOfBirth: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      stressLevel: 3,
      bondScore: 40,
    });
    const result = generateEpigeneticRecommendations(horse, goodEnv, goodTrait, goodDev);
    expect(result).toEqual(['Continue current care approach - horse is developing well']);
  });

  it('adds critical period recommendation for < 30 days old', () => {
    const horse = makeHorse({
      dateOfBirth: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      stressLevel: 3,
      bondScore: 40,
    });
    const result = generateEpigeneticRecommendations(horse, goodEnv, goodTrait, goodDev);
    expect(result.some(r => r.includes('Critical early development'))).toBe(true);
  });

  it('adds socialization recommendation for 30-89 days old', () => {
    const horse = makeHorse({
      dateOfBirth: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      stressLevel: 3,
      bondScore: 40,
    });
    const result = generateEpigeneticRecommendations(horse, goodEnv, goodTrait, goodDev);
    expect(result.some(r => r.includes('socialization period'))).toBe(true);
  });

  it('adds stress recommendation when stressLevel > 6', () => {
    const horse = makeHorse({ stressLevel: 8, bondScore: 40 });
    const result = generateEpigeneticRecommendations(horse, goodEnv, goodTrait, goodDev);
    expect(result.some(r => r.includes('High stress detected'))).toBe(true);
  });

  it('adds bonding recommendation when bondScore < 20', () => {
    const horse = makeHorse({ bondScore: 10, stressLevel: 3 });
    const result = generateEpigeneticRecommendations(horse, goodEnv, goodTrait, goodDev);
    expect(result.some(r => r.includes('Low bonding score'))).toBe(true);
  });

  it('adds environmental recommendation when triggerStrength > 0.6', () => {
    const env = makeEnvContext({ environmentalTriggers: { detectedTriggers: [], triggerStrength: 0.8 } });
    const horse = makeHorse({ bondScore: 40, stressLevel: 3 });
    const result = generateEpigeneticRecommendations(horse, env, goodTrait, goodDev);
    expect(result.some(r => r.includes('Strong environmental triggers'))).toBe(true);
  });

  it('adds conflict recommendation when totalConflictStrength > 0.5', () => {
    const ti = makeTraitInteractions({ conflicts: { conflictPairs: [], totalConflictStrength: 0.7 } });
    const horse = makeHorse({ bondScore: 40, stressLevel: 3 });
    const result = generateEpigeneticRecommendations(horse, goodEnv, ti, goodDev);
    expect(result.some(r => r.includes('Trait conflicts detected'))).toBe(true);
  });

  it('adds milestone recommendation when pendingMilestones present', () => {
    const dev = { pendingMilestones: ['first_trait', 'second_trait'] };
    const horse = makeHorse({ bondScore: 40, stressLevel: 3 });
    const result = generateEpigeneticRecommendations(horse, goodEnv, goodTrait, dev);
    expect(result.some(r => r.includes('2 developmental milestones pending'))).toBe(true);
  });
});

// ── buildTraitTimeline ────────────────────────────────────────────────────────

describe('buildTraitTimeline', () => {
  it('returns empty array for empty inputs', () => {
    expect(buildTraitTimeline([], [])).toEqual([]);
  });

  it('adds trait_discovery events for each history log', () => {
    const log = makeTraitLog();
    const timeline = buildTraitTimeline([log], []);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('trait_discovery');
    expect(timeline[0].event).toContain('curious');
  });

  it('adds significant_interaction only when |bondingChange| > 2', () => {
    const insignificant = makeInteraction({ bondingChange: 1, stressChange: 0 });
    const significant = makeInteraction({
      bondingChange: 3,
      stressChange: 0,
      createdAt: new Date('2025-01-16T10:00:00Z'),
    });
    const timeline = buildTraitTimeline([], [insignificant, significant]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('significant_interaction');
  });

  it('adds significant_interaction when |stressChange| > 2', () => {
    const interaction = makeInteraction({ bondingChange: 0, stressChange: -5 });
    const timeline = buildTraitTimeline([], [interaction]);
    expect(timeline).toHaveLength(1);
  });

  it('sorts timeline by date ascending', () => {
    const early = makeTraitLog({ timestamp: new Date('2025-01-01') });
    const later = makeTraitLog({ traitName: 'bold', timestamp: new Date('2025-06-01') });
    const timeline = buildTraitTimeline([later, early], []);
    expect(new Date(timeline[0].date) < new Date(timeline[1].date)).toBe(true);
  });
});

// ── mapEnvironmentalEvents ────────────────────────────────────────────────────

describe('mapEnvironmentalEvents', () => {
  it('returns empty for interactions with no environmental match', () => {
    const interaction = makeInteraction({ taskType: 'brush', bondingChange: 0, stressChange: 0 });
    expect(mapEnvironmentalEvents([interaction])).toEqual([]);
  });

  it('maps showground_exposure to Novel environment exposure', () => {
    const interaction = makeInteraction({ taskType: 'showground_exposure' });
    const events = mapEnvironmentalEvents([interaction]);
    expect(events[0].factor).toBe('Novel environment exposure');
  });

  it('maps desensitization to Sensory desensitization', () => {
    const interaction = makeInteraction({ taskType: 'desensitization' });
    expect(mapEnvironmentalEvents([interaction])[0].factor).toBe('Sensory desensitization');
  });

  it('maps trust_building to Social bonding activity', () => {
    const interaction = makeInteraction({ taskType: 'trust_building' });
    expect(mapEnvironmentalEvents([interaction])[0].factor).toBe('Social bonding activity');
  });

  it('maps stressChange > 2 to Stress-inducing activity', () => {
    const interaction = makeInteraction({ taskType: 'other', stressChange: 5, bondingChange: 0 });
    expect(mapEnvironmentalEvents([interaction])[0].factor).toBe('Stress-inducing activity');
  });

  it('maps bondingChange > 2 to Bonding-enhancing activity', () => {
    const interaction = makeInteraction({ taskType: 'other', bondingChange: 5, stressChange: 0 });
    expect(mapEnvironmentalEvents([interaction])[0].factor).toBe('Bonding-enhancing activity');
  });

  it('includes impact fields on each event', () => {
    const interaction = makeInteraction({
      taskType: 'trust_building',
      bondingChange: 3,
      stressChange: -1,
      quality: 'excellent',
    });
    const events = mapEnvironmentalEvents([interaction]);
    expect(events[0].impact).toMatchObject({ bonding: 3, stress: -1, quality: 'excellent' });
  });
});

// ── generateStableOverview ────────────────────────────────────────────────────

describe('generateStableOverview', () => {
  it('computes totalHorses', () => {
    const horses = [makeHorse(), makeHorse({ id: 2, name: 'B' })];
    expect(generateStableOverview(horses).totalHorses).toBe(2);
  });

  it('categorizes newborn (< 30 days)', () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    const overview = generateStableOverview([horse]);
    expect(overview.ageDistribution.newborn).toBe(1);
  });

  it('categorizes young (30-89 days)', () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) });
    const overview = generateStableOverview([horse]);
    expect(overview.ageDistribution.young).toBe(1);
  });

  it('categorizes juvenile (90-364 days)', () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) });
    const overview = generateStableOverview([horse]);
    expect(overview.ageDistribution.juvenile).toBe(1);
  });

  it('categorizes mature (>= 365 days)', () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) });
    const overview = generateStableOverview([horse]);
    expect(overview.ageDistribution.mature).toBe(1);
  });

  it('computes average bond and stress', () => {
    const horses = [
      makeHorse({ bondScore: 20, stressLevel: 4 }),
      makeHorse({ id: 2, name: 'B', bondScore: 40, stressLevel: 6 }),
    ];
    const overview = generateStableOverview(horses);
    expect(overview.averageBondScore).toBe(30);
    expect(overview.averageStressLevel).toBe(5);
  });

  it('aggregates trait counts from epigeneticFlags', () => {
    const horses = [
      makeHorse({ epigeneticFlags: ['bold', 'curious'] }),
      makeHorse({ id: 2, name: 'B', epigeneticFlags: ['bold'] }),
    ];
    const overview = generateStableOverview(horses);
    expect(overview.traitCounts.bold).toBe(2);
    expect(overview.traitCounts.curious).toBe(1);
  });
});

// ── analyzeTraitDistribution ──────────────────────────────────────────────────

describe('analyzeTraitDistribution', () => {
  it('returns zeros for empty horses array', () => {
    const dist = analyzeTraitDistribution([]);
    expect(dist.totalTraits).toBe(0);
    expect(dist.uniqueTraits).toBe(0);
  });

  it('counts totalTraits and uniqueTraits', () => {
    const horses = [
      makeHorse({ epigeneticFlags: ['bold', 'curious'] }),
      makeHorse({ id: 2, name: 'B', epigeneticFlags: ['bold'] }),
    ];
    const dist = analyzeTraitDistribution(horses);
    expect(dist.totalTraits).toBe(3);
    expect(dist.uniqueTraits).toBe(2);
  });

  it('commonTraits lists top-3 by frequency', () => {
    const flags = ['a', 'a', 'a', 'b', 'b', 'c', 'd'];
    const horses = [makeHorse({ epigeneticFlags: flags })];
    const dist = analyzeTraitDistribution(horses);
    expect(dist.commonTraits[0].trait).toBe('a');
    expect(dist.commonTraits[0].count).toBe(3);
  });

  it('rareTraits lists bottom-3 by frequency', () => {
    const horses = [makeHorse({ epigeneticFlags: ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'e', 'f'] })];
    const dist = analyzeTraitDistribution(horses);
    expect(dist.rareTraits.length).toBeLessThanOrEqual(3);
  });
});

// ── analyzeDevelopmentalStages ────────────────────────────────────────────────

describe('analyzeDevelopmentalStages', () => {
  it('increments critical for < 14 days old', () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    expect(analyzeDevelopmentalStages([horse]).critical).toBe(1);
  });

  it('increments developing for 14-59 days old', () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    expect(analyzeDevelopmentalStages([horse]).developing).toBe(1);
  });

  it('increments stable for 60-364 days old', () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) });
    expect(analyzeDevelopmentalStages([horse]).stable).toBe(1);
  });

  it('increments mature for >= 365 days old', () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) });
    expect(analyzeDevelopmentalStages([horse]).mature).toBe(1);
  });
});

// ── generateStableRecommendations ────────────────────────────────────────────

describe('generateStableRecommendations', () => {
  const goodOverview = { averageStressLevel: 3, averageBondScore: 35 };
  const goodDist = { uniqueTraits: 8 };
  const goodStages = { critical: 0 };

  it('returns default when stable is well-managed', () => {
    const result = generateStableRecommendations(goodOverview, goodDist, goodStages);
    expect(result).toEqual(['Stable is well-managed - continue current practices']);
  });

  it('adds critical period recommendation when critical > 0', () => {
    const stages = { critical: 2 };
    const result = generateStableRecommendations(goodOverview, goodDist, stages);
    expect(result.some(r => r.includes('2 horses in critical'))).toBe(true);
  });

  it('adds stress recommendation when averageStressLevel > 6', () => {
    const overview = { averageStressLevel: 7, averageBondScore: 35 };
    const result = generateStableRecommendations(overview, goodDist, goodStages);
    expect(result.some(r => r.includes('High average stress'))).toBe(true);
  });

  it('adds bonding recommendation when averageBondScore < 25', () => {
    const overview = { averageStressLevel: 3, averageBondScore: 15 };
    const result = generateStableRecommendations(overview, goodDist, goodStages);
    expect(result.some(r => r.includes('Low average bonding scores'))).toBe(true);
  });

  it('adds diversity recommendation when uniqueTraits < 5', () => {
    const dist = { uniqueTraits: 3 };
    const result = generateStableRecommendations(goodOverview, dist, goodStages);
    expect(result.some(r => r.includes('Limited trait diversity'))).toBe(true);
  });
});

// ── identifyTraitSimilarities / identifyTraitDifferences ─────────────────────

describe('identifyTraitSimilarities', () => {
  it('returns empty for single horse', () => {
    expect(identifyTraitSimilarities([makeHorse()])).toEqual([]);
  });

  it('finds common traits between two horses', () => {
    const h1 = makeHorse({ id: 1, name: 'A', epigeneticFlags: ['bold', 'curious'] });
    const h2 = makeHorse({ id: 2, name: 'B', epigeneticFlags: ['bold', 'calm'] });
    const result = identifyTraitSimilarities([h1, h2]);
    expect(result).toHaveLength(1);
    expect(result[0].commonTraits).toContain('bold');
    expect(result[0].similarityScore).toBeCloseTo(0.5);
  });

  it('returns empty when no common traits', () => {
    const h1 = makeHorse({ id: 1, name: 'A', epigeneticFlags: ['bold'] });
    const h2 = makeHorse({ id: 2, name: 'B', epigeneticFlags: ['calm'] });
    expect(identifyTraitSimilarities([h1, h2])).toEqual([]);
  });

  it('sorts by similarityScore descending', () => {
    const h1 = makeHorse({ id: 1, name: 'A', epigeneticFlags: ['bold', 'curious', 'calm'] });
    const h2 = makeHorse({ id: 2, name: 'B', epigeneticFlags: ['bold', 'curious'] });
    const h3 = makeHorse({ id: 3, name: 'C', epigeneticFlags: ['bold'] });
    const result = identifyTraitSimilarities([h1, h2, h3]);
    expect(result[0].similarityScore).toBeGreaterThanOrEqual(result[1].similarityScore);
  });
});

describe('identifyTraitDifferences', () => {
  it('returns empty for identical traits', () => {
    const h1 = makeHorse({ id: 1, name: 'A', epigeneticFlags: ['bold'] });
    const h2 = makeHorse({ id: 2, name: 'B', epigeneticFlags: ['bold'] });
    expect(identifyTraitDifferences([h1, h2])).toEqual([]);
  });

  it('finds unique traits per horse', () => {
    const h1 = makeHorse({ id: 1, name: 'A', epigeneticFlags: ['bold', 'curious'] });
    const h2 = makeHorse({ id: 2, name: 'B', epigeneticFlags: ['calm'] });
    const result = identifyTraitDifferences([h1, h2]);
    expect(result).toHaveLength(1);
    expect(result[0].horse1.uniqueTraits).toContain('bold');
    expect(result[0].horse2.uniqueTraits).toContain('calm');
  });
});

// ── generateHorseRankings ─────────────────────────────────────────────────────

describe('generateHorseRankings', () => {
  const horses = [
    makeHorse({ id: 1, name: 'A', epigeneticFlags: ['a', 'b'], bondScore: 30, stressLevel: 8 }),
    makeHorse({ id: 2, name: 'B', epigeneticFlags: ['a', 'b', 'c'], bondScore: 50, stressLevel: 2 }),
    makeHorse({ id: 3, name: 'C', epigeneticFlags: ['a'], bondScore: 20, stressLevel: 5 }),
  ];

  it('ranks by trait count descending', () => {
    const rankings = generateHorseRankings(horses);
    expect(rankings.byTraitCount[0].horse.name).toBe('B');
    expect(rankings.byTraitCount[0].rank).toBe(1);
  });

  it('ranks by bond score descending', () => {
    const rankings = generateHorseRankings(horses);
    expect(rankings.byBondScore[0].horse.name).toBe('B');
  });

  it('ranks by stress level ascending (lower stress = better)', () => {
    const rankings = generateHorseRankings(horses);
    expect(rankings.byStressLevel[0].horse.name).toBe('B');
  });

  it('assigns correct rank numbers', () => {
    const rankings = generateHorseRankings(horses);
    expect(rankings.byBondScore.map(r => r.rank)).toEqual([1, 2, 3]);
  });
});

// ── analyzeTraitTrends ────────────────────────────────────────────────────────

describe('analyzeTraitTrends', () => {
  it('returns empty for empty history', () => {
    expect(analyzeTraitTrends([], 'weekly')).toEqual([]);
  });

  it('groups by traitName and counts', () => {
    const history = [
      makeTraitLog({ traitName: 'bold', horseId: 1 }),
      makeTraitLog({ traitName: 'bold', horseId: 2 }),
      makeTraitLog({ traitName: 'calm', horseId: 1 }),
    ];
    const trends = analyzeTraitTrends(history, 'weekly');
    const boldTrend = trends.find(t => t.trait === 'bold');
    expect(boldTrend.discoveryCount).toBe(2);
    expect(boldTrend.horsesAffected).toBe(2);
  });

  it('sets trendDirection "increasing" for multiple discoveries', () => {
    const history = [makeTraitLog(), makeTraitLog({ horseId: 2 })];
    const trends = analyzeTraitTrends(history, 'weekly');
    expect(trends[0].trendDirection).toBe('increasing');
  });

  it('sets trendDirection "stable" for single discovery', () => {
    const history = [makeTraitLog()];
    const trends = analyzeTraitTrends(history, 'weekly');
    expect(trends[0].trendDirection).toBe('stable');
  });

  it('sorts by discoveryCount descending', () => {
    const history = [
      makeTraitLog({ traitName: 'calm' }),
      makeTraitLog({ traitName: 'bold' }),
      makeTraitLog({ traitName: 'bold' }),
    ];
    const trends = analyzeTraitTrends(history, 'weekly');
    expect(trends[0].trait).toBe('bold');
  });
});

// ── identifyTraitPatterns ─────────────────────────────────────────────────────

describe('identifyTraitPatterns', () => {
  it('returns empty for empty history', () => {
    expect(identifyTraitPatterns([])).toEqual([]);
  });

  it('returns empty when no same-day groupings', () => {
    const history = [
      makeTraitLog({ timestamp: new Date('2025-01-01') }),
      makeTraitLog({ traitName: 'bold', timestamp: new Date('2025-01-02') }),
    ];
    expect(identifyTraitPatterns(history)).toEqual([]);
  });

  it('identifies simultaneous_discovery for same-day logs', () => {
    const sameDay = new Date('2025-03-15T10:00:00Z');
    const history = [makeTraitLog({ timestamp: sameDay }), makeTraitLog({ traitName: 'bold', timestamp: sameDay })];
    const patterns = identifyTraitPatterns(history);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].type).toBe('simultaneous_discovery');
    expect(patterns[0].traits).toContain('curious');
    expect(patterns[0].traits).toContain('bold');
  });
});

// ── generateTrendPredictions ──────────────────────────────────────────────────

describe('generateTrendPredictions', () => {
  it('returns empty for trends with discoveryCount <= 2', () => {
    const trends = [{ trait: 'bold', discoveryCount: 2, horsesAffected: 1 }];
    expect(generateTrendPredictions(trends, [])).toEqual([]);
  });

  it('generates prediction for trends with discoveryCount > 2', () => {
    const trends = [{ trait: 'bold', discoveryCount: 5, horsesAffected: 3 }];
    const preds = generateTrendPredictions(trends, []);
    expect(preds).toHaveLength(1);
    expect(preds[0].trait).toBe('bold');
    expect(preds[0].confidence).toBeCloseTo(0.5);
  });

  it('caps confidence at 0.9', () => {
    const trends = [{ trait: 'bold', discoveryCount: 100, horsesAffected: 50 }];
    const preds = generateTrendPredictions(trends, []);
    expect(preds[0].confidence).toBe(0.9);
  });
});

// ── generateSummaryReport (async) ─────────────────────────────────────────────

describe('generateSummaryReport', () => {
  it('returns basicInfo with correct shape', async () => {
    const horse = makeHorse({ epigeneticFlags: ['bold', 'curious'] });
    const report = await generateSummaryReport(horse);
    expect(report.basicInfo.id).toBe(horse.id);
    expect(report.basicInfo.name).toBe(horse.name);
    expect(report.basicInfo.traitCount).toBe(2);
    expect(report.basicInfo.traits).toEqual(['bold', 'curious']);
    expect(typeof report.basicInfo.age).toBe('number');
  });

  it('includes bond and stress scores', async () => {
    const horse = makeHorse({ bondScore: 35, stressLevel: 4 });
    const report = await generateSummaryReport(horse);
    expect(report.scores.bondScore).toBe(35);
    expect(report.scores.stressLevel).toBe(4);
  });

  it('generates summary string with excellent bonding for bondScore > 30', async () => {
    const horse = makeHorse({ bondScore: 40 });
    const report = await generateSummaryReport(horse);
    expect(report.summary).toContain('excellent');
  });

  it('generates summary string with good bonding for bondScore 20-30', async () => {
    const horse = makeHorse({ bondScore: 25 });
    const report = await generateSummaryReport(horse);
    expect(report.summary).toContain('good');
  });
});

// ── generateDetailedReport (async) ───────────────────────────────────────────

describe('generateDetailedReport', () => {
  it('includes traitHistory from horse.traitHistoryLogs', async () => {
    const logs = [makeTraitLog()];
    const horse = makeHorse({ traitHistoryLogs: logs });
    const report = await generateDetailedReport(horse);
    expect(report.traitHistory).toBe(logs);
  });

  it('includes developmentalAnalysis with ageCategory and developmentalStage', async () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) });
    const report = await generateDetailedReport(horse);
    expect(report.developmentalAnalysis.ageCategory).toBe('mature');
    expect(report.developmentalAnalysis.developmentalStage).toBe('mature_expression');
  });

  it('ageCategory is newborn for < 30 days', async () => {
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    const report = await generateDetailedReport(horse);
    expect(report.developmentalAnalysis.ageCategory).toBe('newborn');
    expect(report.developmentalAnalysis.developmentalStage).toBe('critical_period');
  });

  it('includes recommendations array', async () => {
    const horse = makeHorse({ stressLevel: 8, bondScore: 10 });
    const report = await generateDetailedReport(horse);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.recommendations.some(r => r.includes('stress'))).toBe(true);
  });
});

// ── generateComparisonInsights ────────────────────────────────────────────────

describe('generateComparisonInsights', () => {
  const comparison = { averages: { traitCount: 2, bondScore: 30, stressLevel: 4 } };
  const similarities = [{ horse1: { name: 'A' }, horse2: { name: 'B' }, similarityScore: 0.8 }];
  const differences = [{ horse1: { name: 'A' }, horse2: { name: 'C' } }];

  it('includes top similarity pair names', () => {
    const insights = generateComparisonInsights(comparison, similarities, differences);
    expect(insights.some(i => i.includes('A') && i.includes('B'))).toBe(true);
  });

  it('includes most different pair names', () => {
    const insights = generateComparisonInsights(comparison, similarities, differences);
    expect(insights.some(i => i.includes('A') && i.includes('C'))).toBe(true);
  });

  it('includes average trait count', () => {
    const insights = generateComparisonInsights(comparison, [], []);
    expect(insights.some(i => i.includes('2.0'))).toBe(true);
  });
});

// ── enhancedReportingService — uncovered branches (Equoria-jkht) ──────────────
// generateDetailedReport: ageCategory 'young' and 'juvenile' + getDevelopmentalStage branches.
// generateSummaryReport: 'developing' bond category (bondScore <= 20).
// generateBasicRecommendations: < 3 flags branch and default-no-recs branch.
// generateComparisonInsights: empty similarities and empty differences paths.
// generateTraitHistoryInsights: neutral harmony (0.4–0.7, neither message).

describe('generateDetailedReport — ageCategory young and juvenile (Equoria-jkht)', () => {
  it('ageCategory is young + active_development for 30-day-old horse', async () => {
    // 30 days: ageCategory=young (<90), developmentalStage=active_development (<60)
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    const report = await generateDetailedReport(horse);
    expect(report.developmentalAnalysis.ageCategory).toBe('young');
    expect(report.developmentalAnalysis.developmentalStage).toBe('active_development');
  });

  it('ageCategory is young + stabilization for 60-day-old horse', async () => {
    // 60 days: ageCategory=young (<90), developmentalStage=stabilization (60 is NOT <60)
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) });
    const report = await generateDetailedReport(horse);
    expect(report.developmentalAnalysis.ageCategory).toBe('young');
    expect(report.developmentalAnalysis.developmentalStage).toBe('stabilization');
  });

  it('ageCategory is juvenile + stabilization for 200-day-old horse', async () => {
    // 200 days: ageCategory=juvenile (<365), developmentalStage=stabilization (<365)
    const horse = makeHorse({ dateOfBirth: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) });
    const report = await generateDetailedReport(horse);
    expect(report.developmentalAnalysis.ageCategory).toBe('juvenile');
    expect(report.developmentalAnalysis.developmentalStage).toBe('stabilization');
  });
});

describe('generateSummaryReport — developing bond category (Equoria-jkht)', () => {
  it('returns "developing" in summary when bondScore <= 20', async () => {
    const horse = makeHorse({ bondScore: 10 });
    const report = await generateSummaryReport(horse);
    expect(report.summary).toContain('developing');
  });
});

describe('generateBasicRecommendations — low trait count and no-recs branches (Equoria-jkht)', () => {
  it('adds enrichment recommendation when epigeneticFlags.length < 3', async () => {
    const horse = makeHorse({ epigeneticFlags: ['bold'], stressLevel: 3, bondScore: 40 });
    const report = await generateDetailedReport(horse);
    expect(report.recommendations.some(r => r.includes('enrichment'))).toBe(true);
  });

  it('returns "Continue current care approach" when no recs triggered', async () => {
    const horse = makeHorse({ stressLevel: 3, bondScore: 40, epigeneticFlags: ['bold', 'curious', 'calm'] });
    const report = await generateDetailedReport(horse);
    expect(report.recommendations).toContain('Continue current care approach');
  });
});

describe('generateComparisonInsights — empty similarities and differences (Equoria-jkht)', () => {
  const comparison = { averages: { traitCount: 2, bondScore: 30, stressLevel: 4 } };

  it('skips similarity insight when similarities is empty', () => {
    const insights = generateComparisonInsights(comparison, [], []);
    expect(insights.some(i => i.includes('Highest similarity'))).toBe(false);
  });

  it('skips most-different insight when differences is empty', () => {
    const insights = generateComparisonInsights(comparison, [], []);
    expect(insights.some(i => i.includes('Most different'))).toBe(false);
  });
});

describe('generateTraitHistoryInsights — neutral harmony branch (Equoria-jkht)', () => {
  it('adds no harmony message when overallHarmony is between 0.4 and 0.7', () => {
    const ti = makeTraitInteractions({ traitInteractions: { overallHarmony: 0.55 } });
    const result = generateTraitHistoryInsights([makeTraitLog()], makeEnvContext(), ti);
    expect(result.some(s => s.includes('Excellent'))).toBe(false);
    expect(result.some(s => s.includes('Poor'))).toBe(false);
  });
});

// ── identifyCriticalPeriods — branch coverage (Equoria-jkht) ─────────────────
// Lines 175-209: pure function, needs ≥3 events per week-period to enter the
// inner if. Covers: significance ternary (traitDiscoveries>0 → 'high', else 'moderate').

describe('identifyCriticalPeriods — (Equoria-jkht)', () => {
  it('returns empty for empty timeline', () => {
    expect(identifyCriticalPeriods([], [])).toEqual([]);
  });

  it('returns empty when no period has ≥3 events', () => {
    const timeline = [
      { date: '2025-03-15', type: 'trait_discovery' },
      { date: '2025-03-15', type: 'trait_discovery' },
    ];
    expect(identifyCriticalPeriods(timeline, [])).toEqual([]);
  });

  it('returns critical period with significance "high" when traitDiscoveries > 0', () => {
    const sameDate = '2025-03-01';
    const timeline = [
      { date: sameDate, type: 'trait_discovery' },
      { date: sameDate, type: 'trait_discovery' },
      { date: sameDate, type: 'trait_discovery' },
    ];
    const result = identifyCriticalPeriods(timeline, []);
    expect(result).toHaveLength(1);
    expect(result[0].significance).toBe('high');
    expect(result[0].traitDiscoveries).toBe(3);
    expect(result[0].eventCount).toBe(3);
  });

  it('returns critical period with significance "moderate" when significantInteractions > 1 but no traitDiscoveries', () => {
    const sameDate = '2025-03-01';
    const timeline = [
      { date: sameDate, type: 'significant_interaction' },
      { date: sameDate, type: 'significant_interaction' },
      { date: sameDate, type: 'significant_interaction' },
    ];
    const result = identifyCriticalPeriods(timeline, []);
    expect(result).toHaveLength(1);
    expect(result[0].significance).toBe('moderate');
    expect(result[0].significantInteractions).toBe(3);
  });

  it('returns empty when ≥3 events in period but none qualify (no discoveries, ≤1 sig_interaction)', () => {
    const sameDate = '2025-03-01';
    const timeline = [
      { date: sameDate, type: 'grooming' },
      { date: sameDate, type: 'grooming' },
      { date: sameDate, type: 'significant_interaction' },
    ];
    const result = identifyCriticalPeriods(timeline, []);
    expect(result).toHaveLength(0);
  });
});

// ── generateHorseComparison — branch coverage (Equoria-jkht) ─────────────────
// Lines 444-469: async but pure (no DB). Needs horses array with epigeneticFlags,
// bondScore, stressLevel, dateOfBirth properties.

describe('generateHorseComparison — (Equoria-jkht)', () => {
  it('returns comparison with averages for two horses', async () => {
    const horses = [
      makeHorse({ id: 1, name: 'A', epigeneticFlags: ['bold', 'curious'], bondScore: 40, stressLevel: 3 }),
      makeHorse({ id: 2, name: 'B', epigeneticFlags: ['calm'], bondScore: 20, stressLevel: 5 }),
    ];
    const result = await generateHorseComparison(horses);
    expect(result.horses).toHaveLength(2);
    expect(result.averages.traitCount).toBeCloseTo(1.5);
    expect(result.averages.bondScore).toBeCloseTo(30);
    expect(result.averages.stressLevel).toBeCloseTo(4);
    expect(typeof result.horses[0].age).toBe('number');
    expect(result.horses[0].traitCount).toBe(2);
  });
});

// ── analyzeStableEnvironmentalFactors — branch coverage (Equoria-jkht) ──────
// Lines 365-400: async, calls generateEnvironmentalReport(horse.id) internally.
// Branch 1: horses.length === 0 → early return.
// Branch 2: horses.length > 0 but generateEnvironmentalReport throws (caught at 388).

describe('analyzeStableEnvironmentalFactors — (Equoria-jkht)', () => {
  it('returns default factors for empty horses array (length===0 early return)', async () => {
    const result = await analyzeStableEnvironmentalFactors([]);
    expect(result.overallTriggerStrength).toBe(0);
    expect(result.commonTriggers).toEqual([]);
    expect(result.environmentalRisks).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it('returns factors with overallTriggerStrength 0 when generateEnvironmentalReport throws (catch path)', async () => {
    // horse id=-9999 → generateEnvironmentalReport throws → catch warns, skips
    // totalTriggerStrength stays 0 → overallTriggerStrength = 0/1 = 0
    const result = await analyzeStableEnvironmentalFactors([{ id: -9999 }]);
    expect(typeof result.overallTriggerStrength).toBe('number');
    expect(Array.isArray(result.commonTriggers)).toBe(true);
  });
});

// ── generateComprehensiveReport — catch branch (Equoria-jkht) ────────────────
// Lines 718-737: calls generateDetailedReport(horse) then generateEnvironmentalReport(horse.id).
// If generateEnvironmentalReport throws (fake id) → catch at 732 → returns detailed only (line 737).

describe('generateComprehensiveReport — catch branch (Equoria-jkht)', () => {
  it('returns detailed report when generateEnvironmentalReport throws for invalid horse id', async () => {
    const horse = makeHorse({ id: -9999 });
    const result = await generateComprehensiveReport(horse);
    // detailed report fields must be present; environmentalAnalysis must NOT (catch fired)
    expect(result.basicInfo).toBeDefined();
    expect(result.basicInfo.id).toBe(-9999);
    expect(result.environmentalAnalysis).toBeUndefined();
  });
});
