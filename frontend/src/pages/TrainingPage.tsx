/**
 * TrainingPage — Celestial Night restyle (Epic 26-3)
 *
 * Wraps the TrainingDashboard in Celestial Night glass panels.
 * CooldownTimer (via DashboardHorseCard) and DisciplineSelector (via TrainingSessionModal)
 * are integrated inside TrainingDashboard — this page provides the atmospheric shell.
 */

import { Swords } from 'lucide-react';
import TrainingDashboard from '@/components/training/TrainingDashboard';
import { useAuth } from '@/contexts/AuthContext';

const TrainingPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm font-[var(--font-body)] animate-pulse">
          <span className="w-4 h-4 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin inline-block" />
          Checking authentication…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="glass-panel rounded-xl border border-[rgba(201,162,39,0.2)] px-5 py-4 text-sm text-[var(--gold-400)] font-[var(--font-body)]">
          Please log in to access the training center.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[rgba(201,162,39,0.1)] border border-[rgba(201,162,39,0.25)]">
          <Swords className="w-5 h-5 text-[var(--gold-400)]" aria-hidden="true" />
        </div>
        <div>
          <h1
            className="text-xl font-bold text-[var(--cream)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Training Center
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)] mt-0.5">
            Hone your horses&apos; skills across 23 disciplines
          </p>
        </div>
      </div>

      {/* Dashboard wrapped in glass panel */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <TrainingDashboard userId={user?.id ? String(user.id) : undefined} />
      </div>
    </div>
  );
};

export default TrainingPage;
