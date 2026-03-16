/**
 * Hub Dashboard — The player's home base in Equoria (Section 08)
 *
 * Matches direction-4-hybrid.html: "My Stable" header + NextActionsBar + horse grid.
 * AsidePanel is rendered by DashboardLayout on hub routes.
 */

import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NextActionsBar } from '@/components/hub/NextActionsBar';
import { useHorses } from '@/hooks/api/useHorses';

/* ─── Horse Mini-Card ────────────────────────────────────────────────────── */
function HorseMiniCard({
  horse,
}: {
  horse: { id: number; name: string; breed?: string; level?: number; age?: number };
}) {
  return (
    <Link
      to={`/horses/${horse.id}`}
      className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] overflow-hidden transition-all duration-200 hover:border-[var(--glass-hover)] hover:shadow-[var(--glow-gold)] hover:-translate-y-0.5 group"
      aria-label={`View ${horse.name}`}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Portrait placeholder */}
        <div className="w-16 h-16 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0 relative bg-gradient-to-br from-[var(--bg-midnight)] to-[var(--bg-twilight)]">
          <span className="text-2xl">🐴</span>
          {horse.level != null && (
            <span className="absolute -bottom-1 -right-1 bg-[rgba(200,168,78,0.25)] border border-[var(--gold-dim)] rounded-[var(--radius-sm)] px-1.5 py-0 text-[0.6rem] font-bold text-[var(--gold-light)]">
              {horse.level}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-[var(--text-primary)] truncate"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {horse.name}
          </p>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {horse.breed ?? 'Unknown breed'}
            {horse.age != null ? ` · ${horse.age} yrs` : ''}
          </p>
        </div>

        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 group-hover:text-[var(--gold-primary)] transition-colors" />
      </div>
    </Link>
  );
}

/* ─── Getting Started card (new players) ─────────────────────────────────── */
function GettingStartedCard() {
  return (
    <div className="relative bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[rgba(200,168,78,0.35)] rounded-[var(--radius-lg)] p-6 space-y-4 overflow-hidden">
      <div
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none"
        aria-hidden="true"
        style={{ background: 'radial-gradient(circle, rgba(200,168,78,0.12) 0%, transparent 70%)' }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-[var(--gold-primary)]" />
          <h3
            className="text-lg font-bold text-[var(--gold-primary)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Your Adventure Begins
          </h3>
        </div>
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
          Welcome to Equoria, rider. The stables are warm, the training grounds await, and the
          competition arena calls. Meet your first horse and begin forging a legacy among the stars.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-3">
          <Link to="/stable" className="btn-primary-arcs text-center text-sm">
            Enter the Stable
          </Link>
          <Link to="/world" className="btn-outline-celestial text-center text-sm">
            Explore the World
          </Link>
        </div>
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
  const readyCount = 0; // placeholder — will be derived from horse cooldown data
  const needsCareCount = 0; // placeholder

  return (
    <div className="py-6 space-y-6">
      {/* Page header — matches mockup */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-[var(--text-h1)] font-semibold text-[var(--gold-primary)]"
            style={{
              fontFamily: 'var(--font-heading)',
              textShadow: '0 0 30px rgba(200,168,78,0.25)',
            }}
          >
            My Stable
          </h1>
          <p className="text-[0.85rem] text-[var(--text-secondary)] mt-1">
            <span className="text-[var(--gold-light)] font-semibold">{horseList.length}</span>
            {' horses'}
            {readyCount > 0 && (
              <>
                {' · '}
                <span className="text-[var(--gold-light)] font-semibold">{readyCount}</span>
                {' ready to train'}
              </>
            )}
            {needsCareCount > 0 && (
              <>
                {' · '}
                <span className="text-[var(--gold-light)] font-semibold">{needsCareCount}</span>
                {' needs care'}
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/stable"
            className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:border-[var(--glass-hover)] transition-colors"
          >
            View all
          </Link>
        </div>
      </header>

      {/* Next actions or getting started */}
      {isNewPlayer ? <GettingStartedCard /> : <NextActionsBar />}

      {/* Horse grid */}
      <section aria-label="Your horses">
        {horsesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-24 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] animate-pulse"
              />
            ))}
          </div>
        ) : horseList.length === 0 ? (
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[var(--bg-midnight)] to-[var(--bg-twilight)] border border-[rgba(200,168,78,0.2)]">
              <Star className="w-8 h-8 text-[var(--gold-primary)] opacity-40" />
            </div>
            <p
              className="text-sm text-[var(--text-primary)] mb-1"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Your stable is empty
            </p>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Visit the stable to meet your first horse.
            </p>
            <Link to="/stable" className="btn-primary-arcs inline-block text-sm px-8">
              Go to Stable
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {horseList.slice(0, 12).map((horse) => (
              <HorseMiniCard key={horse.id} horse={horse} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Index;
