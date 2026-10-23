import { useEffect } from 'react';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { isStaleBuildError, reloadOnceForNewBuild } from '@/lib/staleBuildReload';

/**
 * What the player sees when an uncaught render error reaches the app-level
 * ErrorBoundary (Equoria-oey96.57, Story 30.2): the restyled ErrorCard with a
 * way out, not a bare paragraph.
 *
 * The boundary sits ABOVE the QueryClient, Auth and Router providers, so this
 * component must not depend on any of them. ErrorCard and its Button are
 * provider-free. "Go Home" is a full document load: the crashed tree (and any
 * state that caused the crash) is discarded, and no router exists up here to
 * navigate with. "Try Again" re-renders the same tree via the boundary reset.
 *
 * A page chunk that cannot be fetched means the game was updated while this
 * tab was open (Equoria-bvddn.32). That is not a crash: we reload once for the
 * new build, and if that has already happened say so plainly and offer a reload.
 */
interface AppCrashFallbackProps {
  /** Clears the boundary so its children render again. */
  onRetry: () => void;
  /** What the boundary caught; used to tell an updated game from a crash. */
  error?: unknown;
}

export default function AppCrashFallback({ onRetry, error }: AppCrashFallbackProps) {
  const updated = isStaleBuildError(error);

  useEffect(() => {
    if (updated) reloadOnceForNewBuild();
  }, [updated]);

  if (updated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorCard
          title="The stable has been updated"
          message="Equoria was updated while this page was open. Reload to pick up the new version."
          onRetry={() => window.location.reload()}
          retryLabel="Reload"
          onGoHome={() => window.location.assign('/')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ErrorCard
        title="Something went wrong"
        message="Something broke on this page. You can try again, or head back to the start."
        onRetry={onRetry}
        onGoHome={() => window.location.assign('/')}
      />
    </div>
  );
}
