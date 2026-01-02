/*
  Warnings:

  - You are about to drop the column `completedAt` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `synced` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `SaleItem` table. All the data in the column will be lost.
  - Added the required column `tenantId` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceAtSale` to the `SaleItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "completedAt",
DROP COLUMN "synced",
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'COMPLETED';

-- AlterTable
ALTER TABLE "SaleItem" DROP COLUMN "price",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "priceAtSale" DECIMAL(65,30) NOT NULL;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
