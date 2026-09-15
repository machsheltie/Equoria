/**
 * horseNamePolicy.mjs — the horse-name rule, and the one clamp the system needs
 * to obey it (Equoria-qkgfh.1)
 *
 * WHY THIS LIVES IN services/ AND NOT IN routes/_validators.mjs
 *   The rule has two kinds of consumer: request validators (routes layer) and
 *   `foalingService`, which DERIVES a name rather than accepting one. A service
 *   importing from `routes/` would invert the layering, so the rule itself sits
 *   here and `routes/_validators.mjs` imports it. `horseNameBodyRule` and the
 *   express-validator middleware stay in the routes layer, where they belong.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * A horse name is a string, raw `.length` <= 40, non-empty after trimming, and
 * contains neither `<` nor NUL. Player-supplied names are stored VERBATIM — no
 * trim, no truncation, no case folding; a violating name is REJECTED, never
 * quietly repaired.
 *
 * WHERE THE BOUNDS COME FROM (found, not invented)
 *   - length 1-40 — OWNER RULING 2026-09-14 (Equoria-zalyb): "Limit: 40
 *     characters for horse names." This REPLACED the 1-100 bound the creation
 *     validators had enforced via `body('name').isLength({ min: 1, max: 100 })`.
 *     40 was already the number the two live surfaces a player actually types
 *     into used — the onboarding input's `maxLength` — so the ruling makes the
 *     whole system agree with what the game already showed her, instead of
 *     accepting 100 in one place and silently cutting at 40 in another.
 *
 *     WHAT THE NARROWING COSTS, stated rather than discovered later: 41-100
 *     character names are now refused everywhere they used to be accepted
 *     (PATCH /horses/:id/name and POST /horses/foals). The longest name in the
 *     live data measured for this policy is 48 UTF-16 units, so a handful of
 *     existing horses carry names that could no longer be RE-typed. Nothing is
 *     broken by that: the bound is checked on input, never on the stored row,
 *     so no horse became unrenameable and no read path rejects anything.
 *   - characters — the rule `validateHorseUpdatePayload` already enforced:
 *     reject `<` and NUL, nothing else. No allow-list regex, because
 *     `backend/__tests__/sql-injection-attempts.test.mjs` requires
 *     `O'Malley's Horse` to be accepted verbatim (201) and excludes 400.
 *
 * WHY RAW `.length` AND NOT express-validator's `isLength`
 *   `isLength` is validator.js `isLength`, which computes
 *   `str.length - presentationSequences.length - surrogatePairs.length`. Under
 *   the old 100 bound it therefore counted 51 grinning-face emoji (102 UTF-16
 *   units) and 100 red-heart emoji (200 units) as inside the cap, and accepted
 *   a whitespace-only name; at 40 the same arithmetic would let 20 emoji (40
 *   stored units) past a cap of 40 while refusing 40 letters' worth of a name
 *   the player can see. Raw `.length` is what Postgres actually stores, so it
 *   is the honest bound. Adopting the stricter count everywhere was checked against the live
 *   data BEFORE it was chosen, not assumed: 515 horse rows measured, longest
 *   name 48 UTF-16 units, ZERO failing any clause — plus the indirect column
 *   `Horse.pendingFoalName`, 6 rows, longest 30, also zero. So no existing horse
 *   became unrenameable, which is the harm that would have forced the permissive
 *   rule instead.
 *
 * NOT enforced, on purpose
 *   - Uniqueness. The owner ruled 2026-09-09 that names need not be unique, and
 *     `Horse.name` carries no unique index in schema.prisma, in any migration,
 *     or in the live catalog.
 *   - Leading/trailing whitespace. `'  Fred  '` is accepted and stored padded.
 *     Rejecting it has no precedent in this codebase and trimming it would be
 *     the normalisation this policy refuses; zero live names are padded.
 *
 * `backend/utils/securityValidation.mjs#validateHorseData` claims 2-50 plus an
 * ASCII allow-list, and `backend/middleware/validateHorse.mjs` claims 2-100, but
 * no route imports either — only their own unit tests do. Neither is enforced
 * behaviour, neither is the precedent followed, and neither was updated when the
 * owner set the limit to 40; if one is ever wired to a route it must adopt this
 * module's rule rather than reintroduce its own.
 */

