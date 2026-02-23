/**
 * TrainerPersonalityDisplay — Expanded personality profile (Epic 13 — Story 13-1)
 *
 * Full personality breakdown showing:
 * - Personality icon, label, and description
 * - Discipline tendencies (which disciplines this trainer excels at)
 * - Horse temperament compatibility (how this trainer works with different horse types)
 *
 * Compact mode: small card for inline use.
 * Full mode: detailed breakdown with all sections.
 *
 * Mirrors RiderPersonalityDisplay.tsx for the Trainer System.
 */

import React from 'react';
import { getTrainerPersonalityInfo } from './TrainerPersonalityBadge';

// Discipline tendencies per personality
const DISCIPLINE_TENDENCIES: Record<
  string,
  Array<{ discipline: string; magnitude: 'high' | 'medium' | 'neutral' }>
> = {
  focused: [
    { discipline: 'Dressage', magnitude: 'high' },
    { discipline: 'Show Jumping', magnitude: 'medium' },
    { discipline: 'Cross Country', magnitude: 'neutral' },
    { discipline: 'Racing', magnitude: 'neutral' },
    { discipline: 'Western', magnitude: 'neutral' },
  ],
  encouraging: [
    { discipline: 'Dressage', magnitude: 'medium' },
    { discipline: 'Show Jumping', magnitude: 'high' },
    { discipline: 'Cross Country', magnitude: 'medium' },
    { discipline: 'Racing', magnitude: 'neutral' },
    { discipline: 'Western', magnitude: 'neutral' },
  ],
  technical: [
    { discipline: 'Dressage', magnitude: 'high' },
    { discipline: 'Show Jumping', magnitude: 'high' },
    { discipline: 'Cross Country', magnitude: 'neutral' },
    { discipline: 'Racing', magnitude: 'medium' },
    { discipline: 'Western', magnitude: 'neutral' },
  ],
  competitive: [
    { discipline: 'Dressage', magnitude: 'neutral' },
    { discipline: 'Show Jumping', magnitude: 'medium' },
    { discipline: 'Cross Country', magnitude: 'high' },
    { discipline: 'Racing', magnitude: 'high' },
    { discipline: 'Western', magnitude: 'medium' },
  ],
  patient: [
    { discipline: 'Dressage', magnitude: 'medium' },
    { discipline: 'Show Jumping', magnitude: 'neutral' },
    { discipline: 'Cross Country', magnitude: 'neutral' },
    { discipline: 'Racing', magnitude: 'neutral' },
    { discipline: 'Western', magnitude: 'high' },
  ],
};

// Horse temperament compatibility per personality
const HORSE_COMPATIBILITY: Record<
  string,
  Array<{ temperament: string; rating: 'excellent' | 'good' | 'poor' }>
> = {
  focused: [
    { temperament: 'Calm', rating: 'excellent' },
    { temperament: 'Bold', rating: 'good' },
    { temperament: 'Nervous', rating: 'poor' },
    { temperament: 'Spirited', rating: 'good' },
  ],
  encouraging: [
    { temperament: 'Calm', rating: 'good' },
    { temperament: 'Bold', rating: 'good' },
    { temperament: 'Nervous', rating: 'excellent' },
    { temperament: 'Spirited', rating: 'good' },
  ],
  technical: [
    { temperament: 'Calm', rating: 'excellent' },
    { temperament: 'Bold', rating: 'good' },
    { temperament: 'Nervous', rating: 'poor' },
    { temperament: 'Spirited', rating: 'poor' },
  ],
  competitive: [
    { temperament: 'Calm', rating: 'poor' },
    { temperament: 'Bold', rating: 'excellent' },
    { temperament: 'Nervous', rating: 'poor' },
    { temperament: 'Spirited', rating: 'excellent' },
  ],
  patient: [
    { temperament: 'Calm', rating: 'good' },
    { temperament: 'Bold', rating: 'poor' },
    { temperament: 'Nervous', rating: 'excellent' },
    { temperament: 'Spirited', rating: 'good' },
  ],
};

const COMPATIBILITY_META = {
  excellent: { label: '↑↑ Excellent', colorClass: 'text-emerald-400 font-semibold' },
  good: { label: '↑ Good', colorClass: 'text-amber-400' },
  poor: { label: '– Poor', colorClass: 'text-white/40' },
};

interface TrainerPersonalityDisplayProps {
  personality: string;
  level?: number;
  compact?: boolean;
}

const TrainerPersonalityDisplay: React.FC<TrainerPersonalityDisplayProps> = ({
  personality,
  level = 1,
  compact = false,
}) => {
  const info = getTrainerPersonalityInfo(personality);
  const tendencies = DISCIPLINE_TENDENCIES[personality] ?? [];
  const compatibility = HORSE_COMPATIBILITY[personality] ?? [];

  if (compact) {
    return (
      <div
        className="text-xs space-y-1.5 p-3 rounded-lg bg-white/5 border border-white/10"
        data-testid="trainer-personality-display"
      >
        <p className="text-white/60 leading-relaxed">{info.description}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {tendencies
            .filter((t) => t.magnitude !== 'neutral')
            .map((t) => (
              <span
                key={t.discipline}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  t.magnitude === 'high'
                    ? 'bg-emerald-900/40 text-emerald-400'
                    : 'bg-amber-900/40 text-amber-400'
                }`}
              >
                {t.discipline}
              </span>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="trainer-personality-display">
      {/* Description */}
      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{info.icon}</span>
          <span className="text-sm font-semibold text-white/90">{info.label} Trainer</span>
        </div>
        <p className="text-sm text-white/60 leading-relaxed">{info.description}</p>
        {level >= 5 && (
          <p className="text-xs text-celestial-gold/80 mt-2 italic">
            Veteran trainer — secondary discipline affinities revealed at this level.
          </p>
        )}
      </div>

      {/* Discipline Tendencies */}
      <div>
        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
          Discipline Tendencies
        </h4>
        <div className="space-y-1.5">
          {tendencies.map((t) => (
            <div key={t.discipline} className="flex items-center justify-between text-sm">
              <span className="text-white/70">{t.discipline}</span>
              <span
                className={
                  t.magnitude === 'high'
                    ? 'text-emerald-400 font-semibold'
                    : t.magnitude === 'medium'
                      ? 'text-amber-400'
                      : 'text-white/40'
                }
              >
                {t.magnitude === 'high'
                  ? '↑↑ Strong'
                  : t.magnitude === 'medium'
                    ? '↑ Moderate'
                    : '– Neutral'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Horse Compatibility */}
      <div>
        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
          Horse Temperament Fit
        </h4>
        <div className="space-y-1.5">
          {compatibility.map((c) => {
            const meta = COMPATIBILITY_META[c.rating];
            return (
              <div key={c.temperament} className="flex items-center justify-between text-sm">
                <span className="text-white/70">{c.temperament}</span>
                <span className={`font-medium ${meta.colorClass}`}>{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TrainerPersonalityDisplay;
