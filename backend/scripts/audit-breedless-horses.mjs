/**
 * audit-breedless-horses.mjs — Equoria-qsp1b.1 / Equoria-2wjp7
 *
 * READ-ONLY. This script contains NO write, update, or delete statement of any
 * kind and has no --apply flag. Running it cannot change a single row.
 *
 * WHY IT EXISTS
 * -------------
 * Onboarding used to create the registration starter horse with a NULL breedId
 * (Equoria-2wjp7 — the fail-open conditional spread). Breeding correctly
 * refuses conception for a dam with no breed, nothing filters a breedless mare
 * out of the breeding selector, and no player-facing surface can set a breed —
 * so such a mare is a dead end. The leak is now closed (both onboarding horse-
 * creation paths are fail-closed). This script is the OTHER half: it reports
 * the damage that already exists so the owner can choose a remedy.
 *
 * CLAUDE.md forbids broad cleanup against player data, and the real player's
 * account is known to carry dangling horse references (Equoria-kszly). So the
 * remedy is the OWNER'S decision, not this script's. What this script does is
 * produce the evidence that decision needs:
 *
 *   1. The exact breedless rows (id, name, sex, owner), never a bare count.
 *   2. Which of them are LINEAGE ANCESTORS. Horse.sireId / Horse.damId are
 *      ON DELETE RESTRICT, so an ancestor cannot simply be deleted — forcing it
 *      would mean destroying descendants. Those are listed separately with the
 *      descendants that reference them.
 *   3. Every OTHER foreign key that would block a delete, read from the LIVE
 *      Postgres catalog (pg_constraint) rather than from schema.prisma — so the
 *      answer reflects the database as it actually is, including any constraint
 *      the schema file and the applied migrations disagree about.
 *   4. What backend/seed/backfillStarterHorseBreedId.mjs would assign to each
 *      row, so backfill-vs-delete can be compared per horse rather than in the
 *      abstract.
 *
 * REMEDIES (neither is performed here; both need the owner's explicit approval)
 *   a) BACKFILL — `node backend/seed/backfillStarterHorseBreedId.mjs --apply`.
 *      Non-destructive, id-scoped per-row updates, idempotent. Keeps the horse
 *      and its history, and works on ancestors and non-ancestors alike.
 *   b) DELETE — scoped Prisma against the LOCAL database only. Blocked outright
 *      for any horse this report marks BLOCKED.
 *
 * USAGE
 *   node backend/scripts/audit-breedless-horses.mjs
 *   node backend/scripts/audit-breedless-horses.mjs --json   (machine-readable)
 */

import { fileURLToPath } from 'url';
import prisma from '../../packages/database/prismaClient.mjs';
import { DEFAULT_TEMPERAMENT_BREED } from '../modules/horses/index.mjs';

const AS_JSON = process.argv.includes('--json');

/**
 * Foreign keys that point AT the horses table, straight from the live Postgres
 * catalog. confdeltype: 'a' = NO ACTION, 'r' = RESTRICT, 'c' = CASCADE,
 * 'n' = SET NULL, 'd' = SET DEFAULT. Only NO ACTION and RESTRICT block a
 * DELETE; the rest resolve themselves.
 */
async function loadIncomingForeignKeys() {
  const rows = await prisma.$queryRaw`
    SELECT
      con.conname            AS constraint_name,
      child.relname          AS child_table,
      att.attname            AS child_column,
      con.confdeltype        AS delete_rule
    FROM pg_constraint con
    JOIN pg_class  child  ON child.oid  = con.conrelid
    JOIN pg_class  parent ON parent.oid = con.confrelid
    JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = k.attnum
    WHERE con.contype = 'f'
      AND parent.relname = 'horses'
    ORDER BY child.relname, att.attname
  `;
  return rows.map(r => ({
    constraintName: r.constraint_name,
    table: r.child_table,
    column: r.child_column,
    deleteRule:
      { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' }[
        r.delete_rule
      ] ?? r.delete_rule,
  }));
}

/**
 * For one blocking FK, count the rows that reference each of the given horse
 * ids. Identifiers come from the pg catalog, not from user input, and the id
 * list is parameterised — nothing is interpolated from anything a player wrote.
 */
