-- CreateTable
CREATE TABLE "competition_results" (
    "id" SERIAL NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "placement" TEXT,
    "discipline" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horseId" INTEGER NOT NULL,
    "showId" INTEGER NOT NULL,

    CONSTRAINT "competition_results_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "competition_results" ADD CONSTRAINT "competition_results_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_results" ADD CONSTRAINT "competition_results_showId_fkey" FOREIGN KEY ("showId") REFERENCES "shows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
