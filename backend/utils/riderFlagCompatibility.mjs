/**
 * Rider–Horse Behavioral Flag Compatibility (Equoria-yzqhj.6)
 *
 * Behavioral epigenetic flags (earned during 0–3yr foal care) modulate how
 * WELL the assigned rider performs with THIS specific horse. A horse carrying
 * positive-valence flags (brave, confident, affectionate, resilient) is more
 * compatible with its rider, so the rider's effective bonus is slightly
 * increased (and penalty slightly reduced). A horse carrying negative-valence
 * flags (fearful, insecure, aloof, skittish, fragile) is less compatible, so
 * the rider's bonus is slightly reduced (and penalty slightly increased).
 *
 * 🔑 DISTINCT FROM yzqhj.1: this is NOT the flag→base-score modifier. The .1
 * path (`applyFlagInfluencesToCompetition` in epigeneticFlagInfluence.mjs,
 * wired at competitionScore.mjs:161) applies flag behaviorModifiers to the
 * BASE competition score. THIS module applies a SEPARATE, additional effect to
 * the RIDER bonus/penalty percentages only. The two never touch the same term.
 *
 * Valence source of truth: the canonical flag definitions in
 * config/epigeneticFlagDefinitions.mjs (`getFlagDefinition(...).type` →
 * FLAG_TYPES.POSITIVE / NEGATIVE). We derive net valence from that source so
 * the list cannot drift out of sync with a hand-maintained copy. ADAPTIVE /
 * unknown flags contribute 0 to net valence (neutral).
 *
 * Conservative magnitude:
 *   FLAG_RIDER_COMPAT_PER_FLAG = 0.02  → ±2% of the rider effect per net flag
 *   FLAG_RIDER_COMPAT_CAP      = 0.10  → total bias clamped to ±10%
 *
 * Safety guarantees (regression-safe):
 *   - Returns a neutral factor (1.0) for horses with NO flags.
 *   - The CALLER applies this ONLY when a rider is present, so a horse with no
 *     rider is unaffected (rider percents stay 0 → no effect).
 *   - The bias scales the rider effect; it can shrink it toward 0 but is
 *     clamped so it can NEVER invert the sign of the rider bonus/penalty.
 *   - JSONB-guarded: epigeneticFlags read through `asFlagArray`.
 */

import { getFlagDefinition, FLAG_TYPES } from '../config/epigeneticFlagDefinitions.mjs';
import { asFlagArray } from './jsonbArrayGuard.mjs';

export const FLAG_RIDER_COMPAT_PER_FLAG = 0.02; // ±2% of rider effect per net valence flag
export const FLAG_RIDER_COMPAT_CAP = 0.1; // total bias clamped to ±10%

/**
 * Compute the net valence of a horse's behavioral flags.
 * Positive flags = +1 each, negative flags = -1 each, adaptive/unknown = 0.
 *
 * @param {unknown} epigeneticFlags - JSONB value expected to be an array of flag names
 * @returns {number} net valence (positiveCount - negativeCount)
 */
export function getNetFlagValence(epigeneticFlags) {
  const flags = asFlagArray(epigeneticFlags);
  let net = 0;
  for (const flagName of flags) {
    if (typeof flagName !== 'string') {
      continue;
    }
    const definition = getFlagDefinition(flagName);
    if (!definition) {
      continue; // unknown flag → neutral
    }
    if (definition.type === FLAG_TYPES.POSITIVE) {
      net += 1;
    } else if (definition.type === FLAG_TYPES.NEGATIVE) {
      net -= 1;
    }
    // ADAPTIVE / anything else → neutral, contributes 0
  }
  return net;
}

/**
 * Calculate the rider-compatibility bias factor from a horse's behavioral flags.
 *
 * The returned factor multiplies the rider's bonus/penalty effect:
 *   - net positive valence → factor > 1.0 (rider performs better with this horse)
 *   - net negative valence → factor < 1.0 (rider performs worse with this horse)
 *   - no flags / net zero  → factor === 1.0 (no change — regression-safe)
 *
 * The bias is `1 + clamp(net * PER_FLAG, -CAP, +CAP)`. Because it is clamped to
 * [1 - CAP, 1 + CAP] (i.e. [0.9, 1.1] with current constants), it is always a
 * positive multiplier and therefore CANNOT invert the sign of the rider effect.
 *
 * @param {unknown} epigeneticFlags - JSONB value expected to be an array of flag names
 * @returns {number} compatibility factor in [1 - CAP, 1 + CAP]
 */
export function calculateRiderFlagCompatibility(epigeneticFlags) {
  const net = getNetFlagValence(epigeneticFlags);
  if (net === 0) {
    return 1.0;
  }
  const rawBias = net * FLAG_RIDER_COMPAT_PER_FLAG;
  const clampedBias = Math.max(-FLAG_RIDER_COMPAT_CAP, Math.min(FLAG_RIDER_COMPAT_CAP, rawBias));
  return 1 + clampedBias;
}

export default {
  FLAG_RIDER_COMPAT_PER_FLAG,
  FLAG_RIDER_COMPAT_CAP,
  getNetFlagValence,
  calculateRiderFlagCompatibility,
};
