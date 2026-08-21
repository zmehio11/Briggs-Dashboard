-- CreateTable
CREATE TABLE "DailySales" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "grossSales" DECIMAL(12,2) NOT NULL,
    "netSales" DECIMAL(12,2) NOT NULL,
    "discounts" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLabor" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "regularHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "totalLaborCost" DECIMAL(12,2) NOT NULL,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLabor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCogs" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailySales_businessDate_key" ON "DailySales"("businessDate");

-- CreateIndex
CREATE INDEX "DailySales_businessDate_idx" ON "DailySales"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLabor_businessDate_key" ON "DailyLabor"("businessDate");

-- CreateIndex
CREATE INDEX "DailyLabor_businessDate_idx" ON "DailyLabor"("businessDate");

-- CreateIndex
CREATE INDEX "DailyCogs_businessDate_idx" ON "DailyCogs"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCogs_businessDate_category_key" ON "DailyCogs"("businessDate", "category");
