/**
 * PedigreeTab — sire / dam / offspring family-tree summary.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 * Equoria-oey96.55 (owner ruling 2026-10-23): the offspring are read from the
 * server and listed by name, each a link to that horse; a foal-less horse says
 * so only after the server has answered.
 */

import React from 'react';
import { Link } from 'react-router';
import { GitBranch } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import { useHorseOffspring } from '@/hooks/api/useHorses';
import { userMessageFor } from '@/lib/http/userMessage';
import type { Horse } from './HorseDetailPageTypes';

/** The Offspring section's four states: loading, error with retry, empty, list. */
const OffspringList: React.FC<{ horse: Horse }> = ({ horse }) => {
  const offspring = useHorseOffspring(horse.id);

  if (offspring.isPending) {
    return <SectionLoading label={`Loading ${horse.name}'s offspring`} minHeight="64px" />;
  }
  if (offspring.isError) {
    return (
      <ErrorState
        title="Couldn't load the offspring"
        message={userMessageFor(offspring.error).message}
        retry={{ label: 'Try Again', onClick: () => void offspring.refetch() }}
        focusOnMount={false}
      />
    );
  }
  if (offspring.data.length === 0) {
    return (
      <p className="fantasy-body text-[var(--text-secondary)] text-sm italic">
        {horse.name} has no foals yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label={`${horse.name}'s offspring`}>
      {offspring.data.map((foal) => (
        <li key={foal.id}>
          <Link
            to={`/horses/${foal.id}`}
            className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-[var(--gold-primary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <GitBranch className="w-4 h-4" aria-hidden="true" />
            {foal.name}
          </Link>
        </li>
      ))}
    </ul>
  );
};

const PedigreeTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const hasSire = Boolean(horse.parentIds?.sireId);
  const hasDam = Boolean(horse.parentIds?.damId);

  return (
    <div className="space-y-6" data-testid="pedigree-tab">
      <div>
        <h3 className="type-section-heading mb-3">Family Tree</h3>
        <p className="fantasy-body text-[var(--text-secondary)] text-sm mb-6">
          Parentage and bloodline information for {horse.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sire */}
        <Surface variant="subtle" className="p-5" data-testid="pedigree-sire">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
            Sire (Father)
          </p>
          {hasSire ? (
            <Link
              to={`/horses/${horse.parentIds!.sireId}`}
              className="font-semibold text-lg text-[var(--gold-primary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              View Sire Profile
            </Link>
          ) : (
            <p className="font-semibold text-lg text-[var(--text-secondary)]">Store Horse</p>
          )}
        </Surface>

        {/* Dam */}
        <Surface variant="subtle" className="p-5" data-testid="pedigree-dam">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
            Dam (Mother)
          </p>
          {hasDam ? (
            <Link
              to={`/horses/${horse.parentIds!.damId}`}
              className="font-semibold text-lg text-[var(--gold-primary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              View Dam Profile
            </Link>
          ) : (
            <p className="font-semibold text-lg text-[var(--text-secondary)]">Store Horse</p>
          )}
        </Surface>
      </div>

      {/* Offspring — real foals from GET /horses/:id/offspring (Equoria-oey96.55) */}
      <Surface variant="subtle" className="p-4" data-testid="pedigree-offspring">
        <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">
          Offspring
        </p>
        <OffspringList horse={horse} />
      </Surface>
    </div>
  );
};

export default PedigreeTab;
