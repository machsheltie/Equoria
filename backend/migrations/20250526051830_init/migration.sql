-- CreateTable
CREATE TABLE "Horse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "breedId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "stableId" INTEGER,
    "sex" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "genotype" JSONB,
    "phenotypic_markings" JSONB,
    "final_display_color" TEXT,
    "shade" TEXT,
    "image_url" TEXT,
    "trait" TEXT,
    "temperament" TEXT,
    "speed" INTEGER,
    "stamina" INTEGER,
    "agility" INTEGER,
    "balance" INTEGER,
    "precision" INTEGER,
    "intelligence" INTEGER,
    "boldness" INTEGER,
    "flexibility" INTEGER,
    "obedience" INTEGER,
    "focus" INTEGER,
    "strength" INTEGER,
    "endurance" INTEGER,
    "personality" TEXT,
    "total_earnings" DOUBLE PRECISION,
    "sire_id" INTEGER,
    "dam_id" INTEGER,
    "stud_status" TEXT,
    "stud_fee" DOUBLE PRECISION,
    "last_bred_date" TIMESTAMP(3),
    "for_sale" BOOLEAN DEFAULT false,
    "sale_price" DOUBLE PRECISION DEFAULT 0,
    "health_status" TEXT,
    "last_vetted_date" TIMESTAMP(3),
    "tack" JSONB,
    "trainingCooldown" TIMESTAMP(3),
    "earnings" DOUBLE PRECISION DEFAULT 0,
    "rider" JSONB,
    "disciplineScores" JSONB,
    "bond_score" INTEGER DEFAULT 50,
    "stress_level" INTEGER DEFAULT 0,
    "epigenetic_modifiers" JSONB DEFAULT '{"positive": [], "negative": [], "hidden": []}',

    CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breed" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "money" INTEGER NOT NULL DEFAULT 1000,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stable" (
    "id" SERIAL NOT NULL,
    "name" TEXT,

    CONSTRAINT "Stable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shows" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "levelMin" INTEGER NOT NULL,
    "levelMax" INTEGER NOT NULL,
    "entryFee" INTEGER NOT NULL,
    "prize" INTEGER NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hostUserId" TEXT, -- Changed from hostPlayer

    CONSTRAINT "shows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_results" (
    "id" SERIAL NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "placement" TEXT,
    "discipline" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "showName" TEXT NOT NULL,
    "prizeWon" DOUBLE PRECISION DEFAULT 0,
    "statGains" JSONB,
    "horseId" INTEGER NOT NULL,
    "showId" INTEGER NOT NULL,

    CONSTRAINT "competition_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_logs" (
    "id" SERIAL NOT NULL,
    "discipline" TEXT NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horseId" INTEGER NOT NULL,

    CONSTRAINT "training_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foal_development" (
    "id" SERIAL NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "bondingLevel" INTEGER NOT NULL DEFAULT 50,
    "stressLevel" INTEGER NOT NULL DEFAULT 20,
    "completedActivities" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "foalId" INTEGER NOT NULL,

    CONSTRAINT "foal_development_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foal_activities" (
    "id" SERIAL NOT NULL,
    "day" INTEGER NOT NULL,
    "activityType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "bondingChange" INTEGER NOT NULL,
    "stressChange" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foalId" INTEGER NOT NULL,

    CONSTRAINT "foal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foal_training_history" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "bond_change" INTEGER NOT NULL DEFAULT 0,
    "stress_change" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "horse_id" INTEGER NOT NULL,

    CONSTRAINT "foal_training_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Breed_name_key" ON "Breed"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "shows_name_key" ON "shows"("name");

-- CreateIndex
CREATE UNIQUE INDEX "foal_development_foalId_key" ON "foal_development"("foalId");

-- CreateIndex
CREATE INDEX "foal_training_history_horse_id_idx" ON "foal_training_history"("horse_id");

-- CreateIndex
CREATE INDEX "foal_training_history_day_idx" ON "foal_training_history"("day");

-- CreateIndex
CREATE INDEX "foal_training_history_timestamp_idx" ON "foal_training_history"("timestamp");

-- CreateIndex
CREATE INDEX "foal_training_history_horse_id_day_idx" ON "foal_training_history"("horse_id", "day");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_stableId_fkey" FOREIGN KEY ("stableId") REFERENCES "Stable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_results" ADD CONSTRAINT "competition_results_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_results" ADD CONSTRAINT "competition_results_showId_fkey" FOREIGN KEY ("showId") REFERENCES "shows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_logs" ADD CONSTRAINT "training_logs_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foal_development" ADD CONSTRAINT "foal_development_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foal_activities" ADD CONSTRAINT "foal_activities_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foal_training_history" ADD CONSTRAINT "foal_training_history_horse_id_fkey" FOREIGN KEY ("horse_id") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
