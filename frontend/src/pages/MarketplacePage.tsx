/**
 * Groom Marketplace Page
 *
 * Celestial Night themed marketplace for hiring grooms.
 * Features marketplace browsing, hiring functionality, and refresh mechanics.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groomsApi, userProgressApi, type MarketplaceGroom } from '../lib/api-client';
import { useProfile } from '../hooks/useAuth';
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
  X,
} from 'lucide-react';

/**
 * Skill level badge styling
 */
const getSkillBadgeStyle = (skillLevel: string): React.CSSProperties => {
  switch (skillLevel.toLowerCase()) {
    case 'expert':
      return {
        background: 'rgba(212,168,67,0.15)',
        border: '1px solid rgba(212,168,67,0.4)',
        color: 'rgb(212,168,67)',
      };
    case 'advanced':
      return {
        background: 'rgba(37,99,235,0.15)',
        border: '1px solid rgba(37,99,235,0.4)',
        color: 'rgb(37,99,235)',
      };
    case 'intermediate':
      return {
        background: 'rgba(100,130,165,0.15)',
        border: '1px solid rgba(100,130,165,0.4)',
        color: 'rgb(148,163,184)',
      };
    default:
      return {
        background: 'rgba(15,35,70,0.5)',
        border: '1px solid rgba(37,99,235,0.2)',
        color: 'rgb(148,163,184)',
      };
  }
};

/**
 * Personality color
 */
