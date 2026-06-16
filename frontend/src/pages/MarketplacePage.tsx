/**
 * Groom Marketplace Page
 *
 * Celestial Night themed marketplace for hiring grooms.
 * Features marketplace browsing, hiring functionality, and refresh mechanics.
 *
 * Dialogs use the canonical GameDialog (Equoria-o5hub.13, DECISIONS.md §8):
 * groom details and the paid-refresh confirmation both render through Radix
 * Dialog, which supplies focus trap, Escape close, scroll lock, and focus
 * restoration.
 *
 * Design-system migration (Equoria-o5hub, marketplace family): PageHeader
 * replaces PageHero; PageContainer wide; Surface(panel/subtle) replaces the
 * inline glass recipes; status-role tokens replace raw palette classes; all
 * game currency renders through the canonical Currency component (no "$").
 */

import React, { useState } from 'react';
import { formatDate } from '@/lib/formatDate';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groomsApi, userProgressApi, type MarketplaceGroom } from '../lib/api-client';
import { useProfile } from '../hooks/useAuth';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { GameBadge } from '@/components/ui/game';
import { PageLoading, ErrorState } from '@/components/ui/state';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import {
  Coins,
  RefreshCw,
  TrendingUp,
  Users,
  Calendar,
  Star,
  Award,
  Heart,
  Briefcase,
  Info,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';

/**
 * Skill level → GameBadge variant (semantic tokens, DECISIONS.md §7).
 */
const getSkillBadgeVariant = (
  skillLevel: string
): 'default' | 'primary' | 'secondary' | 'outline' => {
  switch (skillLevel.toLowerCase()) {
    case 'expert':
      return 'default'; // gold
    case 'advanced':
      return 'primary';
    case 'intermediate':
      return 'secondary';
    default:
      return 'outline';
  }
};

/**
 * Personality → status-role text token (DECISIONS.md §7).
 */
const getPersonalityColorClass = (personality: string): string => {
  switch (personality.toLowerCase()) {
    case 'patient':
      return 'text-[var(--status-info)]';
    case 'energetic':
      return 'text-[var(--status-warning)]';
    case 'gentle':
      return 'text-[var(--status-success)]';
    case 'strict':
      return 'text-[var(--status-danger)]';
    default:
      return 'text-[var(--text-secondary)]';
  }
};

/**
 * Individual Groom Card Component
 */
const GroomCard = ({
  groom,
  onHire,
  isHiring,
}: {
  groom: MarketplaceGroom;
  onHire: (_marketplaceId: string) => void;
  isHiring: boolean;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const hiringCost = groom.sessionRate * 7;

  return (
    <>
      {/* Groom Card — static panel with explicit action buttons (no card hover lift) */}
      <Surface variant="panel" className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="type-card-title mb-1">
              {groom.firstName} {groom.lastName}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{groom.specialty} Specialist</p>
          </div>
          <GameBadge variant={getSkillBadgeVariant(groom.skillLevel)} className="uppercase">
            {groom.skillLevel}
          </GameBadge>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <Surface variant="subtle" className="flex items-center gap-2 px-3 py-2">
            <Award className="w-4 h-4 text-[var(--gold-primary)]" aria-hidden="true" />
            <div className="flex-1">
              <p className="type-label">Experience</p>
              <p className="text-sm text-[var(--text-primary)] font-semibold">
                {groom.experience} years
              </p>
            </div>
          </Surface>
          <Surface variant="subtle" className="flex items-center gap-2 px-3 py-2">
            <Heart
              className={`w-4 h-4 ${getPersonalityColorClass(groom.personality)}`}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="type-label">Personality</p>
              <p className="text-sm text-[var(--text-primary)] font-semibold">
                {groom.personality}
              </p>
            </div>
          </Surface>
        </div>

        {/* Bio preview */}
        <Surface variant="subtle" className="p-3">
          <p className="text-sm text-[var(--text-muted)] line-clamp-2 italic">"{groom.bio}"</p>
        </Surface>

        {/* Pricing */}
        <div
          className="flex items-center justify-between pt-2 border-t"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[var(--gold-primary)]" aria-hidden="true" />
            <div>
              <p className="type-label">Hiring Cost</p>
              <p className="text-lg font-bold text-[var(--gold-primary)]">
                <Currency amount={hiringCost} showIcon={false} />
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            <Currency amount={groom.sessionRate} showIcon={false} />
            /day
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => setShowDetails(true)}
          >
            <Info className="w-4 h-4 inline mr-1" aria-hidden="true" />
            Details
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onHire(groom.marketplaceId)}
            disabled={isHiring}
          >
            <Sparkles className="w-4 h-4 inline mr-1" aria-hidden="true" />
            {isHiring ? 'Hiring…' : 'Hire'}
          </Button>
        </div>
      </Surface>

      {/* Details Dialog — canonical GameDialog (Equoria-o5hub.13) */}
      <GameDialog
        open={showDetails}
        onOpenChange={(open) => {
          if (!open) setShowDetails(false);
        }}
      >
        <GameDialogContent
          size="sm"
          data-testid="groom-details-dialog"
          aria-describedby="groom-details-description"
        >
          <GameDialogHeader>
            <GameDialogTitle>
              {groom.firstName} {groom.lastName}
            </GameDialogTitle>
            <GameDialogDescription id="groom-details-description">
              {groom.specialty} Specialist — full profile and pricing
            </GameDialogDescription>
          </GameDialogHeader>

          <GameDialogBody>
            <div className="space-y-4">
              {/* Full stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Briefcase, label: 'Specialty', value: groom.specialty },
                  { icon: Star, label: 'Skill Level', value: groom.skillLevel },
                  { icon: Award, label: 'Experience', value: `${groom.experience} years` },
                  { icon: Heart, label: 'Personality', value: groom.personality },
                ].map(({ icon: Icon, label, value }) => (
                  <Surface variant="subtle" key={label} className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-[var(--gold-primary)]" aria-hidden="true" />
                      <p className="type-label">{label}</p>
                    </div>
                    <p className="text-sm text-[var(--text-primary)] font-semibold">{value}</p>
                  </Surface>
                ))}
              </div>

              {/* Full bio */}
              <Surface variant="subtle" className="p-4">
                <p className="type-label mb-2">Biography</p>
                <p className="text-sm text-[var(--text-primary)] italic">"{groom.bio}"</p>
              </Surface>

              {/* Pricing breakdown */}
              <Surface variant="subtle" className="p-4">
                <p className="type-label mb-2">Pricing</p>
                <div className="space-y-1 text-sm text-[var(--text-primary)]">
                  <div className="flex justify-between">
                    <span>Daily Rate:</span>
                    <Currency amount={groom.sessionRate} className="font-semibold" />
                  </div>
                  <div className="flex justify-between">
                    <span>Weekly Cost:</span>
                    <Currency amount={groom.sessionRate * 7} className="font-semibold" />
                  </div>
                  <div
                    className="flex justify-between pt-2 border-t"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <span className="font-bold">Hiring Fee (1 week):</span>
                    <Currency
                      amount={hiringCost}
                      className="font-bold text-[var(--gold-primary)] text-base"
                    />
                  </div>
                </div>
              </Surface>
            </div>
          </GameDialogBody>

          <GameDialogFooter>
            {/* Single gold primary per dialog (DECISIONS.md §5) */}
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setShowDetails(false);
                onHire(groom.marketplaceId);
              }}
              disabled={isHiring}
            >
              <Sparkles className="w-4 h-4 inline mr-2" aria-hidden="true" />
              Hire {groom.firstName} {groom.lastName}
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>
    </>
  );
};

