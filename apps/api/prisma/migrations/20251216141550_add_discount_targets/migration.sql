-- AlterTable
ALTER TABLE "Discount" ADD COLUMN     "targetType" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN     "targetValues" TEXT[];

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" TEXT;
