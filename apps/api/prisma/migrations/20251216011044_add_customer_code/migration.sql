/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");
