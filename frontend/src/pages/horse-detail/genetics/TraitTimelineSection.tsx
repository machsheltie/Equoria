/**
 * TraitTimelineSection — chronological list of trait events
 * (discovery, mutation, interaction, …).
 * Equoria-kdduk: extracted from GeneticsTab.tsx.
 */

import React from 'react';
import type { TraitTimelineEntry } from '../../../hooks/useHorseGenetics';

interface TraitTimelineSectionProps {
  timeline: TraitTimelineEntry[] | undefined;
}

const TraitTimelineSection: React.FC<TraitTimelineSectionProps> = ({ timeline }) => {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div>
      <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
        Trait Development Timeline ({timeline.length})
      </h3>
      <div className="space-y-3">
        {timeline.map((entry) => {
          // Equoria-yzar3: eventType is a humanized label derived from the
          // real backend `type` discriminator (e.g. 'Trait Discovery',
          // 'Significant Interaction'). It is GUARANTEED defined by the
          // hook mapper, but we still guard the .charAt access so a future
          // shape regression can never crash the whole Genetics tab.
          const eventLabel = entry.eventType ?? 'Event';
          const eventTypeKey = eventLabel.toLowerCase();
          const badgeClass = eventTypeKey.includes('discover')
            ? 'bg-purple-500/20 text-purple-400'
            : eventTypeKey.includes('interaction')
              ? 'bg-emerald-500/20 text-emerald-400'
              : eventTypeKey.includes('mutat')
                ? 'bg-burnished-gold/20 text-burnished-gold'
                : 'bg-blue-500/20 text-blue-400';
          return (
            <div
              key={entry.id}
              className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border-l-4 border-[rgba(37,99,235,0.5)]"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${badgeClass}`}>
                    {eventLabel}
                  </span>
                  <span className="text-sm font-semibold text-[rgb(220,235,255)]">
                    {entry.traitName}
                  </span>
                </div>
                <span className="text-xs text-[rgb(160,175,200)]">
                  {new Date(entry.timestamp).toLocaleDateString()}
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
