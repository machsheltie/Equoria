/**
 * BankPage — The Vault
 *
 * Gold-mood atmospheric page for coin management, weekly rewards,
 * and transaction history. Uses live user balance from auth context.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Gift, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useAuth } from '@/contexts/AuthContext';
import { bankApi } from '@/lib/api-client';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
}

const BankPage: React.FC = () => {
  const { user, refetchProfile } = useAuth();
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [recentClaims, setRecentClaims] = useState<Transaction[]>([]);

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
      await bankApi.claimWeekly();
      setClaimed(true);
      // Track this claim in the session transaction list
      setRecentClaims((prev) => [
        {
          id: `claim-${Date.now()}`,
          type: 'credit',
          amount: 500,
          description: 'Weekly reward claim',
          date: new Date().toISOString(),
        },
        ...prev,
      ]);
      // Refresh profile so balance updates across the app immediately
      await refetchProfile();
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
    <div className="min-h-screen">
      <PageHero
        title="The Vault"
        subtitle="Manage your coins, claim weekly rewards, and review your transaction ledger."
        mood="golden"
        icon={<Coins className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      >
        {/* Breadcrumb inside hero */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Link to="/" className="hover:text-[var(--cream)] transition-colors">
            Home
          </Link>
          <span className="opacity-40">/</span>
          <span className="text-[var(--cream)]">Bank</span>
        </div>
      </PageHero>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-6">
        {/* Balance Card */}
        <div
          className="relative glass-panel rounded-2xl p-8 overflow-hidden"
          data-testid="balance-card"
        >
          {/* Subtle gold glow behind balance */}
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
            aria-hidden="true"
            style={{
              background: 'radial-gradient(circle, rgba(201,162,39,0.15) 0%, transparent 60%)',
            }}
          />
          <div className="relative">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-[0.15em] mb-2">
              Current Balance
            </p>
            <p
              className="text-5xl font-bold text-[var(--gold-400)] mb-1 font-[var(--font-heading)]"
              data-testid="balance-amount"
              style={{ textShadow: '0 0 30px rgba(201,162,39,0.3)' }}
            >
              {balance.toLocaleString()}
            </p>
            <p className="text-sm text-[var(--text-muted)]">Equoria Coins</p>
          </div>
        </div>

        {/* Weekly Reward Claim */}
        <div className="glass-panel rounded-2xl p-6" data-testid="weekly-reward-section">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-[rgba(201,162,39,0.25)]"
                style={{
                  background: 'linear-gradient(135deg, rgba(201,162,39,0.12), rgba(10,22,40,0.8))',
                }}
              >
                <Gift className="w-5 h-5 text-[var(--gold-400)]" />
              </div>
              <div>
                <h2 className="font-bold text-[var(--cream)] font-[var(--font-heading)]">
                  Weekly Reward
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  {claimed
                    ? 'Claimed! Come back next week for your next reward.'
                    : 'Claim your 500 coin weekly reward. Resets every Sunday.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClaim}
              disabled={claimed || claiming}
              className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                claimed || claiming
                  ? 'glass-panel-subtle text-[var(--text-muted)] cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)] text-[var(--celestial-navy-900)] hover:brightness-110 hover:shadow-[0_0_14px_rgba(201,162,39,0.3)]'
              }`}
              data-testid="claim-button"
              data-onboarding-target="bank-claim-button"
            >
              {claimed ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Claimed
                </>
              ) : claiming ? (
                <>
                  <Gift className="w-4 h-4 animate-pulse" />
                  Claiming...
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  Claim +500
                </>
              )}
            </button>
          </div>
          {claimError && <p className="text-xs text-[var(--status-error)] mt-3">{claimError}</p>}
        </div>

        {/* Transaction History */}
        <section data-testid="transaction-history">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-[var(--gold-500)]" />
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.12em]">
              Recent Transactions
            </h2>
          </div>
          <div className="space-y-2">
            {recentClaims.length === 0 && (
              <div className="glass-panel-subtle rounded-xl p-6 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  No recent transactions this session.
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">
                  Full transaction history is not available in this beta.
                </p>
              </div>
            )}
            {recentClaims.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 glass-panel-subtle rounded-xl hover:border-[rgba(201,162,39,0.3)] transition-all"
                data-testid={`transaction-${tx.id}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                      tx.type === 'credit'
                        ? 'border-[rgba(76,175,130,0.3)] bg-[rgba(76,175,130,0.08)]'
                        : 'border-[rgba(224,90,90,0.3)] bg-[rgba(224,90,90,0.08)]'
                    }`}
                  >
                    {tx.type === 'credit' ? (
                      <ArrowDownLeft className="w-4 h-4 text-[var(--status-success)]" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-[var(--status-error)]" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--cream)]">{tx.description}</p>
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(tx.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <p
                  className={`text-base font-bold ${
                    tx.type === 'credit'
                      ? 'text-[var(--status-success)]'
                      : 'text-[var(--status-error)]'
                  }`}
                >
                  {tx.type === 'credit' ? '+' : '-'}
                  {tx.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Info Panel */}
        <div className="glass-panel-subtle rounded-xl p-5 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2 font-[var(--font-heading)] text-xs uppercase tracking-wide">
            About the Vault
          </h3>
          <ul className="space-y-1 list-disc list-inside text-xs leading-relaxed">
            <li>Coins are earned through competitions, breeding sales, and weekly rewards</li>
            <li>Weekly rewards of 500 coins reset every Sunday at midnight</li>
            <li>Transaction history shows the last 30 days of activity</li>
            <li>Coins are spent at the Tack Shop, Vet Clinic, Feed Shop, and Farrier</li>
            <li>Larger balances unlock access to premium auctions and breeding fees</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BankPage;
