/**
 * BreedingPage — The Breeding Hall
 *
 * Design-system migration (Equoria-o5hub.21, training/breeding/competition
 * family): operational workflow page → PageHeader, PageContainer wide
 * replaces the local max-w wrappers, Surface for the unauthenticated panel,
 * SectionLoading for the auth-resolution state.
 */

import { Heart } from 'lucide-react';
import BreedingPairSelection from '@/pages/breeding/BreedingPairSelection';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { SectionLoading } from '@/components/ui/state';
import { useAuth } from '@/contexts/AuthContext';

const BreedingPage = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <PageContainer variant="wide" data-testid="breeding-page">
        <SectionLoading label="Opening the Breeding Hall…" minHeight="240px" />
      </PageContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageContainer variant="wide" data-testid="breeding-page">
        <Surface variant="panel" className="text-center">
          <Heart className="w-10 h-10 mx-auto mb-3 text-[var(--gold-400)] opacity-40" />
          <p className="text-sm text-[var(--text-primary)]">
            Please log in to enter the Breeding Hall.
          </p>
        </Surface>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="wide" padded={false} className="pb-12" data-testid="breeding-page">
      <PageHeader
        title="Breeding Hall"
        subtitle="Select a pairing and shape the next generation. Genetics and destiny intertwine here."
        icon={<Heart className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="mt-6">
        <BreedingPairSelection userId={user?.id ?? undefined} />
      </div>
    </PageContainer>
  );
};

export default BreedingPage;
