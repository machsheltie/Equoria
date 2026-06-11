/**
 * StatCard — small stat tile with an optional tooltip disclosure.
 *
 * Equoria-o5hub.24: the card previously attached onClick to a plain div with
 * no role/tabIndex — pointer-only disclosure. When a tooltip exists the card
 * now renders as a real <button> (native Enter/Space activation, focusable,
 * focus-visible ring via .glass-panel-interactive, aria-expanded state).
 * Without a tooltip there is nothing to disclose, so it stays a static,
 * non-interactive panel (no hover affordance — D-05).
 */
import React, { useState } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tooltip?: string;
}

const StatCard = ({ label, value, icon, tooltip }: StatCardProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">{label}</p>
          <p className="fantasy-header text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
        {icon && (
          <div className="text-burnished-gold opacity-80 group-hover:opacity-100 transition-opacity">
            {icon}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && tooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-[var(--z-raised)]"
        >
          <div className="bg-[var(--glass-surface-heavy-bg)] text-[var(--text-primary)] px-3 py-2 rounded-[var(--radius-md)] text-sm fantasy-body shadow-lg border border-[var(--glass-border)]">
            {tooltip}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-4 border-transparent border-t-[var(--glass-surface-heavy-bg)]" />
            </div>
          </div>
        </div>
      )}

      {/* Corner decorations */}
      <div
        className="absolute top-1 left-1 w-3 h-3 border-l border-t border-burnished-gold opacity-40"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-1 right-1 w-3 h-3 border-r border-b border-burnished-gold opacity-40"
        aria-hidden="true"
      />
    </>
  );

  if (tooltip) {
    return (
      <button
        type="button"
        className="relative w-full text-left p-4 glass-panel glass-panel-interactive group"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onClick={() => setShowTooltip((prev) => !prev)}
        aria-expanded={showTooltip}
        aria-label={`${label}: ${value}. Show details`}
      >
        {content}
      </button>
    );
  }

  // No tooltip → static panel, no interactive affordance (D-05)
  return <div className="relative p-4 glass-panel group">{content}</div>;
};

export default StatCard;
