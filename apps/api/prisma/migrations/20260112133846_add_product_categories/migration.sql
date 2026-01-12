/*
  Safe Migration Script:
  1. Create ProductCategory Table
  2. Create "Uncategorized" category for receiving existing products
  3. Add categoryId to Product (Nullable initially)
  4. Backfill categoryId
  5. Enforce Not Null and Constraints
*/

-- 1. CreateTable "ProductCategory"
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- 2. CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_tenantId_key" ON "ProductCategory"("name", "tenantId");

-- 3. AddForeignKey (Tenant)
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. DATA MIGRATION: Create "Uncategorized" for EACH Tenant
INSERT INTO "ProductCategory" ("id", "name", "tenantId", "status", "updatedAt")
SELECT gen_random_uuid(), 'Uncategorized', "id", 'ACTIVE', NOW()
FROM "Tenant";

-- 5. Add Column categoryId (Nullable first)
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

-- 6. DATA MIGRATION: Update Products to point to "Uncategorized"
UPDATE "Product" p
SET "categoryId" = (
    SELECT "id" FROM "ProductCategory" pc
    WHERE pc."tenantId" = p."tenantId" AND pc."name" = 'Uncategorized'
    LIMIT 1
);

-- 7. Enforce NOT NULL (Now possible)
-- Verify no NULLs exist first (Optional safety, mostly for debugging)
-- DELETE FROM "Product" WHERE "categoryId" IS NULL; -- Brutal, but schema requires strictness.

ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- 8. Add Foreign Key Constraint
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. Drop Legacy Column
ALTER TABLE "Product" DROP COLUMN "category";
