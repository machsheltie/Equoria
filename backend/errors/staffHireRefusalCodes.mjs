/**
 * Machine-readable `code` for a refused staff-marketplace hire (Equoria-dosig).
 *
 * The rider, trainer and groom marketplace hires answer a full roster and an
 * unaffordable hire with the same 400, so the hire dialog could not tell the
 * player which one stopped them. The response body now carries one of these
 * beside its existing `message` and `data`. Codes are camelCase like every
 * other name Equoria controls (owner ruling 2026-10-21). They are for
 * branching only; the client never shows them.
 */
export const staffHireRefusal = Object.freeze({
  rosterCapReached: 'rosterCapReached',
  insufficientFunds: 'insufficientFunds',
});

export default staffHireRefusal;
