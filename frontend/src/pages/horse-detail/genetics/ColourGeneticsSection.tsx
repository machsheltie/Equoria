/**
 * ColourGeneticsSection: the horse's colour genotype, locus by locus.
 *
 * Owner ruling 2026-10-26 (q72): colour genetics stay hidden until the player
 * pays for the Veterinarian's Genetic Testing. The server withholds the
 * genotype for an untested horse (Equoria-8tz7p); this section shows an
 * invitation instead. Locus names are authored labels, never stored codes.
 */

import React from 'react';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/ui/state';
import { useHorseCoatGenetics } from '@/hooks/useHorseCoatGenetics';

/** Authored name and meaning for each locus, keyed by the stored locus id. */
const LOCI: Record<string, { label: string; meaning: string }> = {
  E_Extension: {
    label: 'Extension',
    meaning: 'Controls black versus red base coat (E dominant, e recessive).',
  },
  A_Agouti: {
    label: 'Agouti',
    meaning: 'Restricts black pigment to mane, tail and legs (bay versus black).',
  },
  Cr_Cream: {
    label: 'Cream',
    meaning: 'Dilutes red and black pigment (palomino, buckskin, cremello).',
  },
  D_Dun: { label: 'Dun', meaning: 'Primitive markings with body dilution.' },
  Z_Silver: { label: 'Silver', meaning: 'Dilutes black pigment only.' },
  Ch_Champagne: {
    label: 'Champagne',
    meaning: 'Soft body dilution with mottled skin and light eyes.',
  },
  G_Gray: { label: 'Gray', meaning: 'Progressive loss of pigment with age (dominant).' },
  Rn_Roan: {
    label: 'Roan',
    meaning: 'White hairs mixed through the body; head and legs stay dark.',
  },
  W_DominantWhite: {
    label: 'Dominant White',
    meaning: 'Large patches of unpigmented skin and hair.',
  },
  TO_Tobiano: { label: 'Tobiano', meaning: 'Vertical white spotting that crosses the topline.' },
  O_FrameOvero: {
    label: 'Frame Overo',
    meaning: 'Horizontal white spotting (lethal when homozygous).',
  },
  SB1_Sabino1: {
    label: 'Sabino',
    meaning: 'Irregular white edges, belly spots and leg markings.',
  },
  SW_SplashWhite: { label: 'Splash White', meaning: 'A dipped-in-paint pattern with blue eyes.' },
  LP_LeopardComplex: { label: 'Leopard Complex', meaning: 'The Appaloosa spotting base gene.' },
  PATN1_Pattern1: { label: 'Leopard Pattern', meaning: 'Changes the extent of leopard spotting.' },
  EDXW: { label: 'Extreme White', meaning: 'A variant giving large white coverage.' },
  MFSD12_Mushroom: { label: 'Mushroom', meaning: 'A sepia-toned recessive dilution of red.' },
};

/** A locus this table does not know reads as its name with the code prefix dropped. */
function locusLabel(locus: string): string {
  return (
    LOCI[locus]?.label ?? locus.replace(/^[A-Za-z0-9]+_/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
  );
}

const ColourGeneticsSection: React.FC<{ horseId: number | string }> = ({ horseId }) => {
  const query = useHorseCoatGenetics(horseId);

  return (
    <section data-testid="colour-genetics-section">
      <h3 className="type-section-heading mb-3">Colour Genetics</h3>
      {query.isLoading && (
        <div role="status" className="flex items-center gap-2 py-4 text-[var(--text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Loading colour genetics...</span>
        </div>
      )}
      {query.isError && (
        <ErrorState
          message="Could not load colour genetics."
          retry={{ label: 'Try Again', onClick: () => query.refetch() }}
        />
      )}
      {query.isSuccess && query.data === null && (
        <p className="text-[var(--text-secondary)]">
          No colour genetics are recorded for this horse.
        </p>
      )}
      {query.isSuccess && query.data && !query.data.colorGeneticsTested && (
        <p data-testid="colour-genetics-untested" className="text-[var(--text-secondary)]">
          This horse&apos;s colour genetics are a secret until they are tested. The Veterinarian
          offers Genetic Testing.{' '}
          <Link to="/vet" className="text-[var(--gold-primary)] underline">
            Visit the Vet Clinic
          </Link>
        </p>
      )}
      {query.isSuccess && query.data && query.data.colorGeneticsTested && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" data-testid="colour-genotype-table">
            <thead>
              <tr className="text-left text-[var(--text-secondary)]">
                <th className="px-3 py-2">Gene</th>
                <th className="px-3 py-2">Alleles</th>
                <th className="px-3 py-2">What it does</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(query.data.colorGenotype).map(([locus, alleles]) => (
                <tr key={locus} className="border-t border-[var(--frosted-border)]">
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-medium text-[var(--text-primary)]"
                  >
                    {locusLabel(locus)}
                  </th>
                  <td className="px-3 py-2 font-mono text-[var(--gold-primary)]">
                    {String(alleles)}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {LOCI[locus]?.meaning ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ColourGeneticsSection;
