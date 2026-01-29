/**
 * Groom Marketplace Page
 *
 * A fantasy-themed marketplace for hiring grooms with full medieval aesthetic.
 * Features marketplace browsing, hiring functionality, and refresh mechanics.
 *
 * Design System:
 * - Fantasy color scheme (forest-green, parchment, aged-bronze, burnished-gold)
 * - Corner embellishments and gold borders
 * - Shimmer effects on hover
 * - Parchment textures
 * - Medieval typography
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groomsApi, userProgressApi, type MarketplaceGroom } from '../lib/api-client';
import { useProfile } from '../hooks/useAuth';
import FantasyButton from '../components/FantasyButton';
import FantasyModal from '../components/FantasyModal';
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
 * Skill level badge styling
 */
const getSkillBadgeColor = (skillLevel: string) => {
  switch (skillLevel.toLowerCase()) {
    case 'expert':
      return 'bg-burnished-gold text-midnight-ink border-burnished-gold';
    case 'advanced':
      return 'bg-forest-green text-parchment border-forest-green';
    case 'intermediate':
      return 'bg-aged-bronze text-parchment border-aged-bronze';
    default:
      return 'bg-saddle-leather text-parchment border-saddle-leather';
  }
};

/**
 * Personality badge styling
 */
const getPersonalityColor = (personality: string) => {
  switch (personality.toLowerCase()) {
    case 'patient':
      return 'text-blue-500';
    case 'energetic':
      return 'text-orange-500';
    case 'gentle':
      return 'text-green-500';
    case 'strict':
      return 'text-red-500';
    default:
      return 'text-aged-bronze';
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
  onHire: (marketplaceId: string) => void;
  isHiring: boolean;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const hiringCost = groom.sessionRate * 7; // One week upfront

  return (
    <>
      {/* Groom Card */}
      <div className="relative group">
        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 shimmer-effect opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-xl pointer-events-none" />

        {/* Main card container */}
        <div className="relative bg-parchment parchment-texture rounded-xl border-2 border-aged-bronze shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
          {/* Gold accent top border */}
          <div className="h-1 bg-gradient-to-r from-transparent via-burnished-gold to-transparent" />

          {/* Card content */}
          <div className="p-6 space-y-4">
            {/* Header with name and skill level */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="fantasy-title text-xl text-midnight-ink group-hover:text-forest-green transition-colors duration-200">
                  {groom.firstName} {groom.lastName}
                </h3>
                <p className="fantasy-body text-sm text-aged-bronze mt-1">
                  {groom.specialty} Specialist
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-lg border-2 ${getSkillBadgeColor(groom.skillLevel)} fantasy-caption text-xs uppercase tracking-wider font-bold shadow-sm`}
              >
                {groom.skillLevel}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Experience */}
              <div className="flex items-center gap-2 bg-aged-bronze/10 rounded-lg px-3 py-2 border border-aged-bronze/30">
                <Award className="w-4 h-4 text-burnished-gold" />
                <div className="flex-1">
                  <p className="fantasy-caption text-xs text-aged-bronze uppercase">Experience</p>
                  <p className="fantasy-body text-sm text-midnight-ink font-semibold">
                    {groom.experience} years
                  </p>
                </div>
              </div>

              {/* Personality */}
              <div className="flex items-center gap-2 bg-aged-bronze/10 rounded-lg px-3 py-2 border border-aged-bronze/30">
                <Heart className={`w-4 h-4 ${getPersonalityColor(groom.personality)}`} />
                <div className="flex-1">
                  <p className="fantasy-caption text-xs text-aged-bronze uppercase">Personality</p>
                  <p className="fantasy-body text-sm text-midnight-ink font-semibold">
                    {groom.personality}
                  </p>
                </div>
              </div>
            </div>

            {/* Bio preview */}
            <div className="bg-parchment border border-aged-bronze/20 rounded-lg p-3">
              <p className="fantasy-body text-sm text-midnight-ink line-clamp-2 italic">
                "{groom.bio}"
              </p>
            </div>

            {/* Pricing */}
            <div className="flex items-center justify-between pt-2 border-t border-aged-bronze/30">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-burnished-gold" />
                <div>
                  <p className="fantasy-caption text-xs text-aged-bronze uppercase">Hiring Cost</p>
                  <p className="fantasy-title text-lg text-forest-green">${hiringCost}</p>
                </div>
              </div>
              <p className="fantasy-body text-xs text-aged-bronze">${groom.sessionRate}/day</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDetails(true)}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-aged-bronze bg-parchment hover:bg-aged-bronze/20 transition-colors duration-200 fantasy-body text-sm text-midnight-ink uppercase tracking-wider font-semibold"
              >
                <Info className="w-4 h-4 inline mr-2" />
                Details
              </button>
              <FantasyButton
                onClick={() => onHire(groom.marketplaceId)}
                disabled={isHiring}
                variant="primary"
                className="flex-1"
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                Hire
              </FantasyButton>
            </div>
          </div>

          {/* Corner embellishments */}
          <div className="absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2 border-burnished-gold opacity-40" />
          <div className="absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2 border-burnished-gold opacity-40" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-l-2 border-b-2 border-burnished-gold opacity-40" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2 border-burnished-gold opacity-40" />
        </div>
      </div>

      {/* Details Modal */}
      <FantasyModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title={`${groom.firstName} ${groom.lastName}`}
        type="event"
      >
        <div className="space-y-4">
          {/* Full stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-aged-bronze/10 rounded-lg p-4 border border-aged-bronze/30">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-5 h-5 text-burnished-gold" />
                <p className="fantasy-caption text-xs text-aged-bronze uppercase">Specialty</p>
              </div>
              <p className="fantasy-body text-midnight-ink font-semibold">{groom.specialty}</p>
            </div>
            <div className="bg-aged-bronze/10 rounded-lg p-4 border border-aged-bronze/30">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-burnished-gold" />
                <p className="fantasy-caption text-xs text-aged-bronze uppercase">Skill Level</p>
              </div>
              <p className="fantasy-body text-midnight-ink font-semibold">{groom.skillLevel}</p>
            </div>
            <div className="bg-aged-bronze/10 rounded-lg p-4 border border-aged-bronze/30">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-burnished-gold" />
                <p className="fantasy-caption text-xs text-aged-bronze uppercase">Experience</p>
              </div>
              <p className="fantasy-body text-midnight-ink font-semibold">
                {groom.experience} years
              </p>
            </div>
            <div className="bg-aged-bronze/10 rounded-lg p-4 border border-aged-bronze/30">
              <div className="flex items-center gap-2 mb-2">
                <Heart className={`w-5 h-5 ${getPersonalityColor(groom.personality)}`} />
                <p className="fantasy-caption text-xs text-aged-bronze uppercase">Personality</p>
              </div>
              <p className="fantasy-body text-midnight-ink font-semibold">{groom.personality}</p>
            </div>
          </div>

          {/* Full bio */}
          <div className="bg-parchment border-2 border-aged-bronze/30 rounded-lg p-4">
            <p className="fantasy-caption text-xs text-aged-bronze uppercase mb-2">Biography</p>
            <p className="fantasy-body text-sm text-midnight-ink italic">"{groom.bio}"</p>
          </div>

          {/* Pricing breakdown */}
          <div className="bg-forest-green/10 border-2 border-forest-green/30 rounded-lg p-4">
            <p className="fantasy-caption text-xs text-aged-bronze uppercase mb-2">Pricing</p>
            <div className="space-y-1 fantasy-body text-sm text-midnight-ink">
              <div className="flex justify-between">
                <span>Daily Rate:</span>
                <span className="font-semibold">${groom.sessionRate}</span>
              </div>
              <div className="flex justify-between">
                <span>Weekly Cost:</span>
                <span className="font-semibold">${groom.sessionRate * 7}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-forest-green/30">
                <span className="font-bold">Hiring Fee (1 week):</span>
                <span className="text-forest-green font-bold text-lg">${hiringCost}</span>
              </div>
            </div>
          </div>

          {/* Hire button */}
          <FantasyButton
            onClick={() => {
              setShowDetails(false);
              onHire(groom.marketplaceId);
            }}
            disabled={isHiring}
            variant="primary"
            size="large"
            className="w-full"
          >
            <Sparkles className="w-5 h-5 inline mr-2" />
            Hire {groom.firstName} {groom.lastName}
          </FantasyButton>
        </div>
      </FantasyModal>
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
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch marketplace data
  const {
    data: marketplace,
    isLoading: isLoadingMarketplace,
    error: marketplaceError,
  } = useQuery({
    queryKey: ['marketplace'],
    queryFn: groomsApi.getMarketplace,
    enabled: !!userId,
  });

  // Fetch user data for money display
  const { data: userData } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userProgressApi.getUser(userId!),
    enabled: !!userId,
  });

  // Fetch marketplace stats (available for future use)
  useQuery({
    queryKey: ['marketplaceStats'],
    queryFn: groomsApi.getMarketplaceStats,
    enabled: !!userId,
  });

  // Hire groom mutation
  const hireMutation = useMutation({
    mutationFn: groomsApi.hireGroom,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['grooms', userId] });
      setNotification({
        type: 'success',
        message: `Successfully hired groom for $${data.data.cost}! Remaining balance: $${data.data.remainingMoney}`,
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

  // Refresh marketplace mutation
  const refreshMutation = useMutation({
    mutationFn: (force: boolean) => groomsApi.refreshMarketplace(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['marketplaceStats'] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      setNotification({
        type: 'success',
        message: 'Marketplace refreshed successfully!',
      });
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
    const needsPayment = marketplace && marketplace.refreshCost > 0;
    if (needsPayment && !window.confirm(`Refresh costs $${marketplace.refreshCost}. Continue?`)) {
      return;
    }
    refreshMutation.mutate(needsPayment || false);
  };

  if (isLoadingMarketplace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-green/20 via-parchment to-aged-bronze/20 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <RefreshCw className="w-12 h-12 text-burnished-gold animate-spin mx-auto mb-4" />
            <p className="fantasy-title text-2xl text-midnight-ink">Loading Marketplace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (marketplaceError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-green/20 via-parchment to-aged-bronze/20 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="fantasy-body text-red-700">
              Failed to load marketplace. Please try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-green/20 via-parchment to-aged-bronze/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="relative mb-8">
          {/* Background decoration */}
          <div className="absolute inset-0 parchment-texture opacity-30 rounded-2xl" />

          <div className="relative bg-parchment border-2 border-aged-bronze rounded-2xl p-6 md:p-8 shadow-xl">
            {/* Gold accent line */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-burnished-gold to-transparent rounded-t-2xl" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="fantasy-title text-3xl md:text-4xl text-forest-green mb-2 flex items-center gap-3">
                  <Users className="w-8 h-8" />
                  Groom Marketplace
                </h1>
                <p className="fantasy-body text-aged-bronze">
                  Hire skilled grooms to care for your horses
                </p>
              </div>

              {/* User money display */}
              {userData && (
                <div className="bg-forest-green/10 border-2 border-forest-green/30 rounded-lg px-6 py-3 flex items-center gap-3">
                  <Coins className="w-6 h-6 text-burnished-gold" />
                  <div>
                    <p className="fantasy-caption text-xs text-aged-bronze uppercase">
                      Your Balance
                    </p>
                    <p className="fantasy-title text-2xl text-forest-green">
                      ${userData.money.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Corner embellishments */}
            <div className="absolute top-3 left-3 w-4 h-4 border-l-2 border-t-2 border-burnished-gold opacity-60" />
            <div className="absolute top-3 right-3 w-4 h-4 border-r-2 border-t-2 border-burnished-gold opacity-60" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-l-2 border-b-2 border-burnished-gold opacity-60" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-r-2 border-b-2 border-burnished-gold opacity-60" />
          </div>
        </div>

        {/* Notification banner */}
        {notification && (
          <div
            className={`mb-6 rounded-xl border-2 p-4 flex items-center gap-3 ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-500'
                : 'bg-red-50 border-red-500'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            )}
            <p
              className={`fantasy-body ${
                notification.type === 'success' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {notification.message}
            </p>
          </div>
        )}

        {/* Marketplace stats and controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total grooms */}
          <div className="bg-parchment border-2 border-aged-bronze rounded-xl p-4 parchment-texture">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-burnished-gold" />
              <div>
                <p className="fantasy-caption text-xs text-aged-bronze uppercase">Available</p>
                <p className="fantasy-title text-2xl text-midnight-ink">
                  {marketplace?.grooms?.length || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Last refresh */}
          <div className="bg-parchment border-2 border-aged-bronze rounded-xl p-4 parchment-texture">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-burnished-gold" />
              <div>
                <p className="fantasy-caption text-xs text-aged-bronze uppercase">Last Refresh</p>
                <p className="fantasy-body text-sm text-midnight-ink">
                  {marketplace?.lastRefresh
                    ? new Date(marketplace.lastRefresh).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>

          {/* Refresh count */}
          <div className="bg-parchment border-2 border-aged-bronze rounded-xl p-4 parchment-texture">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-burnished-gold" />
              <div>
                <p className="fantasy-caption text-xs text-aged-bronze uppercase">Refreshes</p>
                <p className="fantasy-title text-2xl text-midnight-ink">
                  {marketplace?.refreshCount || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <div className="bg-parchment border-2 border-aged-bronze rounded-xl p-4 parchment-texture flex items-center justify-center">
            <FantasyButton
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              variant={marketplace?.canRefreshFree ? 'primary' : 'secondary'}
              className="w-full"
            >
              <RefreshCw
                className={`w-4 h-4 inline mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
              />
              {marketplace?.canRefreshFree
                ? 'Free Refresh'
                : `Refresh ($${marketplace?.refreshCost})`}
            </FantasyButton>
          </div>
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
          <div className="bg-parchment border-2 border-aged-bronze rounded-xl p-12 text-center parchment-texture">
            <Users className="w-16 h-16 text-aged-bronze mx-auto mb-4 opacity-50" />
            <p className="fantasy-title text-xl text-midnight-ink mb-2">No Grooms Available</p>
            <p className="fantasy-body text-aged-bronze mb-6">
              Refresh the marketplace to see new grooms
            </p>
            <FantasyButton onClick={handleRefresh} disabled={refreshMutation.isPending}>
              <RefreshCw
                className={`w-4 h-4 inline mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
              />
              Refresh Marketplace
            </FantasyButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplacePage;
