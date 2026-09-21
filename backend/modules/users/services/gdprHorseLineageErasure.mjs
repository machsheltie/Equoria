/**
 * gdprHorseLineageErasure.mjs — Equoria-49bc2 (extracted from
 * gdprAccountService.mjs, which had reached the 600-line doctrine threshold).
 *
 * The horse half of GDPR right-to-erasure, and the only part of it that has to
 * reason about OTHER players' data: a deleted user's horse may be a breeding
 * ANCESTOR of horses those players own, so the erasure partitions the user's
 * horses into "anonymize and keep" and "hard-delete" rather than deleting them
 * all. That rule (Equoria-cugl9) is cohesive enough to own a module; the
 * behaviour is unchanged by the move.
 *
 * Runs INSIDE the caller's transaction — it takes the `tx` client, never the
 * singleton, so it commits or rolls back with the rest of the erasure.
 */

/**
 * Erase the horses owned by `userId`, preserving (anonymized) any that a
 * surviving player's horse descends from.
 *
 * Every statement is scoped to `userId` or to ids already proven to belong to
 * that user — never an unscoped write.
 *
 * @param {object} tx - the interactive Prisma transaction client
 * @param {string} userId - the user being erased
 * @param {Array<{ id: number, sireId: number|null, damId: number|null }>} ownedHorses
 *   the user's horses WITH their parent edges, already read by the caller
 * @returns {Promise<void>}
 */
