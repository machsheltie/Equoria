/**
 * OverviewTab — current-status grid + trait chips.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import type { Horse } from './HorseDetailPageTypes';

const OverviewTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-6" data-testid="horse-detail-overview">
    <div>
      <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">Current Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Health Status</p>
          <p className="fantasy-body text-[var(--text-primary)]">{horse.healthStatus}</p>
        </div>
        <div className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Age</p>
          <p className="fantasy-body text-[var(--text-primary)]">{horse.age} years old</p>
        </div>
        <div className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Date of Birth</p>
          <p className="fantasy-body text-[var(--text-primary)]">
            {typeof horse.dateOfBirth === 'string' && !isNaN(new Date(horse.dateOfBirth).getTime())
              ? new Date(horse.dateOfBirth).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not recorded'}
          </p>
        </div>
        <div className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Gender</p>
          <p className="fantasy-body text-[var(--text-primary)] capitalize">{horse.gender}</p>
        </div>
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
