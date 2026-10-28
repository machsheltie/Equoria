/**
 * GroomList Component
 *
 * Groom marketplace interface providing:
 * - Marketplace groom listing with filtering and sorting capabilities
 * - One-click groom hiring, fee on the button (owner ruling 2026-10-28, q230)
 * - Marketplace refresh mechanics (free daily or premium instant)
 * - Responsive design with mobile and desktop layouts
 * - Real-time data updates using React Query
 * - Accessibility support with ARIA labels and keyboard navigation
 * - Error handling and loading states
 *
 * Design-system migration (Equoria-o5hub, world-services family): Surface
 * for panels/cards, form Select for filters (replaces celestial-input),
 * Currency for all coin amounts (no USD formatting), GameDialog for the paid
 * refresh, canonical SectionLoading / ErrorState, semantic role tokens.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { formatTime } from '@/lib/formatDate';
import { Users, Coins, Star, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { useGroomMarketplace, useHireGroom, useRefreshMarketplace } from '../hooks/api/useGrooms';
import { useAuth } from '../contexts/AuthContext';
import { MarketplaceGroom, MarketplaceData } from '../lib/api-client';
import GroomPersonalityBadge from './groom/GroomPersonalityBadge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import { SectionLoading, ErrorState, InlineError } from '@/components/ui/state';
import { actionMessageFor, hireRefusalCodes, hireRefused } from '@/lib/http/actionMessage';
import { userMessageFor } from '@/lib/http/userMessage';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { groomSpecialtyTitle } from '@/lib/staffLabels';
import StaffLevelStars from '@/components/common/StaffLevelStars';
import { staffLevelLabel, staffLevelOrder } from '@/lib/staffLevels';

// Owner rulings 2026-10-28 (q226, q228): a groom costs their star level's price per
// week, however many horses; hiring charges that one week. The server sends it as
// weeklyFee on every offer.
const calculateHiringCost = (groom: MarketplaceGroom): number => groom.weeklyFee;

interface GroomListProps {
  onGroomHired?: (_groom: MarketplaceGroom) => void;
  // Optional data props for testing (NO MOCKING)
  marketplaceData?: MarketplaceData;
}

const GroomList: React.FC<GroomListProps> = ({
  onGroomHired,
  marketplaceData: propMarketplaceData,
}) => {
  const { user } = useAuth();
  // The groom the last Hire click was for: its card shows "Processing..." and any refusal.
  const [selectedGroom, setSelectedGroom] = useState<MarketplaceGroom | null>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [filterStarLevel, setFilterStarLevel] = useState<string>('all');
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
    if (filterStarLevel !== 'all') {
      filtered = filtered.filter((g) => g.starLevel === filterStarLevel);
    }
    if (filterSpecialty !== 'all') {
      filtered = filtered.filter((g) => g.specialty === filterSpecialty);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return calculateHiringCost(a) - calculateHiringCost(b);
        case 'price-desc':
          return calculateHiringCost(b) - calculateHiringCost(a);
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
  }, [marketplaceData, filterStarLevel, filterSpecialty, sortBy]);

  // Check if user can afford groom
  const canAffordGroom = (groom: MarketplaceGroom) => {
    if (!user) return false;
    return (user.money || 0) >= calculateHiringCost(groom);
  };

  // Owner ruling 2026-10-28 (q230): one click hires; the fee is on the button.
  const handleHireClick = (groom: MarketplaceGroom) => {
    // A refusal belongs to the attempt that earned it; don't carry it to the next.
    hireMutation.reset();
    setSelectedGroom(groom);
    {
      hireMutation.mutate(groom.marketplaceId, {
        onSuccess: (data) => {
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

  // Handle refresh marketplace.
  // A FREE refresh (canRefreshFree === true) fires immediately. A PAID refresh
  // (canRefreshFree === false / refreshCost > 0) spends coins, so it must be
  // confirmed via the refresh-confirmation dialog BEFORE the mutation fires —
  // mirrors the paid-refresh guard on the unrouted MarketplacePage (Equoria-149ty).
  const handleRefresh = () => {
    const needsPayment = !(marketplaceData && marketplaceData.canRefreshFree);
    if (needsPayment) {
      setShowRefreshConfirm(true);
      return;
    }
    // Free refresh: no confirmation, force = false.
    refreshMutation.mutate(false);
  };

  // Confirm a PAID refresh — fires the real POST /groom-marketplace/refresh {force:true}.
  const handleConfirmPaidRefresh = () => {
    setShowRefreshConfirm(false);
    refreshMutation.mutate(true);
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
          message={userMessageFor(marketplaceError).message}
          retry={{ label: 'Retry', onClick: () => void marketplaceQuery.refetch() }}
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
              {/* Equoria-2dnd2: shared util (guard; normalized to "3:04 PM", was h:m:s). */}
              Next free refresh: {formatTime(marketplaceData.nextFreeRefresh)}
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
              htmlFor="star-level-filter"
              className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2"
            >
              Level
            </label>
            <Select
              id="star-level-filter"
              data-testid="star-level-filter"
              value={filterStarLevel}
              onChange={(e) => setFilterStarLevel(e.target.value)}
              className="w-full"
            >
              <option value="all">All Levels</option>
              {staffLevelOrder.map((level) => (
                <option key={level} value={level}>
                  {staffLevelLabel(level)}
                </option>
              ))}
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
              <option value="general">General</option>
              <option value="training">Training</option>
              <option value="medical">Medical</option>
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
              const hiringCost = calculateHiringCost(groom);
              const canAfford = canAffordGroom(groom);

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
                        <StaffLevelStars level={groom.starLevel} />
                        <span className="px-2 py-0.5 bg-[var(--role-success-bg)] text-[var(--role-success-text)] text-xs font-bold rounded-[var(--radius-sm)] uppercase border border-[var(--role-success-border)]">
                          {groomSpecialtyTitle(groom.specialty)}
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
                    {/* Owner ruling 2026-10-28 (q228): the groom's star level price
                        each week, however many horses they look after. */}
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Weekly fee:</span>
                      <span className="font-bold inline-flex items-center gap-1">
                        <Currency amount={groom.weeklyFee} />
                        /wk
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
                  {hireMutation.isError && selectedGroom?.marketplaceId === groom.marketplaceId && (
                    <InlineError
                      message={actionMessageFor(
                        hireMutation.error,
                        hireRefused,
                        hireRefusalCodes('groom')
                      )}
                      className="mt-3"
                    />
                  )}
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

      {/* Paid Refresh Confirmation — GameDialog (mirrors the hire-modal pattern
          and the unrouted MarketplacePage's refresh-confirmation-dialog,
          Equoria-149ty). Only reachable on the PAID branch (canRefreshFree ===
          false); a FREE refresh skips this dialog entirely. Cancel => no
          mutation; Confirm => real POST /groom-marketplace/refresh {force:true}. */}
      <GameDialog
        open={showRefreshConfirm}
        onOpenChange={(open) => {
          if (!open) setShowRefreshConfirm(false);
        }}
      >
        <GameDialogContent
          size="sm"
          data-testid="refresh-confirmation-dialog"
          aria-describedby="refresh-confirmation-description"
        >
          <GameDialogHeader>
            <GameDialogTitle>Refresh Marketplace</GameDialogTitle>
          </GameDialogHeader>
          <GameDialogBody>
            <p
              id="refresh-confirmation-description"
              className="text-[var(--text-secondary)] mb-6 leading-relaxed"
            >
              Refreshing replaces the current selection of grooms with new ones. This is a paid
              refresh — the cost below will be deducted from your balance.
            </p>

            <Surface variant="subtle" className="p-4 flex items-center justify-between">
              <span className="text-sm text-[var(--text-primary)] inline-flex items-center gap-2">
                <Coins className="w-4 h-4 text-[var(--gold-primary)]" aria-hidden="true" />
                Refresh Cost
              </span>
              <span
                className="text-lg font-bold text-[var(--gold-primary)]"
                data-testid="refresh-cost"
              >
                <Currency amount={marketplaceData?.refreshCost || 0} showIcon={false} />
              </span>
            </Surface>
          </GameDialogBody>
          <GameDialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowRefreshConfirm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPaidRefresh}
              disabled={refreshMutation.isPending}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" aria-hidden="true" />
              {refreshMutation.isPending ? 'Refreshing...' : 'Confirm Refresh'}
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>
    </main>
  );
};

export default GroomList;
