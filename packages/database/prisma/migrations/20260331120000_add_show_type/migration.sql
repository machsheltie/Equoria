-- AddColumn showType to Show model
-- Values: 'ridden' (default discipline scoring), 'conformation', 'parade' (presentation scoring)
ALTER TABLE "shows" ADD COLUMN "showType" TEXT NOT NULL DEFAULT 'ridden';
