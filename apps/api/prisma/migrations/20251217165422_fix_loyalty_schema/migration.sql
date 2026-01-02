-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0;
