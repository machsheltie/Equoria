/**
 * TraitDetailModal Component
 *
 * Comprehensive modal displaying full trait details including description,
 * epigenetic flags, discovery information, history timeline, and competition
 * impact analysis.
 *
 * Story 6-6: Epigenetic Trait System
 */

import React from 'react';
import { Calendar, Info } from 'lucide-react';
import BaseModal from '@/components/common/BaseModal';
import EpigeneticFlagBadge from './EpigeneticFlagBadge';
import TraitHistoryTimeline from './TraitHistoryTimeline';
import CompetitionImpactPanel from './CompetitionImpactPanel';
import type { EpigeneticTrait, TraitHistory } from '@/types/traits';
import { getTierStyle, getTierDisplayName, getDiscoveryStatusDisplay } from '@/types/traits';

export interface TraitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  trait: EpigeneticTrait;
  traitHistory?: TraitHistory;
}

/**
 * TraitDetailModal Component
 */
const TraitDetailModal: React.FC<TraitDetailModalProps> = ({
  isOpen,
  onClose,
  trait,
  traitHistory,
}) => {
  const tierStyle = getTierStyle(trait.tier);
  const discoveryStatus = getDiscoveryStatusDisplay(trait.discoveryStatus);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={trait.name}
      size="xl"
      className="trait-detail-modal"
    >
      <div className="space-y-6">
        {/* Trait Header */}
        <div
          className={`rounded-lg border-2 ${tierStyle.borderColor} ${tierStyle.bgColor} p-6 relative overflow-hidden`}
        >
          {/* Decorative shine effect for ultra-rare and exotic */}
          {(trait.tier === 'ultra-rare' || trait.tier === 'exotic') && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          )}

          <div className="relative">
            {/* Tier Badge */}
            <div className="flex items-center justify-between mb-3">
              <span
                className={`inline-block px-3 py-1 text-sm font-bold uppercase tracking-wide ${tierStyle.badgeColor} rounded`}
              >
                {getTierDisplayName(trait.tier)}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${discoveryStatus.color}`}>
                  {discoveryStatus.icon} {discoveryStatus.label}
                </span>
              </div>
            </div>

            {/* Category */}
            <div className="mb-3">
              <span className="text-sm font-medium text-slate-600 bg-white/50 px-3 py-1 rounded">
                {trait.category}
              </span>
            </div>

            {/* Description */}
            <p className="text-base text-slate-700 leading-relaxed mb-4">{trait.description}</p>

            {/* Epigenetic Flags */}
            {trait.epigeneticFlags.length > 0 && (
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">Epigenetic Factors:</p>
                <div className="flex flex-wrap gap-2">
                  {trait.epigeneticFlags.map((flag, index) => (
                    <EpigeneticFlagBadge
                      key={index}
                      flag={flag}
                      size="medium"
                      showLabel={true}
                      showTooltip={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Discovery Information */}
        {trait.discoveredAt && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-900 mb-1">Discovery Information</p>
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Discovered:</span>{' '}
                  {new Date(trait.discoveredAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {trait.discoverySource && (
                  <p className="text-sm text-blue-700 mt-1">
                    <span className="font-medium">Source:</span>{' '}
                    {trait.discoverySource
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Competition Impact */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-slate-600" />
            Competition Impact
          </h3>
          <CompetitionImpactPanel trait={trait} showSynergies={true} />
        </div>

        {/* Trait History */}
        {traitHistory && traitHistory.events.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-600" />
              Trait History
            </h3>
            <TraitHistoryTimeline history={traitHistory} />
          </div>
        )}

        {/* Trait Type Indicator */}
        <div
          className={`rounded-lg border p-4 ${
            trait.isPositive ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              trait.isPositive ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {trait.isPositive ? '✓ Beneficial Trait' : '✕ Detrimental Trait'}
          </p>
          <p className={`text-sm mt-1 ${trait.isPositive ? 'text-green-700' : 'text-red-700'}`}>
            This trait {trait.isPositive ? 'provides benefits' : 'presents challenges'} for your
            horse's development and competition performance.
          </p>
        </div>
      </div>
    </BaseModal>
  );
};

export default TraitDetailModal;
