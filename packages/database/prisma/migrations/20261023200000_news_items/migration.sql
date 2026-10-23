-- Equoria-wbt8l — owner rulings 2026-10-23 (Stacey): a News page. The owner
-- (Head Admin) and Admins write posts at a News Desk (seasonal event,
-- announcement, contest, store); the game writes short entries at the start of
-- each Eastern game day (elections opening, run-off results, new store items,
-- a new seasonal event). The owner approved this table's migration.
--
-- Additive only: one new table, its indexes and one FK to "User".
--   postType   — plain text, checked by backend/modules/news (no enum, so a
--                new post type needs no migration)
--   tiles      — seasonal-event image tiles, [{ imageUrl, caption }]
--   authorName / authorRoleLabel — signature snapshot; the FK is SET NULL on
--                account erasure so the post keeps its signature
--   endsAt     — when what the post announces ends ("Ahead" on the page)
--   sourceKey  — game entries only; UNIQUE so the nightly job is idempotent
--   publishAt  — visible to players from this instant on

-- CreateTable
CREATE TABLE "news_items" (
    "id" SERIAL NOT NULL,
    "postType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tiles" JSONB NOT NULL DEFAULT '[]',
    "authorUserId" TEXT,
    "authorName" TEXT,
    "authorRoleLabel" TEXT,
    "linkPath" TEXT,
    "endsAt" TIMESTAMP(3),
    "sourceKey" TEXT,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_items_sourceKey_key" ON "news_items"("sourceKey");

-- CreateIndex
CREATE INDEX "news_items_publishAt_id_idx" ON "news_items"("publishAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "news_items_endsAt_idx" ON "news_items"("endsAt");

-- CreateIndex
CREATE INDEX "news_items_authorUserId_idx" ON "news_items"("authorUserId");

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
