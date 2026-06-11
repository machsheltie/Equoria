/**
 * HorseTraderPage — Epic 21 extension
 *
 * Game store where players buy a 3-year-old horse of any breed for 1,000 coins.
 * Features a searchable breed dropdown (live breed catalog from useBreeds),
 * mare/stallion toggle, balance display, and post-purchase success state with
 * stable link.
 *
 * Design-system migration (Equoria-o5hub, marketplace family): PageHeader
 * replaces PageHero; PageContainer narrow (focused purchase workflow);
 * Surface(panel) replaces the local glass recipe + inline backdrop blur;
 * canonical form Input; Currency for price/balance; Button replaces the
 * deprecated .btn-cobalt raw button; status-role tokens for feedback boxes.
 *
 * Route: /marketplace/horse-trader
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { Input } from '@/components/ui/form';
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
  const [sex, setSex] = useState<'Mare' | 'Stallion'>('Mare');

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
    <PageContainer variant="narrow" data-testid="horse-trader-page">
      <PageHeader
        title="Horse Trader"
        subtitle={
          breeds.length > 0
            ? `Browse all ${breeds.length.toLocaleString()} breeds. Pick your perfect horse.`
            : 'Browse our breed catalog. Pick your perfect horse.'
        }
        icon={<ShoppingBag className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="mt-6">
        {/* Main purchase card — Surface(panel) owns frame + blur (DECISIONS.md §4) */}
        <Surface variant="panel" className="space-y-6">
          {/* ── Breed selector ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <label
              htmlFor="breed-search"
              className="block text-sm font-semibold text-[var(--text-primary)]"
            >
              Breed
            </label>
            <div className="relative">
              <Input
                id="breed-search"
                type="text"
                placeholder={breedsLoading ? 'Loading breeds…' : 'Search breeds…'}
                value={search}
                disabled={breedsLoading}
                onChange={handleSearchChange}
                onFocus={() => setShowDropdown(true)}
                autoComplete="off"
              />

              {showDropdown && filteredBreeds.length > 0 && (
                <ul
                  className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--bg-card)] shadow-lg"
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
            <div className="flex gap-3" role="group" aria-label="Horse sex">
              {(['Mare', 'Stallion'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSex(option)}
                  aria-pressed={sex === option}
                  className={`flex-1 rounded-[var(--radius-md)] border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    sex === option
                      ? 'border-[var(--gold-400)] bg-[var(--gold-400)] text-[var(--bg-deep-space)]'
                      : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--gold-400)] hover:text-[var(--gold-400)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* ── Price and balance row ───────────────────────────────────────── */}
          <Surface
            variant="subtle"
            className="flex items-center justify-between px-4 py-3"
            data-testid="price-balance-row"
          >
            <span className="text-sm text-[var(--text-secondary)] inline-flex items-center gap-1.5">
              Cost: <Currency amount={STORE_PRICE} className="font-bold text-[var(--gold-400)]" />
            </span>
            <span
              className={`text-sm font-medium inline-flex items-center gap-1.5 ${
                canAfford ? 'text-[var(--text-secondary)]' : 'text-role-danger'
              }`}
            >
              Your balance: <Currency amount={userBalance} />
              {!canAfford && ' ⚠'}
            </span>
          </Surface>

          {/* ── Buy button — single gold primary (DECISIONS.md §5) ─────────── */}
          <Button
            type="button"
            onClick={handleBuy}
            disabled={buyDisabled}
            pending={buyMutation.isPending}
            className="w-full"
            size="lg"
            data-testid="buy-horse-button"
          >
            Buy Horse
          </Button>

          {/* ── Feedback ───────────────────────────────────────────────────── */}
          {purchasedHorseName && (
            <div
              className="rounded-[var(--radius-md)] border border-[var(--role-success-border)] bg-[var(--role-success-bg)] px-4 py-3 text-sm"
              data-testid="purchase-success"
            >
              <p className="font-semibold text-[var(--role-success-text)]">
                🎉 {purchasedHorseName} has been added to your stable!
              </p>
              <Link
                to="/stable"
                className="mt-1 inline-block text-role-link underline underline-offset-2 hover:text-[var(--gold-bright)]"
              >
                View in Stable →
              </Link>
            </div>
          )}

          {errorMessage && (
            <div
              className="rounded-[var(--radius-md)] border border-[var(--role-danger-border)] bg-[var(--role-danger-bg)] px-4 py-3 text-sm text-[var(--role-danger-text)]"
              data-testid="purchase-error"
            >
              {errorMessage}
            </div>
          )}
        </Surface>

        {/* Info blurb */}
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          All horses from the Horse Trader are 3 years old and ready to train. Stats vary by breed.
        </p>
      </div>
    </PageContainer>
  );
};

export default HorseTraderPage;
