/**
 * Horse age policy, frontend mirror (Equoria-iehtc).
 *
 * The backend owns the rule (backend/constants/horseAgePolicy.mjs: active window
 * 3-20 game-years, retirement label at 21). The frontend needs the retirement
 * label in several surfaces (Hall of Fame, the stable's legacy tab, the stable
 * category filter). Keeping one constant here means a retirement-age change
 * cannot half-apply; lib/__tests__/horseAgePolicy.sentinel.test.ts pins this
 * value to the backend's so the two cannot drift silently.
 */

/** The age, in game-years, at which a horse retires. Not a gate by itself: the backend enforces eligibility. */
export const retirementAgeYears = 21;
