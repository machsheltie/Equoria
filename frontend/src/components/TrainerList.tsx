/**
 * TrainerList Component — Trainer Marketplace (Epic 13 — Story 13-1)
 *
 * Trainer hiring marketplace interface:
 * - Marketplace trainer listing with filtering and sorting
 * - Hire button disabled (mock-ready, pending 13-5 API wire-up)
 * - Skill level transparency note (same as Rider marketplace)
 * - Personality and skill-level filter controls
 *
 * All data uses MOCK_AVAILABLE_TRAINERS — replace with /api/trainers/marketplace endpoint.
 *
 * Mirrors RiderList.tsx for the Trainer System.
 */

import React, { useState, useMemo } from 'react';
import { GraduationCap, DollarSign, RefreshCw } from 'lucide-react';
import TrainerPersonalityBadge from './trainer/TrainerPersonalityBadge';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketplaceTrainer {
  id: string;
  firstName: string;
  lastName: string;
  personality: string;
  skillLevel: 'novice' | 'developing' | 'expert';
  experience: number;
  weeklyRate: number;
  disciplines: string[]; // known specializations (empty for novice)
  bio: string;
}

// ─── Mock Data — replace with /api/trainers/marketplace ──────────────────────

const MOCK_AVAILABLE_TRAINERS: MarketplaceTrainer[] = [
  {
    id: 'tm-1',
    firstName: 'Michael',
    lastName: 'Torres',
    personality: 'focused',
    skillLevel: 'novice',
    experience: 0,
    weeklyRate: 1200,
    disciplines: [],
    bio: 'Recently certified — eager to prove himself. Hidden potential.',
  },
  {
    id: 'tm-2',
    firstName: 'Sarah',
    lastName: 'Chen',
    personality: 'technical',
    skillLevel: 'expert',
    experience: 4800,
    weeklyRate: 3400,
    disciplines: ['Dressage', 'Show Jumping'],
    bio: 'Former Olympic support staff. Precision-focused methodology with proven results.',
  },
  {
    id: 'tm-3',
    firstName: 'Jake',
    lastName: 'Kowalski',
    personality: 'competitive',
    skillLevel: 'developing',
    experience: 1200,
    weeklyRate: 2100,
    disciplines: ['Cross Country'],
    bio: 'Ex-jockey turned trainer. Knows what it takes to win on race day.',
  },
  {
    id: 'tm-4',
    firstName: 'Emma',
    lastName: 'Blanc',
    personality: 'encouraging',
    skillLevel: 'novice',
    experience: 0,
    weeklyRate: 1000,
    disciplines: [],
    bio: 'First year out of training school. Her horses adore her — that counts for a lot.',
  },
  {
    id: 'tm-5',
    firstName: 'David',
    lastName: 'Osei',
    personality: 'patient',
    skillLevel: 'expert',
    experience: 3900,
    weeklyRate: 2900,
    disciplines: ['Western', 'Endurance'],
    bio: 'Specialises in difficult horses. No horse is beyond reaching — just a matter of time.',
  },
  {
    id: 'tm-6',
    firstName: 'Lily',
    lastName: 'Nakamura',
    personality: 'focused',
    skillLevel: 'developing',
    experience: 870,
    weeklyRate: 1800,
    disciplines: ['Dressage'],
    bio: 'Two-year professional. Dressage specialist building a strong track record.',
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const SKILL_LEVEL_LABELS: Record<
  string,
  { label: string; colorClass: string; visibility: string }
> = {
  novice: {
    label: 'Novice',
    colorClass: 'bg-[rgba(15,35,70,0.6)] text-[rgb(148,163,184)]',
    visibility: 'Stats hidden — unknown potential',
  },
  developing: {
    label: 'Developing',
    colorClass: 'bg-blue-900/60 text-blue-300',
    visibility: 'Some specializations revealed',
  },
  expert: {
    label: 'Expert',
    colorClass: 'bg-amber-900/60 text-amber-300',
    visibility: 'All specializations visible',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TrainerListProps {
  userId?: number;
}

const TrainerList: React.FC<TrainerListProps> = () => {
  const [filterSkillLevel, setFilterSkillLevel] = useState<string>('all');
  const [filterPersonality, setFilterPersonality] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const calculateHiringCost = (weeklyRate: number) => weeklyRate * 4; // 4-week upfront

  const filteredAndSortedTrainers = useMemo(() => {
    let filtered = [...MOCK_AVAILABLE_TRAINERS];

    if (filterSkillLevel !== 'all') {
      filtered = filtered.filter((t) => t.skillLevel === filterSkillLevel);
    }
    if (filterPersonality !== 'all') {
      filtered = filtered.filter((t) => t.personality === filterPersonality);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rate-asc':
          return a.weeklyRate - b.weeklyRate;
        case 'rate-desc':
          return b.weeklyRate - a.weeklyRate;
        case 'experience-desc':
          return b.experience - a.experience;
        default:
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
    });

    return filtered;
  }, [filterSkillLevel, filterPersonality, sortBy]);

  return (
    <main
      role="main"
      aria-label="Trainer marketplace"
      data-testid="trainer-list"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white/90">Trainer Marketplace</h2>
          <p className="text-sm text-white/50 mt-0.5">Hire trainers to coach your horses</p>
        </div>
        <button
          type="button"
          disabled
          title="Marketplace refresh coming soon"
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/30 rounded-lg cursor-not-allowed text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Marketplace
        </button>
      </div>

      {/* Balance Placeholder */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm">
        <div className="flex items-center gap-2 text-white/50">
          <DollarSign className="w-4 h-4" />
          <span>Your Balance</span>
        </div>
        <span className="font-bold text-celestial-gold text-white/30 italic text-xs">
          Sign in to view balance
        </span>
      </div>

      {/* Skill Level Transparency Note */}
      <div className="px-4 py-3 rounded-lg bg-blue-900/20 border border-blue-500/20 text-xs text-blue-300/80">
        <strong>Level = Information, not quality.</strong> Novice trainers are affordable but their
        specializations are hidden — they could be exceptional. Expert trainers reveal all skills,
        good or bad.
      </div>

      {/* Filters */}
      <div
        data-testid="trainer-filters"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white/5 border border-white/10 rounded-xl"
      >
        <div>
          <label
            htmlFor="skill-level-filter"
            className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5"
          >
            Skill Level
          </label>
          <select
            id="skill-level-filter"
            data-testid="skill-level-filter"
            value={filterSkillLevel}
            onChange={(e) => setFilterSkillLevel(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
          >
            <option value="all">All Levels</option>
            <option value="novice">Novice</option>
            <option value="developing">Developing</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="personality-filter"
            className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5"
          >
            Personality
          </label>
          <select
            id="personality-filter"
            data-testid="personality-filter"
            value={filterPersonality}
            onChange={(e) => setFilterPersonality(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
          >
            <option value="all">All Personalities</option>
            <option value="focused">Focused</option>
            <option value="encouraging">Encouraging</option>
            <option value="technical">Technical</option>
            <option value="competitive">Competitive</option>
            <option value="patient">Patient</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="sort-select"
            className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5"
          >
            Sort By
          </label>
          <select
            id="sort-select"
            data-testid="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
          >
            <option value="name">Name</option>
            <option value="rate-asc">Rate (Low → High)</option>
            <option value="rate-desc">Rate (High → Low)</option>
            <option value="experience-desc">Most Experienced</option>
          </select>
        </div>
      </div>

      {/* Trainer Grid */}
      <div data-testid="trainer-marketplace">
        {filteredAndSortedTrainers.length === 0 ? (
          <div className="text-center py-12 border border-white/10 rounded-xl">
            <GraduationCap className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white/50 mb-1">No Trainers Match</h3>
            <p className="text-sm text-white/30 mb-4">Try adjusting your filters</p>
          </div>
        ) : (
          <div
            data-testid="trainer-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredAndSortedTrainers.map((trainer) => {
              const hiringCost = calculateHiringCost(trainer.weeklyRate);
              const skillMeta = SKILL_LEVEL_LABELS[trainer.skillLevel] ?? SKILL_LEVEL_LABELS.novice;

              return (
                <div
                  key={trainer.id}
                  data-testid={`trainer-card-${trainer.id}`}
                  className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white/90">
                        {trainer.firstName} {trainer.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${skillMeta.colorClass}`}
                        >
                          {skillMeta.label}
                        </span>
                        <TrainerPersonalityBadge personality={trainer.personality} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm border-y border-white/5 py-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-white/40">Experience:</span>
                      <span className="text-white/70">
                        {trainer.skillLevel === 'novice' ? '???' : `${trainer.experience} XP`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Weekly Rate:</span>
                      <span className="font-semibold text-celestial-gold">
                        {trainer.weeklyRate.toLocaleString()} Coins/wk
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/40">Specializations:</span>
                      <span className="text-[10px] text-white/40 italic">
                        {skillMeta.visibility}
                      </span>
                    </div>
                  </div>

                  {/* Known Disciplines (expert only) */}
                  {trainer.skillLevel === 'expert' && trainer.disciplines.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                        Known Specializations
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {trainer.disciplines.map((d) => (
                          <span
                            key={d}
                            className="px-1.5 py-0.5 bg-violet-900/30 text-violet-400 text-[10px] rounded"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  <p className="text-xs text-white/40 italic mb-4 line-clamp-2">
                    &ldquo;{trainer.bio}&rdquo;
                  </p>

                  {/* Hire Button — disabled, pending auth wire-up (13-5) */}
                  <button
                    type="button"
                    disabled
                    title="Sign in to hire trainers"
                    className="w-full py-2.5 px-4 rounded-lg font-bold text-sm bg-white/5 text-white/30 cursor-not-allowed border border-white/10"
                    data-testid={`hire-button-${trainer.id}`}
                  >
                    Hire — {hiringCost.toLocaleString()} Coins
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* API placeholder note */}
      <div className="px-4 py-3 rounded-lg bg-white/3 border border-white/8 text-xs text-white/30 text-center">
        Mock data — hire functionality requires auth wire-up (Story 13-5)
      </div>
    </main>
  );
};

export default TrainerList;
