/**
 * TemperamentReferenceModal
 *
 * Equoria-876o — frontend consumer for GET /api/v1/horses/temperament-definitions.
 * Renders all 11 temperaments with their descriptions, training/competition
 * modifiers, and best-matched groom personalities so players can learn what
 * each temperament means and how it affects gameplay.
 *
 * Triggered from the HorseDetailPage temperament line (Equoria-8k7k).
 *
 * Design-system migration (Equoria-o5hub.20 / DECISIONS.md §8): the
 * page-local `fixed inset-0` overlay is replaced by the canonical GameDialog
 * (Radix supplies Escape close / focus trap / scroll lock — the manual
 * keydown listener was removed). Status colors use role tokens.
 */

import { AlertCircle } from 'lucide-react';
import { useTemperamentDefinitions } from '@/hooks/api/useTemperamentDefinitions';
import {
  GameDialog,
  GameDialogBody,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
} from '@/components/ui/game';
import { Surface } from '@/components/ui/Surface';
import { SectionLoading } from '@/components/ui/state';

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

  return (
    <GameDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <GameDialogContent size="lg" data-testid="temperament-reference-modal">
        <GameDialogHeader>
          <GameDialogTitle id="temperament-reference-title" className="text-lg">
            Temperament Reference
          </GameDialogTitle>
        </GameDialogHeader>

        <GameDialogBody className="max-h-[70vh]">
          {isLoading && (
            <div data-testid="temperament-reference-loading">
              <SectionLoading label="Loading temperament reference" minHeight="160px" />
            </div>
          )}

          {error && (
            <div
              className="rounded-[var(--radius-md)] border border-[var(--role-danger-border)] bg-[var(--badge-danger-bg)] p-4"
              data-testid="temperament-reference-error"
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="h-5 w-5 text-[var(--status-danger)] mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--status-danger)]">
                    Failed to load temperament reference
                  </p>
                  <p className="text-sm text-role-secondary mt-1">
                    {error.message || 'Please try again later.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {data && (
            <div className="space-y-3" data-testid="temperament-reference-list">
              {data.definitions.map((def) => {
                const isHighlighted = highlightTemperament === def.name;
                return (
                  /* Nested inside the dialog overlay — Surface(subtle), never blurs */
                  <Surface
                    key={def.name}
                    variant="subtle"
                    data-testid={`temperament-def-${def.name.toLowerCase()}`}
                    className={`p-4 ${
                      isHighlighted ? 'border-[var(--gold-primary)] bg-[var(--btn-gold-bg)]' : ''
                    }`}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <h3 className="font-semibold text-role-primary">{def.name}</h3>
                      {isHighlighted && (
                        <span className="text-xs uppercase tracking-wider text-[var(--gold-light)]">
                          This horse
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-role-secondary mb-2">{def.description}</p>
                    {def.prevalenceNote && (
                      <p className="text-xs italic text-role-secondary mb-2">
                        {def.prevalenceNote}
                      </p>
                    )}
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <dt className="inline text-role-secondary">Training XP: </dt>
                        <dd className="inline font-medium text-role-primary">
                          {formatPercent(def.trainingModifiers.xpModifier)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-role-secondary">Training score: </dt>
                        <dd className="inline font-medium text-role-primary">
                          {formatPercent(def.trainingModifiers.scoreModifier)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-role-secondary">Ridden score: </dt>
                        <dd className="inline font-medium text-role-primary">
                          {formatPercent(def.competitionModifiers.riddenModifier)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-role-secondary">Conformation: </dt>
                        <dd className="inline font-medium text-role-primary">
                          {formatPercent(def.competitionModifiers.conformationModifier)}
                        </dd>
                      </div>
                    </dl>
                    {def.bestGroomPersonalities.length > 0 && (
                      <p className="text-xs text-role-secondary mt-2">
                        Best with grooms:{' '}
                        <span className="text-role-primary">
                          {def.bestGroomPersonalities.join(', ')}
                        </span>
                      </p>
                    )}
                  </Surface>
                );
              })}
            </div>
          )}
        </GameDialogBody>
      </GameDialogContent>
    </GameDialog>
  );
};

export default TemperamentReferenceModal;
