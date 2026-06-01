/**
 * API Client for Equoria Frontend
 *
 * Handles all HTTP requests with httpOnly cookie authentication.
 * Automatically includes credentials for cookie-based auth.
 *
 * Security: Uses httpOnly cookies to prevent XSS attacks (tokens not in localStorage)
 *
 * Features:
 * - Auto-retry on 401 with token refresh
 * - Rate limiting (429) with Retry-After support
 * - Comprehensive error handling
 */

// Transport layer extracted to ./http/apiClient (Equoria-rfsml). This file is
// now a compatibility barrel: it re-exports the transport core and hosts the
// domain endpoint wrappers + their response types. New domain clients should
// live in ./api/<domain>.ts and import { apiClient } from the transport module
// (or from this barrel during the incremental migration).
import { apiClient } from './http/apiClient.js';
import type { ApiError, ApiResponse } from './http/types.js';

// Shared API types extracted to ./api/types (Equoria-aodym). Imported here
// for the inline domain wrappers below + normalizeFoalDevelopment, and
// re-exported at the bottom of this barrel so the public type surface is
// unchanged.
import type {
  ActivityFeedItem,
  BreedRequest,
  BreedResponse,
  Competition,
  DashboardData,
  Discipline,
  DisciplineStatus,
  EligibilityResult,
  Foal,
  FoalActivity,
  FoalDevelopment,
  Groom,
  GroomAssignment,
  GroomAssignmentLogEntry,
  GroomMetrics,
  GroomProfile,
  HorseAge,
  HorseProgression,
  HorseStats,
  HorseSummary,
  HorseTrainingAnalytics,
  HorseTrainingHistoryEntry,
  HorseXP,
  HorseXPEvent,
  HorseXPHistory,
  MarketplaceData,
  MarketplaceGroom,
  MarketplaceRider,
  MarketplaceStats,
  RawFoalDevelopmentBody,
  RecentGains,
  Rider,
  RiderAssignment,
  RiderDiscoveryData,
  RiderMarketplaceData,
  SalarySummary,
  StatGain,
  StatHistory,
  TrainableHorse,
  TrainingEligibility,
  TrainingRequest,
  TrainingResult,
  TraitEffects,
  UserProgress,
} from './api/types.js';

// Transport core (refreshAccessToken, sleep, getCsrfToken, fetchWithAuth,
// apiClient) lives in ./http/apiClient (Equoria-rfsml). Re-exported here so
// existing import sites keep resolving `apiClient`, `refreshAccessToken`,
// and `sleep` from this barrel unchanged.
export { refreshAccessToken, sleep } from './http/apiClient.js';
// `apiClient` is imported at the top (domain wrappers below call it directly);
// re-export the already-imported binding so the barrel surface is unchanged.
export { apiClient };

// -- Training --
// Extracted to ./api/training (Equoria-jog8w). Re-exported for barrel compat.
export { trainingApi } from './api/training.js';

// -- Breeding / Foal --
// Extracted to ./api/breeding (Equoria-jog8w). normalizeFoalDevelopment travels
// WITH breedingApi (it is the shared foal-development contract the n3yw6
// sentinel asserts on). Re-exported here — including normalizeFoalDevelopment +
// RawFoalDevelopmentBody at the bottom of this barrel — for barrel compat.
export { breedingApi } from './api/breeding.js';

// -- Ultra-rare traits --
// Extracted to ./api/ultraRareTraits (Equoria-rfsml). Re-exported for barrel compat.
export { ultraRareTraitsApi } from './api/ultraRareTraits.js';
export type { UltraRareTraitEvent, HorseUltraRareTraitsResponse } from './api/ultraRareTraits.js';

// -- Horses --
// Extracted to ./api/horses (Equoria-jog8w). Owns HorseGeneticsResponse +
// HorseColorResponse (31E-4). Re-exported for barrel compat.
export { horsesApi } from './api/horses.js';
export type { HorseGeneticsResponse, HorseColorResponse } from './api/horses.js';

// Rider types live in ./api/types (Equoria-aodym).

// -- Grooms --
// Extracted to ./api/grooms (Equoria-jog8w). Re-exported for barrel compat.
export { groomsApi } from './api/grooms.js';

