/**
 * MyTrainersDashboard Component (Epic 13 — Story 13-2)
 *
 * Dashboard for managing all hired trainers and their horse assignments.
 * Displays:
 * - Slot usage ("2 of 4 trainer slots used")
 * - Trainer cards with personality, career level, assignment status
 * - Retirement warnings
 * - Expandable career + discovery panels
 *
 * All data uses MOCK_MY_TRAINERS — replace with /api/trainers/user/:id endpoint.
 * Assign / unassign buttons disabled pending 13-5 auth wire-up.
 *
 * Mirrors MyRidersDashboard.tsx for the Trainer System.
 */

import React, { useState } from 'react';
import { GraduationCap, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import TrainerPersonalityBadge from './trainer/TrainerPersonalityBadge';
import TrainerCareerPanel, { type TrainerCareerData } from './trainer/TrainerCareerPanel';
import TrainerDiscoveryPanel, {
  buildEmptyTrainerDiscoveryProfile,
} from './trainer/TrainerDiscoveryPanel';
import TrainerAssignmentCard, { type TrainerAssignment } from './trainer/TrainerAssignmentCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HiredTrainer {
  id: number;
  firstName: string;
  lastName: string;
  personality: string;
  skillLevel: 'novice' | 'developing' | 'expert';
  level: number;
  experience: number;
  careerWeeks: number;
  totalSessions: number;
  totalHorses: number;
  prestige: number;
}

// ─── Mock Data — replace with /api/trainers/user/:userId ─────────────────────

const MOCK_MY_TRAINERS: HiredTrainer[] = [
  {
    id: 101,
    firstName: 'Alex',
    lastName: 'Rivera',
    personality: 'technical',
    skillLevel: 'developing',
    level: 4,
    experience: 600,
    careerWeeks: 45,
    totalSessions: 12,
    totalHorses: 3,
    prestige: 22,
  },
  {
    id: 102,
    firstName: 'Bree',
    lastName: 'Callahan',
    personality: 'patient',
    skillLevel: 'novice',
    level: 2,
    experience: 100,
    careerWeeks: 18,
    totalSessions: 4,
    totalHorses: 1,
    prestige: 5,
  },
];

