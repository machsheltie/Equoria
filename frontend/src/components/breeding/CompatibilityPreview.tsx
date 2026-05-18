/**
 * CompatibilityPreview (Epic 28-1)
 *
 * 4-tab compatibility display for a breeding pair:
 *  1. Stat Ranges  — min/max/average predicted offspring stats
 *  2. Traits       — inheritance probability per trait
 *  3. Inbreeding   — coefficient with warning threshold
 *  4. Pedigree     — ancestor overlap summary
 *
 * Bidirectional: works whether started from mare, stallion, or horse detail page.
 * Celestial Night styling throughout.
 */

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ScoreBreakdownRadar } from '@/components/competition/ScoreBreakdownRadar';
import type { PedigreeTree, PedigreeTreeNode } from './pedigreeTreeFromLineage';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StatRange {
  min: number;
  avg: number;
  max: number;
}

interface TraitPrediction {
  name: string;
  probability: number; // 0–1
  source: 'dam' | 'sire' | 'both' | 'recessive';
}

export interface CompatibilityData {
  statRanges: Record<string, StatRange>;
  traits: TraitPrediction[];
  inbreedingCoefficient: number; // 0–1
  pedigreeOverlap: Array<{ ancestorName: string; generations: number }>;
  /**
   * Real 3-generation ancestor tree from the backend lineage-analysis
   * endpoint (Equoria-55bo.2). When present the Pedigree tab renders the
   * recursive sire/dam tree; the flat `pedigreeOverlap` list is only used as
   * the legacy fallback when no tree is available. Never fabricated.
   */
  pedigreeTree?: PedigreeTree | null;
}

interface CompatibilityPreviewProps {
  mareName: string;
  stallionName: string;
  data: CompatibilityData | null;
  isLoading?: boolean;
  className?: string;
}

// ── Tab button ─────────────────────────────────────────────────────────────────

const TABS = ['Stats', 'Traits', 'Inbreeding', 'Pedigree'] as const;
type Tab = (typeof TABS)[number];