/**
 * Main Marketplace Page Component
 */
const MarketplacePage = () => {
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile();
  const userId = profileData?.user?.id;

  const [selectedGroom, setSelectedGroom] = useState<string | null>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const {
    data: marketplace,
    isLoading: isLoadingMarketplace,
    error: marketplaceError,
    refetch: refetchMarketplace,
  } = useQuery({
    queryKey: ['marketplace'],
    queryFn: groomsApi.getMarketplace,
    enabled: !!userId,
  });

  const { data: userData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => userProgressApi.getUser(userId!),
    enabled: !!userId,
  });

  // Fetch marketplace stats (available for future use)
  useQuery({
    queryKey: ['marketplaceStats'],
    queryFn: groomsApi.getMarketplaceStats,
    enabled: !!userId,
  });

  const hireMutation = useMutation({
    mutationFn: groomsApi.hireGroom,
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['profile'],
        (old: { user: Record<string, unknown> } | undefined) => {
          if (!old?.user) return old;
          return { ...old, user: { ...old.user, money: data.data.remainingMoney } };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['grooms', userId] });
      setNotification({
        type: 'success',
        message: `Successfully hired groom for ${data.data.cost.toLocaleString()} coins! Remaining balance: ${data.data.remainingMoney.toLocaleString()} coins`,
      });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (error: Error) => {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to hire groom. Please try again.',
      });
      setTimeout(() => setNotification(null), 5000);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (force: boolean) => groomsApi.refreshMarketplace(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['marketplaceStats'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setNotification({ type: 'success', message: 'Marketplace refreshed successfully!' });
      setTimeout(() => setNotification(null), 3000);
    },
    onError: (error: Error) => {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to refresh marketplace.',
      });
      setTimeout(() => setNotification(null), 5000);
    },
  });

  const handleHire = (marketplaceId: string) => {
    setSelectedGroom(marketplaceId);
    hireMutation.mutate(marketplaceId);
  };

  const handleRefresh = () => {
    const needsPayment = !!(marketplace && marketplace.refreshCost > 0);
    if (needsPayment) {
      // Paid refresh requires confirmation via GameDialog (replaces the old native browser confirm)
      setShowRefreshConfirm(true);
      return;
    }
    refreshMutation.mutate(false);
  };

  const handleConfirmPaidRefresh = () => {
    setShowRefreshConfirm(false);
    refreshMutation.mutate(true);
  };

  if (isLoadingMarketplace) {
    return <PageLoading label="Loading marketplace…" />;
  }

  if (marketplaceError) {
    return (
      <PageContainer variant="content">
        <ErrorState
          severity="page"
          title="Failed to load marketplace"
          message="Check your connection and try again."
          retry={{ label: 'Try Again', onClick: () => refetchMarketplace() }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="wide" data-testid="groom-marketplace-page">
      <PageHeader
        title="Groom Marketplace"
        subtitle="Hire skilled grooms to care for your horses"
        icon={<Users className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
        actions={
          userData ? (
            <Surface variant="subtle" className="px-4 py-2 flex items-center gap-3">
              <div>
                <p className="type-label">Your Balance</p>
                <Currency amount={userData.money} variant="balance" className="text-xl" />
              </div>
            </Surface>
          ) : undefined
        }
      />

      <div className="mt-6 pb-8">
        {/* Notification banner */}
        {notification && (
          <div
            role="status"
            className={`mb-6 rounded-[var(--radius-md)] p-4 flex items-center gap-3 border ${
              notification.type === 'success'
                ? 'bg-[var(--role-success-bg)] border-[var(--role-success-border)]'
                : 'bg-[var(--role-danger-bg)] border-[var(--role-danger-border)]'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2
                className="w-6 h-6 text-[var(--role-success-text)] flex-shrink-0"
                aria-hidden="true"
              />
            ) : (
              <XCircle
                className="w-6 h-6 text-[var(--role-danger-text)] flex-shrink-0"
                aria-hidden="true"
              />
            )}
            <p
              className={
                notification.type === 'success'
                  ? 'text-[var(--role-success-text)]'
                  : 'text-[var(--role-danger-text)]'
              }
            >
              {notification.message}
            </p>
          </div>
        )}

        {/* Stats and controls row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: 'Available', value: marketplace?.grooms?.length || 0 },
            {
              icon: Calendar,
              label: 'Last Refresh',
              value: marketplace?.lastRefresh ? formatDate(marketplace.lastRefresh) : 'Never',
            },
            { icon: TrendingUp, label: 'Refreshes', value: marketplace?.refreshCount || 0 },
          ].map(({ icon: Icon, label, value }) => (
            <Surface variant="panel" key={label} className="p-4">
              <div className="flex items-center gap-3">
                <Icon className="w-8 h-8 text-[var(--gold-primary)]" aria-hidden="true" />
                <div>
                  <p className="type-label">{label}</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
                </div>
              </div>
            </Surface>
          ))}

          {/* Refresh button */}
          <Surface variant="panel" className="p-4 flex items-center justify-center">
            <Button
              variant={marketplace?.canRefreshFree ? 'default' : 'secondary'}
              className="w-full"
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw
                className={`w-4 h-4 inline mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {marketplace?.canRefreshFree ? (
                'Free Refresh'
              ) : (
                <>
                  Refresh (
                  <Currency amount={marketplace?.refreshCost ?? 0} showIcon={false} /> coins)
                </>
              )}
            </Button>
          </Surface>
        </div>

        {/* Grooms grid */}
        {marketplace?.grooms && marketplace.grooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {marketplace.grooms.map((groom) => (
              <GroomCard
                key={groom.marketplaceId}
                groom={groom}
                onHire={handleHire}
                isHiring={hireMutation.isPending && selectedGroom === groom.marketplaceId}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            variant="first-use"
            icon={<Users className="h-8 w-8" aria-hidden="true" />}
            title="No Grooms Available"
            description="Refresh the marketplace to see new grooms."
            primaryAction={{ label: 'Refresh Marketplace', onClick: handleRefresh }}
          />
        )}
      </div>

      {/* Paid Refresh Confirmation — canonical GameDialog (Equoria-o5hub.13),
          replaces the old native browser confirm. Purchase-style confirmation:
          gold primary Confirm, secondary Cancel (DECISIONS.md §5). */}
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
            <GameDialogDescription id="refresh-confirmation-description">
              Refreshing replaces the current selection of grooms with new ones.
            </GameDialogDescription>
          </GameDialogHeader>

          <GameDialogBody>
            <Surface variant="subtle" className="p-4 flex items-center justify-between">
              <span className="text-sm text-[var(--text-primary)] flex items-center gap-2">
                <Coins className="w-4 h-4 text-[var(--gold-primary)]" aria-hidden="true" />
                Refresh Cost
              </span>
              <span
                className="text-lg font-bold text-[var(--gold-primary)]"
                data-testid="refresh-cost"
              >
                <Currency amount={marketplace?.refreshCost ?? 0} showIcon={false} />
              </span>
            </Surface>
          </GameDialogBody>

          <GameDialogFooter>
            <Button variant="secondary" onClick={() => setShowRefreshConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPaidRefresh}>
              <RefreshCw className="w-4 h-4 inline mr-2" aria-hidden="true" />
              Confirm Refresh
            </Button>
          </GameDialogFooter>
        </GameDialogContent>
      </GameDialog>
    </PageContainer>
  );
};

export default MarketplacePage;
