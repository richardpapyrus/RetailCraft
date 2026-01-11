
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TARGET_STORE_ID = "7e422ba7-4ae7-4dda-9e27-1a29d2ee4fa5"; // Branch Location

async function main() {
  console.log(`Migrating Global Data to Store: ${TARGET_STORE_ID}...`);

  // 1. Products
  const products = await prisma.product.updateMany({
    where: { storeId: null },
    data: { storeId: TARGET_STORE_ID }
  });
  console.log(`✅ Migrated ${products.count} Products`);

  // 2. Suppliers
  const suppliers = await prisma.supplier.updateMany({
    where: { storeId: null },
    data: { storeId: TARGET_STORE_ID }
  });
  console.log(`✅ Migrated ${suppliers.count} Suppliers`);



  console.log("Migration Complete.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
