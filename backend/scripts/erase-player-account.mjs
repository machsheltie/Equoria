/**
 * erase-player-account.mjs — operator-run erasure of ONE player account.
 *
 * Players cannot delete their own accounts (owner ruling, Equoria-gfany), so
 * an erasure request (e.g. GDPR Article 17, received at privacy@equoria.com)
 * is carried out by the operator with this script. It runs the same audited,
 * single-transaction cascade the game has always used —
 * `eraseUserAccount()` in modules/users/services/gdprAccountService.mjs — for
 * exactly one user, matched by exact id or exact email. Never a pattern match.
 *
 * DRY-RUN BY DEFAULT: it prints who matched and how much they own, and writes
 * nothing. Only `--execute` erases, and it cannot be undone.
 *
 * USAGE (against the database in DATABASE_URL):
 *   node backend/scripts/erase-player-account.mjs --email player@example.org
 *   node backend/scripts/erase-player-account.mjs --id <user-uuid>
 *   node backend/scripts/erase-player-account.mjs --email player@example.org --execute
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { eraseUserAccount } from '../modules/users/index.mjs';

/** Parse `--id <v>` / `--email <v>` / `--execute`. Exactly one selector. */
export function parseArgs(argv) {
  const valueOf = flag => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1].trim() : null;
  };
  const id = valueOf('--id');
  const email = valueOf('--email');
  if ((id ? 1 : 0) + (email ? 1 : 0) !== 1) {
    throw new Error('Give exactly one of --id <user-uuid> or --email <address>.');
  }
  return { id, email: email ? email.toLowerCase() : null, execute: argv.includes('--execute') };
}

async function main() {
  const { id, email, execute } = parseArgs(process.argv.slice(2));

  const user = await prisma.user.findUnique({
    where: id ? { id } : { email },
    select: { id: true, username: true, email: true, createdAt: true },
  });
  if (!user) {
    console.log(`No account matches ${id ? `id ${id}` : `email ${email}`}. Nothing to do.`);
    return;
  }

  const [horses, clubsLed] = await Promise.all([
    prisma.horse.count({ where: { userId: user.id } }),
    prisma.club.count({ where: { leaderId: user.id } }),
  ]);
  console.log('Matched account:');
  console.log(`  id        ${user.id}`);
  console.log(`  username  ${user.username}`);
  console.log(`  email     ${user.email}`);
  console.log(`  created   ${user.createdAt.toISOString()}`);
  console.log(
    `  horses    ${horses}  (ancestors of other players' horses are anonymised, not deleted)`,
  );
  console.log(`  clubs led ${clubsLed}  (these clubs are deleted with the account)`);

  if (!execute) {
    console.log(
      '\nDRY-RUN: nothing was changed. Re-run with --execute to erase this account permanently.',
    );
    return;
  }

  const { deleted } = await eraseUserAccount(user.id);
  console.log(deleted ? `\nErased account ${user.id}.` : `\nAccount ${user.id} was already gone.`);
}

// Main-module guard (CONTRIBUTING.md): importing this file must not erase anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async err => {
      console.error('Fatal:', err.message);
      await prisma.$disconnect();
      process.exit(1);
    });
}
