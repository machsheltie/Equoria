/**
 * TemperamentReferenceModal
 *
 * Equoria-876o — frontend consumer for GET /api/v1/horses/temperament-definitions.
 * Renders all 11 temperaments with their descriptions, training/competition
 * modifiers, and best-matched groom personalities so players can learn what
 * each temperament means and how it affects gameplay.
 *
 * Triggered from the HorseDetailPage temperament line (Equoria-8k7k).
 */

import { useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTemperamentDefinitions } from '@/hooks/api/useTemperamentDefinitions';

export interface TemperamentReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlightTemperament?: string | null;
}

const formatPercent = (mod: number): string => {
  if (mod === 0) return '0%';
  const sign = mod > 0 ? '+' : '';
  return `${sign}${Math.round(mod * 100)}%`;
};

const TemperamentReferenceModal = ({
  isOpen,
  onClose,
  highlightTemperament,
}: TemperamentReferenceModalProps) => {
  const { data, isLoading, error } = useTemperamentDefinitions(isOpen);

  // Escape-to-close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[var(--z-modal)]"
      onClick={onClose}
      data-testid="temperament-reference-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temperament-reference-title"
    >
      <div
        className="glass-panel max-w-4xl w-full max-h-[85vh] overflow-hidden rounded-lg border border-[var(--glass-hover)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--glass-hover)] px-6 py-4">
          <h2
            id="temperament-reference-title"
            className="text-lg font-semibold text-[var(--text-primary)]"
          >
            Temperament Reference
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Close temperament reference"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-4rem)] p-6">
          {isLoading && (
            <div className="text-center py-12" data-testid="temperament-reference-loading">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-burnished-gold mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">
                Loading temperament reference...
              </p>
            </div>
          )}

          {error && (
            <div
              className="rounded-lg border border-rose-500/30 bg-[rgba(239,68,68,0.1)] p-4"
              data-testid="temperament-reference-error"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-rose-300">
                    Failed to load temperament reference
                  </p>
                  <p className="text-sm text-rose-400 mt-1">
                    {error.message || 'Please try again later.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {data && (
            <div className="space-y-3" data-testid="temperament-reference-list">
              {data.definitions.map(def => {
                const isHighlighted = highlightTemperament === def.name;
                return (
                  <div
                    key={def.name}
                    data-testid={`temperament-def-${def.name.toLowerCase()}`}
                    className={`rounded-lg border p-4 ${
                      isHighlighted
                        ? 'border-burnished-gold bg-[rgba(217,164,65,0.08)]'
                        : 'border-[var(--glass-hover)] bg-[var(--glass-bg)]'
                    }`}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <h3 className="font-semibold text-[var(--text-primary)]">{def.name}</h3>
                      {isHighlighted && (
                        <span className="text-xs uppercase tracking-wider text-burnished-gold">
                          This horse
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-2">{def.description}</p>
                    {def.prevalenceNote && (
                      <p className="text-xs italic text-[var(--text-secondary)] mb-2">
                        {def.prevalenceNote}
                      </p>
                    )}
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <dt className="inline text-[var(--text-secondary)]">Training XP: </dt>
                        <dd className="inline font-medium text-[var(--text-primary)]">
                          {formatPercent(def.trainingModifiers.xpModifier)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--text-secondary)]">Training score: </dt>
                        <dd className="inline font-medium text-[var(--text-primary)]">
                          {formatPercent(def.trainingModifiers.scoreModifier)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--text-secondary)]">Ridden score: </dt>
                        <dd className="inline font-medium text-[var(--text-primary)]">
                          {formatPercent(def.competitionModifiers.riddenModifier)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--text-secondary)]">Conformation: </dt>
                        <dd className="inline font-medium text-[var(--text-primary)]">
                          {formatPercent(def.competitionModifiers.conformationModifier)}
                        </dd>
                      </div>
                    </dl>
                    {def.bestGroomPersonalities.length > 0 && (
                      <p className="text-xs text-[var(--text-secondary)] mt-2">
                        Best with grooms:{' '}
                        <span className="text-[var(--text-primary)]">
                          {def.bestGroomPersonalities.join(', ')}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemperamentReferenceModal;
