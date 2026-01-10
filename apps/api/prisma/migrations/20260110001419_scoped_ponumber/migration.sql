/*
  Warnings:

  - A unique constraint covering the columns `[poNumber,tenantId]` on the table `PurchaseOrder` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PurchaseOrder_poNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_tenantId_key" ON "PurchaseOrder"("poNumber", "tenantId");
