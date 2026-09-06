-- CreateTable
CREATE TABLE "DailyHourlySales" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "netSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "covers" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyHourlySales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyHourlySales_businessDate_idx" ON "DailyHourlySales"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyHourlySales_businessDate_hour_key" ON "DailyHourlySales"("businessDate", "hour");
