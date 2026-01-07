/*
  Warnings:

  - A unique constraint covering the columns `[sku,tenantId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[barcode,tenantId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/

-- Deduplicate SKUs (append suffix to duplicates, keeping the most recent one)
UPDATE "Product" p1
SET sku = sku || '-dup-' || substr(id, 1, 5)
WHERE id NOT IN (
  SELECT id FROM (
     SELECT id, ROW_NUMBER() OVER (PARTITION BY sku, "tenantId" ORDER BY "updatedAt" DESC) as rn
     FROM "Product"
  ) t
  WHERE t.rn = 1
);

-- Deduplicate Barcodes (append suffix to duplicates, keeping the most recent one)
UPDATE "Product" p1
SET barcode = barcode || '-dup-' || substr(id, 1, 5)
WHERE barcode IS NOT NULL AND id NOT IN (
  SELECT id FROM (
     SELECT id, ROW_NUMBER() OVER (PARTITION BY barcode, "tenantId" ORDER BY "updatedAt" DESC) as rn
     FROM "Product"
     WHERE barcode IS NOT NULL
  ) t
  WHERE t.rn = 1
);

-- DropIndex
DROP INDEX IF EXISTS "Product_barcode_key";


-- DropIndex
DROP INDEX IF EXISTS "Product_sku_key";

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_tenantId_key" ON "Product"("sku", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_tenantId_key" ON "Product"("barcode", "tenantId");
