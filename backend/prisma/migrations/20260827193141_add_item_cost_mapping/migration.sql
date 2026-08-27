-- CreateTable
CREATE TABLE "ItemCostMapping" (
    "id" TEXT NOT NULL,
    "itemGuid" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCostMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemCostMapping_itemGuid_key" ON "ItemCostMapping"("itemGuid");
