/**
 * HorseTraderPage — Epic 21 extension
 *
 * Game store where players buy a 3-year-old horse of any breed for 1,000 coins.
 * Features a searchable breed dropdown (all 320 breeds), mare/stallion toggle,
 * balance display, and post-purchase success state with stable link.
 *
 * Route: /marketplace/horse-trader
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useBreeds, useBuyStoreHorse } from '@/hooks/api/useHorseTrader';
import { useProfile } from '@/hooks/useAuth';

const STORE_PRICE = 1000;

const HorseTraderPage: React.FC = () => {
  const { data: breeds = [], isLoading: breedsLoading } = useBreeds();
  const { data: profileData } = useProfile();
  const buyMutation = useBuyStoreHorse();

  const userBalance = profileData?.user?.money ?? 0;
  const canAfford = userBalance >= STORE_PRICE;

  // Breed combobox state
  const [search, setSearch] = useState('');
  const [selectedBreedId, setSelectedBreedId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Sex toggle state
  const [sex, setSex] = useState<'mare' | 'stallion'>('mare');

  // Purchase result state
  const [purchasedHorseName, setPurchasedHorseName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedBreed = useMemo(
    () => breeds.find((b) => b.id === selectedBreedId) ?? null,
    [breeds, selectedBreedId]
  );

  const filteredBreeds = useMemo(() => {
    if (!search.trim()) return breeds;
    const lower = search.toLowerCase();
    return breeds.filter((b) => b.name.toLowerCase().includes(lower));
  }, [breeds, search]);

  function handleSelectBreed(breedId: number, breedName: string) {
    setSelectedBreedId(breedId);
    setSearch(breedName);
    setShowDropdown(false);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setSelectedBreedId(null); // clear selection when user types
    setShowDropdown(true);
  }

  function handleBuy() {
    if (!selectedBreedId) return;
    setErrorMessage(null);
    setPurchasedHorseName(null);
    buyMutation.mutate(
      { breedId: selectedBreedId, sex },
      {
        onSuccess: (data) => {
          setPurchasedHorseName(data.horse.name);
          setSearch('');
          setSelectedBreedId(null);
        },
        onError: (err: Error) => {
          setErrorMessage(err.message ?? 'Purchase failed. Please try again.');
        },
      }
    );
  }

  const buyDisabled = !selectedBreedId || !canAfford || buyMutation.isPending;

  return (
    <div className="min-h-screen" data-testid="horse-trader-page">
      <PageHero
        title="Horse Trader"
        subtitle="Browse all 320 breeds. Pick your perfect horse."
        mood="golden"
        icon={<ShoppingBag className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Main purchase card */}
        <div
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 space-y-6"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {/* ── Breed selector ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <label
              htmlFor="breed-search"
              className="block text-sm font-semibold text-[var(--text-primary)]"
            >
              Breed
            </label>
            <div className="relative">
              <input
                id="breed-search"
                type="text"
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-400)]"
                placeholder={breedsLoading ? 'Loading breeds…' : 'Search breeds…'}
                value={search}
                disabled={breedsLoading}
                onChange={handleSearchChange}
                onFocus={() => setShowDropdown(true)}
                autoComplete="off"
              />

              {showDropdown && filteredBreeds.length > 0 && (
                <ul
                  className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[var(--glass-border)] bg-[var(--bg-card)] shadow-lg"
                  data-testid="breed-dropdown"
                >
                  {filteredBreeds.map((breed) => (
                    <li key={breed.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--glass-bg)] focus:outline-none focus:bg-[var(--glass-bg)]"
                        onMouseDown={() => handleSelectBreed(breed.id, breed.name)}
                      >
                        {breed.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedBreed && (
              <p className="text-xs text-[var(--text-muted)]">
                Selected:{' '}
                <span className="font-semibold text-[var(--gold-400)]">{selectedBreed.name}</span>
              </p>
            )}
          </div>

          {/* ── Sex toggle ─────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">Sex</span>
            <div className="flex gap-3">
              {(['mare', 'stallion'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSex(option)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    sex === option
                      ? 'border-[var(--gold-400)] bg-[var(--gold-400)] text-black'
                      : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--gold-400)] hover:text-[var(--gold-400)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* ── Price and balance row ───────────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-lg border border-[var(--glass-border)] bg-[var(--bg-card)] px-4 py-3">
            <span className="text-sm text-[var(--text-secondary)]">
              Cost: <span className="font-bold text-[var(--gold-400)]">1,000 coins</span>
            </span>
            <span
              className={`text-sm font-medium ${canAfford ? 'text-[var(--text-secondary)]' : 'text-red-400'}`}
            >
              Your balance: {userBalance.toLocaleString()} coins
              {!canAfford && ' ⚠'}
            </span>
          </div>

          {/* ── Buy button ─────────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleBuy}
            disabled={buyDisabled}
            className="btn-cobalt w-full rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wide transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="buy-horse-button"
          >
            {buyMutation.isPending ? 'Purchasing…' : 'Buy Horse'}
          </button>

          {/* ── Feedback ───────────────────────────────────────────────────── */}
          {purchasedHorseName && (
            <div
              className="rounded-lg border border-green-600 bg-green-900/30 px-4 py-3 text-sm"
              data-testid="purchase-success"
            >
              <p className="font-semibold text-green-300">
                🎉 {purchasedHorseName} has been added to your stable!
              </p>
              <Link
                to="/stable"
                className="mt-1 inline-block text-[var(--gold-400)] underline underline-offset-2 hover:text-[var(--gold-300)]"
              >
                View in Stable →
              </Link>
            </div>
          )}

          {errorMessage && (
            <div
              className="rounded-lg border border-red-600 bg-red-900/30 px-4 py-3 text-sm text-red-300"
              data-testid="purchase-error"
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Info blurb */}
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          All horses from the Horse Trader are 3 years old and ready to train. Stats vary by breed.
        </p>
      </div>
    </div>
  );
};

export default HorseTraderPage;
