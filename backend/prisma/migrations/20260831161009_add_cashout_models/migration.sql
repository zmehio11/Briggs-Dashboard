-- CreateTable
CREATE TABLE "DailyCashout" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "foodSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "liquorSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "wineSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "beerSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "naBevSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discounts" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "voids" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ccTipsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cardPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "covers" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCashout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyServerTips" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "employeeGuid" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "netSales" DECIMAL(12,2) NOT NULL,
    "ccTips" DECIMAL(12,2) NOT NULL,
    "houseCutPct" DECIMAL(5,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyServerTips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEmployeeTipHours" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "positionName" TEXT NOT NULL,
    "pool" TEXT,
    "hours" DECIMAL(8,2) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyEmployeeTipHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLeadershipPresence" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "leaderName" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLeadershipPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyCashout_businessDate_key" ON "DailyCashout"("businessDate");

-- CreateIndex
CREATE INDEX "DailyServerTips_businessDate_idx" ON "DailyServerTips"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyServerTips_businessDate_employeeGuid_key" ON "DailyServerTips"("businessDate", "employeeGuid");

-- CreateIndex
CREATE INDEX "DailyEmployeeTipHours_businessDate_idx" ON "DailyEmployeeTipHours"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEmployeeTipHours_businessDate_employeeId_positionName_key" ON "DailyEmployeeTipHours"("businessDate", "employeeId", "positionName");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLeadershipPresence_businessDate_leaderName_key" ON "DailyLeadershipPresence"("businessDate", "leaderName");
