/**
 * TraitFilters — type / rarity / source / sort dropdowns for the
 * Genetics tab. Pure presentational; parent owns the state.
 * Equoria-kdduk: extracted from GeneticsTab.tsx.
 */

import React from 'react';
import { Filter } from 'lucide-react';

export type FilterTypeValue = 'all' | 'epigenetic';
export type FilterRarityValue = 'all' | 'common' | 'rare' | 'legendary';
export type FilterSourceValue = 'all' | 'sire' | 'dam' | 'mutation';
export type SortByValue = 'name' | 'rarity' | 'strength' | 'discoveryDate';

interface TraitFiltersProps {
  filterType: FilterTypeValue;
  filterRarity: FilterRarityValue;
  filterSource: FilterSourceValue;
  sortBy: SortByValue;
  onChangeFilterType: (_value: FilterTypeValue) => void;
  onChangeFilterRarity: (_value: FilterRarityValue) => void;
  onChangeFilterSource: (_value: FilterSourceValue) => void;
  onChangeSortBy: (_value: SortByValue) => void;
}

const TraitFilters: React.FC<TraitFiltersProps> = ({
  filterType,
  filterRarity,
  filterSource,
  sortBy,
  onChangeFilterType,
  onChangeFilterRarity,
  onChangeFilterSource,
  onChangeSortBy,
}) => (
  <div className="bg-[rgba(15,35,70,0.4)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
    <div className="flex items-center mb-4">
      <Filter className="w-5 h-5 text-[rgb(160,175,200)] mr-2" />
      <h4 className="font-semibold text-[rgb(220,235,255)]">Filters &amp; Sorting</h4>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Type Filter */}
      <div>
        <label className="block text-sm text-[rgb(160,175,200)] mb-2">Type</label>
        <select
          value={filterType}
          onChange={(e) => onChangeFilterType(e.target.value as FilterTypeValue)}
          className="celestial-input w-full"
        >
          <option value="all">All Types</option>
          <option value="epigenetic">Epigenetic</option>
        </select>
      </div>

      {/* Rarity Filter */}
      <div>
        <label className="block text-sm text-[rgb(160,175,200)] mb-2">Rarity</label>
        <select
          value={filterRarity}
          onChange={(e) => onChangeFilterRarity(e.target.value as FilterRarityValue)}
          className="celestial-input w-full"
        >
          <option value="all">All Rarities</option>
          <option value="common">Common</option>
          <option value="rare">Rare</option>
          <option value="legendary">Legendary</option>
        </select>
      </div>

      {/* Source Filter */}
      <div>
        <label className="block text-sm text-[rgb(160,175,200)] mb-2">Source</label>
        <select
          value={filterSource}
          onChange={(e) => onChangeFilterSource(e.target.value as FilterSourceValue)}
          className="celestial-input w-full"
        >
          <option value="all">All Sources</option>
          <option value="sire">From Sire</option>
          <option value="dam">From Dam</option>
          <option value="mutation">Mutation</option>
        </select>
      </div>

      {/* Sort By */}
      <div>
        <label className="block text-sm text-[rgb(160,175,200)] mb-2">Sort By</label>
        <select
          value={sortBy}
          onChange={(e) => onChangeSortBy(e.target.value as SortByValue)}
          className="celestial-input w-full"
        >
          <option value="name">Name (A-Z)</option>
          <option value="rarity">Rarity (High to Low)</option>
          <option value="strength">Strength (High to Low)</option>
          <option value="discoveryDate">Discovery Date (Recent First)</option>
        </select>
      </div>
    </div>
  </div>
);

export default TraitFilters;
