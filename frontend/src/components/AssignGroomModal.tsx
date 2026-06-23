/**
 * AssignGroomModal Component
 *
 * Modal for assigning a groom to a horse with the following features:
 * - Display horse information
 * - List available grooms with slot availability
 * - Allow groom selection with radio buttons
 * - Configure assignment priority (1-5)
 * - Add optional notes (max 500 characters)
 * - Replace primary assignment option (when priority=1)
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
 */

import React, { useState, useEffect } from 'react';
import { User, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { useAssignGroom, useGroomHorseSynergy } from '../hooks/api/useGrooms';
import type { ApiError } from '@/lib/api-client';
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
import { Checkbox, Select, Textarea } from '@/components/ui/form';

// Type definitions
interface Groom {
  id: number;
  name: string;
  skillLevel: string;
  specialty: string;
  personality: string;
  experience: number;
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
  userId: string | number;
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
  userId: _userId,
  onAssignmentComplete,
  availableGrooms = [],
  horseTemperament = null,
}) => {
  // State management
  const [selectedGroomId, setSelectedGroomId] = useState<number | null>(null);
  const [priority, setPriority] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [replacePrimary, setReplacePrimary] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedGroomId(null);
      setPriority(1);
      setNotes('');
      setReplacePrimary(false);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Assignment mutation using centralized hook
  const assignMutation = useAssignGroom();

  // Custom success handler
  const handleMutationSuccess = () => {
    setSuccess(true);
    setError(null);

    if (onAssignmentComplete) {
      onAssignmentComplete({}); // Note: centralized hook doesn't return data
    }

    // Close modal after short delay to show success message
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Custom error handler
  const handleMutationError = (err: ApiError) => {
    setError(err.message);
    setSuccess(false);
  };

  // Handle assignment submission
  const handleAssign = () => {
    if (!selectedGroomId) {
      setError('Please select a groom');
      return;
    }

    setError(null);
    assignMutation.mutate(
      {
        groomId: selectedGroomId,
        horseId,
        priority,
        notes: notes.trim() || undefined,
        replacePrimary: priority === 1 ? replacePrimary : undefined,
      },
      {
        onSuccess: handleMutationSuccess,
        onError: handleMutationError,
      }
    );
  };

  // Get selected groom details
  const selectedGroom = availableGrooms.find((g) => g.id === selectedGroomId);

  // Format specialty for display
  const formatSpecialty = (specialty: string): string => {
    return specialty.replace(/([A-Z])/g, ' $1').trim();
  };

  return (
    <GameDialog
      open={isOpen}
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

          {/* Success Message */}
          {success && (
            <div className="bg-[var(--badge-success-bg)] border border-[var(--role-success-border)] rounded-[var(--radius-md)] p-4 mb-6 flex items-center">
              <CheckCircle className="text-[var(--status-success)] mr-3" size={20} />
              <p className="text-[var(--status-success)]">Groom assigned successfully!</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-[var(--badge-danger-bg)] border border-[var(--role-danger-border)] rounded-[var(--radius-md)] p-4 mb-6 flex items-center">
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
                        aria-label={`${groom.name} - ${groom.skillLevel} - ${groom.availableSlots} ${groom.availableSlots === 1 ? 'slot' : 'slots'} available`}
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
                            <span className="text-sm text-role-secondary capitalize">
                              {groom.skillLevel}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-role-secondary space-y-1">
                          <p>
                            <span className="font-medium">Specialty:</span>{' '}
                            <span className="capitalize">{formatSpecialty(groom.specialty)}</span>
                          </p>
                          <p>
                            <span className="font-medium">Experience:</span> {groom.experience}{' '}
                            years
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

              {/* Priority Selection — canonical native Select (D-13) */}
              <div>
                <label
                  htmlFor="priority"
                  className="block text-sm font-medium text-role-secondary mb-2"
                >
                  Priority Level
                </label>
                <Select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  aria-label="Priority level"
                >
                  <option value={1}>1 - Primary (Highest)</option>
                  <option value={2}>2 - High</option>
                  <option value={3}>3 - Medium</option>
                  <option value={4}>4 - Low</option>
                  <option value={5}>5 - Lowest</option>
                </Select>
                <p className="text-xs text-role-muted mt-1">
                  Priority 1 assignments receive the most attention from the groom
                </p>
              </div>

              {/* Replace Primary Checkbox — canonical Radix Checkbox (D-13) */}
              {priority === 1 && (
                <div className="flex items-start">
                  <Checkbox
                    id="replacePrimary"
                    checked={replacePrimary}
                    onCheckedChange={(checked) => setReplacePrimary(checked === true)}
                    className="mt-1 mr-3"
                  />
                  <label htmlFor="replacePrimary" className="text-sm text-role-secondary">
                    <span className="font-medium text-role-primary">
                      Replace existing primary assignment
                    </span>
                    <p className="text-xs text-role-muted mt-1">
                      If this horse already has a primary groom, deactivate that assignment
                    </p>
                  </label>
                </div>
              )}

              {/* Notes Input — canonical Textarea (D-13) */}
              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-role-secondary mb-2"
                >
                  Notes (Optional)
                </label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Add any special instructions or notes for this assignment..."
                  aria-label="Assignment notes"
                />
                <p className="text-xs text-role-muted mt-1">{notes.length}/500 characters</p>
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
            disabled={!selectedGroomId || assignMutation.isPending || success}
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
