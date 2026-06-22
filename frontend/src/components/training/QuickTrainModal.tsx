/**
 * Quick Train Modal Component
 *
 * Modal for selecting and training multiple horses at once
 *
 * Story 4.5: Training Dashboard - Task 6
 * Migrated from hand-rolled `fixed inset-0` overlay → GameDialog
 * (Equoria-8l8zc, DECISIONS.md §8). Focus trap, scroll-lock, Escape close,
 * backdrop-click dismissal, and focus restoration come from the native Dialog
 * primitive — no longer re-implemented here.
 */

import { useState } from 'react';
import { X, Zap, CheckSquare, Square } from 'lucide-react';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { DashboardHorse } from './DashboardHorseCard';

export interface QuickTrainModalProps {
  isOpen: boolean;
  horses: DashboardHorse[];
  onClose: () => void;
  onTrain: (_horseIds: number[]) => void;
}

const QuickTrainModal = ({ isOpen, horses, onClose, onTrain }: QuickTrainModalProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filter to only ready horses (should already be filtered, but just in case)
  const readyHorses = horses.filter((h) => h.trainingStatus === 'ready');

  // Handle individual horse selection
  const toggleHorse = (horseId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(horseId)) {
      newSelected.delete(horseId);
    } else {
      newSelected.add(horseId);
    }
    setSelectedIds(newSelected);
  };

  // Handle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === readyHorses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(readyHorses.map((h) => h.id)));
    }
  };

  // Handle train selected
  const handleTrain = () => {
    onTrain(Array.from(selectedIds));
  };

  const allSelected = selectedIds.size === readyHorses.length && readyHorses.length > 0;
  const hasSelection = selectedIds.size > 0;

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GameDialogContent
        size="md"
        data-testid="quick-train-modal"
        hideCloseButton
        aria-describedby="quick-train-modal-description"
      >
        {/* Header */}
        <GameDialogHeader>
          <GameDialogTitle id="quick-train-modal-title">Quick Train</GameDialogTitle>
          <GameDialogDescription id="quick-train-modal-description">
            Select horses to train simultaneously
          </GameDialogDescription>
        </GameDialogHeader>

        {/* Content */}
        <GameDialogBody className="max-h-[60vh]">
          {readyHorses.length === 0 ? (
            /* Empty State */
            <div className="py-12 text-center" data-testid="empty-state">
              <Zap className="mx-auto h-12 w-12 text-role-secondary mb-4" aria-hidden="true" />
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                No horses ready for training
              </h3>
              <p className="text-sm text-role-secondary">
                All your horses are either on cooldown or ineligible for training.
              </p>
            </div>
          ) : (
            <>
              {/* Horse Count and Select All */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-role-secondary">
                  {readyHorses.length} {readyHorses.length === 1 ? 'horse' : 'horses'} ready
                  {hasSelection && (
                    <span className="ml-2 font-medium text-[var(--role-info-text)]">
                      ({selectedIds.size} selected)
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="sr-only"
                    aria-label="Select all horses"
                  />
                  <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] hover:text-[var(--role-info-text)]">
                    {allSelected ? (
                      <CheckSquare
                        className="h-5 w-5 text-[var(--role-info-text)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <Square className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span>Select All</span>
                  </div>
                </label>
              </div>

              {/* Horse List */}
              <div className="space-y-2">
                {readyHorses.map((horse) => (
                  <label
                    key={horse.id}
                    className="flex items-center gap-3 p-3 border border-[var(--glass-border)] rounded-lg hover:bg-[var(--glass-glow)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(horse.id)}
                      onChange={() => toggleHorse(horse.id)}
                      className="sr-only"
                      aria-label={`Select ${horse.name}`}
                    />
                    <div className="flex-shrink-0">
                      {selectedIds.has(horse.id) ? (
                        <CheckSquare
                          className="h-5 w-5 text-[var(--role-info-text)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Square className="h-5 w-5 text-role-secondary" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-primary)]">{horse.name}</div>
                      <div className="text-sm text-role-secondary">
                        {horse.age} {horse.age === 1 ? 'year' : 'years'} old
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </GameDialogBody>

        {/* Footer */}
        {readyHorses.length > 0 && (
          <GameDialogFooter>
            <button
              onClick={onClose}
              className="px-4 py-2 text-[var(--text-primary)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--celestial-primary)] rounded"
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={handleTrain}
              disabled={!hasSelection}
              className="px-6 py-2 bg-[var(--electric-blue-700)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--gold-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--celestial-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="train-selected-button"
            >
              Train Selected ({selectedIds.size})
            </button>
          </GameDialogFooter>
        )}

        {/* Close affordance — kept as the modal's own labelled button (the
            test asserts `Close quick train modal`); GameDialog's built-in X is
            suppressed via hideCloseButton to avoid two close controls. */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-role-secondary hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--celestial-primary)] rounded"
          data-testid="close-button"
          aria-label="Close quick train modal"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </GameDialogContent>
    </GameDialog>
  );
};

export default QuickTrainModal;