function TabButton({
  label,
  active,
  onClick,
}: {
  label: Tab;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'relative px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none font-[var(--font-body)]',
        'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:transition-all',
        active
          ? 'text-[var(--gold-primary)] after:bg-[var(--gold-primary)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] after:bg-transparent',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ── Tab: Stat Ranges ──────────────────────────────────────────────────────────

function StatRangesTab({ statRanges }: { statRanges: Record<string, StatRange> }) {
  const avgStats = Object.fromEntries(Object.entries(statRanges).map(([k, v]) => [k, v.avg]));

  return (
    <div className="space-y-4">
      <ScoreBreakdownRadar stats={avgStats} title="Predicted offspring profile" height={220} />
      <div className="space-y-2">
        {Object.entries(statRanges).map(([stat, range]) => (
          <div key={stat} className="flex items-center gap-2 text-xs font-[var(--font-body)]">
            <span className="w-20 text-[var(--text-muted)] capitalize">{stat}</span>
            <div className="flex-1 relative h-2 rounded-full bg-[var(--celestial-navy-700)]">
              {/* Range bar */}
              <div
                className="absolute h-full rounded-full bg-[rgba(201,162,39,0.3)]"
                style={{ left: `${range.min}%`, width: `${range.max - range.min}%` }}
              />
              {/* Avg marker */}
              <div
                className="absolute w-2 h-2 rounded-full bg-[var(--gold-primary)] -top-0 -translate-y-0"
                style={{ left: `calc(${range.avg}% - 4px)` }}
                title={`Average: ${range.avg}`}
              />
            </div>
            <span className="w-14 text-right text-[var(--text-muted)]">
              {range.min}–{range.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Traits ───────────────────────────────────────────────────────────────

function TraitsTab({ traits }: { traits: TraitPrediction[] }) {
  if (traits.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)] text-center py-4">
        No traits detected in this pairing.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {traits.map((t) => (
        <div
          key={t.name}
          className="flex items-center gap-3 rounded-lg px-3 py-2 bg-[rgba(10,22,50,0.4)] border border-[rgba(100,130,165,0.15)]"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)] font-[var(--font-body)] truncate">
              {t.name}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] capitalize font-[var(--font-body)]">
              {t.source === 'both' ? 'Both parents' : `From ${t.source}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0 w-16">
            <span className="text-xs font-bold text-[var(--gold-primary)] font-[var(--font-heading)]">
              {Math.round(t.probability * 100)}%
            </span>
            <div className="w-full h-1 rounded-full bg-[var(--celestial-navy-700)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)]"
                style={{ width: `${t.probability * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Inbreeding ───────────────────────────────────────────────────────────

const INBREEDING_WARN = 0.125; // 12.5% — 2nd cousin equivalent

function InbreedingTab({ coefficient }: { coefficient: number }) {
  const pct = Math.round(coefficient * 100 * 10) / 10;
  const isWarning = coefficient >= INBREEDING_WARN;

  return (
    <div className="space-y-4">
      {/* Score display */}
      <div className="text-center py-4">
        <p
          className={`text-4xl font-bold tabular-nums ${isWarning ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {pct}%
        </p>
        <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)] mt-1">
          Inbreeding coefficient
        </p>
      </div>

      {/* Bar */}
      <div
        className="h-2 rounded-full bg-[var(--celestial-navy-700)] overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all ${isWarning ? 'bg-amber-400' : 'bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)]'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      {/* Warning */}
      {isWarning && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)]">
          <AlertTriangle
            className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-xs text-amber-300 font-[var(--font-body)]">
            High inbreeding coefficient. Offspring may have reduced genetic diversity and slightly
            lower stat potential.
          </p>
        </div>
      )}

      {!isWarning && (
        <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)] text-center">
          Low inbreeding — healthy genetic diversity.
        </p>
      )}
    </div>
  );
}

// ── Tab: Pedigree ─────────────────────────────────────────────────────────────

/**
 * Recursive ancestor node — renders the real 3-generation sire/dam tree.
 * Indentation + a connector rail communicate depth; sire above dam mirrors
 * standard pedigree-chart convention.
 */
function PedigreeNode({ node, depth }: { node: PedigreeTreeNode; depth: number }) {
  return (
    <li className="relative" data-testid="pedigree-tree-node">
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-[rgba(10,22,50,0.4)] border border-[rgba(100,130,165,0.15)]"
        style={{ marginLeft: depth * 14 }}
      >
        <span className="text-xs text-[var(--text-primary)] font-[var(--font-body)] truncate">
          {node.name}
        </span>
        <span className="ml-auto text-[10px] text-[var(--text-muted)] font-[var(--font-body)] flex-shrink-0">
          {depth === 0 ? 'Parent' : depth === 1 ? 'Grandparent' : `Gen ${depth + 1}`}
        </span>
      </div>
      {(node.sire || node.dam) && (
        <ul className="mt-1 space-y-1 border-l border-[rgba(201,162,39,0.2)] ml-2 pl-1">
          {node.sire && <PedigreeNode node={node.sire} depth={depth + 1} />}
          {node.dam && <PedigreeNode node={node.dam} depth={depth + 1} />}
        </ul>
      )}
    </li>
  );
}

function PedigreeRoot({ label, node }: { label: string; node: PedigreeTreeNode | null }) {
  return (
    <div className="space-y-1" data-testid={`pedigree-root-${label.toLowerCase()}`}>
      <p className="text-[10px] text-[var(--gold-primary)] font-[var(--font-body)] uppercase tracking-widest">
        {label}: {node?.name ?? '—'}
      </p>
      {node && (node.sire || node.dam) ? (
        <ul className="space-y-1">
          {node.sire && <PedigreeNode node={node.sire} depth={0} />}
          {node.dam && <PedigreeNode node={node.dam} depth={0} />}
        </ul>
      ) : (
        <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)] pl-1">
          No recorded ancestors.
        </p>
      )}
    </div>
  );
}

function PedigreeTab({
  overlap,
  tree,
  mareName,
  stallionName,
}: {
  overlap: Array<{ ancestorName: string; generations: number }>;
  tree?: PedigreeTree | null;
  mareName: string;
  stallionName: string;
}) {
  // Preferred: render the real 3-generation ancestor tree from the backend
  // lineage-analysis endpoint (Equoria-55bo.2). Only fall back to the flat
  // common-ancestor overlap when no real tree is available.
  if (tree && (tree.stallion || tree.mare)) {
    return (
      <div className="space-y-4" data-testid="pedigree-tree">
        <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest">
          3-generation pedigree
        </p>
        <PedigreeRoot label="Sire" node={tree.stallion} />
        <PedigreeRoot label="Dam" node={tree.mare} />
        {overlap.length > 0 && (
          <div className="pt-2 border-t border-[rgba(201,162,39,0.12)]">
            <p className="text-[10px] text-amber-300 font-[var(--font-body)] uppercase tracking-widest mb-1">
              Common ancestors
            </p>
            {overlap.map((a) => (
              <div
                key={a.ancestorName}
                className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-[var(--font-body)] py-0.5"
              >
                <span>{a.ancestorName}</span>
                <span>
                  {a.generations} gen{a.generations !== 1 ? 's' : ''} back
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (overlap.length === 0) {
    return (
      <div className="text-center py-4 space-y-1">
        <p className="text-sm font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          No common ancestors
        </p>
        <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)]">
          {mareName} and {stallionName} have unrelated bloodlines.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest mb-2">
        Shared ancestors
      </p>
      {overlap.map((a) => (
        <div
          key={a.ancestorName}
          className="flex items-center justify-between rounded-lg px-3 py-2 bg-[rgba(10,22,50,0.4)] border border-[rgba(100,130,165,0.15)]"
        >
          <span className="text-xs text-[var(--text-primary)] font-[var(--font-body)]">
            {a.ancestorName}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)]">
            {a.generations} gen{a.generations !== 1 ? 's' : ''} back
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-40 rounded-xl bg-[var(--bg-midnight)]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-6 rounded bg-[var(--bg-midnight)] w-full" />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CompatibilityPreview({
  mareName,
  stallionName,
  data,
  isLoading = false,
  className = '',
}: CompatibilityPreviewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Stats');

  return (
    <div
      className={`glass-panel rounded-2xl border border-[rgba(201,162,39,0.15)] overflow-hidden ${className}`}
      data-testid="compatibility-preview"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[rgba(201,162,39,0.12)]">
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)] mb-0.5">
          Breeding Compatibility
        </p>
        <p className="text-sm font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {mareName} <span className="text-[var(--gold-primary)]">×</span> {stallionName}
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        className="flex border-b border-[rgba(201,162,39,0.12)] px-2"
        aria-label="Compatibility tabs"
      >
        {TABS.map((tab) => (
          <TabButton
            key={tab}
            label={tab}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4" role="tabpanel" aria-label={activeTab}>
        {isLoading || !data ? (
          <LoadingSkeleton />
        ) : activeTab === 'Stats' ? (
          <StatRangesTab statRanges={data.statRanges} />
        ) : activeTab === 'Traits' ? (
          <TraitsTab traits={data.traits} />
        ) : activeTab === 'Inbreeding' ? (
          <InbreedingTab coefficient={data.inbreedingCoefficient} />
        ) : (
          <PedigreeTab
            overlap={data.pedigreeOverlap}
            tree={data.pedigreeTree}
            mareName={mareName}
            stallionName={stallionName}
          />
        )}
      </div>
    </div>
  );
}

export default CompatibilityPreview;
