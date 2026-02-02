/**
 * Quick Train Modal Component
 *
 * Modal for selecting and training multiple horses at once
 *
 * Story 4.5: Training Dashboard - Task 6
 */

import { useState } from 'react';
import { X, Zap, CheckSquare, Square } from 'lucide-react';
import { DashboardHorse } from './DashboardHorseCard';

export interface QuickTrainModalProps {
  isOpen: boolean;
  horses: DashboardHorse[];
  onClose: () => void;
  onTrain: (horseIds: number[]) => void;
}

const QuickTrainModal = ({ isOpen, horses, onClose, onTrain }: QuickTrainModalProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="quick-train-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-train-modal-title"
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 id="quick-train-modal-title" className="text-xl font-bold text-slate-900">
              Quick Train
            </h2>
            <p className="text-sm text-slate-600 mt-1">Select horses to train simultaneously</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            data-testid="close-button"
            aria-label="Close quick train modal"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {readyHorses.length === 0 ? (
            /* Empty State */
            <div className="py-12 text-center" data-testid="empty-state">
              <Zap className="mx-auto h-12 w-12 text-slate-400 mb-4" aria-hidden="true" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                No horses ready for training
              </h3>
              <p className="text-sm text-slate-600">
                All your horses are either on cooldown or ineligible for training.
              </p>
            </div>
          ) : (
            <>
              {/* Horse Count and Select All */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-slate-600">
                  {readyHorses.length} {readyHorses.length === 1 ? 'horse' : 'horses'} ready
                  {hasSelection && (
                    <span className="ml-2 font-medium text-blue-600">
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
                  <div className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                    {allSelected ? (
                      <CheckSquare className="h-5 w-5 text-blue-600" aria-hidden="true" />
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
                    className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
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
                        <CheckSquare className="h-5 w-5 text-blue-600" aria-hidden="true" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-400" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{horse.name}</div>
                      <div className="text-sm text-slate-600">
                        {horse.age} {horse.age === 1 ? 'year' : 'years'} old
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {readyHorses.length > 0 && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={handleTrain}
              disabled={!hasSelection}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="train-selected-button"
            >
              Train Selected ({selectedIds.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickTrainModal;
