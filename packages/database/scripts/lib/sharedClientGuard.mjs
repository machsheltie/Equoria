/**
 * sharedClientGuard.mjs (Equoria-nlpi5)
 *
 * Fail-closed guard for `npm run generate` (scripts/prisma-generate.mjs).
 *
 * The generated Prisma client lives under `node_modules/.prisma/client`. In an
 * agent worktree `node_modules` is a JUNCTION into the main checkout's tree, so
 * `prisma generate` run there does not write into the worktree: it overwrites
 * the client every other worktree and the main checkout are using, with a
 * client derived from THIS worktree's schema.prisma. Nothing marks the change —
 * tests then fail or, worse, pass against a model that exists only in somebody
 * else's uncommitted schema. The wrapper also kills node processes that hold the
 * query-engine DLL and deletes it, which in this situation means other
 * worktrees' processes.
 *
 * So the wrapper refuses to run when the directory it would write into is
 * reached through a link, unless the caller opts in explicitly:
 *
 *   npm run generate -- --shared-ok          (or EQUORIA_PRISMA_GENERATE_SHARED_OK=1)
 *
 * The opt-in exists for the one sanctioned path: the integration worktree's
 * owner regenerating the shared client once, with no other session mid-run.
 * It is never the default and a worktree's own schema edit is not a reason to
 * pass it.
 */

import { lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const SHARED_OK_FLAG = '--shared-ok';
export const SHARED_OK_ENV = 'EQUORIA_PRISMA_GENERATE_SHARED_OK';

function isLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Find the node_modules directories generate could write through that are
 * links (junctions on Windows, symlinks elsewhere).
 *
 * Checked: `<package>/node_modules` (where the wrapper deletes/writes the
 * client) and `<repo root>/node_modules` (where a hoisted @prisma/client would
 * put it). A real directory at both means the write stays inside this checkout.
 *
 * @param {string} packageDir - absolute path of packages/database
 * @returns {string[]} the linked directories, empty when generate is local
 */
export function findLinkedNodeModules(packageDir) {
  const rootDir = resolve(packageDir, '..', '..');
  const candidates = [join(packageDir, 'node_modules'), join(rootDir, 'node_modules')];
  const linked = [];
  for (const candidate of candidates) {
    if (isLink(candidate)) {
      linked.push(candidate);
      continue;
    }
    // A real node_modules whose .prisma (or .prisma/client) child is itself a
    // link would escape the checkout just the same.
    const prismaDir = join(candidate, '.prisma');
    if (isLink(prismaDir)) {
      linked.push(prismaDir);
    } else if (isLink(join(prismaDir, 'client'))) {
      linked.push(join(prismaDir, 'client'));
    }
  }
  return linked;
}

/**
 * @param {object} params
 * @param {string} params.packageDir - absolute path of packages/database
 * @param {string[]} params.argv - arguments after the script name
 * @param {Record<string, string | undefined>} params.env
 * @returns {{allowed: boolean, linked: string[], optedIn: boolean, message: string | null}}
 */
export function assessGenerateTarget({ packageDir, argv, env }) {
  const linked = findLinkedNodeModules(packageDir);
  const optedIn = argv.includes(SHARED_OK_FLAG) || env[SHARED_OK_ENV] === '1';
  if (linked.length === 0 || optedIn) {
    return { allowed: true, linked, optedIn, message: null };
  }
  const message = [
    '[prisma-generate] REFUSED: the Prisma client directory is reached through a link.',
    ...linked.map((dir) => `  linked: ${dir}`),
    '  This checkout shares node_modules with another checkout (an agent worktree).',
    '  Generating here would overwrite the client every other worktree and the main',
    '  checkout are using with one built from THIS schema.prisma, and this wrapper',
    '  would also stop node processes holding the engine DLL — possibly theirs.',
    '  Nothing was changed.',
    `  If you are the one sanctioned owner of the shared client (integration worktree,`,
    `  no other session mid-run), re-run with ${SHARED_OK_FLAG} (npm run generate -- ${SHARED_OK_FLAG})`,
    `  or ${SHARED_OK_ENV}=1.`,
  ].join('\n');
  return { allowed: false, linked, optedIn, message };
}
