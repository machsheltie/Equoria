/**
 * Recovery from a stale build (Equoria-bvddn.32).
 *
 * After a deploy the hashed chunk files of the previous build are gone. A tab
 * that was open across the deploy asks for a page chunk that now answers 404,
 * the dynamic import rejects, and without this module the whole game is
 * replaced by the crash card. A reload fetches the new build and fixes it, so
 * we reload once, quietly.
 *
 * Loop guard: if the new build is itself broken (or the network is down) a
 * reload would fail the same way and the player would be trapped in a reload
 * loop. The time of the last automatic reload is kept in sessionStorage and a
 * second automatic reload inside the guard window is refused, which lets the
 * crash card appear instead.
 */

const GUARD_KEY = 'equoria:staleBuildReloadAt';
const GUARD_WINDOW_MS = 60_000;

const STALE_BUILD_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Chromium, Firefox
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /loading (css )?chunk [^ ]+ failed/i, // webpack-style, still seen from some tooling
  /unable to preload css/i, // Vite preload helper
];

export function isStaleBuildError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === 'ChunkLoadError') return true;
  return (
    typeof message === 'string' && STALE_BUILD_PATTERNS.some((pattern) => pattern.test(message))
  );
}

function readGuard(): number | null {
  try {
    const raw = window.sessionStorage.getItem(GUARD_KEY);
    const at = raw === null ? NaN : Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    // sessionStorage can throw in a locked-down browser; treat as no record.
    return null;
  }
}

function writeGuard(at: number): boolean {
  try {
    window.sessionStorage.setItem(GUARD_KEY, String(at));
    return true;
  } catch {
    // Without a guard we cannot prove the reload will not loop, so do not reload.
    return false;
  }
}

interface ReloadOptions {
  /** Defaults to a real page reload. */
  reload?: () => void;
  now?: number;
}

/** Reloads once per guard window. Returns true only when a reload was started. */
export function reloadOnceForNewBuild({
  reload = () => window.location.reload(),
  now = Date.now(),
}: ReloadOptions = {}): boolean {
  const last = readGuard();
  if (last !== null && now - last < GUARD_WINDOW_MS) return false;
  if (!writeGuard(now)) return false;
  reload();
  return true;
}

/** Vite fires `vite:preloadError` when a lazy page's chunk cannot be fetched. */
export function installStaleBuildReload(options: ReloadOptions = {}): () => void {
  const onPreloadError = () => {
    // No preventDefault: when the guard refuses, Vite's error still reaches the
    // error boundary, which shows the "updated" card.
    reloadOnceForNewBuild(options);
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}
