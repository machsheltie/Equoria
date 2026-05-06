#!/usr/bin/env node
/**
 * Pre-push DB-probe (Equoria-wnsc).
 *
 * Why this is a separate file (not a heredoc inside .husky/pre-push):
 *   The previous shape wrapped this script in `node - <<'NODE_EOF' ... NODE_EOF`
 *   inside command substitution `$(...)`. On Windows Git Bash 5.x, the bash
 *   parser still tries to evaluate the JS backtick template literals as
 *   command substitution even though the heredoc tag is single-quoted (which
 *   should prevent any expansion). The inner parens of the template literal
 *   then desync the outer `$(...)` parser, producing a runtime syntax error
 *   AT THE END of the hook — after the full Jest suite has already run for
 *   ~10 minutes. Cost of the bug: every Windows push burns 10 min on a
 *   doomed run, then fails at the close paren.
 *
 *   Moving the probe to a regular `.mjs` file removes all bash-quoting
 *   ambiguity. The hook now invokes `node scripts/preflight/db-probe.mjs`
 *   like any other script.
 *
 * Behavior (preserved from the heredoc version):
 *   - Reads DATABASE_URL from backend/.env.test.
 *   - Connects to Postgres + runs `SELECT 1` + closes.
 *   - Total budget: 5000ms via Promise.race (covers both connect AND query
 *     timeouts; a Postgres that accepts the TCP handshake but stalls on
 *     queries no longer blocks the push indefinitely).
 *   - Exit codes:
 *       0 — DB reachable.
 *       2 — DATABASE_URL missing in backend/.env.test.
 *       3 — DB unreachable / unresponsive.
 *
 * Required cwd: backend/ (so `dotenv.config({ path: '.env.test' })` resolves).
 */

import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.test' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set in backend/.env.test');
  process.exit(2);
}

const QUERY_BUDGET_MS = 5000;
const client = new Client({
  connectionString: url,
  connectionTimeoutMillis: QUERY_BUDGET_MS,
});

const probe = (async () => {
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
})();

const timeout = new Promise((_resolve, reject) =>
  setTimeout(
    () =>
      reject(
        new Error('probe exceeded ' + QUERY_BUDGET_MS + 'ms (Postgres reachable but unresponsive?)')
      ),
    QUERY_BUDGET_MS
  )
);

try {
  await Promise.race([probe, timeout]);
  console.log('ok');
} catch (err) {
  const msg =
    err && err.code
      ? err.code + ': ' + err.message
      : err && err.message
        ? err.message
        : String(err);
  console.error(msg);
  process.exit(3);
}
