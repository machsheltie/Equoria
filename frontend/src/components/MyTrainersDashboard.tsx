/**
 * MyTrainersDashboard Component (Epic 13 — Story 13-2 / 13-5)
 *
 * Dashboard for managing all hired trainers and their horse assignments.
 * Displays:
 * - Slot usage ("2 of 4 trainer slots used")
 * - Trainer cards with personality, career level, assignment status
 * - Retirement warnings
 * - Expandable career + discovery panels
 *
 * Data is wired to real API hooks:
 *   useUserTrainers(userId)       → /api/trainers/user/:id
 *   useTrainerAssignments()       → /api/trainers/assignments
 *   useDeleteTrainerAssignment()  → DELETE /api/trainers/assignments/:id
 *   useAssignTrainer()            → POST /api/trainers/assignments
 *
 * Mirrors MyRidersDashboard.tsx for the Trainer System.
 */

import React, { useState } from 'react';
import { GraduationCap, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SkeletonBase } from '@/components/ui/SkeletonCard';
import TrainerPersonalityBadge from './trainer/TrainerPersonalityBadge';
import TrainerCareerPanel, { type TrainerCareerData } from './trainer/TrainerCareerPanel';
import TrainerDiscoveryPanel, {
  buildEmptyTrainerDiscoveryProfile,
} from './trainer/TrainerDiscoveryPanel';
import TrainerAssignmentCard from './trainer/TrainerAssignmentCard';
import {
  useUserTrainers,
  useTrainerAssignments,
  useDeleteTrainerAssignment,
  useAssignTrainer,
  type TrainerEntry,
  type TrainerAssignmentEntry,
} from '@/hooks/api/useTrainers';
import { useHorses } from '@/hooks/api/useHorses';

// ─── Constants ─────────────────────────────────────────────────────────────────

