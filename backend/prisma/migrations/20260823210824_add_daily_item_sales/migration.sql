-- CreateTable
CREATE TABLE "DailyItemSales" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "itemGuid" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyItemSales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyItemSales_businessDate_idx" ON "DailyItemSales"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyItemSales_businessDate_itemGuid_key" ON "DailyItemSales"("businessDate", "itemGuid");
