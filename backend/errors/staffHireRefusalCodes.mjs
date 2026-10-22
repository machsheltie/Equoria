/**
 * Machine-readable `code` for a refused staff-marketplace hire (Equoria-dosig).
 *
 * The rider, trainer and groom marketplace hires answer a full roster and an
 * unaffordable hire with the same 400, so the hire dialog could not tell the
 * player which one stopped them. The response body now carries one of these
 * beside its existing `message` and `data`. The codes are for branching only;
 * the client never shows them.
 */
export const STAFF_HIRE_REFUSAL = Object.freeze({
  ROSTER_CAP_REACHED: 'ROSTER_CAP_REACHED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
});

export default STAFF_HIRE_REFUSAL;
