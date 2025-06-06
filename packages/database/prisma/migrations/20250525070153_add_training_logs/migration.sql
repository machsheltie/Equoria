-- CreateTable
CREATE TABLE "training_logs" (
    "id" SERIAL NOT NULL,
    "discipline" TEXT NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horseId" INTEGER NOT NULL,

    CONSTRAINT "training_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "training_logs" ADD CONSTRAINT "training_logs_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
