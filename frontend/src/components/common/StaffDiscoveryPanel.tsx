/**
 * StaffDiscoveryPanel — what a rider or groom has revealed about itself (Equoria-xlw03).
 *
 * Owner rulings 2026-10-28 (q160, q177): every rider and groom carries twelve hidden
 * items — 4 horse traits, 4 disciplines and 2 temperaments (each a strength or a
 * weakness) and 2 favourite breeds. A Rookie shows its personality only; each level-up
 * reveals 3; an Expert shows everything. The server sends only revealed items, as
 * authored labels; the rest appear here as "?" slots. There is no "N more shows" hint
 * (the old discovery hint line was removed by the same ruling).
 */

import React from 'react';
import type { StaffGrowthCategory, StaffGrowthView } from '@/lib/api/types';

interface StaffDiscoveryPanelProps {
  growth: StaffGrowthView;
  /** Whose discoveries these are, e.g. "rider" — used in the test id only. */
  staffKind: 'rider' | 'groom';
}

const signMeta = {
  positive: { icon: '↑', className: 'text-[var(--role-success-text)]' },
  negative: { icon: '↓', className: 'text-[var(--role-danger-text)]' },
} as const;

const CategoryBlock: React.FC<{ category: StaffGrowthCategory; index: number }> = ({
  category,
  index,
}) => {
  const hidden = Math.max(0, category.total - category.revealed.length);
  return (
    <div data-testid={`discovery-category-${index}`}>
      <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
        {category.label}
      </h4>
      <ul className="space-y-2">
        {category.revealed.map((item) => {
          const meta = item.note === 'Favourite' ? null : signMeta[item.sign];
          return (
            <li
              key={item.label}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-hover)]"
            >
              <span className="text-sm text-[var(--text-primary)] font-medium">{item.label}</span>
              {meta ? (
                <span className={`text-xs font-bold ${meta.className}`} title={item.note}>
                  <span aria-hidden="true">{meta.icon}</span>
                  <span className="sr-only">{item.note}</span>
                </span>
              ) : (
                <span className="text-xs text-[var(--gold-primary)]">{item.note}</span>
              )}
            </li>
          );
        })}
        {Array.from({ length: hidden }, (_, i) => (
          <li
            key={`hidden-${i}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)] border-dashed"
          >
            <span className="text-role-disabled text-lg" aria-hidden="true">
              ?
            </span>
            <span className="text-xs text-[var(--text-muted)] italic">Not yet discovered</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const StaffDiscoveryPanel: React.FC<StaffDiscoveryPanelProps> = ({ growth, staffKind }) => {
  const percent = growth.totalItems
    ? Math.round((growth.revealedCount / growth.totalItems) * 100)
    : 0;
  return (
    <div className="space-y-4" data-testid={`${staffKind}-discovery-panel`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Discoveries</h3>
        <span className="text-xs text-[var(--text-muted)]">
          {growth.revealedCount} / {growth.totalItems} revealed
        </span>
      </div>
      <div className="h-1.5 bg-[var(--glass-surface-subtle-bg)] rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-[var(--alpha-gold-primary-70)] rounded-full transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      {growth.categories.map((category, index) => (
        <CategoryBlock key={category.label} category={category} index={index} />
      ))}
    </div>
  );
};

export default StaffDiscoveryPanel;
