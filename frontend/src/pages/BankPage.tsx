/**
 * BankPage — Bank & Currency Hub (Epic 12 — Story 12-1)
 *
 * Displays the player's current coin balance, allows weekly reward claims,
 * and shows a mock transaction history. Backend routes are deferred;
 * the UI is mock-ready pointing at expected /api/bank/* endpoints.
 *
 * Uses Celestial Night theme (consistent with other standalone pages).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Gift, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
}

// Mock transaction history — replaced by live API in Story 12-5 wire-up
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-001',
    type: 'credit',
    amount: 500,
    description: 'Weekly reward claim',
    date: '2026-02-20',
  },
  {
    id: 'tx-002',
    type: 'debit',
    amount: 200,
    description: 'Standard Shoeing — Farrier',
    date: '2026-02-19',
  },
  {
    id: 'tx-003',
    type: 'credit',
    amount: 1200,
    description: 'Competition prize — 1st Place',
    date: '2026-02-18',
  },
  {
    id: 'tx-004',
    type: 'debit',
    amount: 500,
    description: 'Training Saddle — Tack Shop',
    date: '2026-02-17',
  },
  {
    id: 'tx-005',
    type: 'credit',
    amount: 300,
    description: 'Horse sale — Silver Mane',
    date: '2026-02-15',
  },
  {
    id: 'tx-006',
    type: 'debit',
    amount: 150,
    description: 'Health Check — Vet Clinic',
    date: '2026-02-14',
  },
];

// Mock balance — replaced by live useUserProgress hook in Story 12-5 wire-up
const MOCK_BALANCE = 4_850;

const BankPage: React.FC = () => {
  const [claimed, setClaimed] = useState(false);
  const [balance, setBalance] = useState(MOCK_BALANCE);

  const handleClaim = () => {
    // Mock weekly claim — wire to POST /api/bank/claim-weekly in Story 12-5
    setBalance((prev) => prev + 500);
    setClaimed(true);
  };

  return (
    <div className="min-h-screen">
      <MainNavigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/" className="hover:text-white/70 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-white/70">Bank</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-celestial-gold/10 border border-celestial-gold/30">
            <Coins className="w-6 h-6 text-celestial-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white/90">🏦 Bank</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Manage your coins, claim weekly rewards, and review transactions
            </p>
          </div>
        </div>

        {/* Balance Card */}
        <div
          className="bg-white/5 border border-celestial-gold/30 rounded-2xl p-6 mb-6"
          data-testid="balance-card"
        >
          <p className="text-sm font-medium text-white/50 uppercase tracking-widest mb-1">
            Current Balance
          </p>
          <p className="text-5xl font-bold text-celestial-gold mb-2" data-testid="balance-amount">
            {balance.toLocaleString()}
          </p>
          <p className="text-sm text-white/40">Equoria Coins</p>
        </div>

        {/* Weekly Reward Claim */}
        <div
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8"
          data-testid="weekly-reward-section"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Gift className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="font-bold text-white/90">Weekly Reward</h2>
                <p className="text-sm text-white/50 mt-0.5">
                  {claimed
                    ? 'Claimed! Come back next week for your next reward.'
                    : 'Claim your 500 coin weekly reward. Resets every Monday.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClaim}
              disabled={claimed}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                claimed
                  ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-celestial-gold/20 border border-celestial-gold/40 text-celestial-gold hover:bg-celestial-gold/30'
              }`}
              data-testid="claim-button"
            >
              {claimed ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Claimed
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  Claim +500
                </>
              )}
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <section data-testid="transaction-history">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
            Recent Transactions
          </h2>
          <div className="space-y-2">
            {MOCK_TRANSACTIONS.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all"
                data-testid={`transaction-${tx.id}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      tx.type === 'credit'
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}
                  >
                    {tx.type === 'credit' ? (
                      <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/80">{tx.description}</p>
                    <span className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
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
                    tx.type === 'credit' ? 'text-emerald-400' : 'text-red-400'
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
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About the Bank</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Coins are earned through competitions, breeding sales, and weekly rewards</li>
            <li>Weekly rewards of 500 coins reset every Monday at midnight</li>
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
