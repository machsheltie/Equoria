/**
 * RiderPersonalityDisplay Component
 *
 * Expanded personality display showing discipline affinities,
 * temperament compatibilities, and effectiveness notes.
 * Used in rider cards and detail views.
 *
 * Mirrors GroomPersonalityDisplay.tsx for the Rider System (Epic 9C).
 */

import React from 'react';
import {
  getRiderPersonalityInfo,
  riderCompatibilityLabel,
  riderCompatibilityColorClass,
} from '@/types/riderPersonality';

interface RiderPersonalityDisplayProps {
  personality: string;
  level?: number;
  compact?: boolean;
}

const RiderPersonalityDisplay: React.FC<RiderPersonalityDisplayProps> = ({
  personality,
  level = 1,
  compact = false,
}) => {
  const info = getRiderPersonalityInfo(personality);

  if (compact) {
    return (
      <div
        className="text-xs space-y-1.5 p-3 rounded-lg bg-white/5 border border-white/10"
        data-testid="rider-personality-display"
      >
        <p className="text-white/60 leading-relaxed">{info.description}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {info.disciplineAffinities.map((affinity) => (
            <span
              key={affinity.discipline}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                affinity.magnitude === 'high'
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : affinity.magnitude === 'medium'
                    ? 'bg-amber-900/40 text-amber-400'
                    : 'bg-white/5 text-white/40'
              }`}
            >
              {affinity.discipline}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="rider-personality-display">
      {/* Description */}
      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{info.icon}</span>
          <span className="text-sm font-semibold text-white/90">{info.label} Rider</span>
        </div>
        <p className="text-sm text-white/60 leading-relaxed">{info.description}</p>
        {level >= 5 && (
          <p className="text-xs text-celestial-gold/80 mt-2 italic">{info.riderNote}</p>
        )}
      </div>

      {/* Discipline Affinities */}
      <div>
        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
          Discipline Tendencies
        </h4>
        <div className="space-y-1.5">
          {info.disciplineAffinities.map((affinity) => (
            <div key={affinity.discipline} className="flex items-center justify-between text-sm">
              <span className="text-white/70">{affinity.discipline}</span>
              <span
                className={
                  affinity.magnitude === 'high'
                    ? 'text-emerald-400 font-semibold'
                    : affinity.magnitude === 'medium'
                      ? 'text-amber-400'
                      : 'text-white/40'
                }
              >
                {affinity.magnitude === 'high'
                  ? '↑↑ Strong'
                  : affinity.magnitude === 'medium'
                    ? '↑ Moderate'
                    : '– Neutral'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Temperament Compatibility */}
      <div>
        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
          Horse Compatibility
        </h4>
        <div className="space-y-1.5">
          {info.temperamentCompatibility.map((compat) => (
            <div
              key={compat.horseTemperament}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-white/70">{compat.horseTemperament}</span>
              <span className={`font-medium ${riderCompatibilityColorClass(compat.rating)}`}>
                {riderCompatibilityLabel(compat.rating)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiderPersonalityDisplay;
