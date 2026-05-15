/**
 * ConformationEntryModal (Equoria-e0cn)
 *
 * Surfaces the conformation show entry flow: pick a horse + groom + className,
 * check eligibility (warnings, blocking errors, ageClass, groomAssigned), and
 * submit on confirm.
 *
 * Backend contract (controller: conformationShowController.mjs):
 *   GET  /api/v1/competition/conformation/eligibility/:horseId
 *   POST /api/v1/competition/conformation/enter { horseId, groomId, showId, className }
 *
 * Uses BaseModal (Epic 5 — AI-5-1) to inherit focus management, escape close,
 * portal rendering, and ARIA roles. Mutation + eligibility hooks live in
 * useConformationShow.ts. NO route-interception bypasses — the modal calls
 * the real API and renders backend-sourced eligibility reasons verbatim.
 */

import { useState, useMemo } from 'react';
import BaseModal from '@/components/common/BaseModal';
import {
  useConformationEligibility,
  useEnterConformationShow,
} from '@/hooks/api/useConformationShow';
import { useUserGrooms } from '@/hooks/api/useGrooms';
import { useAuth } from '@/contexts/AuthContext';

export interface ConformationEntryModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal is closed (cancel or successful entry) */
  onClose: () => void;
  /** Show to enter — must be a conformation show */
  show: { id: number; name: string };
  /** Horse to enter */
  horse: { id: number; name: string; sex?: string };
  /** Optional success callback (entry created) */
  onSuccess?: () => void;
}

// Conformation className options derive from horse sex; the backend's
// validateConformationEntry accepts these exact strings.
function classOptionsForSex(sex: string | undefined): string[] {
  const s = (sex ?? '').toLowerCase();
  if (s === 'mare' || s === 'female') return ['Mares', 'Geldings'];
  if (s === 'stallion' || s === 'male') return ['Stallions', 'Geldings'];
  return ['Mares', 'Stallions', 'Geldings'];
}

export default function ConformationEntryModal({
  isOpen,
  onClose,
  show,
  horse,
  onSuccess,
}: ConformationEntryModalProps): JSX.Element {
  const { user } = useAuth();
  const userId = user?.id;

  const classOptions = useMemo(() => classOptionsForSex(horse.sex), [horse.sex]);
  const [className, setClassName] = useState<string>(classOptions[0]);
  const [groomId, setGroomId] = useState<number | ''>('');
  const [formError, setFormError] = useState<string | null>(null);

  const eligibility = useConformationEligibility(isOpen ? horse.id : null);
  const grooms = useUserGrooms(userId ?? '');
  const enterMutation = useEnterConformationShow();

  const eligData = eligibility.data;
  const eligLoading = eligibility.isLoading;
  const eligError = eligibility.error;

  const handleSubmit = async () => {
    setFormError(null);
    if (typeof groomId !== 'number') {
      setFormError('Select a groom to handle this entry.');
      return;
    }
    try {
      await enterMutation.mutateAsync({
        horseId: horse.id,
        groomId,
        showId: show.id,
        className,
      });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to enter conformation show.';
      setFormError(msg);
    }
  };

  const eligibilityBlocking = eligData != null && !eligData.eligible;
  const submitDisabled =
    enterMutation.isPending ||
    eligLoading ||
    eligibilityBlocking ||
    typeof groomId !== 'number' ||
    !className;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Enter Conformation Show — ${show.name}`}
      size="md"
      isSubmitting={enterMutation.isPending}
      data-testid="conformation-entry-modal"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={enterMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            className="ml-3 px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700 disabled:opacity-50"
            data-testid="conformation-entry-submit"
          >
            {enterMutation.isPending ? 'Entering…' : 'Confirm Entry'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-700">
          <strong>Horse:</strong> {horse.name}
        </div>

        {eligLoading && <p className="text-sm text-gray-500">Checking eligibility…</p>}

        {eligError && (
          <p
            role="alert"
            className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2"
          >
            Failed to load eligibility — please retry.
          </p>
        )}

        {eligData && (
          <div
            data-testid="conformation-eligibility-summary"
            className={`text-sm rounded p-3 border ${
              eligData.eligible
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="font-semibold">
              {eligData.eligible ? 'Eligible to enter' : 'Not eligible'}
            </div>
            <ul className="mt-1 list-disc list-inside">
              <li>Age class: {eligData.ageClass}</li>
              <li>Groom assigned: {eligData.groomAssigned ? 'Yes' : 'No'}</li>
            </ul>
            {eligData.errors.length > 0 && (
              <ul className="mt-2 list-disc list-inside">
                {eligData.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {eligData.warnings.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-amber-800">
                {eligData.warnings.map((w) => (
                  <li key={w}>Warning: {w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Class</span>
          <select
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            disabled={enterMutation.isPending}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
            data-testid="conformation-class-select"
          >
            {classOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Groom</span>
          <select
            value={groomId === '' ? '' : String(groomId)}
            onChange={(e) => setGroomId(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={enterMutation.isPending || grooms.isLoading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
            data-testid="conformation-groom-select"
          >
            <option value="">Select a groom…</option>
            {(grooms.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.skillLevel} · {g.personality})
              </option>
            ))}
          </select>
          {grooms.data && grooms.data.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              You have no grooms — hire one before entering a conformation show.
            </p>
          )}
        </label>

        {formError && (
          <p
            role="alert"
            className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2"
          >
            {formError}
          </p>
        )}
      </div>
    </BaseModal>
  );
}
