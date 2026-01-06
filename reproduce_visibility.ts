
import { PrismaClient } from '@prisma/client';
import { ProductsService } from './apps/api/src/products/products.service';

const prisma = new PrismaClient();
// Mock the service using the real methods but we need to inject dependencies?
// Service uses "prisma" which is imported from @prisma/client in the file itself?
// No, the file uses `const prisma = new PrismaClient()` globally?
// Let's check `products.service.ts` imports.
// It creates `const prisma = new PrismaClient();` at top level.
// But that might create connection issues if reused.
// Better to just reproduce the QUERY logic using prisma directly in this script.

async function main() {
    const tenantId = 'verify-tenant-' + Date.now();
    const storeId = 'verify-store-' + Date.now();

    // 1. Create Tenant (User?) - usually just string match
    // 2. Create Store
    await prisma.store.create({
        data: {
            id: storeId,
            name: 'Test Store',
            tenantId: tenantId
        }
    });

    // 3. Create Global Product (storeId: null)
    await prisma.product.create({
        data: {
            name: 'Global Product',
            sku: 'GLOBAL-001-' + Date.now(),
            price: 10,
            tenantId: tenantId,
            description: 'Global',
            // storeId is undefined/null by default
        }
    });

    // 4. Run FindAll Query Logic simulating the Service
    // STRICT STORE ISOLATION LOGIC from service:
    /*
    const where: any = { tenantId };
    if (storeId) {
      where.storeId = storeId;
    }
    */

    const whereStrict: any = { tenantId };
    whereStrict.storeId = storeId;

    const countStrict = await prisma.product.count({ where: whereStrict });
    console.log(`Strict Count (Should be 0 if bug exists): ${countStrict}`);

    // 5. Run Proposed Fix Logic
    /*
    where.AND = [
       { OR: [{ storeId: storeId }, { storeId: null }] }
    ]
    */
    const whereFix: any = { tenantId };
    whereFix.OR = [
        { storeId: storeId },
        { storeId: null }
    ];

    const countFix = await prisma.product.count({ where: whereFix });
    console.log(`Fix Count (Should be 1): ${countFix}`);

    // Cleanup
    await prisma.store.delete({ where: { id: storeId } });
    await prisma.product.deleteMany({ where: { tenantId } });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
