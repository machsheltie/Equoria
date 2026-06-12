/**
 * trainingApi.train — backend-contract normalization tests (Equoria-pw7d0)
 *
 * These tests exercise the REAL backend response shape produced by
 * backend/modules/training/controllers/trainingController.mjs#trainRouteHandler:
 *
 *   res.json({
 *     success, message, updatedScore,
 *     nextEligibleDate: <ISO string>,   // NOTE: NOT `nextEligible`
 *     traitEffects, temperamentEffects,
 *   });
 *
 * i.e. a FLAT body (no `data` envelope), using the deprecated `nextEligibleDate`
 * field and a flat `updatedScore` — and crucially NO `nextEligible` and NO
 * `updatedHorse`. The pre-existing useTraining.test.tsx / msw handlers return an
 * idealized `{ data: { nextEligible, updatedHorse } }` shape the real backend
 * never emits, which is exactly why the "Invalid Date" regression slipped
 * through (CLAUDE.md §3 — a green test built on a fictional contract).
 *
 * The normalizer must derive the canonical `nextEligible` from whichever field
 * the backend actually sends and must NEVER clobber a real date with ''.
 *
 * Equoria-xfdcg: the dead/casing-mismatched `updatedHorse.discipline_scores`
 * fallback has been removed from the normalizer and the `TrainingResult` type.
 * `updatedScore` is now derived ONLY from the flat `updatedScore` field the
 * real route emits (the prior "backward compat" test asserted a fictional
 * `updatedHorse` contract the backend never sends — CLAUDE.md §3 — and is
 * replaced by the flat-field sentinel below).
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import { trainingApi } from '../training';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

describe('trainingApi.train — real backend contract (Equoria-pw7d0)', () => {
  it('derives a valid next-eligible date from the real flat backend response', async () => {
    const realIso = '2026-06-17T12:00:00.000Z';

    // Mirror the ACTUAL trainRouteHandler response: flat, `nextEligibleDate`,
    // a flat `updatedScore`, and NO `nextEligible` / `updatedHorse`.
    // Equoria-o1x6g: the route now ALSO emits statGain, xpAwarded, and
    // disciplineScoreIncrease (previously dropped). They must pass through the
    // normalizer untouched so TrainingTab can show the real stat-gain modal,
    // the real XP row, and the authoritative score delta.
    server.use(
      http.post(`${base}/api/v1/training/train`, () =>
        HttpResponse.json({
          success: true,
          message: 'Thunder trained in Dressage. +5 added.',
          updatedScore: 45,
          disciplineScoreIncrease: 5,
          xpAwarded: 5,
          statGain: { stat: 'precision', amount: 2, traitModified: false },
          nextEligibleDate: realIso,
          traitEffects: { appliedTraits: [], scoreModifier: 0, xpModifier: 0 },
          temperamentEffects: null,
        })
      )
    );

    const result = await trainingApi.train({ horseId: 1, discipline: 'Dressage' });

    // Canonical field consumed by TrainingTab + useTraining.onSuccess.
    expect(result.nextEligible).toBeTruthy();
    expect(Number.isNaN(new Date(result.nextEligible as string).getTime())).toBe(false);

    // Field consumed by TrainingResultsDisplay.formatDate() — the live player
    // path that rendered "Invalid Date". Must NOT be clobbered to ''.
    expect(result.nextEligibleDate).toBe(realIso);
    expect(Number.isNaN(new Date(result.nextEligibleDate as string).getTime())).toBe(false);

    // The real discipline score from the backend must survive, not be reset to 0.
    expect(result.updatedScore).toBe(45);

    // Equoria-o1x6g: the previously-dropped fields TrainingTab now reads.
    expect(result.disciplineScoreIncrease).toBe(5);
    expect(result.xpAwarded).toBe(5);
    expect(result.statGain).toEqual({ stat: 'precision', amount: 2, traitModified: false });
  });

  it('does NOT derive updatedScore from a stray updatedHorse.discipline_scores (Equoria-xfdcg)', async () => {
    // Sentinel-positive: this response OMITS the flat `updatedScore` and
    // smuggles in the old, casing-mismatched `updatedHorse.discipline_scores`
    // shape (999). With the dead fallback REMOVED, the normalizer must NOT read
    // 999 — it falls through to the explicit `?? 0`. Were the fallback still
    // wired (`?? result.updatedHorse?.discipline_scores?.[discipline]`),
    // updatedScore would be 999 and this test would fail — proving the fallback
    // is genuinely gone, not merely shadowed.
    server.use(
      http.post(`${base}/api/v1/training/train`, () =>
        HttpResponse.json({
          success: true,
          message: 'Thunder trained in Racing.',
          // NO flat `updatedScore`.
          nextEligibleDate: '2026-02-06T10:00:00.000Z',
          updatedHorse: { id: 1, name: 'Thunder', discipline_scores: { Racing: 999 } },
          statGain: { stat: 'speed', amount: 2, traitModified: false },
        })
      )
    );

    const result = await trainingApi.train({ horseId: 1, discipline: 'Racing' });

    // 999 from the dead path must NOT leak through; the only fallback is `?? 0`.
    expect(result.updatedScore).toBe(0);
    expect(result.nextEligibleDate).toBe('2026-02-06T10:00:00.000Z');
    expect(result.statGain?.stat).toBe('speed');
  });

  it('derives updatedScore from the flat field when the backend sends it', async () => {
    server.use(
      http.post(`${base}/api/v1/training/train`, () =>
        HttpResponse.json({
          success: true,
          message: 'Thunder trained in Racing. +5 added.',
          updatedScore: 92,
          nextEligibleDate: '2026-02-06T10:00:00.000Z',
          statGain: { stat: 'speed', amount: 2, traitModified: false },
        })
      )
    );

    const result = await trainingApi.train({ horseId: 1, discipline: 'Racing' });

    expect(result.updatedScore).toBe(92);
    expect(result.nextEligibleDate).toBe('2026-02-06T10:00:00.000Z');
    expect(result.statGain?.stat).toBe('speed');
  });
});
