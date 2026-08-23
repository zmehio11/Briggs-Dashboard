-- CreateTable
CREATE TABLE "TransactionFlag" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "orderGuid" TEXT NOT NULL,
    "checkGuid" TEXT NOT NULL,
    "employeeGuid" TEXT,
    "employeeName" TEXT,
    "flagType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionFlag_businessDate_idx" ON "TransactionFlag"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionFlag_checkGuid_flagType_key" ON "TransactionFlag"("checkGuid", "flagType");
