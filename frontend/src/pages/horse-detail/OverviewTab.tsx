/**
 * OverviewTab — current-status grid + trait chips.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import { formatDate } from '@/lib/formatDate';
import { Surface } from '@/components/ui/Surface';
import type { Horse } from './HorseDetailPageTypes';

const OverviewTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-6" data-testid="horse-detail-overview">
    <div>
      <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">Current Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Surface variant="subtle" className="p-4">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Health Status</p>
          <p className="fantasy-body text-[var(--text-primary)]">{horse.healthStatus}</p>
        </Surface>
        <Surface variant="subtle" className="p-4">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Age</p>
          <p className="fantasy-body text-[var(--text-primary)]">{horse.age} years old</p>
        </Surface>
        <Surface variant="subtle" className="p-4">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Date of Birth</p>
          <p className="fantasy-body text-[var(--text-primary)]">
            {formatDate(
              horse.dateOfBirth,
              { month: 'long', day: 'numeric', year: 'numeric' },
              'Not recorded'
            )}
          </p>
        </Surface>
        <Surface variant="subtle" className="p-4">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Gender</p>
          <p className="fantasy-body text-[var(--text-primary)] capitalize">{horse.gender}</p>
        </Surface>
      </div>
    </div>

    {horse.traits && horse.traits.length > 0 && (
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">Traits</h3>
        <div className="flex flex-wrap gap-2">
          {horse.traits.map((trait, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-burnished-gold/20 text-[var(--text-primary)] rounded-full text-sm fantasy-body border border-burnished-gold/40"
            >
              {trait}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default OverviewTab;
