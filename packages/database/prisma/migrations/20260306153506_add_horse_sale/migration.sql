-- CreateTable
CREATE TABLE "horse_sales" (
    "id" SERIAL NOT NULL,
    "horseId" INTEGER NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "salePrice" INTEGER NOT NULL,
    "horseName" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horse_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "horse_sales_sellerId_idx" ON "horse_sales"("sellerId");

-- CreateIndex
CREATE INDEX "horse_sales_buyerId_idx" ON "horse_sales"("buyerId");

-- CreateIndex
CREATE INDEX "horse_sales_soldAt_idx" ON "horse_sales"("soldAt");

-- AddForeignKey
ALTER TABLE "horse_sales" ADD CONSTRAINT "horse_sales_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horse_sales" ADD CONSTRAINT "horse_sales_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horse_sales" ADD CONSTRAINT "horse_sales_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
