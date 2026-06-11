/**
 * TrainingPage — World > Training Grounds Location
 *
 * Design-system migration (Equoria-o5hub.21, training/breeding/competition
 * family): operational workflow page → PageHeader (no location artwork),
 * PageContainer wide replaces the local max-w wrappers, Surface for the
 * info panel, SectionLoading for the auth-resolution state.
 */

import { Link } from 'react-router-dom';
import { Swords } from 'lucide-react';
import TrainingDashboard from '@/components/training/TrainingDashboard';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { SectionLoading } from '@/components/ui/state';
import { useAuth } from '@/contexts/AuthContext';

const TrainingPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer variant="wide" data-testid="training-page">
        <SectionLoading label="Entering the Training Grounds…" minHeight="240px" />
      </PageContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageContainer variant="wide" data-testid="training-page">
        <Surface variant="panel" className="text-center">
          <Swords className="w-10 h-10 mx-auto mb-3 text-[var(--gold-400)] opacity-40" />
          <p className="text-sm text-[var(--text-primary)]">
            Please log in to access the Training Grounds.
          </p>
        </Surface>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="wide" padded={false} className="pb-8" data-testid="training-page">
      <PageHeader
        title="Training Grounds"
        subtitle="Hone your horses' skills across 23 disciplines. Each session pushes them closer to their potential."
        icon={<Swords className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
        breadcrumbs={
          <nav aria-label="Breadcrumb" className="flex items-center gap-2">
            <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
              World
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--text-primary)]">Training Grounds</span>
          </nav>
        }
      />

      <div className="mt-6">
        {/* Training Dashboard */}
        <TrainingDashboard userId={user?.id ? String(user.id) : undefined} />
      </div>

      {/* Info Panel */}
      <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
        <h3 className="font-semibold text-[var(--text-primary)] mb-2">
          About the Training Grounds
        </h3>
        <ul className="space-y-1 list-disc list-inside">
          <li>Horses must be at least 3 years old before they can begin formal training</li>
          <li>Each discipline has a 7-day global cooldown to prevent stat stacking</li>
          <li>Training improves the primary stats associated with each discipline</li>
          <li>Injured horses cannot train — visit the Farrier or Vet first</li>
          <li>Consistent training over time unlocks higher performance ceilings in competition</li>
        </ul>
      </Surface>
    </PageContainer>
  );
};

export default TrainingPage;
