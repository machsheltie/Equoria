/**
 * BankPage — The Vault
 *
 * Coin management, weekly rewards, and transaction history. Uses live user
 * balance from auth context.
 *
 * Design-system migration (Equoria-o5hub, marketplace family): PageHeader
 * replaces PageHero; PageContainer content; Surface(panel/subtle) replaces
 * local glass recipes + arbitrary radii; Button replaces the raw gradient
 * claim button (pending state preserved); async states via SectionLoading /
 * EmptyState; all currency through the canonical Currency component.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Coins, Gift, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/IconBox';
import { SectionLoading } from '@/components/ui/state';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { bankApi } from '@/lib/api-client';
import { useTransactionHistory } from '@/hooks/api/useTransactionHistory';
import Currency from '@/components/ui/Currency';

const BankPage: React.FC = () => {
  const { user, refetchProfile } = useAuth();
  const queryClient = useQueryClient();
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const {
    data: transactionHistory,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useTransactionHistory(user?.id, 1, 20);

  const balance = user?.money ?? 0;

  // Check claim status on mount or user change
  useEffect(() => {
    if (!user?.id) return;
    setClaimed(false); // Reset on user change
    bankApi
      .getClaimStatus()
      .then((status) => {
        if (!status.canClaim) setClaimed(true);
      })
      .catch(() => {
        // Silently ignore — default to claimable
      });
  }, [user?.id]);

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError(null);
    try {
      const result = await bankApi.claimWeekly();
      setClaimed(true);
      // Immediately apply the authoritative newBalance from the claim response so the
      // displayed balance updates even if the background refetch is slow or fails.
      queryClient.setQueryData(
        ['profile'],
        (old: { user: Record<string, unknown> } | undefined) => {
          if (!old?.user) return old;
          return { ...old, user: { ...old.user, money: result.newBalance } };
        }
      );
      // Background syncs — failures are non-fatal; cache is already correct above.
      void Promise.allSettled([refetchTransactions(), refetchProfile()]);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Failed to claim reward. Please try again.';
      setClaimError(msg);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <PageContainer variant="content" data-testid="bank-page">
      <PageHeader
        title="The Vault"
        subtitle="Manage your coins, claim weekly rewards, and review your account ledger."
        icon={<Coins className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
        breadcrumbs={
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Link to="/" className="hover:text-[var(--text-primary)] transition-colors">
              Home
            </Link>
            <span className="opacity-40">/</span>
            <span className="text-[var(--text-primary)]">Bank</span>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        {/* Balance Card */}
        <Surface
          variant="panel"
          className="relative p-8 overflow-hidden"
          data-testid="balance-card"
        >
          {/* Subtle gold glow behind balance */}
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
            aria-hidden="true"
            style={{
              background: 'radial-gradient(circle, var(--glass-glow) 0%, transparent 60%)',
            }}
          />
          <div className="relative">
            <p className="type-label mb-2">Current Balance</p>
            <p
              className="mb-1"
              data-testid="balance-amount"
              style={{ textShadow: '0 0 30px var(--gold-dim)' }}
            >
              <Currency
                amount={balance}
                variant="balance"
                className="text-5xl font-[var(--font-heading)]"
              />
            </p>
          </div>
        </Surface>

        {/* Weekly Reward Claim */}
        <Surface variant="panel" data-testid="weekly-reward-section">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <IconBox variant="accent" size="md">
                <Gift />
              </IconBox>
              <div>
                <h2 className="type-card-title">Weekly Reward</h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  {claimed
                    ? 'Claimed! Come back next week for your next reward.'
                    : 'Claim your 500 coin weekly reward. Resets every Sunday.'}
                </p>
              </div>
            </div>
            {/* Single gold primary on this surface (DECISIONS.md §5) */}
            <Button
              type="button"
              onClick={handleClaim}
              disabled={claimed}
              pending={claiming}
              className="flex-shrink-0"
              data-testid="claim-button"
              data-onboarding-target="bank-claim-button"
            >
              {claimed ? (
                <>
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  Claimed
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" aria-hidden="true" />
                  Claim +500
                </>
              )}
            </Button>
          </div>
          {claimError && <p className="text-xs text-role-danger mt-3">{claimError}</p>}
        </Surface>

        {/* Transaction History */}
        <section data-testid="transaction-history">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-[var(--gold-500)]" />
            <h2 className="type-label">Recent Transactions</h2>
          </div>
          <div className="space-y-2">
            {transactionsLoading && (
              <Surface variant="subtle" className="p-6">
                <SectionLoading label="Loading transactions" minHeight="80px" />
              </Surface>
            )}
            {!transactionsLoading && (transactionHistory?.transactions.length ?? 0) === 0 && (
              <EmptyState
                variant="first-use"
                icon={<Coins className="h-8 w-8" aria-hidden="true" />}
                title="No transactions yet"
                description="Claim a reward or enter a competition to start your ledger."
              />
            )}
            {transactionHistory?.transactions.map((tx) => (
              <Surface
                variant="subtle"
                key={tx.id}
                className="flex items-center justify-between p-4"
                data-testid={`transaction-${tx.id}`}
              >
                <div className="flex items-center gap-3">
                  <IconBox variant={tx.type === 'credit' ? 'success' : 'danger'} size="sm">
                    {tx.type === 'credit' ? (
                      <ArrowDownLeft aria-hidden="true" />
                    ) : (
                      <ArrowUpRight aria-hidden="true" />
                    )}
                  </IconBox>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {tx.description}
                    </p>
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {new Date(tx.timestamp).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {tx.balanceAfter !== null && (
                        <span className="ml-2">
                          Balance <Currency amount={tx.balanceAfter} showIcon={false} />
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <Currency
                  amount={tx.type === 'credit' ? tx.amount : -tx.amount}
                  variant="signed"
                  showIcon={false}
                  className="text-base font-bold"
                />
              </Surface>
            ))}
          </div>
        </section>

        {/* Info Panel */}
        <Surface variant="subtle" className="p-5 text-sm text-[var(--text-muted)]">
          <h3 className="type-label mb-2">About the Vault</h3>
          <ul className="space-y-1 list-disc list-inside text-xs leading-relaxed">
            <li>Coins are earned through competitions, breeding sales, and weekly rewards</li>
            <li>Weekly rewards of 500 coins reset every Sunday at midnight</li>
            <li>Transaction history is persisted to your account ledger</li>
            <li>Coins are spent at the Tack Shop, Vet Clinic, Feed Shop, and Farrier</li>
            <li>Larger balances unlock access to premium auctions and breeding fees</li>
          </ul>
        </Surface>
      </div>
    </PageContainer>
  );
};

export default BankPage;
