/**
 * BreedingPage — The Breeding Hall
 *
 * Atmospheric shell for the breeding system. Mystic mood — this is where
 * genetics and destiny intertwine under the celestial canopy.
 */

import { Heart } from 'lucide-react';
import BreedingPairSelection from '@/pages/breeding/BreedingPairSelection';
import PageHero from '@/components/layout/PageHero';
import { useAuth } from '@/contexts/AuthContext';

const BreedingPage = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="glass-panel-subtle rounded-xl p-8 flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--gold-400)] border-r-transparent" />
            Opening the Breeding Hall…
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="glass-panel rounded-xl p-8 text-center">
          <Heart className="w-10 h-10 mx-auto mb-3 text-[var(--gold-400)] opacity-40" />
          <p className="text-sm text-[var(--cream)] font-[var(--font-body)]">
            Please log in to enter the Breeding Hall.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHero
        title="Breeding Hall"
        subtitle="Select a pairing and shape the next generation. Genetics and destiny intertwine here."
        mood="mystic"
        icon={<Heart className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <BreedingPairSelection userId={user?.id != null ? String(user.id) : undefined} />
      </div>
    </div>
  );
};

export default BreedingPage;
