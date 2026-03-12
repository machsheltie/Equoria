/**
 * BreedingPage (Epic 28-2)
 *
 * Celestial Night shell for the breeding system.
 * Shows BreedingPairSelection as the primary interface.
 */

import { Heart } from 'lucide-react';
import BreedingPairSelection from '@/pages/breeding/BreedingPairSelection';
import { useAuth } from '@/contexts/AuthContext';

const BreedingPage = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold-400)] border-r-transparent" />
          Checking authentication…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.2)] px-5 py-4">
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-[var(--gold-400)]" aria-hidden="true" />
            <p className="text-sm text-[var(--cream)] font-[var(--font-body)]">
              Please log in to access the Breeding Hall.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(201,162,39,0.12)] border border-[rgba(201,162,39,0.2)]">
          <Heart className="h-5 w-5 text-[var(--gold-400)]" aria-hidden="true" />
        </div>
        <div>
          <h1
            className="text-2xl font-bold text-[var(--cream)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Breeding Hall
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)]">
            Select a pairing and shape the next generation
          </p>
        </div>
      </div>

      <BreedingPairSelection userId={user?.id != null ? String(user.id) : undefined} />
    </div>
  );
};

export default BreedingPage;
