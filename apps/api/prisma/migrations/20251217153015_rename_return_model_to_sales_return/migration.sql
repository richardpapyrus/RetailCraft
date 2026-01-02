/*
  Warnings:

  - You are about to drop the column `userId` on the `CashTransaction` table. All the data in the column will be lost.
  - You are about to drop the `Return` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReturnItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Return" DROP CONSTRAINT "Return_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Return" DROP CONSTRAINT "Return_saleId_fkey";

-- DropForeignKey
ALTER TABLE "Return" DROP CONSTRAINT "Return_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Return" DROP CONSTRAINT "Return_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnItem" DROP CONSTRAINT "ReturnItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnItem" DROP CONSTRAINT "ReturnItem_returnId_fkey";

-- AlterTable
ALTER TABLE "CashTransaction" DROP COLUMN "userId";

-- DropTable
DROP TABLE "Return";

-- DropTable
DROP TABLE "ReturnItem";

-- CreateTable
CREATE TABLE "SalesReturn" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "refundAmount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SalesReturnItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SalesReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
