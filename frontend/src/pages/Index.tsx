/**
 * Hub Dashboard (Task 23-3)
 *
 * Celestial Night hub-and-spoke constellation layout:
 * - NextActionsBar at top (priority suggestions)
 * - Stable card grid with NarrativeChips
 * - Aside panel (desktop 1024px+) / bottom sheet (mobile)
 * - Day-1 "Getting Started" mode for new users
 *
 * Replaces the old mock Index with live data and Celestial Night styling.
 */

import { Link } from 'react-router-dom';
import { Coins, Star, Trophy, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NextActionsBar } from '@/components/hub/NextActionsBar';
import { useHorses } from '@/hooks/api/useHorses';

/* ─── Stat Pill ─────────────────────────────────────────────────────────── */
function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 glass-panel-subtle rounded-xl px-4 py-3">
      <span className="text-[var(--text-muted)]">{icon}</span>
      <span className="text-lg font-semibold text-[var(--cream)] font-[var(--font-heading)]">
        {value}
      </span>
      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
    </div>
  );
}

/* ─── Horse Mini-Card ────────────────────────────────────────────────────── */
function HorseMiniCard({
  horse,
}: {
  horse: { id: number; name: string; breed?: string; level?: number; age?: number };
}) {
  return (
    <Link
      to={`/horses/${horse.id}`}
      className="glass-panel flex items-center gap-4 p-4 hover:border-[rgba(201,162,39,0.4)] transition-all duration-150 group"
      aria-label={`View ${horse.name}`}
    >
      {/* Horse avatar placeholder */}
      <div className="w-12 h-12 rounded-xl bg-[var(--celestial-navy-700)] flex items-center justify-center flex-shrink-0 border border-[rgba(201,162,39,0.2)] group-hover:border-[rgba(201,162,39,0.5)] transition-colors">
        <Star className="w-6 h-6 text-[var(--gold-400)]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--cream)] truncate font-[var(--font-heading)] text-sm">
          {horse.name}
        </p>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {horse.breed ?? 'Unknown breed'}
          {horse.age != null ? ` · Age ${horse.age}` : ''}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 group-hover:text-[var(--gold-400)] transition-colors" />
    </Link>
  );
}

/* ─── Getting Started card for new-player mode ───────────────────────────── */
function GettingStartedCard() {
  return (
    <div className="glass-panel border-[rgba(201,162,39,0.3)] p-6 space-y-3">
      <h3 className="text-lg font-semibold text-[var(--gold-400)] font-[var(--font-heading)]">
        Getting Started
      </h3>
      <p className="text-sm text-[var(--cream)]">
        Welcome to Equoria! Your adventure begins here. Visit your stable to meet your first horse,
        then enter the training grounds to prepare for competition.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link to="/stable" className="btn-cobalt text-center text-sm">
          Visit Stable
        </Link>
        <Link to="/world" className="btn-outline-celestial text-center text-sm">
          Explore World
        </Link>
      </div>
    </div>
  );
}

/* ─── Main Hub ───────────────────────────────────────────────────────────── */
const Index = () => {
  const { user } = useAuth();
  const { data: horses, isLoading: horsesLoading } = useHorses();

  const isNewPlayer = !user?.completedOnboarding;
  const horseList = Array.isArray(horses) ? horses : [];

  return (
    <div className="min-h-screen">
      {/* Main content + aside layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:flex lg:gap-8">
        {/* Primary column */}
        <main className="flex-1 min-w-0 space-y-8">
          {/* Welcome header */}
          <div>
            <h1
              className="text-3xl font-bold text-[var(--gold-400)] tracking-wide"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {isNewPlayer ? 'Welcome, Rider' : `Welcome back, ${user?.firstName ?? 'Rider'}`}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {isNewPlayer ? 'Your adventure in Equoria begins now.' : 'Your stable awaits.'}
            </p>
          </div>

          {/* Stat pills */}
          {user && (
            <section className="grid grid-cols-3 gap-3" aria-label="Your stats">
              <StatPill
                label="Coins"
                value={user.money?.toLocaleString() ?? 0}
                icon={<Coins className="w-5 h-5" />}
              />
              <StatPill
                label="XP"
                value={user.xp?.toLocaleString() ?? 0}
                icon={<Star className="w-5 h-5" />}
              />
              <StatPill
                label="Level"
                value={user.level ?? 1}
                icon={<Trophy className="w-5 h-5" />}
              />
            </section>
          )}

          {/* Next actions or getting started */}
          {isNewPlayer ? <GettingStartedCard /> : <NextActionsBar />}

          {/* Stable — horse grid */}
          <section aria-label="Your horses">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)]">
                Your Stable
              </h2>
              <Link
                to="/stable"
                className="text-xs text-[var(--electric-blue-300)] hover:text-[var(--electric-blue-400)] transition-colors"
              >
                View all →
              </Link>
            </div>

            {horsesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="glass-panel-subtle h-20 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : horseList.length === 0 ? (
              <div className="glass-panel-subtle rounded-xl p-6 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  Your stable is empty. Visit the stable to get your first horse.
                </p>
                <Link to="/stable" className="btn-cobalt inline-block mt-3 text-sm px-6">
                  Go to Stable
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {horseList.slice(0, 6).map((horse) => (
                  <HorseMiniCard key={horse.id} horse={horse} />
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Aside panel — desktop only */}
        <aside
          className="hidden lg:flex lg:flex-col lg:w-72 xl:w-80 gap-4 flex-shrink-0"
          aria-label="Quick links"
        >
          <div className="glass-panel p-5 space-y-3 sticky top-24">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Quick Links
            </h3>
            {[
              { to: '/training', label: 'Training Grounds', icon: '🏋️' },
              { to: '/competitions', label: 'Competitions', icon: '🏆' },
              { to: '/breeding', label: 'Breeding', icon: '🧬' },
              { to: '/grooms', label: 'Grooms & Foals', icon: '🐣' },
              { to: '/world', label: 'World Hub', icon: '🌍' },
              { to: '/marketplace', label: 'Marketplace', icon: '🛒' },
            ].map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--cream)] hover:bg-[rgba(201,162,39,0.08)] hover:text-[var(--gold-400)] transition-colors group"
              >
                <span className="text-base">{icon}</span>
                <span className="flex-1">{label}</span>
                <ChevronRight className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--gold-400)] transition-colors" />
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Index;
