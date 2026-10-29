/**
 * The git commit the running server was built from (Equoria-yqi49).
 *
 * Railway sets RAILWAY_GIT_COMMIT_SHA on every deploy built from GitHub. It is
 * the only environment value the owner's quarantined-show tools ever report:
 * Run Show is unlocked by a test run on this same commit, and Diagnose names it
 * so the agent fixing the show reads the code that failed. Read on every call,
 * never cached, so a new deploy is seen at once. Null when not set (local runs).
 *
 * @returns {string|null}
 */
export function deployedCommitSha() {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA;
  return typeof sha === 'string' && sha.trim() !== '' ? sha.trim() : null;
}
