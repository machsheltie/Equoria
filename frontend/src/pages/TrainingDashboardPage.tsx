/**
 * Training Dashboard Page
 *
 * Page-level component that wraps the TrainingDashboard component with:
 * - Proper navigation with breadcrumbs
 * - SEO metadata (document title)
 * - Semantic HTML structure
 * - Responsive layout matching existing page patterns
 * - Authentication gating
 *
 * Story 4-2: Training Eligibility Display - Task 5
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Home, Dumbbell, ArrowLeft } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useAuth } from '@/contexts/AuthContext';
import TrainingSummaryCards from '@/components/training/TrainingSummaryCards';
import TrainingDashboardTable from '@/components/training/TrainingDashboardTable';
import TrainingRecommendations from '@/components/training/TrainingRecommendations';
import DashboardFilters, { StatusFilter } from '@/components/training/DashboardFilters';

/**
 * Props for TrainingDashboardPage component
 */
export interface TrainingDashboardPageProps {
  /**
   * Optional className for additional styling
   */
  className?: string;
}

/**
 * Breadcrumb item interface
 */
interface BreadcrumbItem {
  label: string;
  to?: string;
  isCurrentPage?: boolean;
}

/**
 * Breadcrumb Navigation Component
 */
const Breadcrumb = ({ items }: { items: BreadcrumbItem[] }) => (
  <nav
    aria-label="Breadcrumb navigation"
    data-testid="breadcrumb-nav"
    className="flex items-center space-x-2 text-sm text-[rgb(148,163,184)]"
  >
    {items.map((item, index) => (
      <div key={item.label} className="flex items-center">
        {index > 0 && (
          <ChevronRight className="mx-2 h-4 w-4 text-[rgb(148,163,184)]" aria-hidden="true" />
        )}
        {item.to && !item.isCurrentPage ? (
          <Link
            to={item.to}
            className="flex items-center hover:text-[rgb(220,235,255)] hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            aria-label={`Navigate to ${item.label}`}
          >
            {index === 0 && <Home className="mr-1 h-4 w-4" aria-hidden="true" />}
            {item.label}
          </Link>
        ) : (
          <span
            aria-current="page"
            className="flex items-center font-medium text-[rgb(220,235,255)]"
          >
            {item.label}
          </span>
        )}
      </div>
    ))}
  </nav>
);

/**
 * TrainingDashboardPage Component
 *
 * Renders the training dashboard with proper page structure including:
 * - SEO document title
 * - Breadcrumb navigation
 * - Page header with title and description
 * - TrainingDashboard component
 * - Authentication protection
 */
const TrainingDashboardPage = ({ className = '' }: TrainingDashboardPageProps): JSX.Element => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // SEO: Set document title on mount and clean up on unmount
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Training Dashboard - Equoria';

    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', to: '/' },
    { label: 'Training Dashboard', isCurrentPage: true },
  ];

  // State for filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle back navigation
  const handleBackNavigation = () => {
    navigate(-1);
  };

  // Handle training (Story 4.5 - mock implementation for now, real API in Story 4.7)
  const handleTrain = (horseId: number) => {
    // TODO: Story 4.7 will implement actual training flow
    console.log('Training horse:', horseId);
    // In production, this will navigate to training session interface
  };

  // Mock data for development (Story 4.5 - will be replaced with real API data)
  const allMockHorses = useMemo(
    () => [
      { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const },
      { id: 2, name: 'Lightning', age: 4, trainingStatus: 'cooldown' as const },
      { id: 3, name: 'Storm', age: 2, trainingStatus: 'ineligible' as const },
      { id: 4, name: 'Blaze', age: 6, trainingStatus: 'ready' as const },
      { id: 5, name: 'Spirit', age: 3, trainingStatus: 'cooldown' as const },
      { id: 6, name: 'Shadow', age: 1, trainingStatus: 'ineligible' as const },
      { id: 7, name: 'Midnight', age: 7, trainingStatus: 'ready' as const },
      { id: 8, name: 'Star', age: 5, trainingStatus: 'cooldown' as const },
    ],
    []
  );

  // Filter horses based on status and search
  const filteredHorses = useMemo(() => {
    return allMockHorses.filter((horse) => {
      const matchesStatus = statusFilter === 'all' || horse.trainingStatus === statusFilter;
      const matchesSearch = horse.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [allMockHorses, statusFilter, searchQuery]);

  // Calculate summary
  const mockSummary = useMemo(
    () => ({
      readyCount: allMockHorses.filter((h) => h.trainingStatus === 'ready').length,
      cooldownCount: allMockHorses.filter((h) => h.trainingStatus === 'cooldown').length,
      ineligibleCount: allMockHorses.filter((h) => h.trainingStatus === 'ineligible').length,
      totalHorses: allMockHorses.length,
    }),
    [allMockHorses]
  );

  // Loading state
  if (isLoading) {
    return (
      <main
        className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${className}`}
        data-testid="loading-state"
        role="status"
        aria-label="Loading authentication"
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgba(37,99,235,0.3)] border-t-blue-500 mx-auto mb-4" />
            <p className="text-sm text-[rgb(148,163,184)]">Checking authentication...</p>
          </div>
        </div>
      </main>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <main
        className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${className}`}
        data-testid="unauthenticated-state"
      >
        <div
          className="rounded-md border border-amber-500/30 bg-[rgba(212,168,67,0.1)] px-4 py-3 text-sm text-amber-400 shadow-sm"
          role="alert"
        >
          Please log in to access the training dashboard.
        </div>
      </main>
    );
  }

  return (
    <div className={`min-h-screen ${className}`} data-testid="training-dashboard-page">
      <PageHero
        title="Training Dashboard"
        subtitle="Manage your horses' training sessions, track eligibility status, and monitor progress across all disciplines."
        mood="default"
        icon={<Dumbbell className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      >
        <div className="flex items-center justify-between">
          <Breadcrumb items={breadcrumbItems} />
          <div className="sm:hidden">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="flex items-center text-sm text-[var(--text-muted)] hover:text-[var(--cream)] transition-colors rounded"
              aria-label="Go back to previous page"
              data-testid="back-button"
            >
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Back
            </button>
          </div>
        </div>
      </PageHero>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
        {/* Training Dashboard Components */}
        <section aria-label="Training dashboard content">
          {/* Summary Cards */}
          <div className="mb-6">
            <TrainingSummaryCards summary={mockSummary} />
          </div>

          {/* Filters */}
          <div className="mb-6">
            <DashboardFilters
              statusFilter={statusFilter}
              searchQuery={searchQuery}
              onStatusFilterChange={setStatusFilter}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Main Dashboard Table */}
          <div className="mb-8">
            <TrainingDashboardTable horses={filteredHorses} onTrain={handleTrain} />
          </div>

          {/* Training Recommendations */}
          <div>
            <TrainingRecommendations horses={allMockHorses} />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-[rgb(148,163,184)]">
            &copy; {new Date().getFullYear()} Equoria. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default TrainingDashboardPage;
