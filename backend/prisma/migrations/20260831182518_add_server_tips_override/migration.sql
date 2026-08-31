-- CreateTable
CREATE TABLE "ServerTipsOverride" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "employeeGuid" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "netSales" DECIMAL(12,2),
    "ccTips" DECIMAL(12,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerTipsOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServerTipsOverride_businessDate_idx" ON "ServerTipsOverride"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "ServerTipsOverride_businessDate_employeeGuid_key" ON "ServerTipsOverride"("businessDate", "employeeGuid");
