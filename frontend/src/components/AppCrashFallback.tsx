import { ErrorCard } from '@/components/ui/ErrorCard';

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
 */
interface AppCrashFallbackProps {
  /** Clears the boundary so its children render again. */
  onRetry: () => void;
}

export default function AppCrashFallback({ onRetry }: AppCrashFallbackProps) {
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
