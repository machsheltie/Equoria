/**
 * MyGroomsDashboard Component
 *
 * Dashboard for managing all hired grooms and their assignments.
 * Displays groom details, current assignments, bond scores, and salary costs.
 * Integrates with AssignGroomModal for new assignments.
 *
 * Design-system migration (Equoria-o5hub, world-services family): Surface
 * for panels/cards, form Select for filters (replaces celestial-input),
 * Currency for all coin amounts (no USD formatting), canonical Skeleton /
 * EmptyState, semantic role tokens. Dialogs were already GameDialog.
 */

import React, { useState } from 'react';
import { formatDate } from '@/lib/formatDate';
import { Users, Coins, AlertCircle, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import EmptyState from '@/components/ui/EmptyState';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import AssignGroomModal from './AssignGroomModal';
import { SkeletonBase } from '@/components/ui/state';
import GroomPersonalityBadge from './groom/GroomPersonalityBadge';
import GroomPersonalityDisplay from './groom/GroomPersonalityDisplay';
import GroomDetailPanel from './groom/GroomDetailPanel';
import {
  useUserGrooms,
  useGroomAssignments,
  useGroomSalaries,
  useDeleteAssignment,
} from '../hooks/api/useGrooms';
import { useHorses } from '../hooks/api/useHorses';
import type { Groom, GroomAssignment, SalarySummary } from '@/lib/api-client';

interface MyGroomsDashboardProps {
  userId: string | number;
  groomsData?: Groom[];
  assignmentsData?: GroomAssignment[];
  salaryCostsData?: SalarySummary;
  onBrowseMarketplace?: () => void;
}

// Helper function to get max assignments by skill level
const getMaxAssignments = (skillLevel: string | undefined): number => {
  const maxAssignments: Record<string, number> = {
    novice: 2,
    intermediate: 3,
    expert: 4,
    master: 5,
  };
  return maxAssignments[(skillLevel ?? '').toLowerCase()] || 2;
};

// Helper function to format specialty display (null-safe — Equoria-j2a51)
const formatSpecialty = (specialty: string | undefined): string => {
  return (specialty ?? '').replace(/([A-Z])/g, ' $1').trim();
};

const MyGroomsDashboard: React.FC<MyGroomsDashboardProps> = ({
  userId,
  groomsData,
  assignmentsData,
  salaryCostsData,
  onBrowseMarketplace,
}) => {
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [selectedHorseName, setSelectedHorseName] = useState<string>('');
  // Equoria-bu7m — horse temperament forwarded so AssignGroomModal can render
  // the synergy preview badge (Equoria-atb6). Null for legacy horses.
  const [selectedHorseTemperament, setSelectedHorseTemperament] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isHorsePickerOpen, setIsHorsePickerOpen] = useState(false);
  const { data: userHorses = [], isLoading: horsesLoading } = useHorses();
  const [skillLevelFilter, setSkillLevelFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [expandedPersonalityId, setExpandedPersonalityId] = useState<number | null>(null);
  // Equoria-cbkw — which groom's metrics + assignment-history panel is open.
  const [expandedDetailId, setExpandedDetailId] = useState<number | null>(null);
  // Equoria-o5hub.13 — assignment id awaiting unassign confirmation (replaces window.confirm).
  const [pendingUnassignId, setPendingUnassignId] = useState<number | null>(null);

  // Fetch grooms data using centralized hook
  const { data: groomsResponse, isLoading: groomsLoading } = useUserGrooms(userId);

  // Fetch assignments data using centralized hook
  const { data: assignmentsResponse, isLoading: assignmentsLoading } = useGroomAssignments();

  // Fetch salary costs data using centralized hook
  const { data: salaryCostsResponse, isLoading: salaryCostsLoading } = useGroomSalaries();

  // Unassign mutation using centralized hook
  const unassignMutation = useDeleteAssignment();

  // Unwrap data from API responses (Equoria-j2a51). The real backend wire
  // shapes (verified live) are NOT bare arrays:
  //   GET /grooms/user/:id     → { success, grooms: Groom[], ... }      (no .data)
  //   GET /groom-assignments   → { assignments: GroomAssignment[], ... } (after apiClient .data unwrap)
  // The apiClient hands these envelope OBJECTS straight through, so consuming
  // them as arrays (finalGrooms.filter / .length) threw a TypeError that the
  // page ErrorBoundary swallowed ("Something went wrong", blank page). Coerce
  // to the array here — tolerant of a bare array too, in case a hook extracts.
  const groomsFromAPI: Groom[] = Array.isArray(groomsResponse)
    ? groomsResponse
    : ((groomsResponse as { grooms?: Groom[] } | undefined)?.grooms ?? []);
  const assignmentsFromAPI: GroomAssignment[] = Array.isArray(assignmentsResponse)
    ? assignmentsResponse
    : ((assignmentsResponse as { assignments?: GroomAssignment[] } | undefined)?.assignments ?? []);
  const salaryCostsFromAPI = salaryCostsResponse; // Already unwrapped - fetchSalarySummary returns SalarySummary directly

  // Use provided data or fetched data
  const finalGrooms = groomsData || groomsFromAPI;
  const finalAssignments = assignmentsData || assignmentsFromAPI;
  const finalSalaryCosts = salaryCostsData ||
    salaryCostsFromAPI || {
      totalWeeklyCost: 0,
      totalMonthlyCost: 0,
      groomCount: 0,
      breakdown: [],
    };

  // Loading state — skeleton rows
  if (!groomsData && (groomsLoading || assignmentsLoading || salaryCostsLoading)) {
    return (
      <div className="space-y-3 p-4" aria-label="Loading grooms">
        {[...Array(3)].map((_, i) => (
          <Surface variant="subtle" key={i} className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <SkeletonBase className="w-10 h-10 flex-shrink-0" rounded="full" />
              <div className="flex-1 space-y-2">
                <SkeletonBase className="h-4 w-1/3" rounded="full" />
                <SkeletonBase className="h-3 w-1/4" rounded="full" />
              </div>
              <SkeletonBase className="h-6 w-16" rounded="full" />
            </div>
            <SkeletonBase className="h-2 w-full" rounded="full" />
          </Surface>
        ))}
      </div>
    );
  }

  // Empty state — with CTA to grooms marketplace
  if (finalGrooms.length === 0) {
    return (
      <EmptyState
        variant="first-use"
        icon={<Users className="w-8 h-8" aria-hidden="true" />}
        title="No Grooms Hired"
        description="Hire a groom to help care for your foals and improve their development."
        primaryAction={
          onBrowseMarketplace
            ? { label: 'Browse Groom Marketplace', onClick: onBrowseMarketplace }
            : undefined
        }
      />
    );
  }

  // Get assignments for a specific groom
  const getGroomAssignments = (groomId: number): GroomAssignment[] => {
    return finalAssignments.filter((a) => a.groomId === groomId && a.isActive);
  };

  // Calculate unassigned grooms count
  const unassignedGroomsCount = finalGrooms.filter((groom) => {
    const groomAssignments = getGroomAssignments(groom.id);
    return groomAssignments.length === 0;
  }).length;

  // Handle assign button click — open horse picker first so the real horse id is chosen.
  const handleAssignClick = (_groomId: number) => {
    setSelectedHorseId(null);
    setSelectedHorseName('');
    setSelectedHorseTemperament(null);
    setIsHorsePickerOpen(true);
  };

  // Horse picker callback — sets the real horseId, closes picker, opens assign modal.
  const handleHorsePicked = (horse: { id: number; name: string; temperament?: string | null }) => {
    setSelectedHorseId(horse.id);
    setSelectedHorseName(horse.name);
    setSelectedHorseTemperament(horse.temperament ?? null);
    setIsHorsePickerOpen(false);
    setIsAssignModalOpen(true);
  };

  // Handle unassign button click — opens the in-app confirmation dialog.
  const handleUnassignClick = (assignmentId: number) => {
    setPendingUnassignId(assignmentId);
  };

  // Fire the unassign mutation only on explicit dialog confirm.
  const handleUnassignConfirm = () => {
    if (pendingUnassignId !== null) {
      unassignMutation.mutate(pendingUnassignId);
    }
    setPendingUnassignId(null);
  };

  // Handle assignment complete
  const handleAssignmentComplete = () => {
    setIsAssignModalOpen(false);
    setSelectedHorseId(null);
    setSelectedHorseName('');
    setSelectedHorseTemperament(null);
  };

  // Filter and sort grooms
  const filteredAndSortedGrooms = finalGrooms
    .filter((groom) => {
      if (skillLevelFilter !== 'all' && groom.skillLevel !== skillLevelFilter) return false;
      if (specialtyFilter !== 'all' && groom.specialty !== specialtyFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'salary') {
        return b.sessionRate - a.sessionRate;
      }
      if (sortBy === 'slots') {
        const aSlots = getMaxAssignments(a.skillLevel) - getGroomAssignments(a.id).length;
        const bSlots = getMaxAssignments(b.skillLevel) - getGroomAssignments(b.id).length;
        return bSlots - aSlots;
      }
      return 0;
    });

  return (
    <div className="py-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="type-section-heading text-[var(--gold-primary)] mb-6">My Grooms</h2>

        {/* Salary Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Surface variant="panel" className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="type-label text-[var(--text-secondary)] mb-1">Weekly Cost</p>
                <Currency
                  amount={finalSalaryCosts.totalWeeklyCost}
                  variant="balance"
                  className="text-2xl"
                />
              </div>
              <div className="p-3 rounded-full bg-[var(--role-info-bg)] border border-[var(--role-info-border)]">
                <Coins className="w-8 h-8 text-[var(--role-info-text)]" aria-hidden="true" />
              </div>
            </div>
          </Surface>

          <Surface variant="panel" className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="type-label text-[var(--text-secondary)] mb-1">Monthly Cost</p>
                <Currency
                  amount={finalSalaryCosts.totalMonthlyCost}
                  variant="balance"
                  className="text-2xl"
                />
              </div>
              <div className="p-3 rounded-full bg-[var(--role-success-bg)] border border-[var(--role-success-border)]">
                <Calendar className="w-8 h-8 text-[var(--role-success-text)]" aria-hidden="true" />
              </div>
            </div>
          </Surface>

          <Surface variant="panel" className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="type-label text-[var(--text-secondary)] mb-1">Total Grooms</p>
                <p className="text-2xl font-semibold text-[var(--text-primary)]">
                  {finalGrooms.length}
                </p>
              </div>
              <div className="p-3 rounded-full bg-[var(--badge-rare-bg)] border border-[var(--status-rare)]">
                <Users className="w-8 h-8 text-[var(--status-rare)]" aria-hidden="true" />
              </div>
            </div>
          </Surface>
        </div>

        {/* Unassigned Grooms Warning */}
        {unassignedGroomsCount > 0 && (
          <div className="border-l-4 p-4 mb-8 rounded-r-[var(--radius-md)] bg-[var(--role-warning-bg)] border-l-[var(--role-warning-text)]">
            <div className="flex items-center">
              <AlertCircle
                className="w-6 h-6 text-[var(--role-warning-text)] mr-3 flex-shrink-0"
                aria-hidden="true"
              />
              <p className="text-[var(--text-primary)]">
                <span className="font-bold text-[var(--role-warning-text)]">
                  {unassignedGroomsCount} groom{unassignedGroomsCount > 1 ? 's' : ''}
                </span>{' '}
                with no assignments — consider assigning them to horses or releasing them to save
                money.
              </p>
            </div>
          </div>
        )}

        {/* Filters and Sort */}
        <Surface variant="subtle" className="flex flex-wrap gap-6 mb-8 p-4">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="skill-filter"
              className="type-label block text-[var(--text-secondary)] mb-2"
            >
              Filter by Skill Level
            </label>
            <Select
              id="skill-filter"
              value={skillLevelFilter}
              onChange={(e) => setSkillLevelFilter(e.target.value)}
              className="w-full"
            >
              <option value="all">All Levels</option>
              <option value="novice">Novice</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
              <option value="master">Master</option>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="specialty-filter"
              className="type-label block text-[var(--text-secondary)] mb-2"
            >
              Filter by Specialty
            </label>
            <Select
              id="specialty-filter"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="w-full"
            >
              <option value="all">All Specialties</option>
              <option value="foalCare">Foal Care</option>
              <option value="generalCare">General Care</option>
              <option value="training">Training</option>
              <option value="showHandling">Show Handling</option>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label htmlFor="sort-by" className="type-label block text-[var(--text-secondary)] mb-2">
              Sort By
            </label>
            <Select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full"
            >
              <option value="name">Name</option>
              <option value="salary">Salary</option>
              <option value="slots">Available Slots</option>
            </Select>
          </div>
        </Surface>
      </div>

      {/* Groom Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        data-testid="groom-grid"
      >
        {filteredAndSortedGrooms.map((groom) => {
          const groomAssignments = getGroomAssignments(groom.id);
          const maxAssignments = getMaxAssignments(groom.skillLevel);
          const availableSlots = maxAssignments - groomAssignments.length;
          const isFullyAssigned = availableSlots === 0;

          return (
            <Surface
              variant="panel"
              key={groom.id}
              data-testid={`groom-card-${groom.id}`}
              aria-label={`Groom: ${groom.name}`}
              // Static card — no hover lift/glow (D-05, Equoria-o5hub.26)
              className="p-6"
            >
              {/* Groom Header */}
              <div className="mb-6">
                <h3 className="type-card-title text-2xl" data-testid="groom-name">
                  {groom.name}
                </h3>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-3 py-1 text-xs font-bold uppercase tracking-tighter rounded-[var(--radius-sm)] bg-[var(--role-neutral-bg)] text-[var(--role-neutral-text)] border border-[var(--role-neutral-border)]">
                    {groom.skillLevel}
                  </span>
                  <span className="px-3 py-1 text-xs font-bold uppercase tracking-tighter rounded-[var(--radius-sm)] bg-[var(--role-success-bg)] text-[var(--role-success-text)] border border-[var(--role-success-border)]">
                    {formatSpecialty(groom.specialty)}
                  </span>
                </div>
              </div>

              {/* Groom Details */}
              <Surface variant="subtle" className="space-y-3 mb-6 p-4">
                <div className="flex justify-between items-center">
                  <span className="type-label text-xs text-[var(--text-secondary)]">
                    Experience
                  </span>
                  <span className="text-[var(--text-primary)] font-bold">
                    {groom.experience} years
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="type-label text-xs text-[var(--text-secondary)]">
                    Personality
                  </span>
                  <GroomPersonalityBadge personality={groom.personality} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="type-label text-xs text-[var(--text-secondary)]">Salary</span>
                  <span className="font-bold inline-flex items-center gap-1">
                    <Currency amount={groom.sessionRate} />
                    /week
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs type-label text-[var(--text-secondary)]">
                    <span>Assignments</span>
                    <span>
                      {groomAssignments.length} / {maxAssignments}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${(groomAssignments.length / maxAssignments) * 100}%`,
                        background: isFullyAssigned
                          ? 'var(--text-muted)'
                          : 'var(--gradient-stat-bar)',
                      }}
                    />
                  </div>
                </div>
              </Surface>

              {/* Personality Toggle */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedPersonalityId(expandedPersonalityId === groom.id ? null : groom.id)
                  }
                  className="w-full text-left text-xs type-label text-[var(--text-muted)] hover:text-[var(--gold-light)] transition-colors flex items-center justify-between py-1"
                  aria-expanded={expandedPersonalityId === groom.id}
                  data-testid={`personality-toggle-${groom.id}`}
                >
                  <span>Personality Details</span>
                  <span aria-hidden="true">{expandedPersonalityId === groom.id ? '▲' : '▼'}</span>
                </button>
                {expandedPersonalityId === groom.id && (
                  <div className="mt-2" data-testid={`personality-panel-${groom.id}`}>
                    <GroomPersonalityDisplay
                      personality={groom.personality}
                      experience={groom.experience}
                      compact
                    />
                  </div>
                )}
              </div>

              {/* Performance metrics + assignment history toggle (Equoria-cbkw) */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDetailId(expandedDetailId === groom.id ? null : groom.id)
                  }
                  className="w-full text-left text-xs type-label text-[var(--text-muted)] hover:text-[var(--gold-light)] transition-colors flex items-center justify-between py-1"
                  aria-expanded={expandedDetailId === groom.id}
                  data-testid={`groom-detail-toggle-${groom.id}`}
                >
                  <span>Performance &amp; History</span>
                  <span aria-hidden="true">{expandedDetailId === groom.id ? '▲' : '▼'}</span>
                </button>
                {expandedDetailId === groom.id && <GroomDetailPanel groomId={groom.id} enabled />}
              </div>

              {/* Assignments */}
              <div className="mb-6">
                <h4 className="type-label text-[var(--text-secondary)] mb-3 pb-1 border-b border-[var(--glass-border)]">
                  Current Assignments
                </h4>
                {groomAssignments.length === 0 ? (
                  <div className="py-4 text-center rounded-[var(--radius-md)] border-2 border-dashed border-[var(--glass-border)]">
                    <p className="text-[var(--text-muted)] text-sm italic">Available for Hire</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groomAssignments.map((assignment) => (
                      <Surface
                        variant="subtle"
                        key={assignment.id}
                        className="flex items-center justify-between p-3"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            Horse ID: {assignment.horseId}
                          </p>
                          <p className="text-[10px] type-label text-[var(--text-muted)]">
                            Priority: {assignment.priority} |{' '}
                            {/* Equoria-2dnd2: shared util (guard + canonical format). */}
                            {formatDate(assignment.startDate)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnassignClick(assignment.id)}
                          className="text-[var(--role-danger-text)] hover:bg-[var(--role-danger-bg)] hover:no-underline rounded-full"
                          title="Unassign Groom"
                          aria-label="Unassign Groom"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </Surface>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign Button */}
              <Button
                type="button"
                onClick={() => handleAssignClick(groom.id)}
                disabled={isFullyAssigned}
                variant={isFullyAssigned ? 'secondary' : 'default'}
                className="w-full"
              >
                {isFullyAssigned ? 'Max Assignments' : 'Assign to Horse'}
              </Button>
            </Surface>
          );
        })}
      </div>

      {/* Horse Picker Dialog (shown before the assign modal) — GameDialog per Equoria-o5hub.13.
          Overlay + blur owned by GameDialogOverlay (DECISIONS.md §4 single-blur rule). */}
      <GameDialog
        open={isHorsePickerOpen}
        onOpenChange={(open) => {
          if (!open) setIsHorsePickerOpen(false);
        }}
      >
        <GameDialogContent size="sm" data-testid="groom-assign-horse-picker">
          <GameDialogHeader>
            <GameDialogTitle>Pick a horse to assign</GameDialogTitle>
            <GameDialogDescription>
              Choose which of your horses this groom will care for.
            </GameDialogDescription>
          </GameDialogHeader>
          <GameDialogBody>
            {horsesLoading ? (
              <div className="text-sm text-[var(--text-muted)]">Loading horses…</div>
            ) : userHorses.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)]">
                You don&apos;t own any horses yet. Acquire a horse before assigning a groom.
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto space-y-2">
                {userHorses.map((horse) => (
                  <li key={horse.id}>
                    <button
                      type="button"
                      onClick={() =>
                        handleHorsePicked({
                          id: Number(horse.id),
                          name: String(horse.name ?? `Horse ${horse.id}`),
                          temperament:
                            (horse as { temperament?: string | null }).temperament ?? null,
                        })
                      }
                      data-testid={`groom-assign-horse-option-${horse.id}`}
                      className="w-full flex items-center justify-between px-4 py-2 rounded-[var(--radius-md)] text-sm transition-colors text-[var(--text-primary)] border border-[var(--glass-border)] hover:bg-[var(--glass-hover)]"
                    >
                      <span>{horse.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">#{horse.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GameDialogBody>
          <GameDialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsHorsePickerOpen(false)}
              data-testid="groom-assign-horse-picker-cancel"
            >
              Cancel
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>

      {/* Unassign confirmation — destructive action, never gold (DECISIONS.md §5).
          Replaces window.confirm (Equoria-o5hub.13). */}
      <GameDialog
        open={pendingUnassignId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnassignId(null);
        }}
      >
        <GameDialogContent size="sm" data-testid="unassign-groom-confirm-dialog">
          <GameDialogHeader>
            <GameDialogTitle>Unassign Groom</GameDialogTitle>
            <GameDialogDescription>
              Are you sure you want to unassign this groom?
            </GameDialogDescription>
          </GameDialogHeader>
          <GameDialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPendingUnassignId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleUnassignConfirm}>
              Unassign
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>

      {/* Assign Groom Modal */}
      {isAssignModalOpen && selectedHorseId && (
        <AssignGroomModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          horseId={selectedHorseId}
          horseName={selectedHorseName}
          userId={userId}
          onAssignmentComplete={handleAssignmentComplete}
          availableGrooms={finalGrooms}
          horseTemperament={selectedHorseTemperament}
        />
      )}
    </div>
  );
};

export default MyGroomsDashboard;
