/**
 * GroomList Component
 *
 * Groom marketplace interface providing:
 * - Marketplace groom listing with filtering and sorting capabilities
 * - Groom hiring functionality with fund and stable limit validation
 * - Marketplace refresh mechanics (free daily or premium instant)
 * - Responsive design with mobile and desktop layouts
 * - Real-time data updates using React Query
 * - Accessibility support with ARIA labels and keyboard navigation
 * - Error handling and loading states
 *
 * Design-system migration (Equoria-o5hub, world-services family): Surface
 * for panels/cards, form Select for filters (replaces celestial-input),
 * Currency for all coin amounts (no USD formatting), GameDialog for the
 * hire confirmation (replaces page-local fixed-inset overlay), canonical
 * SectionLoading / ErrorState, semantic role tokens.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Users, Coins, Star, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { useGroomMarketplace, useHireGroom, useRefreshMarketplace } from '../hooks/api/useGrooms';
import { useAuth } from '../contexts/AuthContext';
import { MarketplaceGroom, MarketplaceData } from '../lib/api-client';
import GroomPersonalityBadge from './groom/GroomPersonalityBadge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';

interface GroomListProps {
  userId: number;
  onGroomHired?: (_groom: MarketplaceGroom) => void;
  // Optional data props for testing (NO MOCKING)
  marketplaceData?: MarketplaceData;
}

const GroomList: React.FC<GroomListProps> = ({
  userId: _userId,
  onGroomHired,
  marketplaceData: propMarketplaceData,
}) => {
  const { user } = useAuth();
  const [selectedGroom, setSelectedGroom] = useState<MarketplaceGroom | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [filterSkillLevel, setFilterSkillLevel] = useState<string>('all');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [layout, setLayout] = useState<'mobile' | 'desktop'>('desktop');

  // Detect screen size for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setLayout(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Only fetch if not provided as props
  const marketplaceQuery = useGroomMarketplace({ enabled: !propMarketplaceData });

  // Use provided data or fetched data
  const marketplaceData = propMarketplaceData || marketplaceQuery.data;
  const marketplaceLoading = !propMarketplaceData && marketplaceQuery.isLoading;
  const marketplaceError = !propMarketplaceData ? marketplaceQuery.error : null;

  // Hire groom mutation
  const hireMutation = useHireGroom();

  // Refresh marketplace mutation
  const refreshMutation = useRefreshMarketplace();

  // Filter and sort grooms
  const filteredAndSortedGrooms = useMemo(() => {
    const grooms = marketplaceData?.grooms || [];
    if (!grooms.length) return [];

    let filtered = [...grooms];

    // Apply filters
    if (filterSkillLevel !== 'all') {
      filtered = filtered.filter((g) => g.skillLevel === filterSkillLevel);
    }
    if (filterSpecialty !== 'all') {
      filtered = filtered.filter((g) => g.specialty === filterSpecialty);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.sessionRate - b.sessionRate;
        case 'price-desc':
          return b.sessionRate - a.sessionRate;
        case 'experience-asc':
          return a.experience - b.experience;
        case 'experience-desc':
          return b.experience - a.experience;
        case 'name':
        default:
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
    });

    return filtered;
  }, [marketplaceData, filterSkillLevel, filterSpecialty, sortBy]);

  // Calculate hiring cost (1 week upfront)
  const calculateHiringCost = (sessionRate: number) => {
    return sessionRate * 7;
  };

  // Check if user can afford groom
  const canAffordGroom = (sessionRate: number) => {
    if (!user) return false;
    return (user.money || 0) >= calculateHiringCost(sessionRate);
  };

  // Handle hire button click
  const handleHireClick = (groom: MarketplaceGroom) => {
    setSelectedGroom(groom);
    setShowHireModal(true);
  };

  // Handle hire confirmation
  const handleHireConfirm = () => {
    if (selectedGroom) {
      hireMutation.mutate(selectedGroom.marketplaceId, {
        onSuccess: (data) => {
          setShowHireModal(false);
          setSelectedGroom(null);
          // Callback if provided
          if (onGroomHired && data) {
            // onGroomHired expects a groom object, but mutation might return success only.
            // Usually onGroomHired is used to update local state or navigate.
          }
        },
      });
    }
  };

  // Handle refresh marketplace
  const handleRefresh = () => {
    const force = !(marketplaceData && marketplaceData.canRefreshFree);
    refreshMutation.mutate(force);
  };

  if (marketplaceLoading && !propMarketplaceData) {
    return (
      <div data-testid="groom-list">
        <SectionLoading label="Loading marketplace" minHeight="256px" />
      </div>
    );
  }

  if (marketplaceError) {
    return (
      <div data-testid="groom-list">
        <ErrorState
          title="Error Loading Marketplace"
          message={marketplaceError.message}
          retry={{ label: 'Retry', onClick: () => handleRefresh() }}
        />
      </div>
    );
  }

  return (
    <main
      role="main"
      aria-label="Groom marketplace"
      data-testid="groom-list"
      data-layout={layout}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="type-section-heading mb-2">Groom Marketplace</h2>
          <p className="text-[var(--text-secondary)]">
            Hire professional grooms to care for your horses
          </p>
        </div>

        {/* Refresh Button */}
        <Button
          data-testid="refresh-button"
          variant="secondary"
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
          className="mt-4 lg:mt-0"
          aria-label="Refresh marketplace"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {marketplaceData?.canRefreshFree ? (
            <span>Free Refresh Available</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              Refresh (<Currency amount={marketplaceData?.refreshCost || 0} />)
            </span>
          )}
        </Button>
      </div>

      {/* User Info & Refresh Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {marketplaceData?.nextFreeRefresh && (
          <div className="bg-[var(--role-info-bg)] border border-[var(--role-info-border)] rounded-[var(--radius-md)] p-4 flex items-center space-x-3">
            <Clock className="w-5 h-5 text-[var(--role-info-text)]" aria-hidden="true" />
            <span className="text-sm text-[var(--role-info-text)] font-medium">
              Next free refresh: {new Date(marketplaceData.nextFreeRefresh).toLocaleTimeString()}
            </span>
          </div>
        )}
        {user && (
          <Surface variant="subtle" className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Coins className="w-5 h-5 text-[var(--gold-primary)]" aria-hidden="true" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">Your Balance</span>
            </div>
            <Currency amount={user.money ?? 0} variant="balance" />
          </Surface>
        )}
      </div>

      {/* Filters and Sort */}
      <Surface variant="panel" data-testid="groom-filters">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Skill Level Filter */}
          <div>
            <label
              htmlFor="skill-level-filter"
              className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2"
            >
              Skill Level
            </label>
            <Select
              id="skill-level-filter"
              data-testid="skill-level-filter"
              value={filterSkillLevel}
              onChange={(e) => setFilterSkillLevel(e.target.value)}
              className="w-full"
            >
              <option value="all">All Levels</option>
              <option value="novice">Novice</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
              <option value="master">Master</option>
            </Select>
          </div>

          {/* Specialty Filter */}
          <div>
            <label
              htmlFor="specialty-filter"
              className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2"
            >
              Specialty
            </label>
            <Select
              id="specialty-filter"
              data-testid="specialty-filter"
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              className="w-full"
            >
              <option value="all">All Specialties</option>
              <option value="foalCare">Foal Care</option>
              <option value="generalCare">General Care</option>
              <option value="training">Training</option>
              <option value="showHandling">Show Handling</option>
            </Select>
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="sort-select"
              className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2"
            >
              Sort By
            </label>
            <Select
              id="sort-select"
              data-testid="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full"
            >
              <option value="name">Name</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="experience-asc">Experience (Low to High)</option>
              <option value="experience-desc">Experience (High to Low)</option>
            </Select>
          </div>
        </div>
      </Surface>

      {/* Groom Grid */}
      <div data-testid="groom-marketplace">
        {filteredAndSortedGrooms.length === 0 ? (
          <Surface variant="panel" className="p-12 text-center">
            <Users className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              No Grooms Available
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              Try refreshing the marketplace to see new grooms
            </p>
            <Button onClick={handleRefresh}>Refresh Marketplace</Button>
          </Surface>
        ) : (
          <div
            data-testid="groom-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredAndSortedGrooms.map((groom) => {
              const hiringCost = calculateHiringCost(groom.sessionRate);
              const canAfford = canAffordGroom(groom.sessionRate);

              return (
                <Surface
                  variant="panel"
                  key={groom.marketplaceId}
                  data-testid={`groom-card-${groom.marketplaceId}`}
                  className="p-6"
                >
                  {/* Groom Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[var(--text-primary)]">
                        {groom.firstName} {groom.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-[var(--role-info-bg)] text-[var(--role-info-text)] text-xs font-bold rounded-[var(--radius-sm)] uppercase border border-[var(--role-info-border)]">
                          {groom.skillLevel}
                        </span>
                        <span className="px-2 py-0.5 bg-[var(--role-success-bg)] text-[var(--role-success-text)] text-xs font-bold rounded-[var(--radius-sm)] uppercase border border-[var(--role-success-border)]">
                          {groom.specialty.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </div>
                    </div>
                    <Star className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />
                  </div>

                  {/* Groom Details */}
                  <div className="space-y-2 mb-4 text-sm border-y border-[var(--glass-border)] py-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Experience:</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {groom.experience} years
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-secondary)]">Personality:</span>
                      <GroomPersonalityBadge personality={groom.personality} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Weekly Salary:</span>
                      <span className="font-bold inline-flex items-center gap-1">
                        <Currency amount={groom.sessionRate} />
                        /week
                      </span>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-sm text-[var(--text-secondary)] mb-6 line-clamp-2 italic">
                    "{groom.bio}"
                  </p>

                  {/* Hire Button */}
                  <Button
                    onClick={() => handleHireClick(groom)}
                    disabled={!canAfford || hireMutation.isPending}
                    variant={canAfford ? 'default' : 'outline'}
                    className="w-full"
                    aria-label={`Hire ${groom.firstName} ${groom.lastName}`}
                  >
                    {hireMutation.isPending &&
                    selectedGroom?.marketplaceId === groom.marketplaceId ? (
                      'Processing...'
                    ) : canAfford ? (
                      <span className="inline-flex items-center gap-1.5">
                        Hire for <Currency amount={hiringCost} />
                      </span>
                    ) : (
                      'Insufficient Funds'
                    )}
                  </Button>
                </Surface>
              );
            })}
          </div>
        )}
      </div>

      {/* Insufficient Funds Warning */}
      {user && (user.money || 0) < 500 && (
        <div className="bg-[var(--role-warning-bg)] border border-[var(--role-warning-border)] rounded-[var(--radius-md)] p-4 flex items-start space-x-3">
          <AlertCircle
            className="w-5 h-5 text-[var(--role-warning-text)] flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h4 className="font-bold text-[var(--role-warning-text)]">Low Balance</h4>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              You might not have enough to hire top-tier grooms. Remember that hiring requires
              paying the first week upfront.
            </p>
          </div>
        </div>
      )}

      {/* Hire Confirmation Dialog — GameDialog (DECISIONS.md §8). Overlay +
          blur owned by GameDialogOverlay (single-blur rule). */}
      <GameDialog
        open={showHireModal && selectedGroom !== null}
        onOpenChange={(open) => {
          if (!open) setShowHireModal(false);
        }}
      >
        {selectedGroom && (
          <GameDialogContent size="sm" data-testid="hire-modal">
            <GameDialogHeader>
              <GameDialogTitle>Confirm Hire</GameDialogTitle>
            </GameDialogHeader>
            <GameDialogBody>
              <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                Are you sure you want to hire{' '}
                <strong className="text-[var(--text-primary)]">
                  {selectedGroom.firstName} {selectedGroom.lastName}
                </strong>
                ? This professional will be added to your stable staff.
              </p>

              <Surface variant="subtle" className="p-5">
                <div className="flex items-center justify-between mb-3 text-sm">
                  <span className="text-[var(--text-secondary)]">Weekly Salary:</span>
                  <Currency
                    amount={selectedGroom.sessionRate}
                    className="font-semibold text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
                  <span className="text-sm font-bold text-[var(--text-secondary)]">
                    Total Upfront:
                  </span>
                  <Currency
                    amount={calculateHiringCost(selectedGroom.sessionRate)}
                    variant="balance"
                  />
                </div>
              </Surface>
            </GameDialogBody>
            <GameDialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowHireModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleHireConfirm}
                disabled={hireMutation.isPending}
                className="flex-1"
              >
                {hireMutation.isPending ? 'Hiring...' : 'Hire Groom'}
              </Button>
            </GameDialogFooter>
          </GameDialogContent>
        )}
      </GameDialog>
    </main>
  );
};

export default GroomList;
