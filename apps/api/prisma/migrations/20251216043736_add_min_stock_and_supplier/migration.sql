-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "minStockLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "supplierId" TEXT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