// -- Riders (Epic 9C) --
// Extracted to ./api/riders (Equoria-jog8w). Re-exported for barrel compat.
export { ridersApi } from './api/riders.js';

// -- Trainers --
// Extracted to ./api/trainers (Equoria-rfsml). Re-exported for barrel compat.
export { trainersApi } from './api/trainers.js';
export type {
  TrainerEntry,
  MarketplaceTrainer,
  TrainerMarketplaceData,
  TrainerAssignmentEntry,
  TrainerDiscoveryCategory,
  TrainerDiscoveryTrait,
  TrainerDiscoverySlot,
  TrainerDiscoveryData,
} from './api/trainers.js';

// ── Vet Clinic ────────────────────────────────────────────────────────────────
// Extracted to ./api/vet (Equoria-rfsml). Re-exported for barrel compat.
export { vetApi } from './api/vet.js';
export type { VetService, VetAppointmentResult } from './api/vet.js';

// -- Breeds --
// Extracted to ./api/breeds (Equoria-jog8w). Re-exported for barrel compat.
export { breedsApi } from './api/breeds.js';
export type { Breed } from './api/breeds.js';

// -- Horse Marketplace (Epic 21) --
// Extracted to ./api/horseMarketplace (Equoria-jog8w). Re-exported for barrel compat.
export { horseMarketplaceApi } from './api/horseMarketplace.js';
export type {
  MarketplaceListing,
  MarketplacePagination,
  MarketplaceBrowseResult,
  MarketplaceBrowseFilters,
  MyListing,
  SaleHistoryEntry,
  BuyHorseResult,
} from './api/horseMarketplace.js';

// -- Tack Shop --
// Extracted to ./api/tackShop (Equoria-rfsml). Re-exported for barrel compat.
export { tackShopApi } from './api/tackShop.js';
export type {
  TackItem,
  TackInventoryData,
  TackPurchaseResult,
  TackUnequipDecorationResult,
} from './api/tackShop.js';

// ── Farrier ───────────────────────────────────────────────────────────────────
// Extracted to ./api/farrier (Equoria-rfsml). Re-exported for barrel compat.
export { farrierApi } from './api/farrier.js';
export type { FarrierService, FarrierBookingResult } from './api/farrier.js';

// -- Feed Shop / per-horse feed --
// Extracted to ./api/feedShop (Equoria-rfsml). Re-exported for barrel compat.
export { feedShopApi, horseFeedApi } from './api/feedShop.js';
export type {
  FeedItem,
  FeedPurchaseResult,
  FeedHorseResponse,
  EquippableResponse,
} from './api/feedShop.js';

// -- Inventory --
// Extracted to ./api/inventory (Equoria-rfsml). Re-exported for barrel compat.
export { inventoryApi } from './api/inventory.js';
export type { InventoryItem, InventoryData, EquipResult, UnequipResult } from './api/inventory.js';

// -- Forum / Direct Messages / Bank --
// Extracted to ./api/{forum,messages,bank} (Equoria-rfsml). Re-exported for
// barrel compat.
export { forumApi } from './api/forum.js';
export type {
  ForumSection,
  ForumAuthor,
  ForumThread,
  ForumPost,
  ThreadsResponse,
  ThreadDetailResponse,
  CreateThreadRequest,
} from './api/forum.js';
export { messagesApi } from './api/messages.js';
export type {
  DirectMessageUser,
  DirectMessage,
  InboxResponse,
  SendMessageRequest,
} from './api/messages.js';
export { bankApi } from './api/bank.js';
export type {
  WeeklyClaimResponse,
  ClaimStatusResponse,
  TransactionHistoryItem,
  TransactionHistoryResponse,
} from './api/bank.js';

// -- Clubs --
// Extracted to ./api/clubs (Equoria-rfsml). Re-exported for barrel compat.
export { clubsApi } from './api/clubs.js';
export type {
  ClubType,
  ClubRole,
  ElectionStatus,
  Club,
  ClubMembership,
  ClubMember,
  ClubElection,
  ElectionCandidate,
} from './api/clubs.js';

// -- User Progress --
// Extracted to ./api/userProgress (Equoria-jog8w). Re-exported for barrel compat.
export { userProgressApi } from './api/userProgress.js';

