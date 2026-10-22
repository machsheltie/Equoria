/**
 * Single-statement writes to Horse.epigeneticModifiers (Equoria-m1sf8).
 *
 * The column is one JSON object written by more than one job: the nightly foal
 * trait evaluation appends to positive / negative / hidden, and the age-1
 * milestone records its tags under its own key. Each used to read the whole
 * object, change it in memory and write the whole object back, so whichever
 * wrote second erased the other's work.
 *
 * These helpers change only what their caller owns, in one UPDATE that
 * computes the new value from the row's current value. Under READ COMMITTED a
 * blocked UPDATE re-reads the row version it finally locks, so a concurrent
 * writer's committed change is kept. A stored value that is not a JSON object
 * (a legacy null or array) is treated as empty, matching how readers treat it.
 */

/**
 * Append newly revealed trait names to the positive, negative and hidden arrays.
 * @param {object} client - Prisma client or interactive-transaction client
 * @param {number} horseId
 * @param {{positive: string[], negative: string[], hidden: string[]}} newTraits
 * @returns {Promise<object|null>} the stored epigeneticModifiers after the append
 */
export async function appendEpigeneticTraits(client, horseId, newTraits) {
  const positive = JSON.stringify(newTraits.positive ?? []);
  const negative = JSON.stringify(newTraits.negative ?? []);
  const hidden = JSON.stringify(newTraits.hidden ?? []);
  const rows = await client.$queryRaw`
    UPDATE "horses" AS h
    SET "epigeneticModifiers" = (
      SELECT jsonb_set(
        jsonb_set(
          jsonb_set(
            b.m,
            '{positive}',
            (CASE WHEN jsonb_typeof(b.m -> 'positive') = 'array' THEN b.m -> 'positive' ELSE '[]'::jsonb END)
              || ${positive}::jsonb
          ),
          '{negative}',
          (CASE WHEN jsonb_typeof(b.m -> 'negative') = 'array' THEN b.m -> 'negative' ELSE '[]'::jsonb END)
            || ${negative}::jsonb
        ),
        '{hidden}',
        (CASE WHEN jsonb_typeof(b.m -> 'hidden') = 'array' THEN b.m -> 'hidden' ELSE '[]'::jsonb END)
          || ${hidden}::jsonb
      )
      FROM (
        SELECT CASE WHEN jsonb_typeof(h."epigeneticModifiers") = 'object'
          THEN h."epigeneticModifiers" ELSE '{}'::jsonb END AS m
      ) AS b
    )
    WHERE h."id" = ${horseId}
    RETURNING h."epigeneticModifiers" AS "epigeneticModifiers"`;
  return rows[0]?.epigeneticModifiers ?? null;
}

/**
 * Set one top-level key of epigeneticModifiers, leaving every other key as
 * stored. An absent or non-object value starts from the empty trait arrays,
 * as the in-memory default it replaces did.
 * @param {object} client - Prisma client or interactive-transaction client
 * @param {number} horseId
 * @param {string} key - top-level key the caller owns
 * @param {unknown} value - JSON-serialisable value
 * @returns {Promise<number>} rows updated
 */
export async function setEpigeneticModifiersKey(client, horseId, key, value) {
  const json = JSON.stringify(value);
  return client.$executeRaw`
    UPDATE "horses"
    SET "epigeneticModifiers" = jsonb_set(
      CASE WHEN jsonb_typeof("epigeneticModifiers") = 'object'
        THEN "epigeneticModifiers"
        ELSE '{"positive": [], "negative": [], "hidden": []}'::jsonb END,
      ARRAY[${key}::text],
      ${json}::jsonb
    )
    WHERE "id" = ${horseId}`;
}
