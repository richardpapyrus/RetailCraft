/*
  Warnings:

  - Made the column `storeId` on table `Customer` required. This step will fail if there are existing NULL values in that column.

*/

-- Backfill storeId for existing customers to avoid failures
UPDATE "Customer" c
SET "storeId" = (
  SELECT id FROM "Store" s WHERE s."tenantId" = c."tenantId" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "storeId" IS NULL;

-- Delete any customers that still have NULL storeId (orphans belonging to tenants with no stores)
DELETE FROM "Customer" WHERE "storeId" IS NULL;

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_storeId_fkey";


-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "storeId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
