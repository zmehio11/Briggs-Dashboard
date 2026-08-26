-- CreateTable
CREATE TABLE "OutreachContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not Contacted',
    "contactInfo" TEXT,
    "notes" TEXT,
    "lastContactDate" DATE,
    "nextActionDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachContact_status_idx" ON "OutreachContact"("status");
