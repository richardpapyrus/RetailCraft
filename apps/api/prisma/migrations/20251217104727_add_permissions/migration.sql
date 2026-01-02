-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en-US';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
