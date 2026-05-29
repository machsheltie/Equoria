/**
 * PedigreeTab — sire / dam / offspring family-tree summary.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import type { Horse } from './HorseDetailPageTypes';

const PedigreeTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const hasSire = Boolean(horse.parentIds?.sireId);
  const hasDam = Boolean(horse.parentIds?.damId);

  return (
    <div className="space-y-6" data-testid="pedigree-tab">
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">Family Tree</h3>
        <p className="fantasy-body text-[var(--text-secondary)] text-sm mb-6">
          Parentage and bloodline information for {horse.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sire */}
        <div
          className="p-5 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]"
          data-testid="pedigree-sire"
        >
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
            Sire (Father)
          </p>
          {hasSire ? (
            <Link
              to={`/horses/${horse.parentIds!.sireId}`}
              className="fantasy-title text-lg text-burnished-gold hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              View Sire Profile
            </Link>
          ) : (
            <p className="fantasy-title text-lg text-[var(--text-secondary)]">Store Horse</p>
          )}
        </div>

        {/* Dam */}
        <div
          className="p-5 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]"
          data-testid="pedigree-dam"
        >
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
            Dam (Mother)
          </p>
          {hasDam ? (
            <Link
              to={`/horses/${horse.parentIds!.damId}`}
              className="fantasy-title text-lg text-burnished-gold hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              View Dam Profile
            </Link>
          ) : (
            <p className="fantasy-title text-lg text-[var(--text-secondary)]">Store Horse</p>
          )}
        </div>
      </div>

      {/* Offspring section — future expansion */}
      <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)]">
        <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">
          Offspring
        </p>
        <p className="fantasy-body text-[var(--text-secondary)] text-sm italic">
          Offspring records are displayed once this horse has produced foals through the breeding
          system.
        </p>
      </div>
    </div>
  );
};

export default PedigreeTab;
