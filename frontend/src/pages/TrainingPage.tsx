/**
 * TrainingPage — World > Training Grounds Location
 *
 * The Training Grounds location in the World hub. Follows the same layout
 * pattern as TackShopPage, FarrierPage, and FeedShopPage:
 *   - PageHero with breadcrumb (World / Training Grounds)
 *   - Banner image in a glass card
 *   - Content area wrapped in max-w-7xl container
 *   - Info panel at the bottom
 */

import { Link } from 'react-router-dom';
import { Swords } from 'lucide-react';
import TrainingDashboard from '@/components/training/TrainingDashboard';
import PageHero from '@/components/layout/PageHero';
import { useAuth } from '@/contexts/AuthContext';

const TrainingPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="glass-panel-subtle rounded-xl p-8 flex items-center justify-center">
          <div className="flex items-center gap-3 text-[var(--text-muted)] text-sm font-[var(--font-body)]">
            <span className="w-5 h-5 rounded-full border-2 border-[var(--gold-400)] border-t-transparent animate-spin inline-block" />
            Entering the Training Grounds…
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="glass-panel rounded-xl p-8 text-center">
          <Swords className="w-10 h-10 mx-auto mb-3 text-[var(--gold-400)] opacity-40" />
          <p className="text-sm text-[var(--cream)] font-[var(--font-body)]">
            Please log in to access the Training Grounds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHero
        title="Training Grounds"
        subtitle="Hone your horses' skills across 23 disciplines. Each session pushes them closer to their potential."
        mood="default"
        icon={<Swords className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Training Grounds</span>
        </div>
      </PageHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Training Dashboard */}
        <TrainingDashboard userId={user?.id ? String(user.id) : undefined} />

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About the Training Grounds</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Horses must be at least 3 years old before they can begin formal training</li>
            <li>Each discipline has a 7-day global cooldown to prevent stat stacking</li>
            <li>Training improves the primary stats associated with each discipline</li>
            <li>Injured horses cannot train — visit the Farrier or Vet first</li>
            <li>
              Consistent training over time unlocks higher performance ceilings in competition
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TrainingPage;