const SKILL_LEVEL_VISIBILITY: Record<string, string> = {
  novice: 'Unknown potential',
  developing: 'Partial reveal',
  expert: 'Full reveal',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface MyTrainersDashboardProps {
  userId: number;
  trainerSlotCap?: number;
}

const MyTrainersDashboard: React.FC<MyTrainersDashboardProps> = ({
  userId,
  trainerSlotCap = 4,
}) => {
  const [expandedTrainerId, setExpandedTrainerId] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<'career' | 'discovery'>('career');
  const [selectedTrainerIdForAssign, setSelectedTrainerIdForAssign] = useState<number | null>(null);

  const { data: trainers, isLoading: trainersLoading } = useUserTrainers(userId);
  const { data: assignments, isLoading: assignmentsLoading } = useTrainerAssignments();
  const unassignMutation = useDeleteTrainerAssignment();
  const assignMutation = useAssignTrainer();
  const { data: horses, isLoading: horsesLoading } = useHorses();

  const finalTrainers: TrainerEntry[] = trainers ?? [];
  const finalAssignments: TrainerAssignmentEntry[] = assignments ?? [];

  if (!userId || trainersLoading || assignmentsLoading) {
    return (
      <div className="space-y-3 p-4" aria-label="Loading trainers">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-3"
            style={{
              background: 'var(--glass-surface-bg)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <div className="flex items-center gap-3">
              <SkeletonBase className="w-10 h-10 flex-shrink-0" rounded="full" />
              <div className="flex-1 space-y-2">
                <SkeletonBase className="h-4 w-1/3" rounded="full" />
                <SkeletonBase className="h-3 w-1/4" rounded="full" />
              </div>
              <SkeletonBase className="h-6 w-16" rounded="full" />
            </div>
            <SkeletonBase className="h-2 w-full" rounded="full" />
          </div>
        ))}
      </div>
    );
  }

  if (finalTrainers.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="no-trainers-state"
      >
        <GraduationCap
          className="w-14 h-14 mb-4 opacity-30"
          style={{ color: 'var(--celestial-primary)' }}
        />
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          No Trainers Hired
        </h2>
        <p className="text-sm mb-4 max-w-sm" style={{ color: 'var(--text-muted)' }}>
          Hire a specialist trainer to accelerate your horses' progress in their chosen discipline.
        </p>
        <Link
          to="/trainers"
          className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-85"
          style={{ background: 'var(--celestial-primary)' }}
        >
          Browse Trainer Marketplace
        </Link>
      </div>
    );
  }

  const getTrainerAssignments = (trainerId: number) =>
    finalAssignments.filter((a) => a.trainerId === trainerId && a.isActive);

  const unassignedCount = finalTrainers.filter(
    (t) => getTrainerAssignments(t.id).length === 0
  ).length;
  const slotsUsed = finalTrainers.length;

  const handleUnassign = (assignmentId: number) => {
    unassignMutation.mutate(assignmentId);
  };

  const handleAssignClick = (trainerId: number) => {
    setSelectedTrainerIdForAssign(trainerId);
  };

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
          const trainerAssignments = getTrainerAssignments(trainer.id);
          const isExpanded = expandedTrainerId === trainer.id;

          const careerData: TrainerCareerData = {
            id: trainer.id,
            name: trainer.name ?? `${trainer.firstName} ${trainer.lastName}`,
            experience: trainer.experience,
            level: trainer.level,
            careerWeeks: trainer.careerWeeks,
            hiredDate: new Date().toISOString(),
            retired: trainer.retired,
            totalSessions: 0,
            totalHorses: trainerAssignments.length,
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
                  <p className="text-sm font-bold text-white/80">{trainerAssignments.length}</p>
                  <p className="text-[10px] text-white/30">Assigned</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-sm font-bold text-white/80">{trainer.careerWeeks}w</p>
                  <p className="text-[10px] text-white/30">Career</p>
                </div>
              </div>

              {/* Assignments */}
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                  Assigned Horse{trainerAssignments.length !== 1 ? 's' : ''}
                </h4>
                {trainerAssignments.length === 0 ? (
                  <div className="py-3 text-center border-2 border-dashed border-white/10 rounded-lg">
                    <p className="text-xs text-white/30 italic">No horse assigned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trainerAssignments.map((a) => (
                      <TrainerAssignmentCard
                        key={a.id}
                        assignment={a}
                        onUnassign={handleUnassign}
                        isUnassigning={unassignMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Assign Button */}
              <button
                type="button"
                onClick={() => handleAssignClick(trainer.id)}
                className="w-full py-2 px-3 mb-3 text-sm font-medium rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-celestial-gold hover:bg-celestial-gold/20 transition-colors"
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
                    <TrainerCareerPanel
                      trainer={careerData}
                      assignmentCount={trainerAssignments.length}
                    />
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

      {/* Horse Picker Modal */}
      {selectedTrainerIdForAssign !== null && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setSelectedTrainerIdForAssign(null)}
          data-testid="horse-picker-modal"
        >
          <div
            className="bg-deep-space border border-white/10 rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white/90 mb-4">Select a Horse to Assign</h3>
            {horsesLoading && (
              <p className="text-sm text-white/40 text-center py-4">Loading horses…</p>
            )}
            {!horsesLoading && (!horses || horses.length === 0) && (
              <p className="text-sm text-white/40 text-center py-4">No horses available.</p>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {horses?.map((horse) => (
                <button
                  key={horse.id}
                  type="button"
                  onClick={() => {
                    assignMutation.mutate(
                      { trainerId: selectedTrainerIdForAssign, horseId: horse.id },
                      { onSuccess: () => setSelectedTrainerIdForAssign(null) }
                    );
                  }}
                  disabled={assignMutation.isPending}
                  className="w-full text-left px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all disabled:opacity-50"
                >
                  <p className="font-bold text-white/80">{horse.name}</p>
                  <p className="text-xs text-white/40">
                    {horse.breed} · Age {horse.age}
                  </p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedTrainerIdForAssign(null)}
              className="mt-4 w-full py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTrainersDashboard;