export const HORSE_NAME_MIN_LENGTH = 1;
export const HORSE_NAME_MAX_LENGTH = 40;

/**
 * The name every foal is born with (Equoria-4fnro, OWNER RULING 2026-09-14:
 * "At birth a foal is named 'unnamed' and stays so until the player names it").
 *
 * IT IS A NAME, NOT A NULL. `Horse.name` is non-nullable and every surface in
 * the game renders it, so the newborn needs a real string; this is the string
 * the owner chose. Lower-case and unadorned on purpose — it should read on the
 * horse's own header as a blank waiting to be filled in, not as a title.
 *
 * IT SATISFIES THE POLICY. 7 characters, no `<`, no NUL — so the name the game
 * mints at birth is one a player could type, and `horseNameRejectionReason`
 * returns null for it. (`unnamedNameIsAcceptable` below is that claim, checkable.)
 *
 * IT IS NOT A COLLISION. Every foal born shares it, and that is fine: the owner
 * ruled 2026-09-09 that horse names need not be unique, `Horse.name` carries no
 * unique index in schema.prisma, in any migration, or in the live catalog, and
 * no lookup anywhere resolves a horse BY name. Two unnamed foals in one stable
 * are two horses waiting to be named, not a conflict.
 *
 * WHAT IT REPLACED. `deriveFoalName()` built `<Dam> Foal` — a generated name
 * that looked like a choice somebody made, so a player could easily not notice
 * that no one had named her foal. 'unnamed' cannot be mistaken for a decision.
 */
export const UNNAMED_HORSE_NAME = 'unnamed';

/**
 * Why a candidate horse name is unacceptable, or null when it is acceptable.
 *
 * Returning a reason (rather than a message) lets `PUT /horses/:id` keep its
 * historical single 'Invalid horse name' wording — so its responses stay
 * byte-identical — while the other gated paths report which rule failed.
 *
 * @param {unknown} name - candidate name, exactly as it arrived on the request
 * @returns {'type'|'length'|'characters'|null}
 */
export function horseNameRejectionReason(name) {
  if (typeof name !== 'string') {
    return 'type';
  }
  // Bound the RAW value — the stored string is the raw string, so measuring
  // anything else (as validator.js isLength does) would let an over-long name
  // through on a technicality.
  if (name.length > HORSE_NAME_MAX_LENGTH) {
    return 'length';
  }
  if (name.trim().length < HORSE_NAME_MIN_LENGTH) {
    return 'length';
  }
  // ── THE CHARACTER RULE IS A DELIBERATE BOUNDARY DECISION ──────────────────
  // OWNER RULING 2026-09-14 (Equoria-du5qe): the refusal of the angle bracket is
  // RATIFIED. It is recorded here rather than left to read as an arbitrary
  // blacklist, because the next person to meet it will otherwise widen it into a
  // naming rule or delete it as paranoia. Do neither without an owner ruling.
  //
  // WHY IT EXISTS: boundary hygiene, NOT a naming rule. Nothing about `<` makes
  // it a bad name for a horse; the game's naming stance is otherwise
  // unrestricted (any time, any reason, no uniqueness — owner rulings 2026-09-08
  // and 2026-09-09). The bracket is refused at the boundary so that no surface
  // which ever renders a horse name WITHOUT escaping can be made to interpret
  // one as markup. React escapes by default, so the realistic exposure is a
  // future non-React surface: an email, a PDF, a CSV, a log viewer, an admin
  // tool. Refusing the one character that opens a tag is cheap here and removes
  // that whole class of worry from every such surface at once.
  //
  // SCOPE, STATED EXACTLY: `<` is refused; `>` is not, because a lone `>` cannot
  // open a tag and refusing it would cost a player a legitimate character for
  // nothing. NUL is refused for a different and simpler reason — it has no
  // legitimate place in a name and breaks C-style string handling downstream.
  //
  // MEASURED, NOT ASSUMED (2026-09-11): across 515 live horse rows and 6
  // `pendingFoalName` rows, ZERO contain an angle bracket and ZERO contain a
  // NUL. So this rule refuses nothing any player has actually chosen; it is a
  // boundary that has never yet been reached.
  //
  // IF YOU ARE HERE TO CHANGE IT: widening (adding characters) turns a targeted
  // boundary defence into the naming blacklist this game does not want, and
  // deleting it shifts the obligation onto every present and future rendering
  // surface — which then has to be audited. Either direction is the owner's
  // call, not an implementer's.
  if (name.includes('<') || name.includes('\0')) {
    return 'characters';
  }
  return null;
}

