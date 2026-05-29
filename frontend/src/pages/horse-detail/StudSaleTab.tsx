/**
 * StudSaleTab — listing-options panel (stud + sale + conformation-title
 * surfacing + marketplace link). Story 12-4 / 15-5 / Equoria-q072.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useListAtStud, useUnlistAtStud } from '@/hooks/api/useStudListing';
import type { Horse } from './HorseDetailPageTypes';

interface StudSaleTabProps {
  horse: Horse;
  onListForSale: () => void;
  onDelist: () => void;
  isDelisting: boolean;
}

const StudSaleTab: React.FC<StudSaleTabProps> = ({
  horse,
  onListForSale,
  onDelist,
  isDelisting,
}) => {
  const isMale =
    horse.gender?.toLowerCase() === 'stallion' || horse.gender?.toLowerCase() === 'male';
  const isFemale =
    horse.gender?.toLowerCase() === 'mare' || horse.gender?.toLowerCase() === 'female';

  // Equoria-q072: real stud listing wiring (replaces toast.info placeholder)
  const listAtStud = useListAtStud();
  const unlistAtStud = useUnlistAtStud();
  const [showStudForm, setShowStudForm] = useState(false);
  const [studFeeInput, setStudFeeInput] = useState('');
  const isAtStud = typeof horse.studStatus === 'string' && horse.studStatus !== 'Not at Stud';

  const handleSubmitStudListing = (e: React.FormEvent) => {
    e.preventDefault();
    const fee = Number(studFeeInput);
    if (!Number.isInteger(fee) || fee < 0) {
      toast.error('Stud fee must be a non-negative integer');
      return;
    }
    listAtStud.mutate(
      { horseId: horse.id, studFee: fee },
      {
        onSuccess: () => {
          setShowStudForm(false);
          setStudFeeInput('');
        },
      }
    );
  };

  return (
    <div className="space-y-6" data-testid="stud-sale-tab">
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-2">Listing Options</h3>
        <p className="fantasy-body text-[var(--text-secondary)] text-sm">
          List {horse.name} for outright sale, manage active listings, and browse the marketplace.
        </p>
      </div>

      {/* Current Listing Status */}
      <div className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]">
        <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">
          Current Status
        </p>
        <p className="fantasy-title text-lg text-[var(--text-primary)]">
          {horse.forSale
            ? `Listed for ${(horse.salePrice ?? 0).toLocaleString()} coins`
            : 'Not Listed'}
        </p>
        {isAtStud && (
          <p
            className="fantasy-body text-[var(--text-secondary)] text-sm mt-1"
            data-testid="stud-current-status"
          >
            At stud · Fee: {(horse.studFee ?? 0).toLocaleString()} coins
          </p>
        )}
      </div>

      {/* Equoria-8xfo (31F-FE-2) — Conformation Titles block. Hidden when
          horse has never been entered in a conformation show
          (titlePoints === 0 && currentTitle == null). */}
      {((horse.titlePoints ?? 0) > 0 || horse.currentTitle) && (
        <div
          className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--gold-dim)]"
          data-testid="conformation-titles-block"
        >
          <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-2">
            Conformation Titles
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="fantasy-caption text-[var(--text-secondary)] text-[0.65rem] uppercase">
                Current Title
              </p>
              <p
                className="fantasy-title text-lg text-[var(--gold-light)]"
                data-testid="conformation-current-title"
              >
                {horse.currentTitle ?? '—'}
              </p>
            </div>
            <div>
              <p className="fantasy-caption text-[var(--text-secondary)] text-[0.65rem] uppercase">
                Title Points
              </p>
              <p
                className="fantasy-title text-lg text-[var(--text-primary)]"
                data-testid="conformation-title-points"
              >
                {(horse.titlePoints ?? 0).toLocaleString()}
              </p>
            </div>
            {horse.breedingValueBoost && horse.breedingValueBoost > 0 ? (
              <div>
                <p className="fantasy-caption text-[var(--text-secondary)] text-[0.65rem] uppercase">
                  Breeding Value Boost
                </p>
                <p
                  className="fantasy-title text-lg text-emerald-400"
                  data-testid="conformation-breeding-boost"
                >
                  +{(horse.breedingValueBoost * 100).toFixed(0)}%
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Listing Type Buttons */}
      <div className="space-y-3">
        {isMale && !isAtStud && !showStudForm && (
          <button
            type="button"
            onClick={() => setShowStudForm(true)}
            className="w-full flex items-center justify-between p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] text-left hover:border-[var(--glass-hover)] transition-colors"
            title="List this stallion at public stud"
            data-testid="stud-listing-btn"
          >
            <div>
              <p className="fantasy-title text-[var(--text-primary)] text-sm">
                Offer as Stud Service
              </p>
              <p className="fantasy-body text-[var(--text-secondary)] text-xs mt-0.5">
                Other players can pay a breeding fee to use {horse.name}
              </p>
            </div>
            <span className="text-xs fantasy-caption text-[var(--text-secondary)]">Breeding</span>
          </button>
        )}

        {isMale && showStudForm && (
          <form
            onSubmit={handleSubmitStudListing}
            className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] space-y-3"
            data-testid="stud-listing-form"
          >
            <label className="block">
              <span className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                Stud fee (coins)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={studFeeInput}
                onChange={(e) => setStudFeeInput(e.target.value)}
                placeholder="e.g. 5000"
                className="mt-1 w-full p-2 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)] text-[var(--text-primary)]"
                data-testid="stud-fee-input"
                required
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={listAtStud.isPending}
                className="flex-1 px-3 py-2 bg-[var(--accent-primary)] text-white rounded fantasy-title text-sm disabled:opacity-50"
                data-testid="stud-listing-submit"
              >
                {listAtStud.isPending ? 'Listing…' : 'List at Stud'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStudForm(false);
                  setStudFeeInput('');
                }}
                disabled={listAtStud.isPending}
                className="flex-1 px-3 py-2 bg-[var(--glass-surface-subtle-bg)] rounded fantasy-title text-sm border border-[var(--glass-border)]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {isMale && isAtStud && (
          <button
            type="button"
            onClick={() => unlistAtStud.mutate(horse.id)}
            disabled={unlistAtStud.isPending}
            className="w-full flex items-center justify-between p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] text-left hover:border-[var(--glass-hover)] transition-colors"
            title="Remove stud listing"
            data-testid="stud-unlist-btn"
          >
            <div>
              <p className="fantasy-title text-[var(--text-primary)] text-sm">
                Remove Stud Listing
              </p>
              <p className="fantasy-body text-[var(--text-secondary)] text-xs mt-0.5">
                Take {horse.name} off the public stud roster
              </p>
            </div>
            <span className="text-xs fantasy-caption text-[var(--text-secondary)]">
              {unlistAtStud.isPending ? 'Saving…' : 'Unlist'}
            </span>
          </button>
        )}

        {!isFemale && !isMale && (
          <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)]">
            <p className="fantasy-body text-[var(--text-secondary)] text-sm italic">
              Stud listing is only available for stallions.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={horse.forSale ? onDelist : onListForSale}
          disabled={isDelisting}
          className="w-full flex items-center justify-between p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] text-left hover:border-[var(--glass-hover)] transition-colors"
          title={horse.forSale ? 'Remove marketplace listing' : 'List horse for sale'}
          data-testid="sale-listing-btn"
        >
          <div>
            <p className="fantasy-title text-[var(--text-primary)] text-sm">
              {horse.forSale ? 'Remove Sale Listing' : 'List for Sale'}
            </p>
            <p className="fantasy-body text-[var(--text-secondary)] text-xs mt-0.5">
              {horse.forSale
                ? 'Take this horse off the Marketplace'
                : `Place ${horse.name} on the Marketplace for other players to purchase`}
            </p>
          </div>
          <span className="text-xs fantasy-caption text-[var(--text-secondary)]">
            {isDelisting ? 'Saving...' : horse.forSale ? 'Delist' : 'Set Price'}
          </span>
        </button>
      </div>

      {/* Marketplace Link */}
      <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] flex items-center justify-between">
        <div>
          <p className="fantasy-title text-[var(--text-primary)] text-sm">Browse the Marketplace</p>
          <p className="fantasy-body text-[var(--text-secondary)] text-sm">
            See horses listed for sale by other players.
          </p>
        </div>
        <Button asChild>
          <Link to="/marketplace/horses">Marketplace</Link>
        </Button>
      </div>
    </div>
  );
};

export default StudSaleTab;
