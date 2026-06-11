/**
 * TraitFilters — type / rarity / source / sort dropdowns for the
 * Genetics tab. Pure presentational; parent owns the state.
 * Equoria-kdduk: extracted from GeneticsTab.tsx.
 *
 * Design-system migration (Equoria-o5hub.20): celestial-input selects →
 * canonical FormField + Select (D-13); Surface subtle replaces the local
 * panel recipe; role tokens replace raw rgb values.
 */

import React from 'react';
import { Filter } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { FormField, Select } from '@/components/ui/form';

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
  <Surface variant="subtle" className="p-4">
    <div className="flex items-center mb-4">
      <Filter className="w-5 h-5 text-role-secondary mr-2" aria-hidden="true" />
      <h4 className="font-semibold text-role-primary">Filters &amp; Sorting</h4>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Type Filter */}
      <FormField label="Type">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={filterType}
            onChange={(e) => onChangeFilterType(e.target.value as FilterTypeValue)}
          >
            <option value="all">All Types</option>
            <option value="epigenetic">Epigenetic</option>
          </Select>
        )}
      </FormField>

      {/* Rarity Filter */}
      <FormField label="Rarity">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={filterRarity}
            onChange={(e) => onChangeFilterRarity(e.target.value as FilterRarityValue)}
          >
            <option value="all">All Rarities</option>
            <option value="common">Common</option>
            <option value="rare">Rare</option>
            <option value="legendary">Legendary</option>
          </Select>
        )}
      </FormField>

      {/* Source Filter */}
      <FormField label="Source">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={filterSource}
            onChange={(e) => onChangeFilterSource(e.target.value as FilterSourceValue)}
          >
            <option value="all">All Sources</option>
            <option value="sire">From Sire</option>
            <option value="dam">From Dam</option>
            <option value="mutation">Mutation</option>
          </Select>
        )}
      </FormField>

      {/* Sort By */}
      <FormField label="Sort By">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={sortBy}
            onChange={(e) => onChangeSortBy(e.target.value as SortByValue)}
          >
            <option value="name">Name (A-Z)</option>
            <option value="rarity">Rarity (High to Low)</option>
            <option value="strength">Strength (High to Low)</option>
            <option value="discoveryDate">Discovery Date (Recent First)</option>
          </Select>
        )}
      </FormField>
    </div>
  </Surface>
);

export default TraitFilters;