const getPersonalityColor = (personality: string): string => {
  switch (personality.toLowerCase()) {
    case 'patient':
      return 'text-blue-400';
    case 'energetic':
      return 'text-orange-400';
    case 'gentle':
      return 'text-green-400';
    case 'strict':
      return 'text-red-400';
    default:
      return 'text-[rgb(148,163,184)]';
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
      {/* Groom Card */}
      <div className="glass-panel p-6 space-y-4 hover:border-[rgba(37,99,235,0.5)] transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="fantasy-header text-xl text-[rgb(220,235,255)] mb-1">
              {groom.firstName} {groom.lastName}
            </h3>
            <p className="text-sm text-[rgb(148,163,184)]">{groom.specialty} Specialist</p>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs uppercase tracking-wider font-bold"
            style={getSkillBadgeStyle(groom.skillLevel)}
          >
            {groom.skillLevel}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              background: 'var(--glass-surface-subtle-bg)',
              border: 'var(--glass-border-dim)',
            }}
          >
            <Award className="w-4 h-4 text-[rgb(212,168,67)]" />
            <div className="flex-1">
              <p className="text-xs text-[rgb(100,130,165)] uppercase">Experience</p>
              <p className="text-sm text-[rgb(220,235,255)] font-semibold">
                {groom.experience} years
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              background: 'var(--glass-surface-subtle-bg)',
              border: 'var(--glass-border-dim)',
            }}
          >
            <Heart className={`w-4 h-4 ${getPersonalityColor(groom.personality)}`} />
            <div className="flex-1">
              <p className="text-xs text-[rgb(100,130,165)] uppercase">Personality</p>
              <p className="text-sm text-[rgb(220,235,255)] font-semibold">{groom.personality}</p>
            </div>
          </div>
        </div>

        {/* Bio preview */}
        <div
          className="rounded-lg p-3"
          style={{
            background: 'var(--glass-surface-subtle-bg)',
            border: 'var(--glass-border-dim)',
          }}
        >
          <p className="text-sm text-[rgb(148,163,184)] line-clamp-2 italic">"{groom.bio}"</p>
        </div>

        {/* Pricing */}
        <div
          className="flex items-center justify-between pt-2 border-t"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[rgb(212,168,67)]" />
            <div>
              <p className="text-xs text-[rgb(100,130,165)] uppercase">Hiring Cost</p>
              <p className="text-lg font-bold text-[rgb(212,168,67)]">${hiringCost}</p>
            </div>
          </div>
          <p className="text-xs text-[rgb(100,130,165)]">${groom.sessionRate}/day</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setShowDetails(true)}
            className="btn-outline-celestial flex-1"
            style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
          >
            <Info className="w-4 h-4 inline mr-1" />
            Details
          </button>
          <button
            onClick={() => onHire(groom.marketplaceId)}
            disabled={isHiring}
            className="btn-cobalt flex-1"
            style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
          >
            <Sparkles className="w-4 h-4 inline mr-1" />
            {isHiring ? 'Hiring…' : 'Hire'}
          </button>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDetails(false)} />
          <div className="glass-panel relative w-full max-w-md p-6 space-y-4 max-h-[80vh] overflow-y-auto z-10">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="fantasy-header text-xl text-[rgb(212,168,67)]">
                {groom.firstName} {groom.lastName}
              </h2>
              <button
                onClick={() => setShowDetails(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[rgba(37,99,235,0.2)] transition-colors"
              >
                <X className="w-4 h-4 text-[rgb(148,163,184)]" />
              </button>
            </div>

            {/* Full stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Briefcase, label: 'Specialty', value: groom.specialty },
                { icon: Star, label: 'Skill Level', value: groom.skillLevel },
                { icon: Award, label: 'Experience', value: `${groom.experience} years` },
                { icon: Heart, label: 'Personality', value: groom.personality },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-lg p-3"
                  style={{
                    background: 'var(--glass-surface-subtle-bg)',
                    border: 'var(--glass-border-dim)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-[rgb(212,168,67)]" />
                    <p className="text-xs text-[rgb(100,130,165)] uppercase">{label}</p>
                  </div>
                  <p className="text-sm text-[rgb(220,235,255)] font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {/* Full bio */}
            <div
              className="rounded-lg p-4"
              style={{
                background: 'var(--glass-surface-subtle-bg)',
                border: 'var(--glass-border-dim)',
              }}
            >
              <p className="text-xs text-[rgb(100,130,165)] uppercase mb-2">Biography</p>
              <p className="text-sm text-[rgb(220,235,255)] italic">"{groom.bio}"</p>
            </div>

            {/* Pricing breakdown */}
            <div
              className="rounded-lg p-4"
              style={{
                background: 'var(--glass-surface-subtle-bg)',
                border: 'var(--glass-border-dim)',
              }}
            >
              <p className="text-xs text-[rgb(100,130,165)] uppercase mb-2">Pricing</p>
              <div className="space-y-1 text-sm text-[rgb(220,235,255)]">
                <div className="flex justify-between">
                  <span>Daily Rate:</span>
                  <span className="font-semibold">${groom.sessionRate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Weekly Cost:</span>
                  <span className="font-semibold">${groom.sessionRate * 7}</span>
                </div>
                <div
                  className="flex justify-between pt-2 border-t"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  <span className="font-bold">Hiring Fee (1 week):</span>
                  <span className="font-bold text-[rgb(212,168,67)] text-base">${hiringCost}</span>
                </div>
              </div>
            </div>

            {/* Hire button */}
            <button
              onClick={() => {
                setShowDetails(false);
                onHire(groom.marketplaceId);
              }}
              disabled={isHiring}
              className="btn-cobalt"
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              Hire {groom.firstName} {groom.lastName}
            </button>
          </div>
        </div>
      )}
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

  const {
    data: marketplace,
    isLoading: isLoadingMarketplace,
    error: marketplaceError,
  } = useQuery({
    queryKey: ['marketplace'],
    queryFn: groomsApi.getMarketplace,
    enabled: !!userId,
  });

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

  const refreshMutation = useMutation({
    mutationFn: (force: boolean) => groomsApi.refreshMarketplace(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['marketplaceStats'] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
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
    const needsPayment = marketplace && marketplace.refreshCost > 0;
    if (needsPayment && !window.confirm(`Refresh costs $${marketplace.refreshCost}. Continue?`)) {
      return;
    }
    refreshMutation.mutate(needsPayment || false);
  };

  if (isLoadingMarketplace) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-12 h-12 text-[rgb(37,99,235)] animate-spin mx-auto" />
          <p className="text-[rgb(148,163,184)]">Loading Marketplace…</p>
        </div>
      </div>
    );
  }

  if (marketplaceError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-panel p-6 text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">Failed to load marketplace. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="glass-panel p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="fantasy-title text-3xl md:text-4xl mb-2 flex items-center gap-3">
                <Users className="w-8 h-8" />
                Groom Marketplace
              </h1>
              <p className="text-[rgb(148,163,184)]">Hire skilled grooms to care for your horses</p>
            </div>

            {/* User balance */}
            {userData && (
              <div
                className="rounded-lg px-6 py-3 flex items-center gap-3"
                style={{
                  background: 'rgba(37,99,235,0.1)',
                  border: '1px solid rgba(37,99,235,0.25)',
                }}
              >
                <Coins className="w-6 h-6 text-[rgb(212,168,67)]" />
                <div>
                  <p className="text-xs text-[rgb(100,130,165)] uppercase">Your Balance</p>
                  <p className="text-2xl font-bold text-[rgb(212,168,67)]">
                    ${userData.money.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notification banner */}
        {notification && (
          <div
            className={`mb-6 rounded-xl p-4 flex items-center gap-3 ${
              notification.type === 'success'
                ? 'bg-green-900/30 border border-green-500/40'
                : 'bg-red-900/30 border border-red-500/40'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            )}
            <p className={notification.type === 'success' ? 'text-green-300' : 'text-red-300'}>
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
              value: marketplace?.lastRefresh
                ? new Date(marketplace.lastRefresh).toLocaleDateString()
                : 'Never',
            },
            { icon: TrendingUp, label: 'Refreshes', value: marketplace?.refreshCount || 0 },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="glass-panel p-4">
              <div className="flex items-center gap-3">
                <Icon className="w-8 h-8 text-[rgb(212,168,67)]" />
                <div>
                  <p className="text-xs text-[rgb(100,130,165)] uppercase">{label}</p>
                  <p className="text-2xl font-bold text-[rgb(220,235,255)]">{value}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Refresh button */}
          <div className="glass-panel p-4 flex items-center justify-center">
            <button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              className={
                marketplace?.canRefreshFree ? 'btn-cobalt w-full' : 'btn-outline-celestial w-full'
              }
            >
              <RefreshCw
                className={`w-4 h-4 inline mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
              />
              {marketplace?.canRefreshFree
                ? 'Free Refresh'
                : `Refresh ($${marketplace?.refreshCost})`}
            </button>
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
          <div className="glass-panel p-12 text-center">
            <Users className="w-16 h-16 text-[rgb(100,130,165)] mx-auto mb-4 opacity-50" />
            <p className="fantasy-header text-xl text-[rgb(220,235,255)] mb-2">
              No Grooms Available
            </p>
            <p className="text-[rgb(148,163,184)] mb-6">
              Refresh the marketplace to see new grooms
            </p>
            <button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              className="btn-cobalt"
              style={{ maxWidth: '200px', margin: '0 auto' }}
            >
              <RefreshCw
                className={`w-4 h-4 inline mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
              />
              Refresh Marketplace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplacePage;
