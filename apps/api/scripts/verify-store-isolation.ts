import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Verifying Product Isolation...');

    // 1. Setup Tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found');
    console.log(`Using Tenant: ${tenant.id}`);

    // 2. Create Dummy Stores
    const storeA = await prisma.store.create({
        data: { name: 'Test Store A', tenantId: tenant.id }
    });
    const storeB = await prisma.store.create({
        data: { name: 'Test Store B', tenantId: tenant.id }
    });
    console.log(`Created Stores: ${storeA.id}, ${storeB.id}`);

    const commonSku = `TEST-ISO-${Date.now()}`;
    const commonBarcode = `BAR-${Date.now()}`;

    try {
        // 3. Create Product in Store A
        const productA = await prisma.product.create({
            data: {
                name: 'Product A',
                sku: commonSku,
                barcode: commonBarcode,
                price: 100,
                tenantId: tenant.id,
                storeId: storeA.id
            }
        });
        console.log(`✅ Created Product A in Store A (SKU: ${commonSku})`);

        // 4. Create Product in Store B (SAME SKU/BARCODE) -> SHOULD SUCCEED
        const productB = await prisma.product.create({
            data: {
                name: 'Product B',
                sku: commonSku,
                barcode: commonBarcode,
                price: 200,
                tenantId: tenant.id,
                storeId: storeB.id
            }
        });
        console.log(`✅ Created Product B in Store B (SKU: ${commonSku})`);
        console.log('SUCCESS: Different stores can have same SKU.');

        // 5. Create Product in Store A (SAME SKU) -> SHOULD FAIL
        try {
            await prisma.product.create({
                data: {
                    name: 'Product A Duplicate',
                    sku: commonSku,
                    barcode: commonBarcode, // same barcode too
                    price: 100,
                    tenantId: tenant.id,
                    storeId: storeA.id
                }
            });
            console.error('❌ FAILURE: Was able to create duplicate SKU in same store!');
            process.exit(1);
        } catch (e: any) {
            if (e.code === 'P2002') {
                console.log('✅ Correctly prevented duplicate SKU in same store.');
            } else {
                throw e;
            }
        }

    } finally {
        // Cleanup
        console.log('Cleaning up...');
        await prisma.product.deleteMany({
            where: {
                sku: commonSku
            }
        });
        await prisma.store.deleteMany({
            where: {
                id: { in: [storeA.id, storeB.id] }
            }
        });
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
