// The game's temperaments, for the horses module. The one list is
// constants/schema.mjs HORSE_TEMPERAMENT (the owner's competition matrix
// column order); this re-exports it under the name the module has always used.
// Owner ruling 2026-10-21: it moved here when the invented 12-breed table
// (breedGeneticProfiles.mjs), which used to hold a second copy, was deleted.
import { HORSE_TEMPERAMENT_VALUES } from '../../../constants/schema.mjs';

export const TEMPERAMENT_TYPES = HORSE_TEMPERAMENT_VALUES;