const MOCK_ASSIGNMENTS: TrainerAssignment[] = [
  {
    id: 201,
    trainerId: 101,
    horseName: 'Silver Arrow',
    startDate: '2025-11-01T00:00:00Z',
    isActive: true,
  },
  {
    id: 202,
    trainerId: 101,
    horseName: 'Midnight Star',
    startDate: '2025-12-15T00:00:00Z',
    isActive: true,
  },
  {
    id: 203,
    trainerId: 102,
    horseName: 'Copper Dream',
    startDate: '2026-01-10T00:00:00Z',
    isActive: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface MyTrainersDashboardProps {
  userId?: number;
  trainerSlotCap?: number;
}

const SKILL_LEVEL_VISIBILITY: Record<string, string> = {
  novice: 'Unknown potential',
  developing: 'Partial reveal',
  expert: 'Full reveal',
};

const MyTrainersDashboard: React.FC<MyTrainersDashboardProps> = ({ trainerSlotCap = 4 }) => {
  const [expandedTrainerId, setExpandedTrainerId] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<'career' | 'discovery'>('career');

  const finalTrainers = MOCK_MY_TRAINERS;
  const finalAssignments = MOCK_ASSIGNMENTS;

  if (finalTrainers.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="no-trainers-state"
      >
        <GraduationCap className="w-12 h-12 text-white/20 mb-3" />
        <h2 className="text-lg font-bold text-white/60 mb-1">No Trainers Hired</h2>
        <p className="text-sm text-white/40 max-w-sm">
          Visit the Hire tab to browse the trainer marketplace and hire your first trainer.
        </p>
      </div>
    );
  }

  const getTrainerAssignments = (trainerId: number): TrainerAssignment[] =>
    finalAssignments.filter((a) => a.trainerId === trainerId && a.isActive);

  const unassignedCount = finalTrainers.filter(
    (t) => getTrainerAssignments(t.id).length === 0
  ).length;
  const slotsUsed = finalTrainers.length;

  return (
    <div className="space-y-5" data-testid="my-trainers-dashboard">
      {/* Slot Counter */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-white/40" />
          <span className="text-sm text-white/60">
            <span className="font-bold text-white/90">{slotsUsed}</span> of{' '}
            <span className="font-bold text-white/90">{trainerSlotCap}</span> trainer slots used
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: trainerSlotCap }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full ${
                i < slotsUsed ? 'bg-celestial-gold/70' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Warnings */}
      {unassignedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-900/20 border border-amber-500/30 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>
            <strong>{unassignedCount}</strong> trainer{unassignedCount > 1 ? 's' : ''} without
            assignments — assign them to horses to begin training sessions.
          </p>
        </div>
      )}

      {/* Trainer Cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        data-testid="trainer-grid"
      >
        {finalTrainers.map((trainer) => {
          const assignments = getTrainerAssignments(trainer.id);
          const isExpanded = expandedTrainerId === trainer.id;

          const careerData: TrainerCareerData = {
            id: trainer.id,
            name: `${trainer.firstName} ${trainer.lastName}`,
            experience: trainer.experience,
            level: trainer.level,
            careerWeeks: trainer.careerWeeks,
            hiredDate: new Date().toISOString(), // placeholder
            retired: false,
            totalSessions: trainer.totalSessions,
            totalHorses: trainer.totalHorses,
          };

          return (
            <div
              key={trainer.id}
              data-testid={`trainer-card-${trainer.id}`}
              aria-label={`Trainer: ${trainer.firstName} ${trainer.lastName}`}
              className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
            >
              {/* Trainer Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white/90">
                      {trainer.firstName} {trainer.lastName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-white/40 capitalize">{trainer.skillLevel}</span>
                      <span className="text-white/20 text-xs">·</span>
                      <span className="text-xs text-white/40">
                        {SKILL_LEVEL_VISIBILITY[trainer.skillLevel]}
                      </span>
                    </div>
                  </div>
                  <TrainerPersonalityBadge personality={trainer.personality} />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-sm font-bold text-celestial-gold">Lv.{trainer.level}</p>
                  <p className="text-[10px] text-white/30">Level</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-sm font-bold text-white/80">{trainer.totalSessions}</p>
                  <p className="text-[10px] text-white/30">Sessions</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-sm font-bold text-white/80">{trainer.careerWeeks}w</p>
                  <p className="text-[10px] text-white/30">Career</p>
                </div>
              </div>

              {/* Assignments */}
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                  Assigned Horse{assignments.length !== 1 ? 's' : ''}
                </h4>
                {assignments.length === 0 ? (
                  <div className="py-3 text-center border-2 border-dashed border-white/10 rounded-lg">
                    <p className="text-xs text-white/30 italic">No horse assigned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <TrainerAssignmentCard key={a.id} assignment={a} />
                    ))}
                  </div>
                )}
              </div>

              {/* Assign Button — disabled, pending auth wire-up */}
              <button
                type="button"
                disabled
                title="Sign in to assign trainers"
                className="w-full py-2 px-3 mb-3 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
                data-testid={`assign-button-${trainer.id}`}
              >
                Assign to Horse
              </button>

              {/* Expand Career / Discovery */}
              <button
                type="button"
                onClick={() => {
                  if (isExpanded) {
                    setExpandedTrainerId(null);
                  } else {
                    setExpandedTrainerId(trainer.id);
                    setExpandedSection('career');
                  }
                }}
                className="w-full text-left text-xs text-white/30 hover:text-white/60 flex items-center justify-between py-1 transition-colors"
                aria-expanded={isExpanded}
                data-testid={`expand-toggle-${trainer.id}`}
              >
                <span>Career &amp; Discovery Details</span>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {/* Section Tabs */}
                  <div className="flex gap-1 mb-4">
                    {(['career', 'discovery'] as const).map((section) => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setExpandedSection(section)}
                        className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors capitalize ${
                          expandedSection === section
                            ? 'bg-white/10 text-white/90'
                            : 'text-white/30 hover:text-white/50'
                        }`}
                      >
                        {section}
                      </button>
                    ))}
                  </div>

                  {expandedSection === 'career' && (
                    <TrainerCareerPanel trainer={careerData} assignmentCount={assignments.length} />
                  )}

                  {expandedSection === 'discovery' && (
                    <TrainerDiscoveryPanel
                      profile={buildEmptyTrainerDiscoveryProfile(trainer.id)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyTrainersDashboard;
