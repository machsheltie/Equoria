/**
 * AssignGroomModal Component
 *
 * Modal for assigning a groom to a horse with the following features:
 * - Display horse information
 * - List available grooms with slot availability
 * - Allow groom selection with radio buttons
 * - Replace existing assignment option
 * - Validate assignment before submission
 * - Handle success/error states
 * - Accessibility support with ARIA labels and keyboard navigation
 *
 * Uses React Query for API integration with groom assignment endpoints
 *
 * Design-system migration (Equoria-o5hub.20 / DECISIONS.md §8): the local
 * `fixed inset-0` overlay is replaced by the canonical GameDialog (Radix
 * focus trap / Escape / scroll lock); controls use the canonical Select /
 * Textarea / Checkbox; status colors use role tokens; close is prevented
 * while the assign mutation is pending (handoff §6.6).
 *
 * Owner ruling 2026-10-28 (Equoria-ekrab): there is no priority level and no
 * notes field (both were invented); "Replace existing assignment" stays. The
 * dialog closes the moment Assign Groom is pressed and the page updates in
 * place. If the assignment is refused, the dialog comes back with the reason
 * beside the button and the player's choice kept. Old contract: a 1-5
 * priority select, a notes box, and a success banner held for 1.5 seconds.
 */

import React, { useState, useEffect } from 'react';
import { User, AlertCircle, Sparkles } from 'lucide-react';
import { useAssignGroom, useGroomHorseSynergy } from '../hooks/api/useGrooms';
import { actionMessageFor, assignStaffRefusalCodes } from '@/lib/http/actionMessage';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import {
  GameDialog,
  GameDialogBody,
  GameDialogContent,
  GameDialogFooter,
  GameDialogHeader,
  GameDialogTitle,
} from '@/components/ui/game';
import { Checkbox } from '@/components/ui/form';
import { groomSpecialtyTitle } from '@/lib/staffLabels';
import StaffLevelStars from '@/components/common/StaffLevelStars';
import { staffLevelPhrase } from '@/lib/staffLevels';

// Type definitions
interface Groom {
  id: number;
  name: string;
  skillLevel: string;
  /** Equoria-nawn5: the groom's star level. */
  starLevel?: string;
  specialty: string;
  personality: string;
  experience: number;
  /** Equoria-fby1t — the groom's age in game-years; null when not yet known. */
  ageYears?: number | null;
  sessionRate: number;
  isActive: boolean;
  availableSlots: number;
  currentAssignments: number;
  maxAssignments: number;
}

interface AssignGroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  horseId: number;
  horseName: string;
  onAssignmentComplete?: (_assignment: unknown) => void;
  availableGrooms?: Groom[];
  /**
   * Equoria-atb6 (31D-FE-2) — horse temperament. When non-null, each groom
   * row renders a synergy-preview badge fetched from
   * GET /api/v1/grooms/:groomId/horses/:horseId/synergy. When null (legacy
   * horse with no temperament), badges are hidden entirely — no fetches
   * fire, so there is no N+1 storm.
   */
  horseTemperament?: string | null;
}

/**
 * Equoria-atb6 (31D-FE-2) — Synergy preview badge for a single groom row.
 *
 * Renders +X% bonding / −X% bonding chip when synergy is non-zero. Hides
 * when synergy is 0 (silence-is-golden — no clutter for non-matching pairs)
 * or when the synergy preview hasn't loaded yet.
 *
 * The hook is per-pair which means N grooms = N HTTP requests on first
 * paint, but each is cached separately (5 min staleTime in the hook), and
 * the badge is only mounted when horseTemperament is non-null. Bulk-fetch
 * is not justified at typical groom-list sizes (≤10) and would require a
 * new endpoint.
 */
