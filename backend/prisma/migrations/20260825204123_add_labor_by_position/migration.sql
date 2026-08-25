-- CreateTable
CREATE TABLE "DailyLaborByPosition" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "positionName" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLaborByPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyLaborByPosition_businessDate_idx" ON "DailyLaborByPosition"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLaborByPosition_businessDate_positionName_key" ON "DailyLaborByPosition"("businessDate", "positionName");
