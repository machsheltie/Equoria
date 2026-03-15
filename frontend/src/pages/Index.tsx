/**
 * Hub Dashboard — The player's home base in Equoria
 *
 * Celestial Night constellation layout with atmospheric presence.
 * Not a generic dashboard — this is your landing pad in a game world.
 */

import { Link } from 'react-router-dom';
import { Coins, Star, Trophy, ChevronRight, Sparkles, Compass } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NextActionsBar } from '@/components/hub/NextActionsBar';
import { useHorses } from '@/hooks/api/useHorses';

/* ─── Stat Pill ─────────────────────────────────────────────────────────── */
function StatPill({
  label,
  value,
  icon,
  glowColor,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  glowColor?: string;
}) {
  return (
    <div
      className="relative flex flex-col items-center gap-1.5 glass-panel rounded-xl px-5 py-4 group hover:border-[rgba(201,162,39,0.4)] transition-all duration-200"
      style={{
        boxShadow: glowColor
          ? `0 4px 20px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`
          : undefined,
      }}
    >
      <span className="text-[var(--gold-400)] group-hover:scale-110 transition-transform duration-200">
        {icon}
      </span>
      <span className="text-xl font-bold text-[var(--cream)] font-[var(--font-heading)]">
        {value}
      </span>
      <span className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-[0.15em] font-medium">
        {label}
      </span>
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
      className="glass-panel flex items-center gap-4 p-4 hover:border-[rgba(201,162,39,0.4)] hover:shadow-[0_0_20px_rgba(201,162,39,0.1)] transition-all duration-200 group"
      aria-label={`View ${horse.name}`}
    >
      {/* Horse avatar */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-[rgba(201,162,39,0.2)] group-hover:border-[rgba(201,162,39,0.5)] group-hover:shadow-[0_0_12px_rgba(201,162,39,0.2)] transition-all duration-200"
        style={{ background: 'linear-gradient(135deg, rgba(201,162,39,0.08), rgba(10,22,40,0.8))' }}
      >
        <Star className="w-5 h-5 text-[var(--gold-400)]" />
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

      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 group-hover:text-[var(--gold-400)] group-hover:translate-x-0.5 transition-all duration-200" />
    </Link>
  );
}

/* ─── Location Link — replaces plain Quick Links with game-world entries ─── */
function LocationLink({
  to,
  label,
  icon,
  description,
}: {
  to: string;
  label: string;
  icon: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="glass-panel-subtle flex items-center gap-4 px-4 py-3.5 hover:bg-[rgba(201,162,39,0.06)] hover:border-[rgba(201,162,39,0.35)] transition-all duration-200 group"
    >
      <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-[var(--cream)] font-[var(--font-heading)] block">
          {label}
        </span>
        <span className="text-[0.7rem] text-[var(--text-muted)] block truncate">{description}</span>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 group-hover:text-[var(--gold-400)] transition-colors" />
    </Link>
  );
}

/* ─── Getting Started card ──────────────────────────────────────────────── */
function GettingStartedCard() {
  return (
    <div className="relative glass-panel border-[rgba(201,162,39,0.35)] p-6 space-y-4 overflow-hidden">
      {/* Decorative glow */}
      <div
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none"
        aria-hidden="true"
        style={{ background: 'radial-gradient(circle, rgba(201,162,39,0.12) 0%, transparent 70%)' }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-[var(--gold-400)]" />
          <h3 className="text-lg font-bold text-[var(--gold-400)] font-[var(--font-heading)]">
            Your Adventure Begins
          </h3>
        </div>
        <p className="text-sm text-[var(--cream)] leading-relaxed">
          Welcome to Equoria, rider. The stables are warm, the training grounds await, and the
          competition arena calls. Meet your first horse and begin forging a legacy among the stars.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-3">
          <Link to="/stable" className="btn-cobalt text-center text-sm">
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

  return (
    <div className="min-h-screen">
      {/* Atmospheric hero header */}
      <header className="relative overflow-hidden">
        {/* Ambient glow orbs */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse at 30% 40%, rgba(201,162,39,0.12) 0%, transparent 55%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse at 75% 60%, rgba(58,111,221,0.08) 0%, transparent 50%)',
          }}
        />

        <div className="relative z-[1] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-2">
          <div className="flex items-center gap-3 mb-1">
            <Compass className="w-5 h-5 text-[var(--gold-400)] opacity-60" />
            <span className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">
              World Hub
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-[var(--gold-400)]"
            style={{
              fontFamily: 'var(--font-heading)',
              textShadow: '0 0 40px rgba(201,162,39,0.3), 0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {isNewPlayer ? 'Welcome, Rider' : `Welcome back, ${user?.firstName ?? 'Rider'}`}
          </h1>
          <p className="text-sm text-[var(--cream)] mt-1 opacity-70">
            {isNewPlayer
              ? 'Your adventure in Equoria begins now.'
              : 'Your stable awaits beneath the stars.'}
          </p>
        </div>

        {/* Gold accent divider */}
        <div
          className="h-px w-full mt-6"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(201,162,39,0.4), rgba(58,111,221,0.2), transparent)',
          }}
        />
      </header>

      {/* Main content + aside layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:flex lg:gap-8">
        {/* Primary column */}
        <main className="flex-1 min-w-0 space-y-8">
          {/* Stat pills */}
          {user && (
            <section className="grid grid-cols-3 gap-3" aria-label="Your stats">
              <StatPill
                label="Coins"
                value={user.money?.toLocaleString() ?? 0}
                icon={<Coins className="w-5 h-5" />}
                glowColor="rgba(201,162,39,0.08)"
              />
              <StatPill
                label="XP"
                value={user.xp?.toLocaleString() ?? 0}
                icon={<Star className="w-5 h-5" />}
                glowColor="rgba(58,111,221,0.08)"
              />
              <StatPill
                label="Level"
                value={user.level ?? 1}
                icon={<Trophy className="w-5 h-5" />}
                glowColor="rgba(201,162,39,0.08)"
              />
            </section>
          )}

          {/* Next actions or getting started */}
          {isNewPlayer ? <GettingStartedCard /> : <NextActionsBar />}

          {/* Stable — horse grid */}
          <section aria-label="Your horses">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-[var(--gold-500)]" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--cream)] font-[var(--font-heading)]">
                  Your Stable
                </h2>
              </div>
              <Link
                to="/stable"
                className="text-xs text-[var(--electric-blue-300)] hover:text-[var(--electric-blue-400)] transition-colors flex items-center gap-1"
              >
                View all
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {horsesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="glass-panel-subtle h-20 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : horseList.length === 0 ? (
              <div className="glass-panel rounded-xl p-8 text-center">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center border border-[rgba(201,162,39,0.2)]"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(201,162,39,0.08), rgba(10,22,40,0.8))',
                  }}
                >
                  <Star className="w-8 h-8 text-[var(--gold-400)] opacity-40" />
                </div>
                <p className="text-sm text-[var(--cream)] mb-1 font-[var(--font-heading)]">
                  Your stable is empty
                </p>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Visit the stable to meet your first horse.
                </p>
                <Link to="/stable" className="btn-cobalt inline-block text-sm px-8">
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

        {/* Aside panel — locations sidebar */}
        <aside
          className="hidden lg:flex lg:flex-col lg:w-72 xl:w-80 gap-3 flex-shrink-0"
          aria-label="Locations"
        >
          <div className="sticky top-24 space-y-3">
            <div className="flex items-center gap-2 px-1 mb-1">
              <div className="w-1 h-4 rounded-full bg-[var(--electric-blue-500)]" />
              <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Locations
              </h3>
            </div>
            {[
              {
                to: '/training',
                label: 'Training Grounds',
                icon: '🏋️',
                description: 'Hone skills across 23 disciplines',
              },
              {
                to: '/competitions',
                label: 'Competition Arena',
                icon: '🏆',
                description: 'Enter shows and earn prizes',
              },
              {
                to: '/breeding',
                label: 'Breeding Hall',
                icon: '🧬',
                description: 'Shape the next generation',
              },
              {
                to: '/grooms',
                label: 'Groom Quarters',
                icon: '🐣',
                description: 'Manage foal care and bonding',
              },
              {
                to: '/world',
                label: 'World Hub',
                icon: '🌍',
                description: 'Explore all of Equoria',
              },
              {
                to: '/marketplace',
                label: 'Marketplace',
                icon: '🛒',
                description: 'Buy, sell, and trade horses',
              },
            ].map((loc) => (
              <LocationLink key={loc.to} {...loc} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Index;
