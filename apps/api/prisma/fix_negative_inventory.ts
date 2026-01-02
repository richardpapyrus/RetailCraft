import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking for negative inventory...');

    // Find a valid user for the event log
    const adminUser = await prisma.user.findFirst();
    if (!adminUser) {
        console.error('No users found in database. Cannot create audit trail.');
        return;
    }

    // Find all negative inventory records
    const negativeInventory = await prisma.inventory.findMany({
        where: {
            quantity: { lt: 0 }
        },
        include: { product: true }
    });

    console.log(`Found ${negativeInventory.length} products with negative inventory.`);

    for (const record of negativeInventory) {
        const adjustment = Math.abs(record.quantity);
        console.log(`🛠️ Fixing ${record.product.name} (SKU: ${record.product.sku}): ${record.quantity} -> 0 (Adjusting by +${adjustment})`);

        // Transaction: Update Inventory & Log Event
        await prisma.$transaction([
            prisma.inventory.update({
                where: { id: record.id },
                data: { quantity: 0 }
            }),
            prisma.inventoryEvent.create({
                data: {
                    type: 'ADJUSTMENT',
                    quantity: adjustment,
                    reason: 'System Correction: Fix Negative Inventory',
                    storeId: record.storeId,
                    productId: record.productId,
                    userId: adminUser.id
                }
            })
        ]);
    }

    console.log('✅ Inventory correction complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
