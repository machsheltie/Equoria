/**
 * TrainingPage — Training Grounds location
 *
 * Atmospheric shell wrapping TrainingDashboard with Celestial Night depth.
 * Feels like entering a moonlit training arena, not a data dashboard.
 */

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
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="glass-panel rounded-2xl p-4 sm:p-6">
          <TrainingDashboard userId={user?.id ? String(user.id) : undefined} />
        </div>
      </div>
    </div>
  );
};

export default TrainingPage;
