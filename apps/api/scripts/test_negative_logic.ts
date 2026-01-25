
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNegativeLogic() {
    console.log("Starting Negative Logic Test (CANCELED Sale)...");

    // Cleanup
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No Tenant");

    const store = await prisma.store.create({
        data: { name: "Negative Test Store", tenantId: tenant.id }
    });

    const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) throw new Error("No User");

    try {
        const today = new Date();
        const start = new Date(today); start.setHours(0, 0, 0, 0);
        const end = new Date(today); end.setHours(23, 59, 59, 999);

        // Scenario: Sale was CANCELED (Voided) but has a Return record (maybe auto-generated or manual?)
        // Or user clicked "Refund" then "Cancel"? 
        // Regardless, if Status is CANCELED, it shouldn't affect stats.

        console.log("1. Seeding Sale D (100) -> Status CANCELED");
        const saleD = await prisma.sale.create({
            data: {
                tenantId: tenant.id, storeId: store.id, userId: user.id,
                total: 100,
                status: 'CANCELED',
                payments: { create: [{ method: 'CASH', amount: 100 }] }
            }
        });

        console.log("2. Creating Return for Sale D (100)");
        await prisma.salesReturn.create({
            data: {
                tenantId: tenant.id, storeId: store.id, createdBy: user.id,
                saleId: saleD.id,
                total: 100,
                items: { create: [] }
            }
        });

        console.log("--- RUNNING LOGIC ---");

        // MIMIC CURRENT SERVICE LOGIC
        const sales = await prisma.sale.findMany({
            where: {
                tenantId: tenant.id, storeId: store.id,
                createdAt: { gte: start, lte: end },
                status: { notIn: ['CANCELED', 'CANCELLED', 'PENDING'] } // EXCLUDES Sale D
            },
            include: { items: true, payments: true }
        });

        const returns = await prisma.salesReturn.findMany({
            where: { tenantId: tenant.id, storeId: store.id, createdAt: { gte: start, lte: end } },
            include: { items: true, sale: { include: { payments: true, items: true } } }
        });

        let revenue = 0;
        sales.forEach(s => revenue += Number(s.total));
        returns.forEach(r => {
            // FIX LOGIC APPLIED HERE
            if (['CANCELED', 'CANCELLED', 'PENDING'].includes(r.sale.status)) return;
            revenue -= Number(r.total)
        }); // SHOULD IGNORE Return D

        console.log(`Calculated Revenue: ${revenue}`);
        const expected = 0;

        if (Math.abs(revenue - expected) < 0.01) {
            console.log(`✅ SUCCESS: Revenue is 0. Canceled Sale Return was Ignored.`);
        } else {
            console.error(`❌ FAILURE: Revenue is ${revenue}. Still Negative.`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        // Cleanup based on storeId
        try {
            await prisma.salesReturnItem.deleteMany({ where: { return: { storeId: store.id } } });
            await prisma.salesReturn.deleteMany({ where: { storeId: store.id } });

            const salesInStore = await prisma.sale.findMany({ where: { storeId: store.id }, select: { id: true } });
            const saleIds = salesInStore.map(s => s.id);

            await prisma.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
            await prisma.sale.deleteMany({ where: { storeId: store.id } });
            await prisma.store.delete({ where: { id: store.id } });
        } catch (cleanupError) {
            // ignore
        }
        await prisma.$disconnect();
    }
}

testNegativeLogic();