// -- Competitions --
// Extracted to ./api/competitionsApi (Equoria-jog8w). Re-exported for barrel
// compat. (Distinct from ./api/competitions.ts, which hosts the standalone
// fetchCompetitions/... function surface.)
export { competitionsApi } from './api/competitionsApi.js';
export type { ShowFieldEntry, ShowFieldResponse } from './api/competitionsApi.js';

// -- Conformation Shows --
// Extracted to ./api/conformationShows (Equoria-rfsml). Re-exported for barrel compat.
export { conformationShowsApi } from './api/conformationShows.js';
export type {
  ConformationShowEntryPayload,
  ConformationShowEntryResult,
  ConformationShowEligibilityResult,
  ConformationShowResultEntry,
  ConformationShowExecuteResult,
  ConformationShowTitlesResult,
} from './api/conformationShows.js';

// -- Breeding Prediction --
// Extracted to ./api/breedingPrediction (Equoria-rfsml). Re-exported for barrel compat.
export { breedingPredictionApi } from './api/breedingPrediction.js';
export type {
  InbreedingAnalysis,
  LineageTreeNode,
  LineageAnalysis,
  GeneticProbability,
  BreedingCompatibility,
  BreedingColorPredictionEntry,
  BreedingColorPredictionResult,
} from './api/breedingPrediction.js';

/**
 * Authentication API endpoints
 */
// ── Crafting System ──────────────────────────────────────────────────────────
// Extracted to ./api/crafting (Equoria-rfsml). Re-exported for barrel compat.
export { craftingApi } from './api/crafting.js';
export type {
  CraftingMaterials,
  CraftingRecipe,
  CraftedItem,
  CraftResult,
} from './api/crafting.js';

// -- Auth --
// Extracted to ./api/auth (Equoria-jog8w). Owns the UserPreferences shape
// (Story 21S-5). Re-exported for barrel compat.
export { authApi } from './api/auth.js';
export type { UserPreferences } from './api/auth.js';

// ── User Search ───────────────────────────────────────────────────────────────

// -- Users (search) --
// Extracted to ./api/users (Equoria-rfsml). Re-exported for barrel compat.
export { usersApi } from './api/users.js';

// -- Game Notifications --
// Extracted to ./api/gameNotifications (Equoria-rfsml). Re-exported for barrel compat.
export { gameNotificationsApi } from './api/gameNotifications.js';
export type {
  StatGainNotificationPayload,
  FoalBornNotificationPayload,
  GameNotificationType,
  GameNotification,
  GameNotificationsResponse,
} from './api/gameNotifications.js';

// Equoria-n3yw6: exported for the foal-development contract sentinel test.
// normalizeFoalDevelopment now lives in ./api/breeding (Equoria-jog8w); the
// barrel re-exports it so the sentinel's `@/lib/api-client` import is unchanged.
export { normalizeFoalDevelopment } from './api/breeding.js';
export type { RawFoalDevelopmentBody };

/**
 * Export both for convenience
 */
export default apiClient;
export type {
  ActivityFeedItem,
  ApiError,
  ApiResponse,
  BreedRequest,
  BreedResponse,
  Competition,
  Discipline,
  DisciplineStatus,
  DashboardData,
  EligibilityResult,
  Foal,
  FoalActivity,
  FoalDevelopment,
  Groom,
  GroomAssignment,
  GroomMetrics,
  GroomProfile,
  GroomAssignmentLogEntry,
  HorseAge,
  HorseProgression,
  HorseStats,
  HorseSummary,
  HorseTrainingAnalytics,
  HorseTrainingHistoryEntry,
  HorseXP,
  HorseXPEvent,
  HorseXPHistory,
  MarketplaceGroom,
  MarketplaceData,
  MarketplaceStats,
  Rider,
  RiderAssignment,
  MarketplaceRider,
  RiderMarketplaceData,
  RiderDiscoveryData,
  RecentGains,
  SalarySummary,
  StatGain,
  StatHistory,
  TrainableHorse,
  TrainingEligibility,
  TrainingRequest,
  TrainingResult,
  TraitEffects,
  UserProgress,
};
