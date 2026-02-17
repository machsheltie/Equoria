/**
 * GroomPersonalityDisplay Component
 *
 * Full personality panel displaying:
 * - Personality type icon and description
 * - Trait influences (which horse traits are boosted)
 * - Compatibility ratings with different horse temperaments
 * - Overall effectiveness rating
 * - Career development note
 *
 * Used in groom profile views and detail panels.
 */

import React from 'react';
import {
  getPersonalityInfo,
  compatibilityLabel,
  compatibilityColorClass,
  magnitudeColorClass,
  type CompatibilityRating,
  type TraitInfluence,
} from '../../types/groomPersonality';

interface GroomPersonalityDisplayProps {
  personality: string;
  /** Groom's years of experience (affects development note context) */
  experience?: number;
  /** Whether to show the full compatibility matrix or compact view */
  compact?: boolean;
}

const CompatibilityRow: React.FC<{ rating: CompatibilityRating }> = ({ rating }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-700">{rating.horseType}</span>
    <span
      className={`text-sm font-semibold ${compatibilityColorClass(rating.rating)}`}
      data-testid={`compatibility-${rating.horseType.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
    >
      {compatibilityLabel(rating.rating)}
    </span>
  </div>
);

const TraitInfluenceRow: React.FC<{ influence: TraitInfluence }> = ({ influence }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-700">{influence.trait}</span>
    <span
      className={`text-sm capitalize ${magnitudeColorClass(influence.magnitude)}`}
      data-testid={`trait-${influence.trait.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {influence.magnitude === 'high'
        ? '▲▲ High'
        : influence.magnitude === 'medium'
          ? '▲ Medium'
          : '● Low'}
    </span>
  </div>
);

const GroomPersonalityDisplay: React.FC<GroomPersonalityDisplayProps> = ({
  personality,
  experience = 0,
  compact = false,
}) => {
  const info = getPersonalityInfo(personality);

  const effectivenessColor =
    info.effectivenessRating === 'high'
      ? 'text-green-600 bg-green-50 border-green-200'
      : info.effectivenessRating === 'medium'
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : 'text-slate-600 bg-slate-50 border-slate-200';

  const experienceLabel =
    experience >= 10
      ? 'Veteran'
      : experience >= 5
        ? 'Experienced'
        : experience >= 2
          ? 'Developing'
          : 'Early Career';

  return (
    <div
      className="rounded-lg border border-slate-200 overflow-hidden"
      data-testid="personality-display"
      aria-label={`Personality display: ${info.label}`}
    >
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-3 ${info.colorClass}`}>
        <span className="text-2xl" role="img" aria-hidden="true">
          {info.icon}
        </span>
        <div>
          <h4 className="font-bold text-base" data-testid="personality-label">
            {info.label} Personality
          </h4>
          <p className="text-xs opacity-80" data-testid="personality-description">
            {info.description}
          </p>
        </div>
      </div>

      <div className="bg-white px-4 py-4 space-y-4">
        {/* Effectiveness Rating */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Overall Effectiveness</span>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full border capitalize ${effectivenessColor}`}
            data-testid="effectiveness-rating"
          >
            {info.effectivenessRating}
          </span>
        </div>

        {/* Trait Influences */}
        <div>
          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
            Trait Influences
          </h5>
          <div data-testid="trait-influences">
            {info.traitInfluences.map((influence) => (
              <TraitInfluenceRow key={influence.trait} influence={influence} />
            ))}
          </div>
        </div>

        {/* Compatibility Ratings (hidden in compact mode) */}
        {!compact && (
          <div>
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Horse Compatibility
            </h5>
            <div data-testid="compatibility-ratings">
              {info.compatibilityRatings.map((rating) => (
                <CompatibilityRow key={rating.horseType} rating={rating} />
              ))}
            </div>
          </div>
        )}

        {/* Career Development Note */}
        <div
          className="bg-slate-50 rounded-md p-3 border border-slate-100"
          data-testid="development-note"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Career Development
            {experience > 0 && (
              <span className="ml-2 normal-case font-normal text-slate-400">
                — {experienceLabel} ({experience} yr{experience !== 1 ? 's' : ''})
              </span>
            )}
          </p>
          <p className="text-sm text-slate-600">{info.developmentNote}</p>
        </div>
      </div>
    </div>
  );
};

export default GroomPersonalityDisplay;
