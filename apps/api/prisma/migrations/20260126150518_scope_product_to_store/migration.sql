/*
  Warnings:

  - A unique constraint covering the columns `[sku,storeId,tenantId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[barcode,storeId,tenantId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Product_barcode_tenantId_key";

-- DropIndex
DROP INDEX "Product_sku_tenantId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_storeId_tenantId_key" ON "Product"("sku", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_storeId_tenantId_key" ON "Product"("barcode", "storeId", "tenantId");
