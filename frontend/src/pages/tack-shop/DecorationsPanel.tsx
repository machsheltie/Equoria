/**
 * DecorationsPanel (Equoria-n9n8 — extracted from TackShopPage in Equoria-f5xni)
 *
 * Renders the decorations currently equipped on the selected horse and
 * surfaces an "Unequip" button per row that fires the useUnequipDecoration
 * mutation. Without this panel, the
 * POST /api/v1/tack-shop/unequip-decoration endpoint had no UI path.
 */

import React, { useMemo } from 'react';
import { toast } from 'sonner';
import { Sparkles, X } from 'lucide-react';
import { useUnequipDecoration } from '@/hooks/api/useTackShop';
import type { HorseSummary } from '@/lib/api-client';

interface DecorationsPanelProps {
  horse: HorseSummary;
}

export const DecorationsPanel: React.FC<DecorationsPanelProps> = ({ horse }) => {
  const unequipMutation = useUnequipDecoration();

  const decorations = useMemo<string[]>(() => {
    const raw =
      horse.tack && typeof horse.tack === 'object'
        ? (horse.tack as Record<string, unknown>).decorations
        : undefined;
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  }, [horse.tack]);

  const handleUnequip = (itemId: string) => {
    unequipMutation.mutate(
      { horseId: horse.id, itemId },
      {
        onSuccess: () => {
          toast.success(`Unequipped decoration "${itemId}"`);
        },
        onError: () => {
          toast.error('Failed to unequip decoration. Please try again.');
        },
      }
    );
  };

  return (
    <section
      className="p-4 rounded-xl glass-panel"
      data-testid="decorations-panel"
      aria-label="Equipped decorations"
    >
      <h3 className="text-sm font-semibold text-[var(--cream)] uppercase tracking-widest mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[var(--gold-400)]" />
        Equipped Decorations
      </h3>

      {decorations.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] italic" data-testid="decorations-empty">
          No decorations equipped on {horse.name}. Visit the Shop tab to buy decorative items.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="decorations-list">
          {decorations.map((itemId) => (
            <li
              key={itemId}
              className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]"
            >
              <span className="text-sm text-[var(--cream)]">{itemId}</span>
              <button
                type="button"
                onClick={() => handleUnequip(itemId)}
                disabled={unequipMutation.isPending}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 disabled:opacity-40 transition-colors"
                aria-label={`Unequip ${itemId}`}
                data-testid={`unequip-decoration-${itemId}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Unequip
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
