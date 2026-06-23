/**
 * MyRidersDashboard Component (Epic 9C — Story 9C-2)
 *
 * Dashboard for managing all hired riders and their horse assignments.
 * Displays:
 * - Slot usage ("3 of 5 rider slots used")
 * - Rider cards with personality, career level, assignment status
 * - Retirement warnings
 * - Expandable career + discovery panels
 *
 * Mirrors MyGroomsDashboard.tsx for the Rider System.
 */

import React, { useState } from 'react';
import { Users, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

import { SkeletonBase } from '@/components/ui/SkeletonCard';
import RiderPersonalityBadge from './rider/RiderPersonalityBadge';
import RiderCareerPanel from './rider/RiderCareerPanel';
import RiderDiscoveryPanel from './rider/RiderDiscoveryPanel';
import RiderAssignmentCard from './rider/RiderAssignmentCard';
import {
  useUserRiders,
  useRiderAssignments,
  useDeleteRiderAssignment,
  useAssignRider,
  type Rider,
  type RiderAssignment,
} from '@/hooks/api/useRiders';
import { useHorses } from '@/hooks/api/useHorses';
import { getBreedName } from '@/lib/utils';
import { calculateRiderRetirementStatus } from '@/types/riderCareer';
import { buildEmptyDiscoveryProfile } from '@/types/riderDiscovery';
import { Button } from '@/components/ui/button';

interface MyRidersDashboardProps {
  // Auth user id is a UUID string (Equoria-ai6pw / phv9p). It is forwarded
  // straight into useUserRiders → /api/riders/user/:id, so it must NOT be
  // narrowed to number — doing so produced the phv9p NaN regression.
  userId: string;
  ridersData?: Rider[];
  assignmentsData?: RiderAssignment[];
  riderSlotCap?: number;
  onBrowseMarketplace?: () => void;
}

const SKILL_LEVEL_VISIBILITY: Record<string, string> = {
  rookie: 'Unknown potential',
  developing: 'Partial reveal',
  experienced: 'Full reveal',
};

const MyRidersDashboard: React.FC<MyRidersDashboardProps> = ({
  userId,
  ridersData,
  assignmentsData,
  riderSlotCap = 5,
  onBrowseMarketplace,
}) => {
  const [selectedRiderIdForAssign, setSelectedRiderIdForAssign] = useState<number | null>(null);
  const [expandedRiderId, setExpandedRiderId] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<'career' | 'discovery'>('career');

  const { data: ridersResponse, isLoading: ridersLoading } = useUserRiders(userId);
  const { data: assignmentsResponse, isLoading: assignmentsLoading } = useRiderAssignments();
  const unassignMutation = useDeleteRiderAssignment();
  const assignMutation = useAssignRider();
  const { data: horses, isLoading: horsesLoading } = useHorses();

  const finalRiders = ridersData ?? ridersResponse ?? [];
  const finalAssignments = assignmentsData ?? assignmentsResponse ?? [];

  if (!ridersData && (ridersLoading || assignmentsLoading)) {
    return (
      <div className="space-y-3 p-4" aria-label="Loading riders">
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

  if (finalRiders.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="no-riders-state"
      >
        <Users
          className="w-14 h-14 mb-4 opacity-30"
          style={{ color: 'var(--celestial-primary)' }}
        />
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          No Riders Hired
        </h2>
        <p className="text-sm mb-4 max-w-sm" style={{ color: 'var(--text-muted)' }}>
          Browse the rider marketplace to find skilled riders for your competition horses.
        </p>
        <Button type="button" onClick={onBrowseMarketplace}>
          Browse Rider Marketplace
        </Button>
      </div>
    );
  }

  const getRiderAssignments = (riderId: number): RiderAssignment[] =>
    finalAssignments.filter((a) => a.riderId === riderId && a.isActive);

  const unassignedCount = finalRiders.filter((r) => getRiderAssignments(r.id).length === 0).length;
  const slotsUsed = finalRiders.length;
  const approachingRetirement = finalRiders.filter((r) => {
    const status = calculateRiderRetirementStatus(r.careerWeeks, r.level, r.totalWins, r.prestige);
    return status.isApproachingRetirement;
  });

  const handleAssignClick = (riderId: number) => {
    setSelectedRiderIdForAssign(riderId);
  };

  const handleUnassign = (assignmentId: number) => {
    unassignMutation.mutate(assignmentId);
  };

  return (
    <div className="space-y-5" data-testid="my-riders-dashboard">
      {/* Slot Counter */}
      <div className="glass-panel flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-role-muted" />
          <span className="text-sm text-role-secondary">
            <span className="font-bold text-role-primary">{slotsUsed}</span> of{' '}
            <span className="font-bold text-role-primary">{riderSlotCap}</span> rider slots used
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: riderSlotCap }).map((_, i) => (
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
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-900/20 border border-amber-500/30 text-sm text-amber-300 animate-pulse">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>
            <strong>{unassignedCount}</strong> rider{unassignedCount > 1 ? 's' : ''} without
            assignments — horses can't enter competitions without a rider.
          </p>
        </div>
      )}

      {approachingRetirement.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-900/20 border border-red-500/30 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>
            <strong>{approachingRetirement.length}</strong> rider
            {approachingRetirement.length > 1 ? 's' : ''} approaching retirement
          </p>
        </div>
      )}

      {/* Rider Cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        data-testid="rider-grid"
      >
        {finalRiders.map((rider) => {
          const assignments = getRiderAssignments(rider.id);
          const isExpanded = expandedRiderId === rider.id;
          const retirementStatus = calculateRiderRetirementStatus(
            rider.careerWeeks,
            rider.level,
            rider.totalWins,
            rider.prestige
          );

          return (
            <div
              key={rider.id}
              data-testid={`rider-card-${rider.id}`}
              aria-label={`Rider: ${rider.name}`}
              className="glass-panel"
            >
              {/* Rider Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-role-primary group-hover:text-celestial-gold transition-colors">
                      {rider.firstName} {rider.lastName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-role-muted capitalize">{rider.skillLevel}</span>
                      <span className="text-role-disabled text-xs">·</span>
                      <span className="text-xs text-role-muted">
                        {SKILL_LEVEL_VISIBILITY[rider.skillLevel]}
                      </span>
                    </div>
                  </div>
                  <RiderPersonalityBadge personality={rider.personality} />
                </div>

                {retirementStatus.isApproachingRetirement && (
                  <p className="text-xs text-amber-400 mt-2">
                    ⚠️ Retiring in {retirementStatus.weeksRemaining}w
                  </p>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-sm font-bold text-celestial-gold">Lv.{rider.level}</p>
                  <p className="text-[10px] text-role-muted">Level</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-sm font-bold text-role-primary">{rider.totalWins}</p>
                  <p className="text-[10px] text-role-muted">Wins</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-sm font-bold text-role-primary">{rider.careerWeeks}w</p>
                  <p className="text-[10px] text-role-muted">Career</p>
                </div>
              </div>

              {/* Assignments */}
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-role-muted uppercase tracking-wider mb-2">
                  Assigned Horse{assignments.length !== 1 ? 's' : ''}
                </h4>
                {assignments.length === 0 ? (
                  <div className="py-3 text-center border-2 border-dashed border-white/10 rounded-lg">
                    <p className="text-xs text-role-muted italic">No horse assigned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <RiderAssignmentCard
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
              <Button
                type="button"
                size="sm"
                onClick={() => handleAssignClick(rider.id)}
                className="w-full mb-3"
                data-testid={`assign-button-${rider.id}`}
              >
                Assign to Horse
              </Button>

              {/* Expand Career / Discovery */}
              <button
                type="button"
                onClick={() => {
                  if (isExpanded) {
                    setExpandedRiderId(null);
                  } else {
                    setExpandedRiderId(rider.id);
                    setExpandedSection('career');
                  }
                }}
                className="w-full text-left text-xs text-role-muted hover:text-role-secondary flex items-center justify-between py-1 transition-colors"
                aria-expanded={isExpanded}
                data-testid={`expand-toggle-${rider.id}`}
              >
                <span>Career & Discovery Details</span>
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
                            ? 'bg-white/10 text-role-primary'
                            : 'text-role-muted hover:text-role-secondary'
                        }`}
                      >
                        {section}
                      </button>
                    ))}
                  </div>

                  {expandedSection === 'career' && (
                    <RiderCareerPanel
                      rider={{
                        id: rider.id,
                        name: `${rider.firstName} ${rider.lastName}`,
                        experience: rider.experience,
                        level: rider.level,
                        careerWeeks: rider.careerWeeks,
                        hiredDate: rider.hiredDate,
                        retired: rider.retired,
                        totalWins: rider.totalWins,
                        totalCompetitions: rider.totalCompetitions,
                        prestige: rider.prestige,
                      }}
                      assignmentCount={assignments.length}
                    />
                  )}

                  {expandedSection === 'discovery' && (
                    <RiderDiscoveryPanel profile={buildEmptyDiscoveryProfile(rider.id)} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Horse Picker Modal */}
      {selectedRiderIdForAssign !== null && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[var(--z-modal)] animate-in fade-in duration-200"
          onClick={() => setSelectedRiderIdForAssign(null)}
          data-testid="horse-picker-modal"
        >
          <div
            className="glass-panel-heavy rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-role-primary mb-4">Select a Horse to Assign</h3>
            {horsesLoading && (
              <p className="text-sm text-role-muted text-center py-4">Loading horses…</p>
            )}
            {!horsesLoading && (!horses || horses.length === 0) && (
              <p className="text-sm text-role-muted text-center py-4">No horses available.</p>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {horses?.map((horse) => (
                <Button
                  key={horse.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    assignMutation.mutate(
                      { riderId: selectedRiderIdForAssign, horseId: horse.id },
                      { onSuccess: () => setSelectedRiderIdForAssign(null) }
                    );
                  }}
                  disabled={assignMutation.isPending}
                  className="w-full justify-start text-left h-auto py-3"
                >
                  <span className="flex flex-col items-start">
                    <span className="font-bold">{horse.name}</span>
                    <span className="text-xs opacity-60">
                      {getBreedName(horse.breed)} · Age {horse.age}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSelectedRiderIdForAssign(null)}
              className="mt-4 w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyRidersDashboard;
