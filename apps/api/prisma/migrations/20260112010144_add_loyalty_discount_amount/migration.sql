-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isLoyaltyMember" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "loyaltyDiscountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "loyaltyEarnRate" DECIMAL(65,30) NOT NULL DEFAULT 1.0,
ADD COLUMN     "loyaltyExpiryDays" INTEGER NOT NULL DEFAULT 365,
ADD COLUMN     "loyaltyRedeemRate" DECIMAL(65,30) NOT NULL DEFAULT 0.10;