const SynergyBadge: React.FC<{ groomId: number; horseId: number }> = ({ groomId, horseId }) => {
  const { data } = useGroomHorseSynergy(groomId, horseId);
  if (!data || data.synergyModifier === 0) return null;

  const pct = Math.round(data.synergyModifier * 100);
  const sign = data.synergyModifier > 0 ? 'positive' : 'negative';
  // Role tokens replace the raw emerald/rose palette (D-11/D-12)
  const colorClass =
    sign === 'positive'
      ? 'bg-[var(--badge-success-bg)] border-[var(--role-success-border)] text-[var(--status-success)]'
      : 'bg-[var(--badge-danger-bg)] border-[var(--role-danger-border)] text-[var(--status-danger)]';
  const label = `${pct > 0 ? '+' : ''}${pct}% bonding`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] border text-xs font-medium ${colorClass}`}
      data-testid="groom-row-synergy-badge"
      data-synergy-sign={sign}
      title={data.message}
    >
      <Sparkles size={10} aria-hidden="true" />
      {label}
    </span>
  );
};

const AssignGroomModal: React.FC<AssignGroomModalProps> = ({
  isOpen,
  onClose,
  horseId,
  horseName,
  onAssignmentComplete,
  availableGrooms = [],
  horseTemperament = null,
}) => {
  // State management
  const [selectedGroomId, setSelectedGroomId] = useState<number | null>(null);
  const [replacePrimary, setReplacePrimary] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Pressed Assign: the dialog is out of sight while the request runs.
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedGroomId(null);
      setReplacePrimary(false);
      setError(null);
      setSubmitted(false);
    }
  }, [isOpen]);

  // Assignment mutation using centralized hook
  const assignMutation = useAssignGroom();

  // Success: the page shows the groom in place; the dialog is already gone.
  const handleMutationSuccess = () => {
    if (onAssignmentComplete) {
      onAssignmentComplete({}); // Note: centralized hook doesn't return data
    }
    onClose();
  };

  // Refused: bring the dialog back with the reason, the choice kept.
  const handleMutationError = (err: unknown) => {
    // Class-mapped copy only: a server body can carry internals (§3).
    setError(actionMessageFor(err, {}, assignStaffRefusalCodes));
    setSubmitted(false);
  };

  // Handle assignment submission
  const handleAssign = () => {
    if (!selectedGroomId) {
      setError('Please select a groom');
      return;
    }

    setError(null);
    setSubmitted(true);
    assignMutation.mutate(
      {
        groomId: selectedGroomId,
        horseId,
        replacePrimary,
      },
      {
        onSuccess: handleMutationSuccess,
        onError: handleMutationError,
      }
    );
  };

  // Get selected groom details
  const selectedGroom = availableGrooms.find((g) => g.id === selectedGroomId);

  return (
    <GameDialog
      open={isOpen && !submitted}
      onOpenChange={(open) => {
        // Pending-close prevention: ignore close requests mid-assignment.
        if (!open && !assignMutation.isPending) onClose();
      }}
    >
      <GameDialogContent
        size="md"
        aria-label="Assign groom to horse"
        data-testid="assign-groom-modal"
      >
        <GameDialogHeader>
          <GameDialogTitle className="text-2xl">Assign Groom</GameDialogTitle>
        </GameDialogHeader>

        <GameDialogBody className="max-h-[65vh]">
          {/* Horse Information — nested inside the overlay → Surface subtle */}
          <Surface variant="subtle" className="p-4 mb-6">
            <h3 className="text-lg font-semibold text-role-primary mb-2">Horse</h3>
            <p className="text-role-secondary">{horseName}</p>
          </Surface>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="bg-[var(--badge-danger-bg)] border border-[var(--role-danger-border)] rounded-[var(--radius-md)] p-4 mb-6 flex items-center"
            >
              <AlertCircle className="text-[var(--status-danger)] mr-3" size={20} />
              <p className="text-[var(--status-danger)]">{error}</p>
            </div>
          )}

          {/* Available Grooms */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-role-primary mb-4">Select Groom</h3>

            {availableGrooms.length === 0 ? (
              <div className="text-center py-8 text-role-secondary">
                <User size={48} className="mx-auto mb-4 text-role-muted" />
                <p className="text-lg">No grooms available</p>
                <p className="text-sm mt-2">
                  Hire grooms from the marketplace to assign them to your horses.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableGrooms.map((groom) => (
                  <label
                    key={groom.id}
                    className={`block border rounded-[var(--radius-md)] p-4 cursor-pointer transition-all ${
                      selectedGroomId === groom.id
                        ? 'border-[var(--gold-primary)] bg-[var(--btn-gold-bg)]'
                        : groom.availableSlots === 0
                          ? 'border-[var(--glass-border)] bg-[var(--glass-surface-subtle-bg)] cursor-not-allowed opacity-60'
                          : 'border-[var(--glass-border)] hover:border-[var(--gold-light)] hover:bg-[var(--glass-glow)]'
                    }`}
                  >
                    <div className="flex items-start">
                      <input
                        type="radio"
                        name="groom"
                        value={groom.id}
                        checked={selectedGroomId === groom.id}
                        onChange={() => setSelectedGroomId(groom.id)}
                        disabled={groom.availableSlots === 0}
                        className="mt-1 mr-3"
                        aria-label={`${groom.name} - ${staffLevelPhrase(groom.starLevel)} - ${groom.availableSlots} ${groom.availableSlots === 1 ? 'slot' : 'slots'} available`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-role-primary">{groom.name}</h4>
                          <div className="flex items-center gap-2">
                            {/* Equoria-atb6 (31D-FE-2) — synergy badge.
                                Only mounted when horseTemperament is non-null
                                so legacy horses fire zero synergy requests. */}
                            {horseTemperament ? (
                              <SynergyBadge groomId={groom.id} horseId={horseId} />
                            ) : null}
                            <span className="text-sm text-role-secondary">
                              <StaffLevelStars level={groom.starLevel} />
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-role-secondary space-y-1">
                          <p>
                            <span className="font-medium">Specialty:</span>{' '}
                            <span>{groomSpecialtyTitle(groom.specialty)}</span>
                          </p>
                          <p>
                            <span className="font-medium">Experience:</span> {groom.experience}{' '}
                            years
                          </p>
                          {/* Equoria-fby1t: the player picking a groom sees how old
                              they are, in the same list of identity facts. */}
                          <p>
                            <span className="font-medium">Age:</span>{' '}
                            {typeof groom.ageYears === 'number'
                              ? `${groom.ageYears} years`
                              : 'Unknown'}
                          </p>
                          <p>
                            <span className="font-medium">Slots:</span>{' '}
                            <span
                              className={
                                groom.availableSlots === 0
                                  ? 'text-[var(--status-danger)] font-semibold'
                                  : 'text-[var(--status-success)] font-semibold'
                              }
                            >
                              {groom.availableSlots} {groom.availableSlots === 1 ? 'slot' : 'slots'}{' '}
                              available
                            </span>{' '}
                            ({groom.currentAssignments}/{groom.maxAssignments} assigned)
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Assignment Options */}
          {selectedGroom && (
            <div className="space-y-4 mb-2">
              <h3 className="text-lg font-semibold text-role-primary">Assignment Options</h3>

              {/* Replace existing assignment — canonical Radix Checkbox (D-13) */}
              <div className="flex items-start">
                <Checkbox
                  id="replacePrimary"
                  checked={replacePrimary}
                  onCheckedChange={(checked) => setReplacePrimary(checked === true)}
                  className="mt-1 mr-3"
                />
                <label htmlFor="replacePrimary" className="text-sm text-role-secondary">
                  <span className="font-medium text-role-primary">Replace existing assignment</span>
                  <p className="text-xs text-role-muted mt-1">
                    If this horse already has a groom, end that assignment
                  </p>
                </label>
              </div>
            </div>
          )}
        </GameDialogBody>

        {/* Footer — one gold primary (Assign Groom); Cancel secondary (D-08) */}
        <GameDialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={assignMutation.isPending}
            aria-label="Cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!selectedGroomId || assignMutation.isPending}
            aria-label="Assign groom"
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign Groom'}
          </Button>
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
};

export default AssignGroomModal;