/**
 * The player-facing message for a rejection reason. One wording per rule, so
 * "rejected with a message naming the rule" is a checkable claim rather than an
 * aspiration — the rename suite asserts these exact strings.
 *
 * @param {'type'|'length'|'characters'} reason
 * @returns {string}
 */
export function horseNameRejectionMessage(reason) {
  switch (reason) {
    case 'type':
      return 'Horse name must be a string';
    case 'length':
      return `Horse name must be between ${HORSE_NAME_MIN_LENGTH} and ${HORSE_NAME_MAX_LENGTH} characters`;
    case 'characters':
      return 'Horse name may not contain < or a null character';
    default:
      return 'Invalid horse name';
  }
}

/**
 * The same rejection, said to a player who has never seen this game before
 * (Equoria-zalyb; OWNER RULING 2026-09-14: "with a rejection message worth
 * reading since it is a new player's first action").
 *
 * WHY A SECOND WORDING RATHER THAN A SECOND RULE
 *   The rule is one function (`horseNameRejectionReason`) and stays one
 *   function. Only the COPY differs, and only on the one surface where the
 *   reader is naming her first horse in the first two minutes of the game:
 *   'Horse name must be between 1 and 40 characters' is a validator talking to
 *   a developer. This is the game talking to a player, and it tells her the
 *   limit, how far over she is, and that nothing she did is lost.
 *
 *   The PUT path already established the precedent that one rule may have more
 *   than one wording (it keeps its historical single 'Invalid horse name').
 *
 * @param {'type'|'length'|'characters'} reason
 * @param {unknown} name - the candidate, used only to say how long it was
 * @returns {string}
 */
export function firstHorseNameRejectionMessage(reason, name) {
  const length = typeof name === 'string' ? name.length : 0;
  switch (reason) {
    case 'length':
      if (length > HORSE_NAME_MAX_LENGTH) {
        return (
          `That name is ${length} characters — a horse name can be up to ` +
          `${HORSE_NAME_MAX_LENGTH}. Trim ${length - HORSE_NAME_MAX_LENGTH} and she is ready to ` +
          'come home. Nothing else you chose has been lost.'
        );
      }
      return 'Your horse needs a name — even a short one. Type anything and you can change it later.';
    case 'characters':
      return (
        'A horse name cannot contain the "<" character (it confuses the places ' +
        'her name gets written down). Try it without that one, and everything ' +
        'else you chose is still here.'
      );
    case 'type':
    default:
      return 'Your horse needs a name — type one and you can change it any time afterwards.';
  }
}

/**
 * Is the birth name the game mints acceptable under the rule the game enforces?
 *
 * A one-line invariant rather than a comment claiming it: `UNNAMED_HORSE_NAME`
 * is written by `foalingService` at every birth, and the day it stops
 * satisfying the policy is the day the game mints horses it would refuse to
 * accept. The rename suite asserts this.
 *
 * @returns {boolean}
 */
export function unnamedNameIsAcceptable() {
  return horseNameRejectionReason(UNNAMED_HORSE_NAME) === null;
}
