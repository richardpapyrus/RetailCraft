-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "costAtSale" DECIMAL(65,30) NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT;
