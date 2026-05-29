-- Equoria-ezx1y: add indexes for high-traffic Horse WHERE-filter queries.
--
-- Audit 2026-05-28 finding #10 listed 6 candidate indexes. Source audit of
-- actual WHERE-clause sites in production code narrowed that to 3 with a
-- real query basis. The other 3 (studStatus, trainingCooldown,
-- pregnancySireId) appear only in SELECT/UPDATE positions; they have no
-- current WHERE filter to optimize and are tracked as a separate follow-up
-- to re-evaluate when the query patterns emerge.
--
-- Each index is cited to the call site that benefits:
--
--   1) sireId  — backend/modules/users/services/gdprAccountService.mjs:286
--      Cascade: prisma.horse.updateMany({ where: { sireId: { in: horseIds } } })
--      A bulk null-ification at user-delete time; pre-index this is a
--      sequential scan over the full horses table per call.
--
--   2) damId   — backend/modules/users/services/gdprAccountService.mjs:282
--      Same shape for the dam side. Also exercised in the load test
--      backend/tests/load/run-bulk-foaling-cron.mjs:168 ("by-dam" filter).
--
--   3) (forSale, salePrice) composite —
--      backend/modules/marketplace/controllers/marketplaceController.mjs:60
--      browseListings: `where: { forSale: true, userId: { not: userId } }`
--      with `orderBy: { salePrice: 'asc' | 'desc' }`. The composite serves
--      both the leading-column filter AND the sort phase; a separate
--      forSale-only index would be redundant under the leading-column rule.
--
-- All 3 are pure CREATE INDEX statements — additive, reversible, no data
-- writes. CONCURRENTLY would be the production-safe variant but is not
-- legal inside a transaction; Prisma wraps each migration in BEGIN/COMMIT,
-- so we use plain CREATE INDEX. The horses table is at single-replica
-- scale where the brief AccessExclusiveLock is acceptable.

CREATE INDEX "horses_sireId_idx" ON "horses" ("sireId");
CREATE INDEX "horses_damId_idx" ON "horses" ("damId");
CREATE INDEX "horses_forSale_salePrice_idx" ON "horses" ("forSale", "salePrice");