export async function eraseOrAnonymizeOwnedHorses(tx, userId, ownedHorses) {
  const horseIds = ownedHorses.map(h => h.id);
  if (horseIds.length === 0) {
    return;
  }
  // A user's horse may be a breeding ANCESTOR of horses owned by OTHER,
  // surviving users. The pre-cugl9 code nulled damId/sireId on EVERY
  // descendant pointing at the user's horses, then deleted the user's
  // horses — that DESTROYED the lineage of descendants the deleted user
  // never owned (collateral damage to another player's horse graph).
  //
  // The senior fix (per the issue + a richer breeding economy): partition
  // the user's horses into
  //   (a) ANCESTORS WITH A SURVIVING EXTERNAL DESCENDANT — a horse that
  //       has at least one offspring whose owner is NOT this user. These
  //       are ANONYMIZED (detached + PII-scrubbed), NOT deleted, so the
  //       descendant keeps its damId/sireId pointer and the breeding
  //       graph survives.
  //   (b) ALL OTHER owned horses — hard-deleted as before (no external
  //       graph value to preserve).
  //
  // A descendant owned by THIS SAME user is being deleted in this very
  // transaction, so it does not count as a reason to preserve its parent
  // — hence the `userId: { not: userId }` (plus null-owner) filter below.
  // The set we may NOT delete. Seed it with the user's horses that are
  // DIRECT parents of a surviving external descendant, then expand
  // transitively UP the ancestry: a preserved horse's own owned ancestors
  // (grandparents, great-grandparents, ...) must ALSO be preserved, or a
  // multi-generation lineage would lose its deeper ancestors and the
  // intermediate preserved horse would be left with a dangling parent edge.
  const horseIdSet = new Set(horseIds);
  const preserveIds = new Set();

  // Seed: direct external children of any of the user's horses.
  const directExternalChildren = await tx.horse.findMany({
    where: {
      OR: [{ sireId: { in: horseIds } }, { damId: { in: horseIds } }],
      // Owned by ANYONE other than the user being deleted (another
      // surviving user, or an already-unowned/anonymized horse).
      NOT: { userId },
    },
    select: { sireId: true, damId: true },
  });
  for (const child of directExternalChildren) {
    if (child.sireId !== null && horseIdSet.has(child.sireId)) {
      preserveIds.add(child.sireId);
    }
    if (child.damId !== null && horseIdSet.has(child.damId)) {
      preserveIds.add(child.damId);
    }
  }

  // Transitive expansion: walk up. For every horse currently slated for
  // preservation, pull its sire/dam; if that parent is one of the user's
  // horses and not yet preserved, preserve it too. Iterate to a fixpoint.
  // Bounded by horseIds.length (each iteration adds ≥1 id or stops).
  //
  // Equoria-49bc2: this walk used to issue ONE `findMany` per generation
  // inside the transaction — O(pedigree depth) round trips, and a deep
  // breeding line is exactly what a power user has. Every id the walk can
  // ever visit is in `horseIdSet` (the guard below enforces it), and the
  // parent edges for all of those rows were already read in the single
  // `ownedHorses` query at the top of the transaction, so the fixpoint
  // runs in memory against that adjacency map: ZERO extra round trips,
  // identical result.
  const parentsById = new Map(ownedHorses.map(h => [h.id, [h.sireId, h.damId]]));
  let frontier = [...preserveIds];
  while (frontier.length > 0) {
    const nextFrontier = [];
    for (const id of frontier) {
      for (const parentId of parentsById.get(id) ?? []) {
        if (parentId !== null && horseIdSet.has(parentId) && !preserveIds.has(parentId)) {
          preserveIds.add(parentId);
          nextFrontier.push(parentId);
        }
      }
    }
    frontier = nextFrontier;
  }

  const idsToDelete = horseIds.filter(id => !preserveIds.has(id));

  // (a) Anonymize the ancestors that must survive for the lineage. Detach
  //     from the deleted user (userId -> null) and scrub user-identifying
  //     fields. The horse row + the descendants' lineage pointers INTO it
  //     are left intact (that is the whole point). We deliberately do NOT
  //     cascade-delete the ancestor's own horse children here — the horse
  //     survives, so its competition history / logs survive with it (no
  //     longer attributed to the deleted user).
  //
  //     Safety net: clear a preserved ancestor's OWN sireId/damId if it
  //     somehow references a horse slated for hard-delete in step (b).
  //     The transitive expansion above already guarantees a preserved
  //     horse's owned parents are themselves preserved, so this should
  //     never fire — but if it did, leaving the edge would make the
  //     deleted horse a referenced parent and the Restrict FK would block
  //     its deletion. Defensive only; loses no graph value when inert.
  //
  // Equoria-49bc2: this was a per-row `tx.horse.update` loop — O(number
  // of preserved ancestors) round trips inside the transaction, the
  // single largest contributor to the 5 s blow-up for a breeder who has
  // sold offspring on. It is now THREE scoped statements regardless of
  // how many ancestors are preserved.
  //
  // The scrub itself has one per-row component — the anonymized name
  // embeds the horse's own id — so it goes through a PARAMETERIZED
  // `$executeRaw` tagged template (the same form used for the optimistic
  // claims elsewhere in this codebase) that computes the name in SQL.
  // `id = ANY($1::int[])` keeps the statement strictly scoped to the ids
  // we already proved belong to this user; there is no predicate here
  // that could reach a row outside `preserveIds`. The Prisma client's
  // only write extension canonicalizes `Horse.sex`, which this statement
  // does not touch, so bypassing the query layer changes no behavior.
  const preservedIds = [...preserveIds];
  if (preservedIds.length > 0) {
    await tx.$executeRaw`
          UPDATE horses
             SET "userId" = NULL,
                 name = 'Anonymized Horse #' || id::text,
                 "forSale" = false,
                 "salePrice" = 0,
                 "studStatus" = 'Not at Stud',
                 "studFee" = 0
           WHERE id = ANY(${preservedIds}::int[])`;

    // Dangling-edge safety net, now expressed as two scoped updateMany
    // statements instead of a per-row branch. Scope is identical to the
    // old loop: only PRESERVED rows, and only edges pointing at rows
    // being hard-deleted in step (b).
    if (idsToDelete.length > 0) {
      await tx.horse.updateMany({
        where: { id: { in: preservedIds }, sireId: { in: idsToDelete } },
        data: { sireId: null },
      });
      await tx.horse.updateMany({
        where: { id: { in: preservedIds }, damId: { in: idsToDelete } },
        data: { damId: null },
      });
    }
  }

  // (b) Hard-delete the remaining owned horses. Their lineage pointers
  //     into siblings that are ALSO being deleted (or into preserved
  //     ancestors) must be cleared first so the damId/sireId Restrict FKs
  //     don't block — but scoped ONLY to deleted-horse → deleted-horse
  //     edges (never touching a surviving/anonymized horse's pointers).
  if (idsToDelete.length > 0) {
    await tx.horse.updateMany({
      where: { id: { in: idsToDelete }, damId: { in: idsToDelete } },
      data: { damId: null },
    });
    await tx.horse.updateMany({
      where: { id: { in: idsToDelete }, sireId: { in: idsToDelete } },
      data: { sireId: null },
    });
    // Most horse children (competitionResults, trainingLogs,
    // foalDevelopment, horseXpEvents, trait logs, groom*) are
    // onDelete: Cascade — they go automatically.
    await tx.horse.deleteMany({ where: { id: { in: idsToDelete } } });
  }
}
