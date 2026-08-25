-- CreateTable
CREATE TABLE "RecipeCost" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "recipeName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "unitCost" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "categoryType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeCost_recipeId_key" ON "RecipeCost"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeCost_normalizedName_idx" ON "RecipeCost"("normalizedName");