async function countBlockingReferences(fk, horseIds) {
  const sql = `
    SELECT "${fk.column}" AS horse_id, COUNT(*)::int AS n
    FROM "${fk.table}"
    WHERE "${fk.column}" = ANY($1::int[])
    GROUP BY "${fk.column}"
  `;
  const rows = await prisma.$queryRawUnsafe(sql, horseIds);
  return new Map(rows.map(r => [Number(r.horse_id), Number(r.n)]));
}

async function auditBreedlessHorses() {
  const totalHorses = await prisma.horse.count();

  const breedless = await prisma.horse.findMany({
    where: { breedId: null },
    select: {
      id: true,
      name: true,
      sex: true,
      age: true,
      dateOfBirth: true,
      userId: true,
      sireId: true,
      damId: true,
      user: { select: { id: true, username: true, email: true } },
      sire: { select: { id: true, breedId: true } },
      dam: { select: { id: true, breedId: true } },
    },
    orderBy: { id: 'asc' },
  });

  const ids = breedless.map(h => h.id);

  const defaultBreed = await prisma.breed.findUnique({
    where: { name: DEFAULT_TEMPERAMENT_BREED },
    select: { id: true, name: true },
  });

  const foreignKeys = await loadIncomingForeignKeys();
  const blockingFks = foreignKeys.filter(
    fk => fk.deleteRule === 'RESTRICT' || fk.deleteRule === 'NO ACTION',
  );

  // Per-horse blocker counts across every blocking FK.
  const blockersByHorse = new Map(ids.map(id => [id, []]));
  if (ids.length > 0) {
    for (const fk of blockingFks) {
      const counts = await countBlockingReferences(fk, ids);
      for (const [horseId, n] of counts) {
        if (blockersByHorse.has(horseId)) {
          blockersByHorse.get(horseId).push({ ...fk, referencingRows: n });
        }
      }
    }
  }

  // Named descendants for the lineage blockers specifically, so "ancestor" is
  // reported with the actual foals rather than just a number.
  const descendants =
    ids.length > 0
      ? await prisma.horse.findMany({
          where: { OR: [{ sireId: { in: ids } }, { damId: { in: ids } }] },
          select: { id: true, name: true, sireId: true, damId: true, breedId: true },
          orderBy: { id: 'asc' },
        })
      : [];

  const report = breedless.map(h => {
    const blockers = blockersByHorse.get(h.id) ?? [];
    const kids = descendants.filter(d => d.sireId === h.id || d.damId === h.id);
    const inheritedBreedId = h.sire?.breedId ?? h.dam?.breedId ?? null;
    return {
      id: h.id,
      name: h.name,
      sex: h.sex,
      age: h.age,
      dateOfBirth: h.dateOfBirth,
      ownerUserId: h.userId,
      ownerUsername: h.user?.username ?? null,
      sireId: h.sireId,
      damId: h.damId,
      isLineageAncestor: kids.length > 0,
      descendants: kids.map(d => ({
        id: d.id,
        name: d.name,
        via: d.sireId === h.id ? 'sire' : 'dam',
      })),
      deleteBlockers: blockers,
      deletable: blockers.length === 0,
      backfillWouldAssign:
        inheritedBreedId !== null
          ? { breedId: inheritedBreedId, source: 'inherit(lineage)' }
          : defaultBreed
            ? { breedId: defaultBreed.id, source: `default(${defaultBreed.name})` }
            : { breedId: null, source: 'UNRESOLVABLE — default breed row missing' },
    };
  });

  const result = {
    mode: 'READ-ONLY REPORT — no rows were read for modification and nothing was written',
    generatedAt: new Date().toISOString(),
    totals: {
      horsesInDatabase: totalHorses,
      breedlessHorses: report.length,
      breedlessMaresAndFillies: report.filter(
        h => h.sex !== 'Stallion' && h.sex !== 'Colt' && h.sex !== 'Gelding',
      ).length,
      lineageAncestors: report.filter(h => h.isLineageAncestor).length,
      deletableWithoutForce: report.filter(h => h.deletable).length,
      blockedFromDeletion: report.filter(h => !h.deletable).length,
      distinctOwners: new Set(report.map(h => h.ownerUserId)).size,
    },
    defaultBreed,
    incomingForeignKeys: foreignKeys,
    blockingForeignKeys: blockingFks,
    horses: report,
  };

  if (AS_JSON) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('═'.repeat(78));
  console.log('BREEDLESS HORSE AUDIT (Equoria-qsp1b.1 / Equoria-2wjp7) — READ-ONLY');
  console.log('═'.repeat(78));
  console.log(`Generated: ${result.generatedAt}`);
  console.log(`Horses in database:        ${result.totals.horsesInDatabase}`);
  console.log(`Breedless (breedId NULL):  ${result.totals.breedlessHorses}`);
  console.log(`  ...mares/fillies:        ${result.totals.breedlessMaresAndFillies}`);
  console.log(`  ...lineage ancestors:    ${result.totals.lineageAncestors}`);
  console.log(`  ...deletable as-is:      ${result.totals.deletableWithoutForce}`);
  console.log(`  ...blocked by an FK:     ${result.totals.blockedFromDeletion}`);
  console.log(`Distinct owning users:     ${result.totals.distinctOwners}`);
  console.log(
    `Default breed:             ${defaultBreed ? `${defaultBreed.name} (id ${defaultBreed.id})` : 'MISSING — backfill would fail'}`,
  );

  console.log('\n── Foreign keys pointing at "horses" (live pg_constraint) ──');
  for (const fk of foreignKeys) {
    const flag =
      fk.deleteRule === 'RESTRICT' || fk.deleteRule === 'NO ACTION' ? ' ⛔ blocks DELETE' : '';
    console.log(`  ${fk.table}.${fk.column}  ON DELETE ${fk.deleteRule}${flag}`);
  }

  if (report.length === 0) {
    console.log('\n✅ No breedless horses. Nothing to remedy.');
    return;
  }

  console.log(`\n── The exact rows (${report.length}) ──`);
  for (const h of report) {
    console.log(
      `\n  horse ${h.id}  "${h.name}"  [${h.sex}, age ${h.age}]  owner ${h.ownerUsername ?? '(none)'} (user ${h.ownerUserId})`,
    );
    console.log(
      `    born: ${h.dateOfBirth ? new Date(h.dateOfBirth).toISOString() : 'NULL'}   sire: ${h.sireId ?? '—'}   dam: ${h.damId ?? '—'}`,
    );
    if (h.isLineageAncestor) {
      console.log(
        `    ⛔ LINEAGE ANCESTOR of ${h.descendants.length}: ${h.descendants
          .map(d => `${d.id} ("${d.name}", via ${d.via})`)
          .join(', ')}`,
      );
    }
    if (h.deleteBlockers.length > 0) {
      console.log('    ⛔ DELETE BLOCKED BY:');
      for (const b of h.deleteBlockers) {
        console.log(
          `         ${b.table}.${b.column} — ${b.referencingRows} row(s), ON DELETE ${b.deleteRule}`,
        );
      }
    } else {
      console.log('    ✓ no FK would block a delete');
    }
    console.log(
      `    backfill would assign breedId ${h.backfillWouldAssign.breedId} [${h.backfillWouldAssign.source}]`,
    );
  }

  console.log(`\n${'═'.repeat(78)}`);
  console.log('NOTHING WAS CHANGED. This script has no write path and no --apply flag.');
  console.log("Remedies, both requiring the owner's explicit approval:");
  console.log('  (a) backfill — node backend/seed/backfillStarterHorseBreedId.mjs --apply');
  console.log('      non-destructive, id-scoped, idempotent; works on blocked rows too.');
  console.log('  (b) delete   — scoped Prisma, LOCAL database only, and impossible for the');
  console.log(
    `      ${result.totals.blockedFromDeletion} row(s) marked blocked above without destroying what references them.`,
  );
  console.log('═'.repeat(78));
}

// Main-module guard (Equoria-flqjs, Windows-correct form): do not run on bare import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  auditBreedlessHorses()
    .catch(err => {
      console.error('❌ Audit failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export { auditBreedlessHorses };
