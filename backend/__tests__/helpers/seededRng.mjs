/**
 * A seeded 0..1 random function for statistical tests (Equoria-b6n4k, Equoria-0frwt).
 *
 * A distribution test that draws from Math.random and asserts a chi-squared
 * bound at p = 0.001 fails by design about once per thousand runs, and a gate
 * that fails at random trains people to retry blind. Driving the code under
 * test with a fixed seed makes every run draw the same sequence, so the bound
 * is checked against one reproducible sample: a correct distribution passes on
 * every run, and a biased one still produces a huge statistic and fails.
 *
 * mulberry32: a small 32-bit generator with a full 2^32 period and good
 * equidistribution for the sample sizes used here (10^4 to 10^6 draws).
 *
 * @param {number} seed - any 32-bit integer
 * @returns {() => number} a function returning floats in [0, 1)
 */
export function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
