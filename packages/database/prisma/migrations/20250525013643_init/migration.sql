-- CreateTable
CREATE TABLE "Horse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "breedId" INTEGER NOT NULL,
    "playerId" TEXT,
    "ownerId" INTEGER,
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
    "precision" INTEGER,
    "strength" INTEGER,
    "speed" INTEGER,
    "agility" INTEGER,
    "endurance" INTEGER,
    "intelligence" INTEGER,
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

    CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "money" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "settings" JSONB NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
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
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "email" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stable" (
    "id" SERIAL NOT NULL,
    "name" TEXT,

    CONSTRAINT "Stable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_email_key" ON "players"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_name_key" ON "Breed"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_stableId_fkey" FOREIGN KEY ("stableId") REFERENCES "Stable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
