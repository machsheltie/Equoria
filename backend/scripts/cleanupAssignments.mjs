/**
 * Clean up groom assignments + interactions for fresh testing.
 *
 * SCOPED BY DESIGN (Equoria-2apsk / CLAUDE.md §2): this script runs against
 * the canonical Equoria DB (`.env.test` points at production data), so a bare
 * `deleteMany({})` here would wipe every real player's groom assignments and
 * interactions. It therefore REFUSES to run without an explicit scope and
 * deletes ONLY the records matching that scope.
 *
 * Usage:
 *   node backend/scripts/cleanupAssignments.mjs --userId=<uuid>
 *   node backend/scripts/cleanupAssignments.mjs --foalId=<int>
 *   node backend/scripts/cleanupAssignments.mjs --groomId=<int>
 *
 * Exactly one scope must be provided. Interactions are deleted within the same
 * scope so no foal/groom/user's interaction rows are touched beyond the target.
 */

import prisma from '../db/index.mjs';

/**
 * Parse `--key=value` CLI args into a scope object. Returns the single
 * supported scope key/value, or null if none/invalid was supplied.
 */
function parseScope(argv) {
  const args = {};
  for (const raw of argv) {
    const match = /^--(userId|foalId|groomId)=(.+)$/.exec(raw);
    if (match) {
      args[match[1]] = match[2];
    }
  }

  const provided = Object.keys(args);
  if (provided.length !== 1) {
    return null; // require exactly one scope — never an empty (table-wide) filter
  }

  const [key] = provided;
  let value = args[key];

  // foalId / groomId are integer FKs; userId is a string UUID.
  if (key === 'foalId' || key === 'groomId') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    value = parsed;
  } else if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return { key, value };
}

async function cleanupAssignments() {
  const scope = parseScope(process.argv.slice(2));

  if (!scope) {
    console.error(
      '❌ Refusing to run: an explicit scope is required.\n' +
        '   This script runs against the canonical DB; an unscoped delete would\n' +
        '   wipe every player\'s groom data.\n' +
        '   Usage: node backend/scripts/cleanupAssignments.mjs --userId=<uuid>\n' +
        '          node backend/scripts/cleanupAssignments.mjs --foalId=<int>\n' +
        '          node backend/scripts/cleanupAssignments.mjs --groomId=<int>',
    );
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }

  // Scoped where-clause for GroomAssignment — never `{}`. GroomAssignment has
  // userId, foalId, and groomId columns, so any scope key applies directly.
  const assignmentWhere = { [scope.key]: scope.value };

  // GroomInteraction has foalId + groomId columns but NO userId column, so a
  // userId scope must be expressed via the related assignment. foalId/groomId
  // apply directly.
  const interactionWhere =
    scope.key === 'userId'
      ? { assignment: { userId: scope.value } }
      : { [scope.key]: scope.value };

  try {
    console.log(`🧹 Cleaning up groom assignments scoped by ${scope.key}=${scope.value}...`);

    // Delete interactions first (they reference assignments via assignmentId).
    const deletedInteractions = await prisma.groomInteraction.deleteMany({ where: interactionWhere });
    console.log(`✅ Deleted ${deletedInteractions.count} interactions`);

    const deletedAssignments = await prisma.groomAssignment.deleteMany({ where: assignmentWhere });
    console.log(`✅ Deleted ${deletedAssignments.count} assignments`);

    console.log('🎯 Ready for fresh testing!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupAssignments();
