/**
 * TraitTimelineSection — chronological list of trait events
 * (discovery, mutation, interaction, …).
 * Equoria-kdduk: extracted from GeneticsTab.tsx.
 *
 * Palette migration (design exception `palette-classes` retired): raw
 * purple/emerald/blue badge classes are now semantic tokens, and each phase
 * badge pairs its already-visible phase label with a per-phase icon, so the
 * phase never depends on badge colour alone.
 */

import React from 'react';
import { CircleDot, Dna, GitMerge, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import type { TraitTimelineEntry } from '../../../hooks/useHorseGenetics';

interface TraitTimelineSectionProps {
  timeline: TraitTimelineEntry[] | undefined;
}

const TraitTimelineSection: React.FC<TraitTimelineSectionProps> = ({ timeline }) => {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div>
      <h3 className="type-section-heading mb-4">Trait Development Timeline ({timeline.length})</h3>
      <div className="space-y-3">
        {timeline.map((entry) => {
          // Equoria-yzar3: eventType is a humanized label derived from the
          // real backend `type` discriminator (e.g. 'Trait Discovery',
          // 'Significant Interaction'). It is GUARANTEED defined by the
          // hook mapper, but we still guard the .charAt access so a future
          // shape regression can never crash the whole Genetics tab.
          const eventLabel = entry.eventType ?? 'Event';
          const eventTypeKey = eventLabel.toLowerCase();
          // Phase presentation. The badge already renders `eventLabel` as text;
          // `icon` adds a per-phase shape so the phase never depends on badge
          // colour alone. The icon is decorative — the adjacent label names it.
          const phase = eventTypeKey.includes('discover')
            ? {
                icon: Sparkles,
                badgeClass: 'bg-[var(--badge-rare-bg)] text-[var(--status-rare)]',
              }
            : eventTypeKey.includes('interaction')
              ? {
                  icon: GitMerge,
                  badgeClass: 'bg-[var(--role-success-bg)] text-[var(--role-success-text)]',
                }
              : eventTypeKey.includes('mutat')
                ? {
                    icon: Dna,
                    badgeClass: 'bg-[var(--alpha-gold-primary-20)] text-[var(--gold-primary)]',
                  }
                : {
                    icon: CircleDot,
                    badgeClass: 'bg-[var(--role-info-bg)] text-[var(--role-info-text)]',
                  };
          const PhaseIcon = phase.icon;
          return (
            <div
              key={entry.id}
              className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border-l-4 border-[rgba(37,99,235,0.5)]"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold ${phase.badgeClass}`}
                  >
                    <PhaseIcon className="w-3 h-3" aria-hidden="true" />
                    {eventLabel}
                  </span>
                  <span className="text-sm font-semibold text-[rgb(220,235,255)]">
                    {entry.traitName}
                  </span>
                </div>
                <span className="text-xs text-[rgb(160,175,200)]">
                  {formatDate(entry.timestamp)}
                </span>
              </div>
              {entry.description && (
                <p className="text-sm text-[rgb(220,235,255)] mb-2">{entry.description}</p>
              )}
              {entry.source && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[rgb(160,175,200)]">
                    Source: <span className="capitalize font-semibold">{entry.source}</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TraitTimelineSection;
